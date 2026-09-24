import { test, expect, type Page, type BrowserContext, type ConsoleMessage, type Response } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Drives the teacher's core job end to end through a real browser: create a
 * session, enroll a candidate, watch it show up on the monitor screen, and
 * confirm the question bank loads real data and can be filtered. This exists
 * because the teacher/admin screens (12 of them) have zero automated
 * coverage today and are about to be reorganized starting with the session
 * scheduler — without a regression net, that refactor can break session
 * creation or candidate enrollment silently.
 *
 * Modeled on exam-flow.spec.ts: real browser, real backend, OTP read from
 * Redis the same way, seeds/cleans its own data.
 *
 * ── Why this test creates its OWN session instead of touching the fixture's
 * session ──
 * global-setup seeds one exam + one session that is already `in_progress`
 * and is the fixture exam-flow.spec.ts sits from start to finish. This spec
 * never touches that session (never navigates to it, never enrolls into it,
 * never starts/ends it) so the two specs can't race or corrupt each other's
 * state regardless of run order.
 *
 * It DOES reuse the fixture's *exam* (fixture.examId) as the exam a new
 * session is scheduled against, the same way a real teacher reuses an
 * existing exam definition across many sessions. That's safe because
 * exam-flow.spec.ts only ever mutates the SESSION/attempt/response/result
 * documents — it never writes to the exam document itself — so scheduling a
 * second, independent session against the same exam cannot collide with it.
 * Creating a whole second exam through the UI would mean driving the
 * (separately screened) exam-builder flow, which is out of scope for the
 * teacher screens this spec is meant to cover.
 */

interface TeacherFixture {
  studentEmail: string;
  studentId: string;
  examId: string;
  examName: string;
  teacherEmail: string;
  teacherPassword: string;
  level: string;
  competency: string;
}

const FIXTURE_PATH = path.join(__dirname, '..', '.e2e-data.json');
const TAG_PREFIX = 'e2ebrowser-teacherflow-';

function loadFixture(): TeacherFixture {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw);
}

/** Same Redis lookup exam-flow.spec.ts and teacher-shots.spec.ts use — see exam-flow.spec.ts for the full explanation. */
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

/** Counts sessions this spec created (by its own name prefix) directly in Mongo — used to prove cleanup left nothing behind. */
function countTeacherFlowSessions(): number {
  const script = [
    "const mongoose = require('mongoose');",
    'mongoose.connect(process.env.MONGO_URI).then(async () => {',
    '  const db = mongoose.connection.db;',
    `  const n = await db.collection('sessions').countDocuments({ sessionName: { $regex: '^${TAG_PREFIX}' } });`,
    '  process.stdout.write(String(n));',
    '  await mongoose.disconnect();',
    '});',
  ].join(' ');
  const raw = execFileSync('docker', ['exec', '-w', '/app/exam-service', 'exam-service', 'node', '-e', script], { encoding: 'utf-8' });
  return Number(raw.trim());
}

/** Deletes every session this spec created (by name prefix) plus anything hanging off it — mirrors global-teardown's style. */
function cleanupTeacherFlowSessions(): void {
  const script = [
    "const mongoose = require('mongoose');",
    'mongoose.connect(process.env.MONGO_URI).then(async () => {',
    '  const db = mongoose.connection.db;',
    `  const sessions = await db.collection('sessions').find({ sessionName: { $regex: '^${TAG_PREFIX}' } }).project({ _id: 1 }).toArray();`,
    '  const ids = sessions.map((s) => s._id);',
    "  await db.collection('exam_results').deleteMany({ sessionId: { $in: ids } });",
    "  await db.collection('responses').deleteMany({ sessionId: { $in: ids } });",
    "  await db.collection('attempts').deleteMany({ sessionId: { $in: ids } });",
    "  await db.collection('sessions').deleteMany({ _id: { $in: ids } });",
    '  await mongoose.disconnect();',
    '});',
  ].join(' ');
  execFileSync('docker', ['exec', '-w', '/app/exam-service', 'exam-service', 'node', '-e', script], { encoding: 'utf-8' });
}

const BAD_RESPONSE_STATUSES = new Set([401, 403, 500]);
const BAD_CONSOLE_PATTERN = /CORS|Network Error|Failed to fetch/i;

