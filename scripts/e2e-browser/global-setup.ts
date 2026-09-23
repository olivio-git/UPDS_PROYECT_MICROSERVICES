import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const FIXTURE_PATH = path.join(__dirname, '.e2e-data.json');

const SEED_SCRIPT_LOCAL = path.join(__dirname, 'docker', 'seed.js');
const SEED_SCRIPT_REMOTE = '/app/exam-service/e2e-browser-seed.js';
const STUDENT_PASSWORD = 'E2eBrowser2026!';

/**
 * Copies the seed script into the exam-service container, generates a real
 * bcrypt hash for the student's password via identity-service (bcrypt lives
 * there, not in exam-service — same split scripts/demo/setup-demo.js uses),
 * then runs the seed. The seed script prints exactly one JSON line on
 * success (its last stdout line); everything else it logs goes to stderr.
 */
export default async function globalSetup(): Promise<void> {
  execFileSync('docker', ['cp', SEED_SCRIPT_LOCAL, `exam-service:${SEED_SCRIPT_REMOTE}`], { stdio: 'inherit' });

  const passwordHash = execFileSync(
    'docker',
    ['exec', 'identity-service', 'node', '-e', `require('bcryptjs').hash(${JSON.stringify(STUDENT_PASSWORD)}, 12).then((h) => console.log(h))`],
    { encoding: 'utf-8' }
  ).trim();

  const output = execFileSync(
    'docker',
    ['exec', '-e', `DEMO_PASSWORD_HASH=${passwordHash}`, '-e', `E2E_BROWSER_PASSWORD=${STUDENT_PASSWORD}`, '-w', '/app/exam-service', 'exam-service', 'node', SEED_SCRIPT_REMOTE],
    // Progress logs (console.error inside seed.js) print live to this
    // process's stderr; only the final JSON line comes back on stdout.
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] }
  );

  const lines = output.trim().split('\n').filter(Boolean);
  const lastLine = lines[lines.length - 1];
  console.log(`[global-setup] seeded fixture: ${lastLine}`);
  const fixture = JSON.parse(lastLine);

  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2));
}
