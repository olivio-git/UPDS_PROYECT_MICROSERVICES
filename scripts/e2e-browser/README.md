# Browser E2E — exam-taking flow

Drives the exam-taking flow through a **real browser** end to end, asserting
what the student sees — not raw API responses. This exists because the 7
API-level e2e suites under `scripts/e2e/*.e2e.js` (139 checks, all green)
missed three bugs that only show up in a real browser, all found by a human
clicking through the app:

1. **CORS** — the gateway origin was rejected, so login failed with "No
   permitido por CORS" (`node fetch` sends no `Origin` header, so no API
   test ever saw it).
2. **Missing `isActive`** — the login payload lacked it, so every logged-in
   user landed on a "Cuenta Inactiva" screen.
3. **Unreported technical checks** — the preparation screen ran its
   technical checks in the browser but never reported them to
   session-manager, so the server-side gate refused every real student with
   "Puntuación de verificación técnica insuficiente (0/100)".

All three are fixed on this branch; the assertions in
`tests/exam-flow.spec.ts` are the regression net for that class of bug.

## Prerequisites

- The docker-compose stack must already be running (this suite never starts
  or restarts containers):
  ```
  GATEWAY_PORT=8088 docker compose up -d
  ```
  App + API are same-origin at `http://localhost:8088`.
- Google Chrome must be installed at `/usr/bin/google-chrome` (or adjust the
  `channel` in `playwright.config.ts`). The suite uses Playwright's `channel:
  'chrome'` so no separate browser download is required.

## Install & run

```bash
cd scripts/e2e-browser
npm install
npx playwright test
```

Headed / debug mode:

```bash
npx playwright test --headed
# or
PWDEBUG=1 npx playwright test
```

Type-check only:

```bash
npm run typecheck
```

## How seeding & teardown work

- `global-setup.ts` runs once before all tests:
  1. `docker cp`s `docker/seed.js` into the `exam-service` container.
  2. Generates a bcrypt hash for the student's password via `identity-service`
     (bcrypt lives there, not in exam-service — same split
     `scripts/demo/setup-demo.js` uses).
  3. Runs the seed script inside `exam-service` (it already has mongoose +
     jsonwebtoken). It creates:
     - A student account + candidate document with a **real password**
       (`userId` intentionally equals the candidate's `_id` —
       `/sessions/my-sessions` 500s otherwise).
     - A throwaway teacher account (dev-mode JWT, never logs in through the
       browser).
     - An exam pinned via `questionPool` to exactly 3 `multiple_choice`
       questions — GROQ's API key is currently rejected, so anything needing
       AI grading would never finish.
     - A session already `in_progress` (started the way a teacher would,
       via `POST /sessions/:id/start`) with `browserLockdown: true`, the
       student already enrolled.
  4. The seed script prints exactly **one JSON line** on success (its last
     stdout line); `global-setup.ts` parses it and writes it to
     `.e2e-data.json` (gitignored), which the tests read at runtime.
  - **The student's email is unique per run** (`e2ebrowser.student.<timestamp>@cba.test`),
    not fixed — identity-service rate-limits OTP generation to 3 requests
    per 5 minutes **per email**, and a fixed address would make back-to-back
    runs (or a debugging session) flake with "Demasiados intentos". This is
    a real production safeguard, not a bug, so the fixture works around it
    instead of tripping it.
- `global-teardown.ts` runs the same seed script with `--clean`, which
  deletes everything by tag pattern (`e2ebrowser.(student|teacher).*@cba.test`
  for accounts, `e2ebrowser-*` for the exam/session — matching however many
  timestamped runs left something behind) — not just the current run's
  fixture, so an interrupted earlier run's leftovers get swept up too.
- `docker/seed.js` also clears any previous leftovers unconditionally before
  seeding, so `npx playwright test` is safe to re-run from a dirty state.

## What the suite covers

Three tests, run in `serial` mode sharing one browser context (the journey
is inherently stateful — the exam can only be attempted once):

1. **Login** — OTP request → real OTP read out of Redis (the same key
   `identity-service`'s `otp.service.ts` writes,
   `otp:<email>:login`) → OTP submit → password login → lands on
   `/student/dashboard`. Asserts no "Cuenta Inactiva" text, no console
   message matching `/CORS|Network Error|Failed to fetch/`, and no `401/403/500`
   response to any `/api/` call during the whole flow.
2. **Technical verification** — clicks through to the preparation screen,
   waits for the automatic checks (browser compatibility, screen
   resolution, internet), clicks "Probar" for the microphone (fake device +
   pre-granted `microphone` permission means `getUserMedia` resolves with a
   synthetic non-silent stream instead of hanging on a real prompt) and
   "Probar audio" + "Sí, lo escuché" for the speaker check, then asserts the
   start button becomes enabled and clicks it. This is the regression check
   for bug #3 above — if the browser doesn't report these checks to
   session-manager, exam-service's server-side gate 403s right here.
3. **Exam + result** — answers every question, asserts the lockdown chip
   ("Modo bloqueo activo") is visible, finishes the exam, and asserts the
   student lands on a result page showing a percentage. Then cross-checks
   through Mongo (`docker exec` into `exam-service`) that **exactly one**
   `exam_result` document exists for that session+candidate — tying the UI
   claim back to actual data.

## Selectors — what's robust, what's fragile

- Robust: `getByRole`/`getByLabel`/`getByText` throughout for buttons, form
  fields, and status text (Spanish UI strings, matched exactly where the
  same substring appears more than once on the page).
- `input[data-input-otp]` for the OTP field — not a label/role match, but
  it's the actual attribute the `input-otp` library puts on its real
  (visually-hidden) `<input>`, so it's stable across any restyling of the
  visual slot divs.
- **Fragile, called out explicitly**: `div.cursor-pointer` for
  multiple-choice options in `QuestionRenderer.tsx`. Neither the
  single-select nor multi-select branch gives its option `<div>` a role,
  label, or test id — both just render a `div` with an `onClick` and a
  `cursor-pointer` class. The test accepts **any** option (it doesn't assert
  correctness, only that the exam can be completed and graded), but if that
  component gains more `cursor-pointer` elements in the question card this
  selector will need a test id instead
  (`data-testid="mc-option"` would fix it cleanly).

## Lockdown coverage

Only the reliable part is asserted: the lockdown chip's presence & text.
Fullscreen requests and real tab-switch/visibility events are unreliable
under headless automation (`document.hidden`/`visibilitychange` can be
faked, but Chromium's fullscreen API behaves inconsistently headless, and a
flaky assertion here would cost more than it proves) — this is intentionally
left out rather than written as a flaky test. If lockdown-infraction
coverage is wanted, `scripts/e2e/lockdown-infractions.e2e.js` already covers
it at the API level with a real infraction round-trip.

## Runtime

Both tests + full seed/teardown: ~13 seconds per full run (measured: 12.5s
and 12.7s on two consecutive clean runs), well under the ~3 minute budget.
