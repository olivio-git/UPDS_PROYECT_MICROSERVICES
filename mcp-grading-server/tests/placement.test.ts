/**
 * Adaptive placement, simulated end to end with the production pieces:
 * the level walk of exam-service (utils/adaptivePlacement) and the level
 * estimate of grading-service (grading/placement). Students of known level
 * answer with a 3-parameter logistic model — including guessing on multiple
 * choice and true/false — and the placement is compared with their real level.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { estimatePlacementLevel, guessRate, probabilityCorrect, PLACEMENT_LEVELS } from '../src/grading/placement.js';
import { nextPlacementStep, shouldStopPlacement, fallbackLevels } from '../../exam-service/src/utils/adaptivePlacement.js';

function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const TYPES = [
  { type: 'multiple_choice', optionCount: 4, weight: 0.6 },
  { type: 'true_false', optionCount: 2, weight: 0.2 },
  { type: 'fill_blanks', optionCount: undefined, weight: 0.2 },
];

/** Previous rule, kept here only as the baseline: one right → up, never down, stop after 3 wrong, highest level ≥60%. */
function legacyPlacement(history: Array<{ level: string; score: number; maxScore: number }>) {
  const by = new Map<string, [number, number]>();
  for (const h of history) { const s = by.get(h.level) ?? [0, 0]; s[0] += h.score; s[1] += h.maxScore; by.set(h.level, s); }
  let best = 0;
  for (const [l, [ok, n]] of by) if (ok / n >= 0.6) best = Math.max(best, PLACEMENT_LEVELS.indexOf(l as any));
  return best;
}

function simulate(trueLevel: number, rand: () => number, legacy: boolean, slope = 1.8, offset = 0.6) {
  const pick = () => { let r = rand(); for (const t of TYPES) if ((r -= t.weight) <= 0) return t; return TYPES[0]!; };
  let state = { currentLevel: 'A2', streak: 0, consecutiveWrong: 0 };
  const history: Array<{ level: string; score: number; maxScore: number; type: string; optionCount?: number }> = [];
  for (;;) {
    const t = pick();
    const level = PLACEMENT_LEVELS.indexOf(state.currentLevel as any);
    const c = guessRate(t.type, t.optionCount);
    const p = c + (1 - c) / (1 + Math.exp(-slope * (trueLevel + offset - level)));
    const ok = rand() < p;
    history.push({ level: state.currentLevel, score: ok ? 1 : 0, maxScore: 1, type: t.type, optionCount: t.optionCount });
    if (legacy) {
      if (ok) state = { ...state, consecutiveWrong: 0, currentLevel: PLACEMENT_LEVELS[Math.min(level + 1, 5)]! };
      else state = { ...state, consecutiveWrong: state.consecutiveWrong + 1 };
      if (history.length >= 20 || state.consecutiveWrong >= 3) return legacyPlacement(history);
    } else {
      state = nextPlacementStep(state, ok);
      if (shouldStopPlacement(state, history.length, 20, 3)) return PLACEMENT_LEVELS.indexOf(estimatePlacementLevel(history).level as any);
    }
  }
}

function accuracy(legacy: boolean, slope?: number, offset?: number) {
  const rand = seeded(legacy ? 1 : 2);
  let exact = 0, near = 0, n = 0, overByTwo = 0;
  for (let t = 0; t < 6; t++) {
    for (let k = 0; k < 1500; k++) {
      const placed = simulate(t, rand, legacy, slope, offset);
      n++;
      if (placed === t) exact++;
      if (Math.abs(placed - t) <= 1) near++;
      if (placed - t >= 2) overByTwo++;
    }
  }
  return { exact: exact / n, near: near / n, overByTwo: overByTwo / n };
}

describe('adaptive placement (9,000 simulated students per method)', () => {
  const now = accuracy(false);
  const before = accuracy(true);

  test('places ~80% at their exact level and almost all within one level', () => {
    assert.ok(now.exact >= 0.75, `exact ${now.exact}`);
    assert.ok(now.near >= 0.98, `±1 ${now.near}`);
  });

  test('clearly better than the previous rule, which over-placed lucky guessers', () => {
    assert.ok(now.exact > before.exact + 0.2, `now ${now.exact} vs before ${before.exact}`);
    assert.ok(before.overByTwo > 0.1 && now.overByTwo < 0.01, `over by 2+: before ${before.overByTwo}, now ${now.overByTwo}`);
  });

  test('still better when students do not behave like the model assumes', () => {
    for (const [slope, offset] of [[1, 0.6], [3, 0.6], [1.8, 0.2], [1.8, 1]] as const) {
      const a = accuracy(false, slope, offset);
      const b = accuracy(true, slope, offset);
      assert.ok(a.exact > b.exact && a.near > b.near, `slope ${slope} offset ${offset}: ${a.exact}/${a.near} vs ${b.exact}/${b.near}`);
    }
  });
});

describe('placement building blocks', () => {
  test('two right in a row go up, one wrong goes down, never below A1 or above C2', () => {
    let s = { currentLevel: 'A2', streak: 0, consecutiveWrong: 0 };
    s = nextPlacementStep(s, true);
    assert.equal(s.currentLevel, 'A2');
    s = nextPlacementStep(s, true);
    assert.equal(s.currentLevel, 'B1');
    s = nextPlacementStep(s, false);
    assert.equal(s.currentLevel, 'A2');
    s = nextPlacementStep(nextPlacementStep({ currentLevel: 'A1', streak: 0, consecutiveWrong: 0 }, false), false);
    assert.equal(s.currentLevel, 'A1');
    assert.equal(shouldStopPlacement({ ...s, consecutiveWrong: 3 }, 5, 20, 3), 'consecutive_wrong');
    assert.equal(shouldStopPlacement({ currentLevel: 'B1', streak: 0, consecutiveWrong: 3 }, 5, 20, 3), undefined, 'only stops early at the bottom');
  });

  test('when a level has no questions left, the nearest levels are tried first', () => {
    assert.deepEqual(fallbackLevels('C1').slice(0, 3), ['B2', 'C2', 'B1']);
    assert.deepEqual(fallbackLevels('A1').slice(0, 2), ['A2', 'B1']);
  });

  test('a single lucky answer at a high level does not decide the result', () => {
    const history = [
      { level: 'A2', score: 0, maxScore: 1, type: 'multiple_choice' },
      { level: 'A1', score: 1, maxScore: 1, type: 'multiple_choice' },
      { level: 'A1', score: 1, maxScore: 1, type: 'fill_blanks' },
      { level: 'A2', score: 0, maxScore: 1, type: 'fill_blanks' },
      { level: 'C1', score: 1, maxScore: 1, type: 'true_false' },
    ];
    assert.equal(estimatePlacementLevel(history).level, 'A1');
    assert.ok(probabilityCorrect(0, 4, 0.5) > 0.5, 'a coin flip explains the C1 answer');
  });
});
