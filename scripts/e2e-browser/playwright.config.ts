import { defineConfig, devices } from '@playwright/test';

/**
 * Real-browser E2E for the exam-taking flow. Runs against the already-up
 * docker-compose stack (frontend + api-gateway on the same origin), using
 * the system's Google Chrome via the `chrome` channel so no browser
 * download is required.
 *
 * `globalSetup` seeds a throwaway student/exam/session inside the
 * exam-service container and writes the fixture the tests need to
 * `.e2e-data.json` (gitignored). `globalTeardown` deletes it again.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  globalSetup: require.resolve('./global-setup.ts'),
  globalTeardown: require.resolve('./global-teardown.ts'),

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8088',
    headless: !process.env.PWDEBUG,
    // Headless Chromium mirrors `window.screen` to the viewport when no
    // device emulation says otherwise, so this also has to satisfy the
    // preparation screen's "Resolución de Pantalla" check (>=1024x768),
    // which session-manager scores server-side too — below that, the score
    // can drop under the 60/100 gate threshold even though the client-side
    // check only shows a (non-blocking) warning.
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Technical verification requires microphone access. Fake devices mean
    // getUserMedia resolves with a synthetic (non-silent) audio stream
    // instead of hanging on a real hardware prompt or a real mic.
    permissions: ['microphone'],
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        // devices['Desktop Chrome'] carries its own viewport (1280x720),
        // which would otherwise silently override the top-level `use.viewport`
        // above via project-level precedence — reassert it here so
        // window.screen (mirrored from viewport in headless Chromium)
        // actually reports >=1024x768.
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
