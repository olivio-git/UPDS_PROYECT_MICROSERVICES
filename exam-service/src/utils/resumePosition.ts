/**
 * Where a resumed attempt picks up, and how many questions the exam has.
 *
 * The position is the first unanswered question, in section order; when
 * everything is answered it is the last question of the last section. The
 * total always counts every section. It used to stop at the first section
 * with an unanswered question, so a student who resumed saw
 * "13 / 4 respondidas".
 */
export interface ResumeSection {
  questions: Array<{ _id: { toString(): string } }>;
}

export interface ResumePosition {
  totalQuestions: number;
  currentSectionIndex: number;
  currentQuestionIndex: number;
}

export function resumePosition(
  sections: ResumeSection[],
  answers: Record<string, unknown>
): ResumePosition {
  const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);

  for (const [sectionIdx, section] of sections.entries()) {
    const firstUnanswered = section.questions.findIndex(
      (question) => !answers[question._id.toString()]
    );
    if (firstUnanswered !== -1) {
      return { totalQuestions, currentSectionIndex: sectionIdx, currentQuestionIndex: firstUnanswered };
    }
  }

  const lastSection = Math.max(0, sections.length - 1);
  return {
    totalQuestions,
    currentSectionIndex: lastSection,
    currentQuestionIndex: Math.max(0, (sections[lastSection]?.questions.length ?? 0) - 1),
  };
}
