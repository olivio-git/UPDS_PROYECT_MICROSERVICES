/*
 * Captures the screens of the student flow, to compare before and after a
 * redesign. Not a test: every step is best-effort and it never asserts, so a
 * screen that has moved does not fail the run — it just does not get a shot.
 *
 * Writes into screenshots/<label>.png (gitignored).
 *   SHOTS=1 npx playwright test tests/screenshots.spec.ts
 *
 * Skipped unless SHOTS is set: it sits the same exam the real suite uses, so
 * running both in one go leaves the second one without an attempt to take.
 */
import { test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const FIXTURE_PATH = path.join(__dirname, '..', '.e2e-data.json');
const OUT_DIR = path.join(__dirname, '..', 'screenshots');

interface Fixture {
  studentEmail: string;
  studentPassword: string;
  sessionId: string;
  questionCount: number;
}

function loadFixture(): Fixture {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
}

function fetchOtpCode(email: string): string {
  const key = `otp:${email.trim().toLowerCase()}:login`;
  const script = [
    "const Redis = require('ioredis');",
    'const r = new Redis(process.env.REDIS_URI);',
    `r.get(${JSON.stringify(key)}).then((v) => {`,
    '  process.stdout.write(v ? JSON.parse(v).code : "");',
    '  r.disconnect();',
    '});',
  ].join(' ');
  for (let i = 0; i < 5; i++) {
    const raw = execFileSync('docker', ['exec', 'identity-service', 'node', '-e', script], { encoding: 'utf-8' }).trim();
    if (raw) return raw;
  }
  throw new Error('no OTP in Redis');
}

async function shot(page: Page, label: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.waitForTimeout(600); // let animations settle
  await page.screenshot({ path: path.join(OUT_DIR, `${label}.png`), fullPage: false });
  console.log(`captured: ${label}`);
}

// No video: this run only needs stills, and recording needs an ffmpeg binary
// Playwright has not downloaded here.
test.use({ video: 'off', trace: 'off' });

test('capture the student flow', async ({ page }) => {
  test.skip(!process.env.SHOTS, 'capture tool — run with SHOTS=1');
  test.setTimeout(180_000);
  const fixture = loadFixture();

  await page.goto('/');
  await shot(page, '01-otp-email');

  await page.getByLabel('Email').fill(fixture.studentEmail);
  await page.getByRole('button', { name: 'Enviar Código OTP' }).click();
  await page.waitForURL(/\/otp-verification/);
  await shot(page, '02-otp-code');

  await page.locator('input[data-input-otp]').fill(fetchOtpCode(fixture.studentEmail));
  await page.getByRole('button', { name: 'Verificar y Continuar al Login' }).click();
  await page.waitForURL(/\/login/);
  await shot(page, '03-login-password');

  await page.getByLabel('Contraseña').fill(fixture.studentPassword);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await page.waitForURL(/\/student\/dashboard/, { timeout: 20_000 });
  await shot(page, '04-student-dashboard');

  // The sidebar as it renders at a narrow width (mobile drawer).
  await page.setViewportSize({ width: 430, height: 900 });
  await shot(page, '05-dashboard-mobile');
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto(`/student/exam/${fixture.sessionId}/preparation`);
  await page.waitForTimeout(5000); // the automatic checks run here
  await shot(page, '06-preparation');

  // The mic and speaker checks only flip on their own button, as the suite
  // documents; a granted permission is not enough.
  const micRow = page.locator('li', { hasText: 'Micrófono' });
  await micRow.getByRole('button', { name: 'Probar' }).click().catch(() => {});
  await page.waitForTimeout(2500);
  const audioRow = page.locator('li', { hasText: 'Auriculares/Altavoces' });
  await audioRow.getByRole('button', { name: 'Probar audio' }).click().catch(() => {});
  await page.getByRole('button', { name: 'Sí, lo escuché' }).click().catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '06b-preparation-completa');

  const start = page.getByRole('button', { name: /Comenzar Examen/i });
  if (await start.isEnabled().catch(() => false)) {
    await start.click();
    await page.waitForTimeout(4000);
    await shot(page, '07-exam-runner');

    const options = page.getByTestId('mc-option');
    for (let i = 0; i < fixture.questionCount; i++) {
      await options.first().click().catch(() => {});
      await page.waitForTimeout(400);
      const next = page.getByRole('button', { name: /Siguiente/i });
      if (await next.isVisible().catch(() => false)) await next.click().catch(() => {});
      await page.waitForTimeout(400);
    }
    await shot(page, '08-exam-last-question');

    const finish = page.getByRole('button', { name: /Finalizar|Enviar/i }).first();
    if (await finish.isVisible().catch(() => false)) {
      await finish.click();
      await page.waitForTimeout(1200);
      await shot(page, '09-finish-confirm');
      const confirm = page.getByRole('button', { name: /Confirmar|Sí|Finalizar/i }).last();
      if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => {});
      await page.waitForURL(/\/student\/results/, { timeout: 90_000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await shot(page, '10-result');
    }
  } else {
    console.log('start button disabled — preparation blocked, skipping the exam shots');
  }
});
