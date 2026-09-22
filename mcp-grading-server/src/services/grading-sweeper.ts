import { getAttempts, getExamResults } from '../db/collections.js';
import { gradeExam } from '../tools/grade-exam.js';
import { config } from '../config.js';

// Reconciliation sweeper: guarantees no completed exam is left ungraded even if the
// fire-and-forget HTTP call from exam-service (finishExam/endSession) never reached
// grading-service (grading-service was down, network blip, etc).
//
// It periodically looks for attempts with status='completed' that have no matching
// exam_results document, and grades them the normal way (gradeExam already skips
// attempts that already have a completed result, so this is safe to re-run).

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let stopped = false;

// Permanently-failing attempts should not be retried forever within a single
// process lifetime — restart the service to reset this counter.
const failureCounts = new Map<string, number>();
const MAX_FAILURES = 3;

interface UngradedAttempt {
  _id: import('mongodb').ObjectId;
}

async function findUngradedAttempts(cutoff: Date, limit: number): Promise<UngradedAttempt[]> {
  return getAttempts()
    .aggregate<UngradedAttempt>([
      { $match: { status: 'completed', finishedAt: { $lte: cutoff } } },
      {
        $lookup: {
          from: 'exam_results',
          localField: '_id',
          foreignField: 'attemptId',
          as: 'result',
        },
      },
      { $match: { result: { $size: 0 } } },
      { $sort: { finishedAt: 1 } },
      { $limit: limit },
      { $project: { _id: 1 } },
    ])
    .toArray();
}

async function runSweep(): Promise<void> {
  if (running) {
    // Previous tick is still working (e.g. a slow GROQ call) — skip this one.
    return;
  }
  running = true;

  try {
    const cutoff = new Date(Date.now() - config.gradingSweep.minAgeMs);
    const candidates = await findUngradedAttempts(cutoff, config.gradingSweep.batchSize);

    const toGrade = candidates.filter(
      (a) => (failureCounts.get(a._id.toString()) ?? 0) < MAX_FAILURES
    );
    const skipped = candidates.length - toGrade.length;
    if (skipped > 0) {
      console.warn(`[grading-sweeper] skipping ${skipped} attempt(s) that failed ${MAX_FAILURES}+ times already`);
    }

    if (toGrade.length === 0) {
      return;
    }

    let graded = 0;
    let failed = 0;

    for (const attempt of toGrade) {
      const attemptId = attempt._id.toString();
      try {
        // Defensive re-check: gradeExam() already no-ops on an existing completed
        // result, but avoid the call entirely if another process just graded it.
        const existing = await getExamResults().findOne({ attemptId: attempt._id });
        if (existing && existing.status === 'completed') {
          continue;
        }

        await gradeExam(attemptId);
        graded++;
        failureCounts.delete(attemptId);
      } catch (error: any) {
        failed++;
        const count = (failureCounts.get(attemptId) ?? 0) + 1;
        failureCounts.set(attemptId, count);
        console.error(`[grading-sweeper] failed to grade attempt=${attemptId} (attempt ${count}/${MAX_FAILURES}):`, error?.message || error);
      }
    }

    console.info(`[grading-sweeper] found=${candidates.length} graded=${graded} failed=${failed}`);
  } catch (error: any) {
    console.error('[grading-sweeper] sweep run failed:', error?.message || error);
  } finally {
    running = false;
  }
}

function scheduleNext(): void {
  if (stopped || config.gradingSweep.intervalMs <= 0) return;
  timer = setTimeout(async () => {
    await runSweep();
    scheduleNext();
  }, config.gradingSweep.intervalMs);
  timer.unref();
}

export function startGradingSweeper(): void {
  if (config.gradingSweep.intervalMs <= 0) {
    console.log('[grading-sweeper] disabled (GRADING_SWEEP_INTERVAL_MS <= 0)');
    return;
  }
  console.log(
    `[grading-sweeper] started: interval=${config.gradingSweep.intervalMs}ms ` +
    `minAge=${config.gradingSweep.minAgeMs}ms batch=${config.gradingSweep.batchSize}`
  );
  stopped = false;
  scheduleNext();
}

export function stopGradingSweeper(): void {
  stopped = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
