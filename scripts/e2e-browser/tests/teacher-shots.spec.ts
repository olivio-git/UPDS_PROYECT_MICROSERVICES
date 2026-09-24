/*
 * Captures the teacher and admin screens, to diagnose their UI with evidence
 * instead of from memory. Diagnostic only: it asserts nothing and never fails
 * a screen that has moved — it just does not get a shot.
 *
 *   SHOTS=1 npx playwright test tests/teacher-shots.spec.ts
 *
 * Needs the demo accounts from scripts/demo/setup-demo.js.
 */
import { test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const OUT_DIR = path.join(__dirname, '..', 'screenshots', 'teacher');
const EMAIL = process.env.DEMO_TEACHER_EMAIL || 'demo.docente@cba.test';
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026!';

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
  for (let i = 0; i < 6; i++) {
    const raw = execFileSync('docker', ['exec', 'identity-service', 'node', '-e', script], { encoding: 'utf-8' }).trim();
    if (raw) return raw;
  }
  throw new Error('no OTP in Redis');
}

async function shot(page: Page, label: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, `${label}.png`) });
  console.log(`captured: ${label}`);
}

test.use({ video: 'off', trace: 'off' });

test('capture the teacher screens', async ({ page }) => {
  test.skip(!process.env.SHOTS, 'capture tool — run with SHOTS=1');
  test.setTimeout(240_000);

  await page.goto('/');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByRole('button', { name: 'Enviar Código OTP' }).click();
  await page.waitForURL(/\/otp-verification/);
  await page.locator('input[data-input-otp]').fill(fetchOtpCode(EMAIL));
  await page.getByRole('button', { name: 'Verificar y Continuar al Login' }).click();
  await page.waitForURL(/\/login/);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  // A teacher lands on /sessions, not /dashboard.
  await page.waitForURL(/\/(dashboard|sessions)/, { timeout: 20_000 });
  await shot(page, '01-aterrizaje');

  const routes: Array<[string, string]> = [
    ['/sessions', '02-sesiones'],
    ['/exams', '03-examenes'],
    ['/questions', '04-preguntas'],
    ['/academic-config', '05-config-academica'],
    ['/levels', '06-niveles'],
    ['/rubrics', '07-rubricas'],
    ['/reports', '08-reportes'],
    ['/upcoming-sessions', '09-proximas-sesiones'],
    ['/student-history', '10-historial-estudiantes'],
    ['/teacher/profile', '11-perfil'],
  ];

  for (const [route, label] of routes) {
    await page.goto(route).catch(() => {});
    await shot(page, label);
  }

  // The scheduler: open the create-session form from the sessions screen.
  await page.goto('/sessions');
  await page.waitForTimeout(1500);
  const nueva = page.getByRole('button', { name: /Nueva|Crear|Programar/i }).first();
  if (await nueva.isVisible().catch(() => false)) {
    await nueva.click().catch(() => {});
    await shot(page, '12-programador-sesion');
    // Second step of the form, if it has one.
    const siguiente = page.getByRole('button', { name: /Siguiente|Continuar/i }).first();
    if (await siguiente.isVisible().catch(() => false)) {
      await siguiente.click().catch(() => {});
      await shot(page, '13-programador-paso2');
    }
  } else {
    console.log('no encontré el botón de crear sesión');
  }
});
