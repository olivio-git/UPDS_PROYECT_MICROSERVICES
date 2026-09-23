import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { FIXTURE_PATH } from './global-setup';

const SEED_SCRIPT_REMOTE = '/app/exam-service/e2e-browser-seed.js';

/**
 * Deletes everything global-setup created (student/candidate, exam,
 * session, attempts, responses, exam_results) via the seed script's
 * --clean flag, then removes the local fixture file.
 */
export default async function globalTeardown(): Promise<void> {
  try {
    execFileSync('docker', ['exec', '-w', '/app/exam-service', 'exam-service', 'node', SEED_SCRIPT_REMOTE, '--clean'], {
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('[global-teardown] cleanup failed (leftover fixture data may remain):', err);
  } finally {
    if (fs.existsSync(FIXTURE_PATH)) fs.unlinkSync(FIXTURE_PATH);
  }
}
