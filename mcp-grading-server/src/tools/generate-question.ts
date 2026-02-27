import Groq from 'groq-sdk';
import { ObjectId } from 'mongodb';
import { config } from '../config.js';
import { getLevels, getQuestions } from '../db/collections.js';
import type { IQuestion, QuestionType, Competency, Level } from '../types/index.js';

export interface GenerateQuestionInput {
  competency: Competency;
  level: Level;
  type: QuestionType;
  difficulty: number;
  topic?: string;
  thematicContext?: string;
  audioTranscript?: string;
  save?: boolean;
  createdBy?: string;
  /** Question texts already generated in this batch — injected into prompt to enforce diversity */
  avoidQuestions?: string[];
}

export interface GenerateQuestionOutput {
  question: Omit<IQuestion, '_id' | 'statistics' | 'createdAt' | 'updatedAt' | 'createdBy'>;
  savedId?: string;
  model: string;
}

const TYPE_HINTS: Partial<Record<QuestionType, string>> = {
  multiple_choice: 'Provide options array with exactly 4 items, exactly one isCorrect=true. Set correctAnswer to the id of the correct option.',
  true_false:
    'The "question" field MUST be a STATEMENT (NOT a question), e.g. "The cat is sitting on the mat." ' +
    '— the student decides whether that statement is True or False. ' +
    'Provide options with EXACTLY 2 items: ' +
    'first: { id: "true", text: "True", isCorrect: true } if the statement is correct, ' +
    'OR { id: "true", text: "True", isCorrect: false } if the statement is wrong. ' +
    'second: { id: "false", text: "False", isCorrect: <opposite> }. ' +
    'NEVER use content-based option texts — always "True" and "False" literally.',
  fill_blanks: 'Provide template string with ___ for each blank. Provide blanks array with position (1-based), correctAnswers array. Also set correctAnswer as array of answers.',
  matching: 'Provide items array where each item has content and matchingPair (its correct match).',
  ordering: 'Provide items array where each item has content and correctPosition (1-based integer).',
  drag_drop: 'Provide items array where each item has content and correctPosition (1-based integer).',
  essay:
    'ESSAY is a WRITING PRODUCTION task — NOT a comprehension question. ' +
    'The "question" field MUST be a writing prompt that asks the student to PRODUCE their own text, ' +
    'e.g. "Write a short paragraph about your daily routine." or "Describe a place you like." ' +
    'NEVER ask the student to extract information from a text. ' +
    'The "instructions" field should guide the student (word count, structure hints). ' +
    'The "sampleAnswer" MUST be a full model answer at the CEFR level — not a single sentence, ' +
    'but a proper paragraph or structured text showing what a good student response looks like. ' +
    'Include "keywords" with 4-6 vocabulary items the student should use.',
  open_text:
    'SHORT-ANSWER question: the student writes 1-3 sentences in response. ' +
    'The "question" field should be a clear, specific question. ' +
    'Include sampleAnswer as a model short answer (1-2 sentences). ' +
    'Optionally include keywords array with key vocabulary.',
  audio_response:
    'AUDIO RESPONSE is a SPEAKING PRODUCTION task — the student RECORDS their spoken answer. ' +
    'NEVER generate a comprehension question requiring a text or multiple-choice answer. ' +
    'The "question" field MUST be a clear SPEAKING PROMPT that tells the student what to say out loud, ' +
    'e.g. "Describe your daily routine in a few sentences." or "Talk about your favourite place." ' +
    'The "instructions" field should guide the student: how long to speak, what aspects to cover, ' +
    'e.g. "Speak for about 30 seconds. Mention at least 2 details." ' +
    'Include "keywords" with 4-6 vocabulary items the student should try to use in their spoken response. ' +
    'The "sampleAnswer" should be a short model spoken response (2-4 sentences) showing target language use. ' +
    'Do NOT add a "context" reading passage. Do NOT use options, items or template fields.',
};

