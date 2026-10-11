import { toStudentQuestion } from '../src/utils/studentQuestionView';

describe('toStudentQuestion context', () => {
  const question = (competency: string) => ({
    type: 'multiple_choice',
    competency,
    content: {
      question: 'What did he buy?',
      context: 'Transcript: I bought some milk.',
      options: [{ id: 'A', text: 'milk', isCorrect: true }, { id: 'B', text: 'bread', isCorrect: false }],
    },
  });

  it('drops the transcript of a listening question', () => {
    const view = toStudentQuestion<any>(question('listening'));
    expect(view.content.context).toBeUndefined();
    expect(view.content.question).toBe('What did he buy?');
  });

  it('keeps the reading passage of other competencies', () => {
    expect(toStudentQuestion<any>(question('reading')).content.context).toBe('Transcript: I bought some milk.');
  });
});
