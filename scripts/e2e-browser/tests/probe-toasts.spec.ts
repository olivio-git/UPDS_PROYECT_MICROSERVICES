/*
 * Walks a whole exam and records every toast that appears, plus stills of the
 * result screen. Diagnostic only — it asserts nothing.
 *   PROBE=1 npx playwright test tests/probe-toasts.spec.ts
 *
 * Skipped unless PROBE is set: it takes a whole exam, so it should not run
 * on every suite run.
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

/** Records every toast the app shows, in order, with the screen it appeared on. */
async function watchToasts(page: Page): Promise<void> {
  await page.exposeFunction('__toastSeen', (text: string, url: string) => {
    console.log(`TOAST | ${url.replace(/^https?:\/\/[^/]+/, '')} | ${text.replace(/\s+/g, ' ').trim()}`);
  });
  await page.addInitScript(() => {
    const seen = new WeakSet<Element>();
    const report = () => {
      document.querySelectorAll('[data-sonner-toast], li[data-styled="true"], ol[data-sonner-toaster] li').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        (window as unknown as { __toastSeen: (t: string, u: string) => void }).__toastSeen(
          el.textContent || '',
          location.href,
        );
      });
    };
    new MutationObserver(report).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(report, 250);
  });
}

async function shot(page: Page, label: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, `${label}.png`) });
  console.log(`captured: ${label}`);
}


/** Reads the toasts currently on screen. */
async function toasts(page: Page, when: string): Promise<void> {
  const list = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-sonner-toast]')).map((el) => (el.textContent || '').trim()),
  );
  console.log(`TOASTS @ ${when}: ${list.length}${list.length ? ' -> ' + JSON.stringify(list) : ''}`);
}

test.use({ video: 'off', trace: 'off' });

test('take a whole exam, log every toast, and land on the result', async ({ page }) => {
  test.skip(!process.env.PROBE, 'diagnostic only — run with PROBE=1');
  test.setTimeout(240_000);
  const fixture: Fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
  await watchToasts(page);

  await page.goto('/');
  await page.getByLabel('Email').fill(fixture.studentEmail);
  await page.getByRole('button', { name: 'Enviar Código OTP' }).click();
  await page.waitForURL(/\/otp-verification/);
  await page.locator('input[data-input-otp]').fill(fetchOtpCode(fixture.studentEmail));
  await page.getByRole('button', { name: 'Verificar y Continuar al Login' }).click();
  await page.waitForURL(/\/login/);
  await page.getByLabel('Contraseña').fill(fixture.studentPassword);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await page.waitForURL(/\/student\/dashboard/, { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await toasts(page, 'dashboard recién cargado');

  await page.goto(`/student/exam/${fixture.sessionId}/preparation`);
  await page.getByText('Navegador Compatible', { exact: true }).waitFor({ timeout: 30_000 });
  const micRow = page.locator('li', { hasText: 'Micrófono' });
  await micRow.getByRole('button', { name: 'Probar' }).click();
  await micRow.getByText('Correcto').waitFor({ timeout: 20_000 });
  const audioRow = page.locator('li', { hasText: 'Auriculares/Altavoces' });
  await audioRow.getByRole('button', { name: 'Probar audio' }).click();
  await page.getByRole('button', { name: 'Sí, lo escuché' }).click();
  await audioRow.getByText('Correcto').waitFor({ timeout: 15_000 });
  await toasts(page, 'preparación con los chequeos hechos');

  await page.getByRole('button', { name: /Comenzar Examen/i }).click();
  await page.getByTestId('mc-option').first().waitFor({ timeout: 30_000 });
  await toasts(page, 'examen recién abierto');

  for (let i = 0; i < fixture.questionCount; i++) {
    await page.getByTestId('mc-option').first().click();
    await page.waitForTimeout(500);
    // On the last question "Siguiente" is replaced by the submit button, so
    // ask with a short timeout instead of waiting for the default one.
    const next = page.getByRole('button', { name: /Siguiente/i });
    if ((await next.count()) > 0 && (await next.isEnabled({ timeout: 2000 }).catch(() => false))) {
      await next.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  await shot(page, 'probe-01-last-question');

  const finish = page.getByRole('button', { name: /Entregar examen|Finalizar examen|Finalizar/i }).first();
  await finish.click();
  await page.waitForTimeout(1000);
  await shot(page, 'probe-02-finish-dialog');
  // The modal is not exposed as role=dialog, but its button's accessible name
  // is exactly "Entregar", while the page behind it says "Entregar examen".
  await page.getByRole('button', { name: 'Entregar', exact: true }).click({ timeout: 10_000 });

  await page.waitForURL(/\/student\/results/, { timeout: 120_000 });
  await page.waitForTimeout(3000);
  await toasts(page, 'resultado');
  await shot(page, 'probe-03-result-detail');

  await page.goto('/student/results');
  await page.waitForTimeout(2500);
  await shot(page, 'probe-04-results-list');
});
