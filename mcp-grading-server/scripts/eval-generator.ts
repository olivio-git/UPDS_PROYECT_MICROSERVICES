/**
 * Offline evaluation of the AI question generator against the real model.
 *
 *   GROQ_API_KEY=... npm run eval:generator              # default matrix, 2 per cell
 *   GROQ_API_KEY=... EVAL_PER_CELL=5 npm run eval:generator
 *
 * Uses an in-memory database (no MongoDB needed): every accepted question is
 * added to the bank, so later ones are also checked for repetition.
 * Exits with code 1 when an acceptance threshold is not met.
 */
import { fakeCollection, installFakeMongo } from '../tests/helpers/fake-mongo.js';
import type { Competency, Level, QuestionType } from '../src/types/index.js';

process.env.JWT_SECRET ??= 'eval';
process.env.SERVICE_TOKEN ??= 'eval';
process.env.MONGO_DB_NAME = 'cba_platform';
process.env.KAFKA_BROKER ??= '127.0.0.1:9';
if (!process.env.GROQ_API_KEY) {
  console.error('GROQ_API_KEY is required for the evaluation.');
  process.exit(2);
}

installFakeMongo();
const { connectDB } = await import('../src/db/connection.js');
const { generateQuestion } = await import('../src/tools/generate-question.js');
const { similarity, questionSignature, DUPLICATE_THRESHOLD } = await import('../src/grading/question-quality.js');
await connectDB();

/** Acceptance thresholds (comparable to manual QA rates reported for commercial item banks). */
const THRESHOLDS = {
  success: 0.95, // a usable question comes back
  clean: 0.8, // no warnings for the teacher
  avgScore: 90,
  duplicates: 0, // pairs of near-identical questions
};

const CELLS: Array<[Competency, QuestionType]> = [
  ['reading', 'multiple_choice'], ['reading', 'true_false'], ['reading', 'open_text'],
  ['listening', 'multiple_choice'],
  ['grammar', 'multiple_choice'], ['grammar', 'fill_blanks'], ['grammar', 'drag_drop'],
  ['vocabulary', 'multiple_choice'], ['vocabulary', 'matching'],
  ['writing', 'essay'], ['speaking', 'audio_response'], ['reading', 'ordering'],
];
const LEVELS: Level[] = (process.env.EVAL_LEVELS?.split(',') as Level[]) ?? ['A1', 'A2', 'B1', 'B2'];
const PER_CELL = Number(process.env.EVAL_PER_CELL ?? 2);

interface Row { cell: string; ok: boolean; attempts: number; score: number; issues: string[]; ms: number; error?: string }
const rows: Row[] = [];
const accepted: string[] = [];

for (const level of LEVELS) {
  for (const [competency, type] of CELLS) {
    for (let i = 0; i < PER_CELL; i++) {
      const cell = `${level} ${competency}/${type}`;
      const t0 = Date.now();
      try {
        const out = await generateQuestion({ competency, level, type, difficulty: 3 });
        fakeCollection('cba_platform', 'questions').docs.push({ ...out.question, createdAt: new Date() });
        accepted.push(questionSignature(out.question.content));
        rows.push({ cell, ok: true, attempts: out.attempts, score: out.quality.score, issues: out.quality.issues.map((x) => x.code), ms: Date.now() - t0 });
      } catch (e: any) {
        rows.push({ cell, ok: false, attempts: 3, score: 0, issues: [], ms: Date.now() - t0, error: String(e?.message ?? e) });
      }
      const r = rows.at(-1)!;
      console.log(`${r.ok ? '✓' : '✗'} ${cell.padEnd(34)} score ${String(r.score).padStart(3)}  tries ${r.attempts}  ${r.ms}ms  ${r.error ?? r.issues.join(', ')}`);
    }
  }
}

let duplicates = 0;
for (let a = 0; a < accepted.length; a++) for (let b = a + 1; b < accepted.length; b++) if (similarity(accepted[a]!, accepted[b]!) >= DUPLICATE_THRESHOLD) duplicates++;

const ok = rows.filter((r) => r.ok);
const metrics = {
  success: ok.length / rows.length,
  firstTry: ok.filter((r) => r.attempts === 1).length / rows.length,
  clean: ok.filter((r) => r.issues.length === 0).length / Math.max(1, ok.length),
  avgScore: ok.reduce((s, r) => s + r.score, 0) / Math.max(1, ok.length),
  duplicates,
  avgMs: rows.reduce((s, r) => s + r.ms, 0) / rows.length,
};
const issueCounts = Object.entries(
  ok.flatMap((r) => r.issues).reduce<Record<string, number>>((m, c) => ((m[c] = (m[c] ?? 0) + 1), m), {}),
).sort((a, b) => b[1] - a[1]);

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const checks = [
  ['Pregunta utilizable', pct(metrics.success), `≥ ${pct(THRESHOLDS.success)}`, metrics.success >= THRESHOLDS.success],
  ['Sin avisos para el docente', pct(metrics.clean), `≥ ${pct(THRESHOLDS.clean)}`, metrics.clean >= THRESHOLDS.clean],
  ['Puntaje medio de calidad', metrics.avgScore.toFixed(1), `≥ ${THRESHOLDS.avgScore}`, metrics.avgScore >= THRESHOLDS.avgScore],
  ['Pares casi idénticos', String(metrics.duplicates), `= ${THRESHOLDS.duplicates}`, metrics.duplicates <= THRESHOLDS.duplicates],
] as const;

console.log(`\n${rows.length} generaciones · aceptadas al primer intento ${pct(metrics.firstTry)} · ${Math.round(metrics.avgMs)} ms de media`);
for (const [name, value, target, pass] of checks) console.log(`${pass ? 'PASA ' : 'FALLA'}  ${name.padEnd(28)} ${value.padStart(7)}  (${target})`);
if (issueCounts.length) console.log(`Avisos más frecuentes: ${issueCounts.map(([c, n]) => `${c} ×${n}`).join(', ')}`);
process.exit(checks.every((c) => c[3]) ? 0 : 1);