// Competency-specific requirements injected into the prompt.
// These enforce structural rules that the question type hints alone cannot cover.
const COMPETENCY_HINTS: Partial<Record<Competency, string>> = {
  reading:
    'REQUIRED: You MUST populate the "context" field with a short reading passage (2-5 sentences) ' +
    'appropriate for the CEFR level. The question MUST be about that passage — use phrasing like ' +
    '"According to the text...", "What does the passage say about...", "Based on the text...". ' +
    'NEVER create a standalone question that ignores the passage.',
  listening:
    'REQUIRED: You MUST populate the "context" field with a short listening scenario or dialogue ' +
    '(2-4 exchanges or a brief description of what was heard). The question must be about that scenario.',
  writing:
    'This is a WRITING PRODUCTION task. The "question" must be a writing prompt (not a reading question). ' +
    'Provide "instructions" with word-count guidance and structural hints appropriate for the CEFR level. ' +
    'The "sampleAnswer" MUST be a complete model text (full paragraph or structured response) ' +
    'that demonstrates the expected output — not a single sentence. ' +
    'Add "keywords" with 4-6 vocabulary items the student should include.',
  speaking:
    'Provide a clear speaking prompt in the "instructions" field. Include a sampleAnswer showing ' +
    'what a good spoken response would include. Add keywords with key phrases.',
  grammar:
    'Focus on exactly one grammar point relevant to the CEFR level. The question must test correct ' +
    'understanding or application of that specific rule.',
  vocabulary:
    'Focus on word meaning or usage in context. When possible, embed the target word in a sentence ' +
    'within the question text to give context for the answer.',
};

/**
 * Generate a question using GROQ tool_use (function calling).
 * Instead of parsing text output, GROQ fills in a structured `register_question`
 * tool call — the arguments come back as validated JSON matching IQuestion['content'].
 */
