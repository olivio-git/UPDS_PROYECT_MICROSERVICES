// Only the pure validation is exercised; the service's collaborators need env, redis and kafka.
jest.mock('../src/config/redis', () => ({ cache: {} }));
jest.mock('../src/services/kafka.service', () => ({ KafkaService: class {} }));
jest.mock('../src/models/question.model', () => ({ Question: {} }));
jest.mock('../src/models/rubric.model', () => ({ Rubric: {} }));
jest.mock('../src/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock('../src/utils/constants', () => ({ CONSTANTS: {} }));

import { QuestionService } from '../src/services/question.service';

const validate = (data: Record<string, unknown>, hasAudioFile = false) =>
  (QuestionService.prototype as any).validateQuestionData.call({}, data, hasAudioFile);

const listening = (extra: Record<string, unknown> = {}) => ({
  type: 'multiple_choice',
  competency: 'listening',
  content: { question: 'q', options: [{ id: 'A', text: 'a', isCorrect: true }, { id: 'B', text: 'b' }] },
  ...extra,
});

describe('listening question without audio', () => {
  it('is rejected while active (the default)', () => {
    expect(() => validate(listening())).toThrow(/requieren audio/);
    expect(() => validate(listening({ isActive: true }))).toThrow(/requieren audio/);
  });

  it('is accepted as an inactive draft', () => {
    expect(() => validate(listening({ isActive: false }))).not.toThrow();
  });

  it('cannot be activated without audio, but can once it has it', () => {
    expect(() => validate(listening({ isActive: true }), false)).toThrow(/requieren audio/);
    expect(() => validate({ ...listening({ isActive: true }), content: { ...listening().content, mediaUrl: 'https://x/a.mp3' } })).not.toThrow();
    expect(() => validate(listening({ isActive: true }), true)).not.toThrow();
  });

  it('other validations still apply to drafts', () => {
    expect(() => validate({ ...listening({ isActive: false }), content: { question: 'q', options: [] } })).toThrow();
  });
});

describe('validation errors are client errors', () => {
  it('carry HTTP 400 so the API does not answer 500', () => {
    let thrown: any;
    try { validate(listening()); } catch (error) { thrown = error; }
    expect(thrown).toMatchObject({ statusCode: 400, message: expect.stringMatching(/requieren audio/) });
  });
});
