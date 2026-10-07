import { before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { Completions } from 'groq-sdk/resources/chat/completions';
import { fakeCollection, installFakeMongo } from './helpers/fake-mongo.js';

process.env.JWT_SECRET ??= 'test-secret';
process.env.SERVICE_TOKEN ??= 'test-service-token';
process.env.MONGO_DB_NAME = 'cba_platform';
process.env.GROQ_API_KEY = 'test-key';
process.env.KAFKA_BROKER = '127.0.0.1:9';

installFakeMongo();
const { connectDB } = await import('../src/db/connection.js');
const { generateQuestion } = await import('../src/tools/generate-question.js');

const DB = 'cba_platform';

/** Scripted model: each call returns the next content as a register_question tool call. */
let script: object[] = [];
let requests: any[] = [];
(Completions.prototype as any).create = async function (body: any) {
  requests.push(JSON.parse(JSON.stringify(body)));
  const content = script.shift();
  if (!content) throw new Error('script exhausted');
  return {
    model: 'scripted-model',
    choices: [{ message: { tool_calls: [{ function: { name: 'register_question', arguments: JSON.stringify({ content, metadata: {} }) } }] } }],
  };
};

const PASSAGE = 'Hi, I am Tom. I live in a small house with my mother and my sister. We have a cat. Her name is Mimi. She is black and white.';
const good = {
  context: PASSAGE,
  question: 'According to the text, what colour is the cat?',
  options: [
    { text: 'Black and white', isCorrect: true },
    { text: 'Brown', isCorrect: false },
    { text: 'Grey', isCorrect: false },
    { text: 'Orange', isCorrect: false },
  ],
};
const input = { competency: 'reading', level: 'A1', type: 'multiple_choice', difficulty: 2 } as const;
const lastUserMessage = (req: any) => req.messages.filter((m: any) => m.role === 'user').at(-1).content as string;

before(async () => {
  await connectDB();
});
beforeEach(() => {
  script = [];
  requests = [];
  fakeCollection(DB, 'questions').docs.length = 0;
});

describe('question generator with quality control', () => {
  test('a good first answer is accepted at once with a clean report', async () => {
    script = [good];
    const out = await generateQuestion({ ...input });
    assert.equal(out.attempts, 1);
    assert.equal(out.quality.score, 100);
    assert.deepEqual(out.quality.issues, []);
    assert.match(lastUserMessage(requests[0]), /passage of 20-80 words/);
  });

  test('a question without its passage is sent back with the reason and fixed', async () => {
    script = [{ ...good, context: '' }, good];
    const out = await generateQuestion({ ...input });
    assert.equal(out.attempts, 2);
    assert.match(lastUserMessage(requests[1]), /needs a passage in "context"/);
    assert.equal(out.question.content.context, PASSAGE);
  });

  test('a copy of a bank question is rejected; bank questions are quoted in the prompt', async () => {
    fakeCollection(DB, 'questions').docs.push({
      _id: new ObjectId(), ...input, isActive: true, createdAt: new Date(), content: { ...good, options: good.options.map((o, i) => ({ id: 'ABCD'[i], ...o })) },
    });
    const different = {
      context: 'Anna works in a café near the station. She starts at six in the morning and finishes at two. In the afternoon she plays tennis with her brother.',
      question: 'When does Anna finish work?',
      options: [
        { text: 'At two', isCorrect: true },
        { text: 'At six', isCorrect: false },
        { text: 'At noon', isCorrect: false },
        { text: 'At ten', isCorrect: false },
      ],
    };
    script = [{ ...good, question: 'According to the text, what colour is Mimi the cat?' }, different];
    const out = await generateQuestion({ ...input });
    assert.match(lastUserMessage(requests[0]), /ALREADY exist in the question bank[\s\S]*what colour is the cat/);
    assert.match(lastUserMessage(requests[1]), /almost identical to one already in the bank/);
    assert.equal(out.question.content.question, 'When does Anna finish work?');
  });

  test('warnings get one fix request; if they remain, the question is returned with them', async () => {
    const longCorrect = {
      ...good,
      options: [
        { text: 'It is black and white, like Mimi in the text', isCorrect: true },
        { text: 'Brown', isCorrect: false },
        { text: 'Grey', isCorrect: false },
        { text: 'Orange', isCorrect: false },
      ],
    };
    script = [longCorrect, longCorrect];
    const out = await generateQuestion({ ...input });
    assert.equal(out.attempts, 2);
    assert.deepEqual(out.quality.issues.map((i) => i.code), ['longest_option']);
    assert.equal(out.quality.issues[0]!.label, 'La opción correcta se delata por ser la más larga');
  });

  test('after three blocked answers the teacher gets the reasons in Spanish', async () => {
    const spanish = { ...good, question: '¿De qué color es el gato según el texto?' };
    script = [spanish, spanish, spanish];
    await assert.rejects(generateQuestion({ ...input }), /La IA no logró una pregunta válida: Parte del texto está en español/);
    assert.equal(requests.length, 3);
  });

  test('a listening transcript is kept verbatim even if the model rewrites it', async () => {
    const transcript = 'Woman: Excuse me, is this the bus to the airport? Man: No, the airport bus is number 12. It leaves from the other side of the street.';
    script = [{
      context: 'A woman asks a man about a bus.',
      question: 'Which bus goes to the airport?',
      options: [
        { text: 'Number 12', isCorrect: true },
        { text: 'Number 2', isCorrect: false },
        { text: 'Number 20', isCorrect: false },
        { text: 'Number 21', isCorrect: false },
      ],
    }];
    const out = await generateQuestion({ competency: 'listening', level: 'A2', type: 'multiple_choice', difficulty: 2, audioTranscript: transcript });
    assert.equal(out.question.content.context, transcript);
    assert.equal(out.attempts, 1);
  });
});

describe('generator request validation', async () => {
  const { GenerateQuestionRequestSchema } = await import('../src/schemas/grading.schemas.js');
  test('formats that do not measure the competency are refused before calling the model', () => {
    for (const [competency, type] of [['grammar', 'essay'], ['reading', 'drag_drop'], ['writing', 'multiple_choice'], ['vocabulary', 'drag_drop']]) {
      const r = GenerateQuestionRequestSchema.safeParse({ competency, type, level: 'A2' });
      assert.equal(r.success, false, `${competency}/${type}`);
    }
    assert.equal(GenerateQuestionRequestSchema.safeParse({ competency: 'grammar', type: 'drag_drop', level: 'A2' }).success, true);
  });
});
