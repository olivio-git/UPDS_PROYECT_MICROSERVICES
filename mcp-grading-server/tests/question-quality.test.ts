import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessQuestionQuality,
  countSyllables,
  questionSignature,
  similarity,
} from '../src/grading/question-quality.js';
import { BAD, GOOD } from './fixtures/generated-questions.js';

const codes = (s: (typeof GOOD)[number], existing?: string[]) =>
  assessQuestionQuality(s, s.content, { existing }).issues.map((i) => i.code).sort();

describe('question quality: well-made questions pass', () => {
  for (const s of GOOD) {
    test(s.name, () => {
      const report = assessQuestionQuality(s, s.content);
      assert.deepEqual(report.issues.map((i) => i.code), [], JSON.stringify(report.issues));
      assert.equal(report.score, 100);
    });
  }
});

describe('question quality: typical generation failures are caught', () => {
  for (const s of BAD) {
    test(s.name, () => assert.deepEqual(codes(s), [...s.expect].sort()));
  }

  test('each failure has an English fix request and a Spanish label', () => {
    for (const s of BAD) {
      for (const issue of assessQuestionQuality(s, s.content).issues) {
        assert.ok(issue.message.length > 10 && issue.label.length > 5, issue.code);
      }
    }
  });
});

describe('duplicates against the bank', () => {
  const original = GOOD.find((s) => s.name === 'B1 listening MC')!;

  test('a reworded copy is blocked, a related question only warned, a different one passes', () => {
    const copy = { ...original.content, question: 'Why is the woman so worried?' };
    const related = {
      ...original.content,
      context: 'Woman: Excuse me, does this bus stop at the station? Man: No, you need the number 12. This one goes to the airport. Woman: Oh no, my train leaves at eleven.',
    };
    const bank = [questionSignature(original.content)];
    assert.ok(assessQuestionQuality(original, copy, { existing: bank }).issues.some((i) => i.code === 'duplicate'));
    const relatedCodes = assessQuestionQuality(original, related, { existing: bank }).issues.map((i) => i.code);
    assert.ok(!relatedCodes.includes('duplicate'));
    assert.deepEqual(codes(GOOD[0]!, bank), []);
  });

  test('short template stems alone are not treated as duplicates', () => {
    assert.equal(similarity('Choose the correct word.', 'Choose the correct word.'), 0);
  });
});

test('score drops 25 per blocking issue and 8 per warning', () => {
  const s = BAD.find((b) => b.name === 'essay with one-line model answer')!;
  assert.equal(assessQuestionQuality(s, s.content).score, 100 - 8 * 2);
  const r = BAD.find((b) => b.name === 'reading with no passage')!;
  assert.equal(assessQuestionQuality(r, r.content).score, 75);
});

test('syllable counter is close enough for level checks', () => {
  assert.deepEqual(['cat', 'table', 'family', 'banana', 'necessitate', 'made'].map(countSyllables), [1, 2, 3, 3, 4, 1]);
});
