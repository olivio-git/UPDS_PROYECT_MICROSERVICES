import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { detectGrammar, estimateLevel, lemmaCandidates, wordLevel, LEVELS } from '../src/grading/cefr/cefr-level.js';

const lvl = (w: string) => LEVELS[wordLevel(w)];

describe('vocabulary lookup (CEFR-J)', () => {
  test('inflected forms resolve to their headword level', () => {
    assert.equal(lvl('went'), 'A1');
    assert.equal(lvl('children'), 'A1');
    assert.equal(lvl('studies'), lvl('study'));
    assert.equal(lvl('happier'), lvl('happy'));
    assert.equal(lvl('stopped'), lvl('stop'));
    assert.equal(lvl("isn't"), 'A1');
    assert.ok(lemmaCandidates('making').includes('make'));
  });

  test('levels go up with rarity', () => {
    assert.equal(lvl('house'), 'A1');
    assert.ok(['B1', 'B2'].includes(lvl('environment')!));
    assert.equal(lvl('infrastructural'), 'C1', 'not in the A1–B2 list');
  });
});

describe('text level estimate', () => {
  const a1 = 'My name is Ana. I live in a small house with my mother and my brother. We have a dog. It is black. I go to school every day.';
  const b2 = 'Although remote work offers considerable flexibility, many organisations report that maintaining trust and a shared sense of purpose has become increasingly challenging, particularly for recently recruited employees.';

  test('a simple A1 text is A1 and a dense B2 sentence is far above it', () => {
    assert.equal(estimateLevel(a1).level, 'A1');
    assert.ok(LEVELS.indexOf(estimateLevel(b2).lexicalLevel) >= 2, estimateLevel(b2).lexicalLevel);
    assert.ok(estimateLevel(a1).coverage[0] > estimateLevel(b2).coverage[0]);
  });

  test('names are not counted as hard words', () => {
    const above = estimateLevel('Sara and Ben live in Madrid with Mimi. Mimi is a cat.').wordsAbove('A1');
    assert.deepEqual(above, []);
  });

  test('wordsAbove lists the words that push the level up', () => {
    const above = estimateLevel(b2).wordsAbove('A2').map((w) => w.word);
    assert.ok(above.includes('considerable') || above.includes('flexibility'));
  });
});

describe('grammar structures (precision on hand-labelled sentences)', () => {
  const cases: Array<[string, string | null]> = [
    ['She was reading when I arrived.', 'past continuous'],
    ['I have lived here since 2015.', 'present perfect'],
    ['We used to play football.', 'used to'],
    ['They have been waiting for an hour.', 'present perfect continuous'],
    ['When we arrived, the film had started.', 'past perfect'],
    ['If I had more money, I would travel.', 'second conditional'],
    ['If she had studied, she would have passed.', 'third conditional'],
    ['He said that he would call me.', 'reported speech'],
    ['My brother, who lives in Paris, is a doctor.', 'non-defining relative clause'],
    ['You should have told me.', 'modal perfect'],
    ['The bridge has been built.', 'passive with perfect or modal'],
    ['I wish I were taller.', 'wish + past'],
    ['By June I will have finished.', 'future perfect'],
    ['Had I known, I would have come.', 'inversion'],
    // Must NOT be read as harder structures:
    ['I have a car and two bikes.', null],
    ['I had to work yesterday.', null],
    ['If it rains, I will stay at home.', null],
    ['I am interested in music.', null],
    ['She has three brothers.', null],
  ];
  for (const [sentence, structure] of cases) {
    test(sentence, () => {
      const found = detectGrammar(sentence).map((g) => g.structure);
      if (structure) assert.ok(found.includes(structure), `expected ${structure}, got ${found.join(', ') || 'nothing'}`);
      else assert.deepEqual(found, []);
    });
  }
});
