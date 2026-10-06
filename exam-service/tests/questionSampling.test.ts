import { sampleWithoutReplacement } from '../src/utils/questionSampling';

/** Deterministic random source (mulberry32) so the statistics below are stable. */
function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const BANK = Array.from({ length: 100 }, (_, i) => `q${i}`);

describe('sampleWithoutReplacement', () => {
  it('returns the requested number of distinct items from the list', () => {
    const picked = sampleWithoutReplacement(BANK, 10, seeded(1));
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
    picked.forEach((q) => expect(BANK).toContain(q));
  });

  it('caps at the list size and handles empty input', () => {
    expect(sampleWithoutReplacement(BANK.slice(0, 3), 10, seeded(2))).toHaveLength(3);
    expect(sampleWithoutReplacement([], 5)).toEqual([]);
    expect(sampleWithoutReplacement(BANK, 0)).toEqual([]);
  });

  it('does not modify the input', () => {
    const copy = [...BANK];
    sampleWithoutReplacement(BANK, 50, seeded(3));
    expect(BANK).toEqual(copy);
  });

  it('every question in the bank gets a fair chance across attempts', () => {
    const random = seeded(42);
    const counts = new Map<string, number>();
    const attempts = 20000;
    for (let a = 0; a < attempts; a++) {
      for (const q of sampleWithoutReplacement(BANK, 10, random)) counts.set(q, (counts.get(q) ?? 0) + 1);
    }
    // Each question should appear in ~10% of attempts (2000 times).
    expect(counts.size).toBe(100);
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(1700);
      expect(n).toBeLessThan(2300);
    }
  });

  it('covers the whole bank where the old "first 1.5x then shuffle" never left 15 questions', () => {
    const random = seeded(7);
    const seenNew = new Set<string>();
    const seenOld = new Set<string>();
    for (let a = 0; a < 50; a++) {
      sampleWithoutReplacement(BANK, 10, random).forEach((q) => seenNew.add(q));
      // Old behaviour: the database returned the same first 15, then shuffled.
      sampleWithoutReplacement(BANK.slice(0, 15), 10, random).forEach((q) => seenOld.add(q));
    }
    expect(seenOld.size).toBe(15);
    expect(seenNew.size).toBeGreaterThan(90);
  });
});
