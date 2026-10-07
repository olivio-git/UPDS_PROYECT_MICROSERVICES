/**
 * What a student may see of a question while taking an exam.
 *
 * The stored question carries the answer key in several places (options[].isCorrect,
 * items[].correctPosition, items[].matchingPair, blanks[].correctAnswers,
 * correctAnswer, sampleAnswer, keywords). Anything sent to the exam runner goes
 * through here so none of it reaches the browser. Grading reads the stored
 * question, so ids are kept as they are.
 */

const shuffle = <T>(arr: readonly T[], random: () => number): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

const ANSWER_KEY_FIELDS = ['correctAnswer', 'sampleAnswer', 'keywords', 'explanation', 'acceptedAnswers'] as const;

export function toStudentQuestion<T = any>(question: any, random: () => number = Math.random): T {
  const obj = typeof question?.toObject === 'function' ? question.toObject() : { ...question };
  const content = obj?.content;
  if (!content) return obj;

  const out: Record<string, any> = { ...content };
  for (const key of ANSWER_KEY_FIELDS) delete out[key];

  const options: any[] = Array.isArray(content.options) ? content.options : [];
  if (options.length) {
    // The runner needs to know single vs multiple selection, not which ones are right.
    out.multipleAnswers = options.filter((o) => o?.isCorrect).length > 1;
    const visible = options.map(({ isCorrect: _hidden, ...rest }: any) => rest);
    out.options = obj.type === 'true_false' ? visible : shuffle(visible, random);
  }

  const items: any[] = Array.isArray(content.items) ? content.items : [];
  if (items.length) {
    if (obj.type === 'matching') {
      // Right-hand column travels on its own so the pairing is not in the payload.
      out.matchOptions = shuffle([...new Set(items.map((i) => i?.matchingPair).filter(Boolean))], random);
    }
    out.items = shuffle(items.map(({ correctPosition: _p, matchingPair: _m, ...rest }: any) => rest), random);
  }

  if (Array.isArray(content.blanks)) {
    out.blanks = content.blanks.map((b: any, i: number) => ({ position: b?.position ?? i }));
  }

  return { ...obj, content: out } as T;
}
