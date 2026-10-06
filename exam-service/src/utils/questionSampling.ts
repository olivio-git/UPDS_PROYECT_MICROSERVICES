/**
 * Picks `size` distinct items uniformly at random from the whole list
 * (partial Fisher–Yates). Used to choose an attempt's questions from the full
 * bank, so every question has the same chance of appearing; before, only the
 * first ~1.5×N questions the database returned were ever shuffled, which made
 * attempts of the same exam keep repeating the same questions.
 */
export function sampleWithoutReplacement<T>(items: readonly T[], size: number, random: () => number = Math.random): T[] {
  const pool = [...items];
  const n = Math.min(Math.max(0, Math.floor(size)), pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}

/**
 * Like sampleWithoutReplacement, but questions the candidate has NOT seen in
 * earlier attempts come first: the result is the unseen ones (random order)
 * followed by seen ones (random order), cut to `size`. Seen questions are only
 * used when the unseen ones run out, so a retake repeats as little as the bank
 * allows.
 */
export function sampleFavoringUnseen<T>(
  items: readonly T[],
  size: number,
  isSeen: (item: T) => boolean,
  random: () => number = Math.random,
): T[] {
  const unseen = items.filter((i) => !isSeen(i));
  const seen = items.filter((i) => isSeen(i));
  const n = Math.min(Math.max(0, Math.floor(size)), items.length);
  const fromUnseen = sampleWithoutReplacement(unseen, n, random);
  return [...fromUnseen, ...sampleWithoutReplacement(seen, n - fromUnseen.length, random)];
}
