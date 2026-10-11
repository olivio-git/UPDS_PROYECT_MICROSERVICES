import { attemptLimitError } from '../src/utils/attemptLimit';

describe('attempts allowed per exam', () => {
  it('lets the candidate in while attempts remain', () => {
    expect(attemptLimitError(1, 0)).toBeNull();
    expect(attemptLimitError(3, 2)).toBeNull();
  });
  it('refuses once the limit is used, in Spanish', () => {
    expect(attemptLimitError(1, 1)).toBe('Ya rendiste este examen. Solo se permite un intento.');
    expect(attemptLimitError(2, 2)).toBe('Ya usaste los 2 intentos permitidos para este examen.');
  });
  it('treats a missing or non-positive limit as unlimited', () => {
    expect(attemptLimitError(undefined, 10)).toBeNull();
    expect(attemptLimitError(0, 10)).toBeNull();
  });
});
