/**
 * grading-pass-fail: Compute-on-Read Fallback for Legacy Results.
 *
 * grading-service is the source of truth for `passed`/`passingScore`; this
 * fallback only runs for legacy `exam_results` documents that predate those
 * stored fields.
 */

import { DEFAULT_PASSING_SCORE, resolvePassFail } from '../src/utils/passFail';

describe('resolvePassFail', () => {
  it('uses the stored passed/passingScore when present, ignoring the exam threshold', () => {
    const result = resolvePassFail(
      { passed: false, passingScore: 80, percentage: 70, status: 'completed' },
      { structure: { passingScore: 60 } }
    );
    expect(result).toEqual({ passed: false, passingScore: 80 });
  });

  it('returns passed:null for a legacy result that is not completed', () => {
    const result = resolvePassFail({ percentage: 40, status: 'pending_ai_review' });
    expect(result.passed).toBeNull();
  });

  it('computes passed from the exam threshold for a completed legacy result', () => {
    const result = resolvePassFail(
      { percentage: 65, status: 'completed' },
      { structure: { passingScore: 60 } }
    );
    expect(result).toEqual({ passed: true, passingScore: 60 });
  });

  it('falls back to the single documented default when the exam does not resolve', () => {
    const result = resolvePassFail({ percentage: 65, status: 'completed' }, null);
    expect(result).toEqual({ passed: false, passingScore: DEFAULT_PASSING_SCORE });
    expect(DEFAULT_PASSING_SCORE).toBe(70);
  });

  it('does not throw when the exam argument is omitted entirely', () => {
    expect(() => resolvePassFail({ percentage: 90, status: 'completed' })).not.toThrow();
  });

  it('ignores a non-finite stored passingScore and falls back to the exam threshold (S2)', () => {
    const result = resolvePassFail(
      { percentage: 65, status: 'completed', passingScore: Number.NaN },
      { structure: { passingScore: 60 } }
    );
    expect(result).toEqual({ passed: true, passingScore: 60 });
  });

  it('ignores a non-numeric exam passingScore and uses the documented default', () => {
    const result = resolvePassFail(
      { percentage: 65, status: 'completed' },
      { structure: { passingScore: '60' as unknown as number } }
    );
    expect(result).toEqual({ passed: false, passingScore: DEFAULT_PASSING_SCORE });
  });

  it('never gives a verdict for placement exams, even with a stale stored passed', () => {
    const result = resolvePassFail(
      { percentage: 95, status: 'completed', passed: false, passingScore: 70 },
      { type: 'placement', structure: { passingScore: 60 } }
    );
    expect(result).toEqual({ passed: null, passingScore: null });
  });

  it('treats a result with a recommendedLevel as placement when the exam no longer resolves (W2)', () => {
    const result = resolvePassFail(
      { percentage: 40, status: 'completed', passed: false, passingScore: 70, recommendedLevel: 'B1' },
      null
    );
    expect(result).toEqual({ passed: null, passingScore: null });
  });

  it('treats stored levelScores/placementMode as a placement signal without an exam (W2)', () => {
    expect(
      resolvePassFail({ percentage: 40, status: 'completed', levelScores: [{ level: 'A1' }] }, null)
    ).toEqual({ passed: null, passingScore: null });
    expect(
      resolvePassFail({ percentage: 40, status: 'completed', placementMode: 'adaptive' })
    ).toEqual({ passed: null, passingScore: null });
  });

  it('does not treat an empty levelScores array as a placement signal', () => {
    const result = resolvePassFail({ percentage: 80, status: 'completed', levelScores: [] }, null);
    expect(result).toEqual({ passed: true, passingScore: DEFAULT_PASSING_SCORE });
  });
});
