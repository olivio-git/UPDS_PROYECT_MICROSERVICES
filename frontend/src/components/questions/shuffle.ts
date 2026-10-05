/** Fisher–Yates shuffle; returns a new array. */
export function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Shuffle so that no element stays at its original index (when possible), so
 * an ordering never starts already solved and matching columns never line up.
 */
export function derange<T>(arr: readonly T[]): T[] {
  if (arr.length < 2) return [...arr];
  for (let attempt = 0; attempt < 12; attempt++) {
    const out = shuffle(arr);
    if (out.every((v, i) => v !== arr[i])) return out;
  }
  return [...arr.slice(1), arr[0]];
}
