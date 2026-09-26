import { resumePosition } from '../src/utils/resumePosition';

/**
 * Regression: resuming an attempt reported the total as the questions up to
 * the first section with an unanswered question, so the finish dialog read
 * "13 / 4 respondidas" on a 13-question exam.
 */
const q = (id: string) => ({ _id: id });
const sections = [
  { questions: [q('a1'), q('a2'), q('a3'), q('a4')] },
  { questions: [q('b1'), q('b2'), q('b3')] },
  { questions: [q('c1'), q('c2'), q('c3')] },
  { questions: [q('d1'), q('d2'), q('d3')] },
];

describe('resumePosition', () => {
  it('counts every section even when the first one is incomplete', () => {
    const answers = { a1: 'x', b1: 'x', b2: 'x', c1: 'x' };
    expect(resumePosition(sections, answers)).toEqual({
      totalQuestions: 13,
      currentSectionIndex: 0,
      currentQuestionIndex: 1,
    });
  });

  it('resumes at the first unanswered question of a later section', () => {
    const answers = { a1: 'x', a2: 'x', a3: 'x', a4: 'x', b1: 'x' };
    expect(resumePosition(sections, answers)).toEqual({
      totalQuestions: 13,
      currentSectionIndex: 1,
      currentQuestionIndex: 1,
    });
  });

  it('stays on the last question when everything is answered', () => {
    const all = Object.fromEntries(sections.flatMap((s) => s.questions.map((x) => [x._id, 'x'])));
    expect(resumePosition(sections, all)).toEqual({
      totalQuestions: 13,
      currentSectionIndex: 3,
      currentQuestionIndex: 2,
    });
  });

  it('handles an exam with no sections', () => {
    expect(resumePosition([], {})).toEqual({
      totalQuestions: 0,
      currentSectionIndex: 0,
      currentQuestionIndex: 0,
    });
  });
});
