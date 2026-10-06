import type { Competency, IQuestion, Level, QuestionType } from '../../src/types/index.js';

export interface Sample {
  name: string;
  type: QuestionType;
  competency: Competency;
  level: Level;
  content: IQuestion['content'];
  /** Issue codes the checker must report; [] = a well-made question. */
  expect: string[];
}

const mc = (texts: string[], correct = 0) => texts.map((text, i) => ({ id: String(i), text, isCorrect: i === correct }));

/** Well-made questions in the shape the generator returns, across types and levels. */
export const GOOD: Sample[] = [
  {
    name: 'A1 reading MC', type: 'multiple_choice', competency: 'reading', level: 'A1', expect: [],
    content: {
      context: 'Hi, I am Tom. I live in a small house with my mother and my sister. We have a cat. Her name is Mimi. She is black and white.',
      question: 'According to the text, what colour is the cat?',
      options: mc(['Black and white', 'Brown', 'Grey', 'Orange']),
    },
  },
  {
    name: 'A2 reading TF', type: 'true_false', competency: 'reading', level: 'A2', expect: [],
    content: {
      context: 'Last weekend Sara went to the beach with her friends. They swam in the sea and ate pizza. In the evening it started to rain, so they took the bus home early.',
      question: 'Sara and her friends went home by bus.',
      options: [{ id: 'true', text: 'True', isCorrect: true }, { id: 'false', text: 'False', isCorrect: false }],
    },
  },
  {
    name: 'B1 listening MC', type: 'multiple_choice', competency: 'listening', level: 'B1', expect: [],
    content: {
      context: 'Woman: Excuse me, does this train stop at Oxford? Man: No, you need the 10:15 from platform 4. This one goes straight to Bristol. Woman: Oh no, I have a meeting at eleven. Man: Don\'t worry, it only takes forty minutes.',
      question: 'Why is the woman worried?',
      options: mc(['She has a meeting at eleven', 'She lost her ticket', 'The train to Bristol is late', 'She cannot find platform 2']),
    },
  },
  {
    name: 'A2 grammar MC', type: 'multiple_choice', competency: 'grammar', level: 'A2', expect: [],
    content: { question: 'Choose the correct word: Yesterday we ___ to the cinema.', options: mc(['went', 'go', 'goes', 'going']) },
  },
  {
    name: 'B1 grammar fill', type: 'fill_blanks', competency: 'grammar', level: 'B1', expect: [],
    content: {
      question: 'Complete the sentence with the correct form of the verb in brackets.',
      template: 'I ___ (live) in this city since 2015.',
      blanks: [{ position: 0, correctAnswers: ['have lived', "'ve lived"] }],
    },
  },
  {
    name: 'A1 vocabulary MC', type: 'multiple_choice', competency: 'vocabulary', level: 'A1', expect: [],
    content: { question: 'Which one is a fruit you can eat for breakfast?', options: mc(['banana', 'carrot', 'onion', 'potato']) },
  },
  {
    name: 'A2 vocabulary matching', type: 'matching', competency: 'vocabulary', level: 'A2', expect: [],
    content: {
      question: 'Match each word with its opposite.',
      items: [
        { id: '1', content: 'hot', matchingPair: 'cold' },
        { id: '2', content: 'early', matchingPair: 'late' },
        { id: '3', content: 'cheap', matchingPair: 'expensive' },
        { id: '4', content: 'empty', matchingPair: 'full' },
      ],
    },
  },
  {
    name: 'A2 grammar sentence builder', type: 'drag_drop', competency: 'grammar', level: 'A2', expect: [],
    content: {
      question: 'Build the sentence: "Ella nunca bebe café por la noche."',
      items: [
        { id: '1', content: 'She', correctPosition: 1 },
        { id: '2', content: 'never', correctPosition: 2 },
        { id: '3', content: 'drinks', correctPosition: 3 },
        { id: '4', content: 'coffee', correctPosition: 4 },
        { id: '5', content: 'at night.', correctPosition: 5 },
      ],
    },
  },
  {
    name: 'A2 writing essay', type: 'essay', competency: 'writing', level: 'A2', expect: [],
    content: {
      question: 'Write an email to a friend about your last holiday.',
      instructions: 'Write 50-80 words. Say where you went, who you went with and what you did.',
      sampleAnswer:
        'Hi Lucy, last summer I went to the mountains with my family. We stayed in a small hotel near a lake. Every morning we walked in the forest and in the afternoon we swam in the lake. The food was delicious and the people were very friendly. I took a lot of photos. I want to go back next year! Love, Ana',
      keywords: ['went', 'stayed', 'hotel', 'lake', 'friendly'],
    },
  },
  {
    name: 'B1 speaking audio', type: 'audio_response', competency: 'speaking', level: 'B1', expect: [],
    content: {
      question: 'Talk about a person who has helped you in your life.',
      instructions: 'Speak for about one minute. Say who the person is, how they helped you and how you feel about it.',
      sampleAnswer: 'My grandmother has helped me a lot. When I was a child she taught me to read and cook. She always listens to me, and I feel very grateful.',
      keywords: ['helped', 'taught', 'grateful', 'listens'],
    },
  },
  {
    name: 'B2 reading open text', type: 'open_text', competency: 'reading', level: 'B2', expect: [],
    content: {
      context:
        'Remote work has changed the way many companies operate. While employees often appreciate the flexibility and the time saved on commuting, managers report that building trust and team spirit has become harder. Some firms have responded by organising regular in-person meetings, whereas others invest in digital tools that encourage informal conversation. Research suggests that the most successful teams combine both approaches, adapting them to the needs of each project rather than following a single rule for everyone in the organisation.',
      question: 'According to the text, what do the most successful teams do?',
      sampleAnswer: 'They combine in-person meetings and digital tools, adapting them to each project.',
    },
  },
  {
    name: 'A1 ordering', type: 'ordering', competency: 'reading', level: 'A1', expect: [],
    content: {
      context: 'Every morning Ben gets up at seven. He has a shower and then he eats breakfast. After that he walks to school with his friend Sam.',
      question: 'Put Ben\'s morning in order.',
      items: [
        { id: '1', content: 'Ben gets up.', correctPosition: 1 },
        { id: '2', content: 'He has a shower.', correctPosition: 2 },
        { id: '3', content: 'He eats breakfast.', correctPosition: 3 },
        { id: '4', content: 'He walks to school.', correctPosition: 4 },
      ],
    },
  },
];

