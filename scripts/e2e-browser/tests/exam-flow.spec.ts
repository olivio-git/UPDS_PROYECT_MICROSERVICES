import { test, expect, type Page, type BrowserContext, type ConsoleMessage, type Response } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Drives the exam-taking flow through a real browser end to end, asserting
 * what the STUDENT sees (not raw API responses). This exists because the
 * 7 API-level e2e suites under scripts/e2e/*.e2e.js (139 checks, all green)
 * missed three bugs that only show up in a real browser:
 *   1. CORS: the gateway origin was rejected -> login failed with
 *      "No permitido por CORS" (node fetch sends no Origin header).
 *   2. The login payload lacked `isActive` -> every logged-in user landed
 *      on a "Cuenta Inactiva" screen.
 *   3. The preparation screen ran its technical checks in the browser but
 *      never reported them to session-manager, so the server-side gate
 *      refused every real student with "insufficient technical score".
 * All three are fixed on this branch; these assertions are the regression
 * net for that class of bug.
 */

interface Fixture {
  studentEmail: string;
  studentPassword: string;
  studentId: string;
  sessionId: string;
  examId: string;
  examName: string;
  questionCount: number;
}

const FIXTURE_PATH = path.join(__dirname, '..', '.e2e-data.json');

function loadFixture(): Fixture {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Reads the OTP code straight out of Redis via the identity-service
 * container (same DB the OTP endpoint writes to — see
 * identity-service/src/auth/services/otp.service.ts: key `otp:<email>:login`,
 * value `{ code, email, purpose, expiresAt, attempts, maxAttempts }`).
 * Uses the container's own REDIS_URI env var — never reads/echoes the
 * password itself, only the OTP payload it returns.
 */
function fetchOtpCode(email: string): string {
  const key = `otp:${email.trim().toLowerCase()}:login`;
  const script = [
    "const Redis = require('ioredis');",
    'const r = new Redis(process.env.REDIS_URI);',
    `r.get(${JSON.stringify(key)}).then((v) => { process.stdout.write(v || ''); process.exit(0); })`,
    '.catch((e) => { console.error(e); process.exit(1); });',
  ].join(' ');

  for (let attempt = 0; attempt < 5; attempt++) {
    const raw = execFileSync('docker', ['exec', 'identity-service', 'node', '-e', script], { encoding: 'utf-8' });
    if (raw) return JSON.parse(raw).code;
    execFileSync('sleep', ['0.5']);
  }
  throw new Error(`No OTP found in Redis for key ${key} after 5 attempts`);
}

/** Counts exam_results for this session+candidate directly in Mongo, to tie the UI's "you have a result" claim back to actual data (not just a rendered number). */
function countExamResults(sessionId: string, candidateId: string): number {
  const script = [
    "const mongoose = require('mongoose');",
    'mongoose.connect(process.env.MONGO_URI).then(async () => {',
    "  const db = mongoose.connection.db;",
    `  const n = await db.collection('exam_results').countDocuments({ sessionId: new mongoose.Types.ObjectId(${JSON.stringify(sessionId)}), candidateId: new mongoose.Types.ObjectId(${JSON.stringify(candidateId)}) });`,
    '  process.stdout.write(String(n));',
    '  await mongoose.disconnect();',
    '});',
  ].join(' ');
  const raw = execFileSync('docker', ['exec', '-w', '/app/exam-service', 'exam-service', 'node', '-e', script], { encoding: 'utf-8' });
  return Number(raw.trim());
}

const BAD_RESPONSE_STATUSES = new Set([401, 403, 500]);
const BAD_CONSOLE_PATTERN = /CORS|Network Error|Failed to fetch/i;

test.describe.configure({ mode: 'serial' });

test.describe('Student exam flow (real browser, real backend)', () => {
  let fixture: Fixture;
  let context: BrowserContext;
  let page: Page;
  const consoleErrors: string[] = [];
  const badResponses: string[] = [];

  test.beforeAll(async ({ browser }) => {
    fixture = loadFixture();
    context = await browser.newContext();
    page = await context.newPage();

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('response', (response: Response) => {
      const url = response.url();
      if (url.includes('/api/') && BAD_RESPONSE_STATUSES.has(response.status())) {
        badResponses.push(`${response.status()} ${response.request().method()} ${url}`);
      }
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('student logs in through OTP + password and lands on the dashboard (no CORS failure, no inactive-account screen)', async () => {
    // ── Step 1: request an OTP for the seeded student ──────────────────────
    await page.goto('/');
    await page.getByLabel('Email').fill(fixture.studentEmail);
    await page.getByRole('button', { name: 'Enviar Código OTP' }).click();
    await expect(page).toHaveURL(/\/otp-verification/);

    // ── Step 2: read the real OTP out of Redis and submit it ───────────────
    const otpCode = fetchOtpCode(fixture.studentEmail);
    await page.locator('input[data-input-otp]').fill(otpCode);
    await page.getByRole('button', { name: 'Verificar y Continuar al Login' }).click();
    await expect(page).toHaveURL(/\/login/);

    // ── Step 3: real password login ─────────────────────────────────────────
    await page.getByLabel('Contraseña').fill(fixture.studentPassword);
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 15_000 });
    // The page title was removed on purpose (it only took space); the
    // dashboard's first card is what proves we landed on it.
    await expect(page.getByText('Próximo Examen', { exact: true })).toBeVisible();

    // The two browser-only bugs this suite exists to catch: a CORS
    // rejection or a login response missing `isActive` would surface here.
    await expect(page.getByText('Cuenta Inactiva')).toHaveCount(0);
    expect(consoleErrors.filter((e) => BAD_CONSOLE_PATTERN.test(e))).toEqual([]);
    expect(badResponses).toEqual([]);
  });

  test('student passes technical verification and reaches a startable exam', async () => {
    await page.getByRole('button', { name: 'Entrar al Examen' }).click();
    await expect(page).toHaveURL(new RegExp(`/student/exam/${fixture.sessionId}/preparation`));

    // Automatic checks (browser compatibility, screen resolution, internet)
    // run on mount with small delays between them — wait for them to settle
    // instead of a fixed sleep.
    await expect(page.getByText('Navegador Compatible', { exact: true })).toBeVisible();

    // Microphone: fake device + pre-granted permission means this resolves
    // without a real prompt, but the UI still requires the manual "Probar"
    // click per check design (technicalVerificationService's `required`
    // checks are only flipped by their own action, not by permission grant
    // alone).
    const micRow = page.locator('li', { hasText: 'Micrófono' });
    await micRow.getByRole('button', { name: 'Probar' }).click();
    await expect(micRow.getByText('Correcto')).toBeVisible({ timeout: 15_000 });

    // Audio: plays a tone via Web Audio (no permission needed), then asks
    // for a manual yes/no confirmation.
    const audioRow = page.locator('li', { hasText: 'Auriculares/Altavoces' });
    await audioRow.getByRole('button', { name: 'Probar audio' }).click();
    await page.getByRole('button', { name: 'Sí, lo escuché' }).click();
    await expect(audioRow.getByText('Correcto')).toBeVisible({ timeout: 10_000 });

    // Every required check passed (or warned) -> gate reachable -> the
    // start button must be enabled. This is the third browser-only bug's
    // regression check: if the browser never reports these checks to
    // session-manager, exam-service's server-side gate 403s here instead.
    const startButton = page.getByRole('button', { name: /Comenzar Examen|Continuar Examen/ });
    await expect(startButton).toBeEnabled({ timeout: 10_000 });

    expect(consoleErrors.filter((e) => BAD_CONSOLE_PATTERN.test(e))).toEqual([]);
    expect(badResponses).toEqual([]);

    await startButton.click();
    await expect(page).toHaveURL(new RegExp(`/student/exam/${fixture.sessionId}$`), { timeout: 15_000 });
  });

  test('student answers every question, finishes, and sees the submitted screen (no result wait)', async () => {
    // The session was seeded with browserLockdown: true — the runner must
    // show the lockdown indicator (ExamRunnerHTTP.tsx's chip).
    await expect(page.getByText('Modo bloqueo activo')).toBeVisible();

    for (let i = 1; i <= fixture.questionCount; i++) {
      await expect(page.getByText(`Pregunta ${i} de ${fixture.questionCount}`, { exact: true })).toBeVisible();

      // QuestionRenderer marks both the single-select and multi-select
      // multiple_choice option branches with data-testid="mc-option" (plus
      // role="radio"/"checkbox" and aria-label). Any option is accepted:
      // the test doesn't assert correctness, only that the exam can be
      // completed and graded.
      await page.getByTestId('mc-option').first().click();

      const isLast = i === fixture.questionCount;
      if (isLast) {
        await page.getByRole('button', { name: 'Entregar examen' }).click();
        await page.getByRole('button', { name: 'Entregar', exact: true }).click();
      } else {
        await page.getByRole('button', { name: /Siguiente( Sección)?/ }).click();
      }
    }

    // Product decision: exams run in a computer lab with rotating groups —
    // the student must NEVER wait for grading here. It always happens in
    // the background (exam-service publishes to Kafka, grading-service
    // grades asynchronously). Assert the shared "Examen enviado" screen
    // instead of a navigation to a result page or any score on screen.
    await expect(page.getByRole('heading', { name: 'Examen enviado' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ir a mi panel' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/student\/results\//);
    await expect(page.getByText(/^\d+%$/)).toHaveCount(0);

    // Grading still happens — just asynchronously, off the UI thread the
    // student is looking at. Tie the "enviado" claim back to actual data:
    // poll until exactly one exam_result exists for this session+candidate
    // (grading latency varies — AI-graded questions can take a while), then
    // re-check it stayed at one (more than one would be a double-grade bug).
    await expect
      .poll(() => countExamResults(fixture.sessionId, fixture.studentId), { timeout: 45_000 })
      .toBe(1);
    expect(countExamResults(fixture.sessionId, fixture.studentId)).toBe(1);

    expect(consoleErrors.filter((e) => BAD_CONSOLE_PATTERN.test(e))).toEqual([]);
    expect(badResponses).toEqual([]);
  });
});
