import { answerKeyProblems, formatMismatch, QUESTION_FORMATS_BY_COMPETENCY, withDefaultPositions } from '../src/utils/questionFormats';
import { toStudentQuestion } from '../src/utils/studentQuestionView';

describe('question formats per competency', () => {
  it('accepts the formats that measure each competency', () => {
    for (const [competency, types] of Object.entries(QUESTION_FORMATS_BY_COMPETENCY)) {
      for (const type of types) expect(formatMismatch(type, competency)).toBeNull();
    }
  });

  it.each([
    ['essay', 'reading'],
    ['drag_drop', 'reading'],
    ['multiple_choice', 'writing'],
    ['matching', 'writing'],
    ['audio_response', 'listening'],
    ['essay', 'grammar'],
    ['drag_drop', 'vocabulary'],
    ['multiple_choice', 'speaking'],
  ])('rejects %s for %s with a reason in Spanish', (type, competency) => {
    expect(formatMismatch(type, competency)).toMatch(/no evalúa .*Formatos válidos/);
  });
});

describe('answer key checks', () => {
  it('multiple choice needs a correct option and distinct options', () => {
    expect(answerKeyProblems('multiple_choice', { options: [{ text: 'a' }, { text: 'b' }] })).toContain('Marca al menos una opción correcta');
    expect(answerKeyProblems('multiple_choice', { options: [{ text: 'a', isCorrect: true }, { text: 'A' }] })).toContain('Hay opciones repetidas');
    expect(answerKeyProblems('multiple_choice', { options: [{ text: 'a', isCorrect: true }, { text: 'b' }] })).toEqual([]);
  });

  it('fill in the blanks needs one answer per gap', () => {
    const content = { template: 'I ___ to ___.', blanks: [{ position: 0, correctAnswers: ['went'] }] };
    expect(answerKeyProblems('fill_blanks', content)[0]).toMatch(/2 espacios y 1 respuestas/);
  });

  it('matching needs a distinct pair per row', () => {
    expect(answerKeyProblems('matching', { items: [{ content: 'hot', matchingPair: 'cold' }, { content: 'warm', matchingPair: 'Cold' }] }))
      .toContain('Las parejas deben ser distintas (una sola respuesta por fila)');
  });

  it('ordering positions must be 1..n; missing positions follow the list order', () => {
    expect(answerKeyProblems('ordering', { items: [{ content: 'a', correctPosition: 1 }, { content: 'b', correctPosition: 1 }, { content: 'c', correctPosition: 3 }] })).toHaveLength(1);
    const filled = withDefaultPositions('ordering', { items: [{ content: 'a' }, { content: 'b' }, { content: 'c' }] });
    expect(filled.items.map((i: any) => i.correctPosition)).toEqual([1, 2, 3]);
    expect(answerKeyProblems('ordering', filled)).toEqual([]);
  });
});

describe('student view of a question', () => {
  const keyFields = ['isCorrect', 'correctPosition', 'matchingPair', 'correctAnswers', 'correctAnswer', 'sampleAnswer', 'keywords'];
  const leaks = (v: unknown) => keyFields.filter((k) => JSON.stringify(v).includes(`"${k}"`));

  it.each([
    ['multiple_choice', { question: 'q', correctAnswer: 'A', options: [{ id: 'A', text: 'a', isCorrect: true }, { id: 'B', text: 'b', isCorrect: true }, { id: 'C', text: 'c' }] }],
    ['fill_blanks', { question: 'q', template: '___', blanks: [{ position: 0, correctAnswers: ['went'] }], correctAnswer: ['went'] }],
    ['matching', { question: 'q', items: [{ id: 'm1', content: 'hot', matchingPair: 'cold' }, { id: 'm2', content: 'up', matchingPair: 'down' }] }],
    ['ordering', { question: 'q', items: [{ id: 'o1', content: 'a', correctPosition: 1 }, { id: 'o2', content: 'b', correctPosition: 2 }] }],
    ['essay', { question: 'q', sampleAnswer: 'model', keywords: ['k'] }],
  ])('%s carries no answer key', (type, content) => {
    const view = toStudentQuestion({ type, content });
    expect(leaks(view)).toEqual([]);
  });

  it('keeps what the runner needs: option ids, selection mode, matching column, blank count', () => {
    const mc = toStudentQuestion<any>({ type: 'multiple_choice', content: { question: 'q', options: [{ id: 'A', text: 'a', isCorrect: true }, { id: 'B', text: 'b', isCorrect: true }] } });
    expect(mc.content.multipleAnswers).toBe(true);
    expect(mc.content.options.map((o: any) => o.id).sort()).toEqual(['A', 'B']);
    const m = toStudentQuestion<any>({ type: 'matching', content: { question: 'q', items: [{ id: 'm1', content: 'hot', matchingPair: 'cold' }, { id: 'm2', content: 'up', matchingPair: 'down' }] } });
    expect([...m.content.matchOptions].sort()).toEqual(['cold', 'down']);
    const f = toStudentQuestion<any>({ type: 'fill_blanks', content: { question: 'q', template: '___ ___', blanks: [{ position: 0, correctAnswers: ['a'] }, { position: 1, correctAnswers: ['b'] }] } });
    expect(f.content.blanks).toEqual([{ position: 0 }, { position: 1 }]);
  });
});