export async function generateQuestion(input: GenerateQuestionInput): Promise<GenerateQuestionOutput> {
  if (!config.groq.apiKey) throw new Error('GROQ_API_KEY not configured');

  const groq = new Groq({ apiKey: config.groq.apiKey });

  // ── Fetch level requirements from DB ────────────────────────────────────────
  // Use the actual CEFR/MCER data stored by admins instead of hardcoded hints.
  // Falls back gracefully if the level document doesn't exist yet.
  const levelDoc = await getLevels().findOne(
    { code: input.level, isActive: true },
    { projection: { description: 1, competencyRequirements: 1 } }
  );

  // Build a concise level+competency context block for the prompt
  const levelContextLines: string[] = [
    `- CEFR Level: ${input.level}${levelDoc?.description ? ` — ${levelDoc.description}` : ''}`,
  ];
  const compReq = (levelDoc?.competencyRequirements as any)?.[input.competency];
  if (compReq?.description) {
    levelContextLines.push(`- ${input.competency} at ${input.level}: ${compReq.description}`);
  }
  if (compReq?.canDoStatements?.length) {
    levelContextLines.push(
      `- What students CAN DO at this level for ${input.competency}:`,
      ...(compReq.canDoStatements as string[]).map((s: string) => `  • ${s}`)
    );
  }
  const levelContext = levelContextLines.join('\n');

  // ── Rest of prompt parameters ────────────────────────────────────────────────
  const typeHint = TYPE_HINTS[input.type] ?? `Type: ${input.type}`;

  // Resolve type vs competency conflicts:
  // essay is always a WRITING PRODUCTION task — competencies like reading/listening
  // should only influence the TOPIC AREA, not impose comprehension-question patterns.
  // audio_response is always a SPEAKING PRODUCTION task — same principle applies.
  let competencyHint = COMPETENCY_HINTS[input.competency] ?? '';
  if (input.competency === 'listening' && input.audioTranscript) {
    competencyHint =
      'REQUIRED: The student will listen to a real audio recording. ' +
      'The "context" field MUST contain the EXACT transcript provided — do NOT invent, paraphrase, or modify it. ' +
      'Generate questions about what is ACTUALLY said in that transcript. ' +
      'Your questions, options, and correct answers must be grounded ONLY in the transcript content. ' +
      'Do NOT introduce information that is not present in the transcript.';
  }
  if (input.type === 'essay' && (input.competency === 'reading' || input.competency === 'listening')) {
    competencyHint =
      `The competency "${input.competency}" defines only the TOPIC AREA for this essay. ` +
      `This is a WRITING PRODUCTION task — do NOT generate a comprehension question, ` +
      `do NOT add a "context" passage, and do NOT ask the student to extract information. ` +
      `The student must write their own original text inspired by the topic.`;
  }
  if (input.type === 'audio_response' && input.competency !== 'speaking') {
    competencyHint =
      `The competency "${input.competency}" defines only the TOPIC AREA for this speaking task. ` +
      `This is a SPEAKING PRODUCTION task — do NOT generate a comprehension question, ` +
      `do NOT add a reading/listening "context" passage, and do NOT ask the student to extract information. ` +
      `The student must speak their own original response about a topic related to "${input.competency}". ` +
      `Generate a speaking prompt appropriate for that topic area.`;
  }
  const topicLine = input.topic ? `- Topic: ${input.topic}` : '';
  // Audio transcript takes priority over thematicContext for listening questions.
  const contextLine = input.audioTranscript
    ? `- AUDIO TRANSCRIPT (source of truth — use verbatim in the "context" field, do NOT modify):\n"${input.audioTranscript}"`
    : input.thematicContext
    ? `- REQUIRED TOPIC: The entire question content MUST be about "${input.thematicContext}". ` +
      `Do NOT use any other topic (e.g. books, school, sports) unless it is directly related to "${input.thematicContext}". ` +
      `Every example, word, sentence, and scenario in your response MUST relate to this topic.`
    : '';
  const difficultyDesc =
    input.difficulty <= 2
      ? 'simple vocabulary, basic structures'
      : input.difficulty === 3
      ? 'intermediate complexity, common vocabulary'
      : 'complex structures, academic/sophisticated vocabulary';

  const systemPrompt =
    'You are an expert English language test designer following the CEFR/MCER framework. ' +
    'You MUST call register_question with complete, original, ready-to-use question data. ' +
    'CRITICAL: The question content, vocabulary and grammar complexity MUST strictly match ' +
    'the CEFR level and competency requirements provided — do NOT exceed them. ' +
    'TOPIC RULE: When a REQUIRED TOPIC is given, you MUST use it — never default to generic topics ' +
    'like books, school, or sports unless they are part of the required topic. ' +
    'LANGUAGE RULE: ALL generated content (question text, options, instructions, sample answers, ' +
    'keywords, items) MUST be written in ENGLISH only — never in Spanish or any other language. ' +
    'Level descriptions may be provided in Spanish for reference only; ignore their language. ' +
    'Generate UNIQUE content — never copy or paraphrase the schema examples. ' +
    'For essay and open_text types, sampleAnswer is REQUIRED — always include a model answer.';

  // Diversity block: injected when generating in bulk to prevent repetition
  const avoidBlock =
    input.avoidQuestions && input.avoidQuestions.length > 0
      ? [
          '',
          'DIVERSITY REQUIREMENT: The questions below have ALREADY been generated.',
          'Your question MUST be distinctly different — use a different topic, scenario, vocabulary set, and structure.',
          'Do NOT paraphrase, rephrase, or closely mirror any of these:',
          ...input.avoidQuestions
            .slice(0, 20)
            .map((q, i) => `  ${i + 1}. "${q.substring(0, 150)}"`),
          '',
        ]
      : [];

  const userPrompt = [
    `Generate a ${input.type.replace(/_/g, ' ')} question with these parameters:`,
    `- Competency: ${input.competency}`,
    levelContext,
    `- Difficulty: ${input.difficulty}/5 (${difficultyDesc})`,
    topicLine,
    contextLine,
    ...avoidBlock,
    `Type-specific instructions: ${typeHint}`,
    competencyHint ? `Competency-specific requirement: ${competencyHint}` : '',
    '',
    input.audioTranscript
      ? `REMINDER: Use the audio transcript above as the "context" field verbatim. All questions and answers must come from that transcript only.`
      : input.thematicContext
      ? `REMINDER: The question topic is "${input.thematicContext}" — do not change the topic.`
      : '',
    'IMPORTANT: Every word, sentence structure and grammar point in the question must be ' +
    'appropriate for the CEFR level described above. Do not use vocabulary or grammar ' +
    'that exceeds the level requirements.',
    '',
    'Call register_question with the complete question data.',
  ]
    .filter(Boolean)
    .join('\n');

  // Define register_question as a GROQ tool.
  // GROQ will fill in the arguments as structured JSON — no text parsing needed.
  const tool: Groq.Chat.Completions.ChatCompletionTool = {
    type: 'function',
    function: {
      name: 'register_question',
      description: 'Register a structured educational question into the assessment system',
      parameters: {
        type: 'object',
        required: ['content', 'metadata'],
        properties: {
          content: {
            type: 'object',
            required: ['question'],
            description: 'Question content fields',
            properties: {
              question: { type: 'string', description: 'The main question text shown to the student' },
              instructions: { type: 'string', description: 'Additional instructions for the student' },
              context: { type: 'string', description: 'Reading passage or situational context (for reading/listening)' },
              correctAnswer: {
                description: 'Correct answer: single string or array of strings (for fill_blanks)',
                oneOf: [
                  { type: 'string' },
                  { type: 'array', items: { type: 'string' } },
                ],
              },
              sampleAnswer: { type: 'string', description: 'Model answer for essay/open_text scoring' },
              keywords: {
                type: 'array',
                items: { type: 'string' },
                description: 'Expected vocabulary/key terms',
              },
              template: {
                type: 'string',
                description: 'Sentence template with ___ placeholders for fill_blanks',
              },
              options: {
                type: 'array',
                description: 'Answer options for multiple_choice and true_false',
                items: {
                  type: 'object',
                  required: ['text', 'isCorrect'],
                  properties: {
                    id: { type: 'string', description: 'Option identifier (auto-generated if omitted)' },
                    text: { type: 'string' },
                    isCorrect: { type: 'boolean' },
                  },
                },
              },
              items: {
                type: 'array',
                description: 'Items for matching, ordering, drag_drop',
                items: {
                  type: 'object',
                  required: ['content'],
                  properties: {
                    id: { type: 'string', description: 'Item identifier (auto-generated if omitted)' },
                    content: { type: 'string' },
                    matchingPair: { type: 'string', description: 'Correct match (for matching type)' },
                    correctPosition: { type: 'number', description: '1-based correct position (for ordering/drag_drop)' },
                  },
                },
              },
              blanks: {
                type: 'array',
                description: 'Blank definitions for fill_blanks',
                items: {
                  type: 'object',
                  required: ['position', 'correctAnswers'],
                  properties: {
                    position: { type: 'number', description: '1-based blank index' },
                    correctAnswers: { type: 'array', items: { type: 'string' } },
                    caseSensitive: { type: 'boolean' },
                  },
                },
              },
            },
          },
          metadata: {
            type: 'object',
            description: 'Question metadata',
            properties: {
              topic: { type: 'string' },
              subtopic: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              estimatedTime: { type: 'number', description: 'Estimated time in minutes' },
              points: { type: 'number', description: 'Points assigned to this question' },
            },
          },
        },
      },
    },
  };

  const completion = await groq.chat.completions.create({
    model: config.groq.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    tools: [tool],
    tool_choice: { type: 'function', function: { name: 'register_question' } },
    temperature: 0.8, // Higher creativity than grading (0.3)
    max_tokens: 1500,
  });

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function.name !== 'register_question') {
    throw new Error('GROQ did not call register_question tool');
  }

  // Structured JSON — no text parsing, no regex, no fallbacks
  const args = JSON.parse(toolCall.function.arguments) as {
    content: IQuestion['content'];
    metadata: IQuestion['metadata'];
  };

  // Normalize: generate IDs server-side if GROQ omitted them
  if (args.content.options) {
    // Special case: true_false MUST always use id="true"/"false" with literal text "True"/"False"
    // GROQ sometimes generates content-based options (e.g. "The dog is brown.") — fix that here.
    if (input.type === 'true_false') {
      const opts = args.content.options;
      // Try to identify which GROQ option represents "True" (correct fact / first option)
      const trueOpt = opts.find(o => o.id === 'true' || (o.text ?? '').toLowerCase() === 'true');
      const falseOpt = opts.find(o => o.id === 'false' || (o.text ?? '').toLowerCase() === 'false');

      if (trueOpt && falseOpt) {
        // GROQ followed the hint correctly — just normalise ids and text
        args.content.options = [
          { id: 'true',  text: 'True',  isCorrect: trueOpt.isCorrect  ?? false },
          { id: 'false', text: 'False', isCorrect: falseOpt.isCorrect ?? false },
        ];
      } else {
        // GROQ generated content-based options — treat first as the "True" option
        // (the statement in `question` represents a fact to verify)
        const firstIsCorrect = opts[0]?.isCorrect ?? true;
        args.content.options = [
          { id: 'true',  text: 'True',  isCorrect:  firstIsCorrect },
          { id: 'false', text: 'False', isCorrect: !firstIsCorrect },
        ];
      }
    } else {
      args.content.options = args.content.options.map((opt, i) => ({
        ...opt,
        id: opt.id ?? String.fromCharCode(65 + i), // A, B, C, D
      }));
    }
  }
  if (args.content.items) {
    args.content.items = args.content.items.map((item, i) => ({
      ...item,
      id: item.id ?? String(i + 1),
    }));
  }

  const questionDoc: Omit<IQuestion, '_id'> = {
    type: input.type,
    competency: input.competency,
    level: input.level,
    difficulty: input.difficulty,
    content: args.content,
    metadata: {
      ...args.metadata,
      topic: args.metadata.topic ?? input.topic ?? '',
      points: args.metadata.points ?? 1,
      tags: args.metadata.tags ?? [],
    },
    statistics: {
      timesUsed: 0,
      averageScore: 0,
      averageTime: 0,
      difficulty: input.difficulty,
    },
    isActive: true,
    createdBy: input.createdBy ? new ObjectId(input.createdBy) : new ObjectId('000000000000000000000000'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let savedId: string | undefined;
  if (input.save) {
    const result = await getQuestions().insertOne(questionDoc as IQuestion);
    savedId = result.insertedId.toString();
  }

  return {
    question: questionDoc,
    savedId,
    model: completion.model,
  };
}
