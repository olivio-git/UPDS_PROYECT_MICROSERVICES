/**
 * Audit of the real question bank: is each question what it says it is?
 *
 *   MONGO_URI=mongodb://... npm run audit:bank            # summary
 *   MONGO_URI=mongodb://... npm run audit:bank -- --csv   # one row per question with problems
 *
 * For every active question it checks
 *   - format vs competency (a "grammar" essay, a "reading" sentence builder…)
 *   - the answer key (gradable at all: a correct option, one answer per blank…)
 *   - the CEFR level of its language (CEFR-J vocabulary + grammar) vs its label
 *   - observed difficulty from real answers vs the author's difficulty
 * Read-only: it never writes to the database.
 */
import { MongoClient } from 'mongodb';
import { normalizeGeneratedContent } from '../src/tools/question-validation.js';
import { assessQuestionQuality } from '../src/grading/question-quality.js';
import { QUESTION_FORMATS_BY_COMPETENCY } from '../src/schemas/grading.schemas.js';
import { LEVELS } from '../src/grading/cefr/cefr-level.js';
import { MIN_ANSWERS_FOR_OBSERVED_DIFFICULTY, observedDifficulty } from '../src/grading/item-difficulty.js';

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI is required.');
  process.exit(2);
}
const csv = process.argv.includes('--csv');

const client = await MongoClient.connect(uri);
const db = client.db(process.env.MONGO_DB_NAME || 'cba_platform');
const questions = await db.collection('questions').find({ isActive: { $ne: false } }).toArray();

const LEVEL_FIT_CODES = new Set(['passage_above_level', 'words_above_level', 'grammar_above_level', 'passage_below_level']);
const tally = { total: questions.length, format: 0, key: 0, level: 0, difficulty: 0, ok: 0 };
const byLevel = new Map<string, { n: number; above: number }>();
const rows: string[] = ['id,level,competency,type,problem,detail'];
const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;

for (const q of questions as any[]) {
  const problems: Array<[string, string]> = [];
  const allowed = QUESTION_FORMATS_BY_COMPETENCY[q.competency];
  if (allowed && !allowed.includes(q.type)) problems.push(['formato', `${q.type} no evalúa ${q.competency}`]);

  const autoGraded = !['essay', 'open_text', 'audio_response', 'file_upload'].includes(q.type);
  const keyProblems = autoGraded ? normalizeGeneratedContent(q.type, q.content ?? {}).problems : [];
  if (keyProblems.length) problems.push(['clave de respuestas', keyProblems.join('; ')]);

  const report = assessQuestionQuality({ type: q.type, competency: q.competency, level: q.level }, q.content ?? {});
  const levelIssues = report.issues.filter((i) => LEVEL_FIT_CODES.has(i.code));
  for (const i of levelIssues) problems.push(['nivel', `${i.label} (estimado ${report.estimatedLevel})`]);
  const lv = byLevel.get(q.level) ?? { n: 0, above: 0 };
  lv.n++;
  // One level of stretch is normal (a vocabulary item tests a word the student is learning); two is not.
  if (report.estimatedLevel && LEVELS.indexOf(report.estimatedLevel) >= LEVELS.indexOf(q.level === 'C2' ? 'C1' : q.level) + 2) lv.above++;
  byLevel.set(q.level, lv);

  const stats = q.statistics ?? {};
  if ((stats.timesUsed ?? 0) >= MIN_ANSWERS_FOR_OBSERVED_DIFFICULTY && typeof q.difficulty === 'number') {
    const observed = observedDifficulty(stats.averageScore ?? 0);
    if (Math.abs(observed - q.difficulty) >= 2) {
      problems.push(['dificultad', `marcada ${q.difficulty}/5, observada ${observed}/5 (${Math.round((stats.averageScore ?? 0) * 100)}% de aciertos en ${stats.timesUsed} respuestas)`]);
    }
  }

  if (problems.some(([p]) => p === 'formato')) tally.format++;
  if (problems.some(([p]) => p === 'clave de respuestas')) tally.key++;
  if (problems.some(([p]) => p === 'nivel')) tally.level++;
  if (problems.some(([p]) => p === 'dificultad')) tally.difficulty++;
  if (!problems.length) tally.ok++;
  for (const [p, d] of problems) rows.push([q._id, q.level, q.competency, q.type, p, d].map(esc).join(','));
}

if (csv) {
  console.log(rows.join('\n'));
} else {
  const pct = (n: number) => `${n} (${tally.total ? Math.round((100 * n) / tally.total) : 0}%)`;
  console.log(`Preguntas activas: ${tally.total}`);
  console.log(`Sin observaciones:                 ${pct(tally.ok)}`);
  console.log(`Formato que no mide su competencia: ${pct(tally.format)}`);
  console.log(`Clave de respuestas con problemas:  ${pct(tally.key)}`);
  console.log(`Lenguaje por encima/debajo del nivel: ${pct(tally.level)}`);
  console.log(`Dificultad real ≠ marcada (±2):     ${pct(tally.difficulty)}`);
  console.log('\nLenguaje estimado dos niveles o más por encima del marcado, por nivel:');
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    const v = byLevel.get(level);
    if (v) console.log(`  ${level}: ${v.above}/${v.n}`);
  }
  console.log('\nDetalle por pregunta: npm run audit:bank -- --csv > auditoria.csv');
}
await client.close();
