/**
 * Whether a multiple-choice question takes several answers. The exam runner gets
 * `multipleAnswers` from the server (the answer key is stripped); previews of a
 * full question fall back to counting correct options.
 */
export const isMultipleAnswer = (content: any, options: any[]): boolean =>
  typeof content?.multipleAnswers === 'boolean'
    ? content.multipleAnswers
    : options.filter((o) => o?.isCorrect).length > 1 && !content?.correctAnswer;
