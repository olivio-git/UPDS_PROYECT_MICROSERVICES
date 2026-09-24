# Continuous Integration

CI is defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and runs on:

- `pull_request` targeting `main` or `development`
- `push` to `main` or `development`
- manual `workflow_dispatch`

It has three jobs: `typecheck`, `unit`, and `e2e` (which waits on the first two).

## What runs when

| Job | Trigger | What it does |
|---|---|---|
| `typecheck` | every run | Matrix build over every TypeScript package: `shared/events`, `identity-service`, `notifications-service`, `exam-service`, `session-manager-service`, `mcp-grading-server`, `frontend`. Installs deps and runs each package's own `npm run build` (`tsc`, or `tsc -b && vite build` for the frontend). |
| `unit` | every run | `exam-service` jest suite only (`npm test`). The other services have jest configured but no test files yet (see "Known gaps"). |
| `e2e` | every run, after `typecheck` + `unit` pass | Builds and boots the full stack with `docker compose`, waits for every service healthcheck, then runs the deterministic scripts in `scripts/e2e/*.e2e.js` against it (everything except `ai-grading.e2e.js`). |
| `e2e` → AI grading step | only on `workflow_dispatch`, or `push` to `main`, **and** only if the `GROQ_API_KEY` secret is set | Runs `scripts/e2e/ai-grading.e2e.js`, which makes real calls to GROQ (costs quota/money). Never runs on `pull_request`, so a secret is never needed for (and never reaches) a forked PR. |

## The `@cba/events` shared package

`exam-service`, `mcp-grading-server`, and `notifications-service` depend on `@cba/events` via `file:../shared/events/cba-events.tgz` — a real tarball, not a registry package. The `typecheck` job builds and packs it (`cd shared/events && npm ci && npm run pack:local`) before installing those three services' dependencies, exactly like their Dockerfiles do. Those three services use `npm install` instead of `npm ci`, because the tarball is rebuilt fresh every run and isn't byte-reproducible, so its integrity hash can legitimately differ from what's recorded in the service's lockfile — same reasoning as the Dockerfiles' own comments.

## The e2e stack

The `e2e` job builds and boots the same `docker-compose.yml` used locally, including the real `frontend` image.

All secrets the stack needs (`MONGO_ROOT_PASSWORD`, `JWT_SECRET`, etc.) are generated as dummy values directly in the workflow — nothing is committed, nothing is copied from a real `.env`. `GROQ_API_KEY` is the one exception: it's taken from a GitHub secret so the optional AI-grading step can use a real key when available.

Each e2e script is copied into the running `exam-service` container and executed there with `docker exec`, exactly as each script's own header comment documents (they were written to be run that way against a live stack, not from the host).

On any e2e failure, `docker compose logs --tail=200` is dumped before the job ends. `docker compose down -v` always runs (`if: always()`), even on failure.

## Required GitHub secrets

| Secret | Required? | Used by |
|---|---|---|
| `GROQ_API_KEY` | Optional | Only the AI-grading e2e step. Without it, that step is skipped (all other jobs and steps still run). Never exposed to `pull_request` runs, per GitHub's own default for forked PRs, and never requested on `pull_request` at all. |

No other secrets are required — everything else the CI stack needs is dummy data generated in the workflow.

## Running the same checks locally

```bash
# 1. Build the shared package once (needed by exam-service, mcp-grading-server,
#    notifications-service)
cd shared/events && npm ci && npm run pack:local && cd ../..

# 2. Typecheck / build any package
npm --prefix identity-service ci && npm --prefix identity-service run build
npm --prefix notifications-service install && npm --prefix notifications-service run build
npm --prefix exam-service install && npm --prefix exam-service run build
npm --prefix session-manager-service ci && npm --prefix session-manager-service run build
npm --prefix mcp-grading-server install && npm --prefix mcp-grading-server run build
npm --prefix frontend ci --legacy-peer-deps && npm --prefix frontend run build

# 3. exam-service unit tests
npm --prefix exam-service test

# 4. Full e2e stack (copy .env.template to .env and fill in real/dummy values first)
cp .env.template .env
docker compose up -d --build
docker cp scripts/e2e/grading-pipeline.e2e.js exam-service:/app/exam-service/grading-pipeline.e2e.js
docker exec -w /app/exam-service exam-service node grading-pipeline.e2e.js
# ... other scripts/e2e/*.e2e.js, see each file's header comment for its exact
# docker cp / docker exec invocation.
docker compose down -v
```

## Known gaps

- **`identity-service` and `notifications-service`** have jest configured (`"test": "jest"`) but no test files under either repo — `unit` does not run them to avoid a false-red/false-green signal.
- **`session-manager-service`** has a `"test": "jest"` script but no jest config file; running it as-is would likely fail for configuration reasons unrelated to actual code correctness. Not run in CI.
- **Browser e2e (`scripts/e2e-browser/`, Playwright)** is not part of this workflow. It needs a real browser environment and was out of scope for this CI pass.
- **`scripts/e2e/ai-grading.e2e.js`** is the only e2e script requiring a real external API key (GROQ) and real spend; it's intentionally gated as described above rather than run on every PR.