/** Typical LLM failures, each paired with the issue the checker must report. */
export const BAD: Sample[] = [
  {
    name: 'question in Spanish', type: 'multiple_choice', competency: 'grammar', level: 'A1', expect: ['language'],
    content: { question: '¿Cuál es la forma correcta del verbo en esta oración?', options: mc(['is', 'are', 'am', 'be']) },
  },
  {
    name: 'reading with no passage', type: 'multiple_choice', competency: 'reading', level: 'A2', expect: ['missing_context'],
    content: { question: 'Where does Tom work?', options: mc(['In a bank', 'In a shop', 'In a school', 'In a hospital']) },
  },
  {
    name: 'answer in the question', type: 'multiple_choice', competency: 'vocabulary', level: 'A2', expect: ['answer_in_question'],
    content: { question: 'A kitchen is the room where you cook. Which room is it?', options: mc(['kitchen', 'bedroom', 'garage', 'garden']) },
  },
  {
    name: 'all of the above', type: 'multiple_choice', competency: 'grammar', level: 'B1', expect: ['banned_option'],
    content: { question: 'Which sentence is correct?', options: mc(['All of the above', 'She go home', 'She goes home', 'She going home']) },
  },
  {
    name: 'correct option is the long one', type: 'multiple_choice', competency: 'reading', level: 'B1', expect: ['longest_option'],
    content: {
      context: 'The museum opens at nine on weekdays, but on Sundays it opens later, at eleven, because the staff prepare the new exhibitions in the morning.',
      question: 'Why does the museum open later on Sundays?',
      options: mc(['Because the staff prepare the new exhibitions in the morning', 'It is closed', 'Visitors sleep', 'No staff']),
    },
  },
  {
    name: 'hint is the answer', type: 'fill_blanks', competency: 'grammar', level: 'A1', expect: ['answer_in_hint'],
    content: { question: 'Complete the sentence.', template: 'They ___ (play) football every Sunday.', blanks: [{ position: 0, correctAnswers: ['play'] }] },
  },
  {
    name: 'A1 passage far above level', type: 'multiple_choice', competency: 'reading', level: 'A1', expect: ['passage_too_long', 'sentences_too_long', 'vocabulary_too_hard'],
    content: {
      context:
        'Contemporary urban environments increasingly necessitate sophisticated infrastructural interventions, particularly regarding sustainable transportation alternatives, which municipal authorities frequently consider economically problematic despite considerable environmental advantages. '.repeat(5) +
        'Consequently, administrative institutions occasionally postpone implementation indefinitely, generating considerable dissatisfaction amongst environmentally conscious residents everywhere.',
      question: 'What do municipal authorities consider problematic?',
      options: mc(['Sustainable transportation', 'Private car parking', 'Residential housing', 'Public holidays']),
    },
  },
  {
    name: 'answer not in passage', type: 'multiple_choice', competency: 'reading', level: 'A2', expect: ['not_grounded'],
    content: {
      context: 'Maria lives in Madrid. She works in a hospital and she starts at eight. After work she likes to go running in the park.',
      question: 'What does Maria do on Saturdays?',
      options: mc(['She visits her grandparents', 'She goes to the cinema', 'She cleans the house', 'She studies English']),
    },
  },
  {
    name: 'trivial matching', type: 'matching', competency: 'vocabulary', level: 'A2', expect: ['trivial_pair'],
    content: {
      question: 'Match the words with their meanings.',
      items: [
        { id: '1', content: 'teacher', matchingPair: 'a teacher works in a school' },
        { id: '2', content: 'doctor', matchingPair: 'helps sick people' },
        { id: '3', content: 'farmer', matchingPair: 'grows food' },
      ],
    },
  },
  {
    name: 'sentence builder without full stop', type: 'drag_drop', competency: 'grammar', level: 'A1', expect: ['chunk_count', 'final_punctuation'],
    content: { question: 'Build the sentence.', items: [{ id: '1', content: 'I', correctPosition: 1 }, { id: '2', content: 'like', correctPosition: 2 }, { id: '3', content: 'tea', correctPosition: 3 }] },
  },
  {
    name: 'essay with one-line model answer', type: 'essay', competency: 'writing', level: 'B1', expect: ['sample_length', 'no_instructions'],
    content: { question: 'Write about your favourite film.', sampleAnswer: 'My favourite film is Titanic because it is sad.' },
  },
];