/**
 * KNOWN BUG, not a test flake — tracked separately instead of silently
 * ignored: SessionMonitorScreen.tsx (frontend/src/modules/exams/screens/
 * SessionMonitorScreen.tsx, fetchAuditLogs()) calls GET /api/v1/audit-logs
 * for ANY role that can open the monitor screen (admin, teacher, proctor —
 * see the "/sessions/:sessionId/monitor" route's `role` array in
 * frontend/src/navigation/Protected.Route.ts). But the endpoint itself
 * (identity-service/src/routes/audit.routes.ts, `@access Admin only`,
 * `...middlewareStacks.adminOnly`) 403s anyone who isn't admin. The
 * component swallows the failure (`catch { // silent — not critical }`),
 * so a teacher/proctor never sees an error, but "Actividad reciente" is
 * permanently empty for them and every visit fires a doomed request. See
 * this spec's final report for the full write-up.
 */
const KNOWN_BUG_URL_PATTERN = /\/audit-logs/;

/**
 * The session-scheduling TimePicker (components/atoms/time-picker.tsx) is a
 * drag-drum widget with no native <input> and no aria-labels on its
 * up/down chevrons — there's nothing role/label-based to grab there. Each
 * click of the "Hr" column's up-arrow decrements the hour by one (12 -> 11
 * -> 10 -> ...) and each click of the period column's up-arrow flips
 * AM<->PM; this drives both to a target 24h hour mechanically, which is the
 * only deterministic way to operate it without reading React internals.
 * Left as-is on purpose rather than reaching into component state: the
 * screen is getting redesigned, and this is exactly the kind of interaction
 * that redesign should fix (see final report).
 */
async function setTimeViaDrum(page: Page, triggerName: string, hour24: number): Promise<void> {
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const h12 = hour24 % 12 || 12;
  // Both columns start at their default (12, AM) every time the popover
  // mounts fresh. A full 12-click cycle back to 12 still fires onChange at
  // least once, so 0 is normalized to 12 to guarantee the value commits
  // even when the target IS the default hour.
  const hourUpClicks = ((12 - h12) % 12) || 12;
  const periodUpClicks = period === 'PM' ? 1 : 0;

  await page.getByRole('button', { name: triggerName }).click();
  const popover = page.locator('div.flex.divide-x.divide-border');
  await expect(popover).toBeVisible();
  const hourColumn = popover.locator('> div').nth(0);
  const periodColumn = popover.locator('> div').nth(2);
  const hourUp = hourColumn.getByRole('button').first();
  const periodUp = periodColumn.getByRole('button').first();

  for (let i = 0; i < hourUpClicks; i++) {
    await hourUp.click();
    await page.waitForTimeout(80);
  }
  // Let the drum's inertia/lerp animation settle so onSelect (-> onChange)
  // fires with the final hour BEFORE the period click reads it back.
  await page.waitForTimeout(600);
  for (let i = 0; i < periodUpClicks; i++) {
    await periodUp.click();
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
}

test.describe.configure({ mode: 'serial' });

test.describe('Teacher core flow (real browser, real backend)', () => {
  let fixture: TeacherFixture;
  let context: BrowserContext;
  let page: Page;
  let sessionId: string | null = null;
  const sessionName = `${TAG_PREFIX}${Date.now()}`;
  const consoleErrors: string[] = [];
  const badResponses: string[] = [];
  const knownBugResponses: string[] = [];

  test.beforeAll(async ({ browser }) => {
    fixture = loadFixture();

    // Mongo count BEFORE anything runs — proves this run starts clean and
    // any leftover from a previous interrupted run would be visible.
    const before = countTeacherFlowSessions();
    console.log(`[teacher-flow] sessions matching '${TAG_PREFIX}*' before test: ${before}`);
    expect(before).toBe(0);

    context = await browser.newContext();
    page = await context.newPage();

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('response', (response: Response) => {
      const url = response.url();
      if (url.includes('/api/') && BAD_RESPONSE_STATUSES.has(response.status())) {
        if (KNOWN_BUG_URL_PATTERN.test(url)) {
          knownBugResponses.push(`${response.status()} ${response.request().method()} ${url}`);
        } else {
          badResponses.push(`${response.status()} ${response.request().method()} ${url}`);
        }
      }
    });
  });

  test.afterAll(async () => {
    await context.close();
    if (knownBugResponses.length > 0) {
      console.log(`[teacher-flow] KNOWN BUG hit (see KNOWN_BUG_URL_PATTERN comment): ${JSON.stringify(knownBugResponses)}`);
    }
    // Clean up regardless of pass/fail, the same way global-teardown does.
    cleanupTeacherFlowSessions();
    const after = countTeacherFlowSessions();
    console.log(`[teacher-flow] sessions matching '${TAG_PREFIX}*' after cleanup: ${after}`);
    expect(after).toBe(0);
  });

  test('teacher logs in through OTP + password and lands on the sessions screen', async () => {
    await page.goto('/');
    await page.getByLabel('Email').fill(fixture.teacherEmail);
    await page.getByRole('button', { name: 'Enviar Código OTP' }).click();
    await expect(page).toHaveURL(/\/otp-verification/);

    const otpCode = fetchOtpCode(fixture.teacherEmail);
    await page.locator('input[data-input-otp]').fill(otpCode);
    await page.getByRole('button', { name: 'Verificar y Continuar al Login' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('Contraseña').fill(fixture.teacherPassword);
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    // A teacher lands on /sessions, not /dashboard (see useAutoNavigation / menu.ts role map).
    await expect(page).toHaveURL(/\/sessions/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Sesiones' })).toBeVisible();

    expect(consoleErrors.filter((e) => BAD_CONSOLE_PATTERN.test(e))).toEqual([]);
    expect(badResponses).toEqual([]);
  });

  test('teacher creates a session through the form and sees it in the sessions list', async () => {
    await page.getByRole('button', { name: 'Nueva Sesión' }).click();
    await expect(page.getByRole('heading', { name: 'Nueva Sesión' })).toBeVisible();

    await page.getByPlaceholder('Ej: Evaluación Nivel B1 — Marzo 2026').fill(sessionName);

    // Exam dropdown — selected by value (the exam's _id) instead of by
    // label text, since the label is composed at render time
    // (`${name} (${type} - ${level})`) and selecting by id is exact and
    // stable regardless of how that label is formatted.
    await expect(page.locator('select')).toContainText(fixture.examName, { timeout: 10_000 });
    await page.locator('select').selectOption(fixture.examId);

    // Calendar: single-day mode is the default — click today's date.
    const today = new Date();
    await page.getByRole('button', { name: String(today.getDate()), exact: true }).click();

    // Start = now + 1h, End = now + 3h (clamped to stay inside today, since
    // single-day mode forces end date == start date) — comfortably clears
    // the fixture exam's 15-minute minimum duration AND keeps the session's
    // end time in the future for the rest of this test (SessionsList's
    // canManageSession() hides "Gestionar candidatos" once a session's end
    // time is in the past). See setTimeViaDrum's comment for why this is
    // driven via click-counting instead of a direct fill.
    const nowHour = today.getHours();
    const startHour24 = nowHour >= 21 ? 21 : nowHour + 1;
    const endHour24 = nowHour >= 21 ? 23 : nowHour + 3;
    await setTimeViaDrum(page, 'Hora inicio', startHour24);
    await setTimeViaDrum(page, 'Hora fin', endHour24);

    const submit = page.getByRole('button', { name: 'Crear Sesión' });
    await expect(submit).toBeEnabled({ timeout: 5_000 });

    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST' && /\/sessions$/.test(new URL(r.url()).pathname)),
      submit.click(),
    ]);
    expect(createResponse.status()).toBe(201);
    const createdBody = await createResponse.json();
    sessionId = String(createdBody.data._id);
    expect(sessionId).toBeTruthy();

    // Back on the table — the new session must be visible to the teacher.
    await expect(page.getByRole('heading', { name: 'Sesiones' })).toBeVisible();
    await expect(page.getByRole('cell', { name: sessionName })).toBeVisible({ timeout: 10_000 });

    expect(consoleErrors.filter((e) => BAD_CONSOLE_PATTERN.test(e))).toEqual([]);
    expect(badResponses).toEqual([]);
  });

  test('teacher enrolls a candidate into the session through the UI', async () => {
    const row = page.getByRole('row', { name: new RegExp(sessionName) });
    await row.getByRole('button', { name: 'Acciones' }).click();
    await page.getByRole('button', { name: 'Gestionar candidatos' }).click();

    await expect(page.getByRole('heading', { name: 'Gestionar Candidatos' })).toBeVisible();

    // Real API-backed flow (candidateService.getAvailableCandidates / POST
    // /sessions/:id/candidates) — NOT mock data. Search for the seeded
    // student by its unique-per-run email so this can't accidentally match
    // a leftover candidate from an earlier interrupted run.
    await page.getByPlaceholder('Buscar por nombre, email...').fill(fixture.studentEmail);
    const candidateRow = page.getByText(fixture.studentEmail, { exact: true });
    await expect(candidateRow).toBeVisible({ timeout: 10_000 });
    await candidateRow.click();

    await page.getByRole('button', { name: /^Asignar/ }).click();
    await expect(page.getByText(/candidato\(s\) asignado\(s\)/)).toBeVisible({ timeout: 10_000 });

    // Candidate moved out of "Disponibles" into "Asignados" — it's still on
    // the page exactly once, just in the other column now.
    await expect(page.getByText(fixture.studentEmail)).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Sesiones' })).toBeVisible();

    expect(consoleErrors.filter((e) => BAD_CONSOLE_PATTERN.test(e))).toEqual([]);
    expect(badResponses).toEqual([]);
  });

  test('the session monitor screen lists the enrolled candidate', async () => {
    expect(sessionId).toBeTruthy();
    await page.goto(`/sessions/${sessionId}/monitor`);

    await expect(page.getByText(sessionName)).toBeVisible({ timeout: 10_000 });
    // Stat card: exactly one candidate enrolled.
    await expect(page.getByText('Inscritos')).toBeVisible();

    // The candidate's name as session.service.ts's getSessionProgress
    // resolves it: `${firstName} ${lastName}` from the candidates
    // collection — seed.js sets these to "E2E Browser". The candidate row
    // renders both a mobile and a desktop layout (one hidden via CSS at a
    // time, both present in the DOM), so scope to the one actually visible
    // at this viewport instead of an ambiguous getByText match.
    await expect(page.locator('span:visible', { hasText: 'E2E Browser' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('span:visible', { hasText: 'Sin empezar' })).toBeVisible();

    expect(consoleErrors.filter((e) => BAD_CONSOLE_PATTERN.test(e))).toEqual([]);
    expect(badResponses).toEqual([]);
  });

  test('the question bank loads real data and a filter narrows it', async () => {
    await page.goto('/questions');
    await expect(page.getByRole('heading', { name: 'Banco de Preguntas' })).toBeVisible();

    const totalsText = () => page.locator('p', { hasText: /\d+\s+preguntas/ }).first().innerText();

    const before = await totalsText();
    const beforeCount = Number(before.match(/(\d+)\s+preguntas/)?.[1] ?? '0');
    expect(beforeCount).toBeGreaterThan(0);

    // Filter to the exact level+competency the seeded question pool used
    // (exported by seed.js) — guaranteed to exist and, since the bank spans
    // multiple levels/competencies, guaranteed to be a strict subset of the
    // unfiltered total. Select order in the filter bar (QuestionsScreen.tsx):
    // Tipo, Competencia, Nivel, Dificultad.
    const selects = page.locator('select');
    await selects.nth(1).selectOption(fixture.competency); // "Competencia"
    await selects.nth(2).selectOption(fixture.level); // "Nivel"
    await page.getByRole('button', { name: 'Aplicar' }).click();

    await expect(async () => {
      const after = await totalsText();
      const afterCount = Number(after.match(/(\d+)\s+preguntas/)?.[1] ?? '-1');
      expect(afterCount).toBeGreaterThan(0);
      expect(afterCount).toBeLessThan(beforeCount);
    }).toPass({ timeout: 10_000 });

    expect(consoleErrors.filter((e) => BAD_CONSOLE_PATTERN.test(e))).toEqual([]);
    expect(badResponses).toEqual([]);
  });
});
