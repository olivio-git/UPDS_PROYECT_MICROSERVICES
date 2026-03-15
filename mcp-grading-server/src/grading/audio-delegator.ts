import axios from 'axios';
import Groq, { toFile } from 'groq-sdk';
import { config } from '../config.js';
import type { IQuestion, AIGradeResult } from '../types/index.js';

let groqClient: Groq | null = null;

function getGroq(): Groq {
  if (!groqClient) {
    if (!config.groq.apiKey) throw new Error('GROQ_API_KEY not configured');
    groqClient = new Groq({ apiKey: config.groq.apiKey });
  }
  return groqClient;
}

const MIME_MAP: Record<string, string> = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  flac: 'audio/flac',
};

/**
 * Download audio from a URL and transcribe it with GROQ Whisper.
 * Used for listening question creation — teacher uploads audio, we return the transcript
 * so the AI can generate a question grounded in real audio content.
 */
export async function transcribeAudio(audioUrl: string): Promise<string> {
  const groq = getGroq();

  let downloadUrl = audioUrl;
  if (downloadUrl.includes('localhost:9000') || downloadUrl.includes('127.0.0.1:9000')) {
    downloadUrl = downloadUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1):9000/, config.minio.internalEndpoint);
  }

  const audioResponse = await axios.get(downloadUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });
  const audioBuffer = Buffer.from(audioResponse.data);

  const ext = audioUrl.split('?')[0]?.split('.').pop()?.toLowerCase() || 'webm';
  const mimeType = MIME_MAP[ext] || 'audio/webm';
  const fileName = `audio.${ext}`;

  const audioFile = await toFile(audioBuffer, fileName, { type: mimeType });
  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-large-v3-turbo',
    response_format: 'json',
  });

  return transcription.text?.trim() || '';
}

/**
 * Transcribe audio from a raw Buffer (used when the frontend sends base64-encoded audio).
 * Avoids a MinIO round-trip — the bytes come directly from the request body.
 */
export async function transcribeAudioBuffer(
  buffer: Buffer,
  mimeType: string,
  ext: string = 'webm',
): Promise<string> {
  const groq = getGroq();
  const audioFile = await toFile(buffer, `audio.${ext}`, { type: mimeType });
  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-large-v3-turbo',
    response_format: 'json',
  });
  return transcription.text?.trim() || '';
}

/**
 * Evaluate audio responses using GROQ Whisper for transcription
 * and GROQ LLM for content evaluation.
 * This replaces the Python ai-grading-service which had Whisper timeout issues.
 */
export async function evaluateAudio(
  question: IQuestion,
  response: any,
  maxScore?: number
): Promise<AIGradeResult> {
  const points = maxScore ?? question.metadata?.points ?? 10;
  const audioUrl = response?.audioUrl || response?.response?.audioUrl || response?.fileUrl || '';

  if (!audioUrl) {
    return {
      score: 0,
      maxScore: points,
      feedback: 'No se proporcionó archivo de audio',
      criteria: {},
      suggestions: ['Debes grabar tu respuesta de audio para ser evaluado.'],
    };
  }

  try {
    const groq = getGroq();

    // 1. Download audio from MinIO
    // Rewrite public localhost URL to internal Docker URL as safety net
    let downloadUrl = audioUrl;
    if (downloadUrl.includes('localhost:9000') || downloadUrl.includes('127.0.0.1:9000')) {
      downloadUrl = downloadUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1):9000/, config.minio.internalEndpoint);
      console.log(`[AudioDelegator] Rewrote URL to internal: ${downloadUrl}`);
    }

    const audioResponse = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const audioBuffer = Buffer.from(audioResponse.data);

    // Detect format from URL
    const ext = audioUrl.split('?')[0]?.split('.').pop()?.toLowerCase() || 'webm';
    const mimeType = MIME_MAP[ext] || 'audio/webm';
    const fileName = `audio.${ext}`;

    // 2. Transcribe with GROQ Whisper (whisper-large-v3-turbo: fast + accurate)
    const audioFile = await toFile(audioBuffer, fileName, { type: mimeType });
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3-turbo',
      response_format: 'json',
    });

    const transcript = transcription.text?.trim() || '';

    if (!transcript) {
      return {
        score: 0,
        maxScore: points,
        feedback: 'No se pudo transcribir el audio. Verifica que hayas grabado correctamente y hables con claridad.',
        criteria: {},
        suggestions: [
          'Habla claramente y en un ambiente silencioso.',
          'Asegúrate de que el micrófono funcione correctamente.',
        ],
      };
    }

    // 3. Evaluate transcript with GROQ LLM
    const evaluationResult = await evaluateTranscript(groq, question, transcript, points);

    const feedback = `[Transcripción: "${transcript.substring(0, 120)}${transcript.length > 120 ? '...' : ''}"] ${evaluationResult.feedback}`;
    return {
      score: Math.round(evaluationResult.score * 100) / 100,
      maxScore: points,
      feedback,
      criteria: {
        content_relevance: evaluationResult.content_relevance,
        language_accuracy: evaluationResult.language_accuracy,
        task_completion: evaluationResult.task_completion,
      },
      suggestions: evaluationResult.suggestions,
    };
  } catch (error: any) {
    console.error('[AudioDelegator] Error evaluating audio:', error.message);
    return {
      score: 0,
      maxScore: points,
      feedback: 'No se pudo evaluar el audio automáticamente. Pendiente de revisión manual.',
      criteria: {},
      suggestions: [],
    };
  }
}

async function evaluateTranscript(
  groq: Groq,
  question: IQuestion,
  transcript: string,
  points: number
): Promise<{
  score: number;
  feedback: string;
  content_relevance: number;
  language_accuracy: number;
  task_completion: number;
  suggestions: string[];
}> {
  const questionText = question.content?.question || '';
  const level = question.level || 'A1';
  const competency = question.competency || 'speaking';
  const instructions = question.content?.instructions || '';
  const keywords = (question.content as any)?.keywords?.join(', ') || '';

  const isListening = competency === 'listening';
  const correctAnswer = isListening ? (question.content?.correctAnswer || '') : '';

  const systemPrompt = `Eres un evaluador experto de examenes de idiomas (ingles) siguiendo el Marco Comun Europeo de Referencia (MCER).
Evaluas respuestas habladas de estudiantes de forma justa y constructiva para el nivel ${level}.
SIEMPRE respondes en formato JSON valido, sin texto adicional fuera del JSON.`;

  const userPrompt = isListening
    ? `Evalua esta respuesta de comprension auditiva de un estudiante nivel ${level}.

Pregunta/Instruccion: ${questionText}
${instructions ? `Instrucciones adicionales: ${instructions}` : ''}
${correctAnswer ? `Respuesta correcta esperada: ${correctAnswer}` : ''}

Transcripcion del audio del estudiante: "${transcript}"

Criterios de evaluacion para nivel ${level}:
- Comprension: ¿El estudiante respondio correctamente a lo que se pedia?
- Precision: ¿Coincide con la respuesta esperada?

Puntaje maximo: ${points}

Responde SOLO en este JSON:
{
  "score": <numero entre 0 y ${points}>,
  "feedback": "<feedback constructivo en espanol, 1-2 oraciones>",
  "content_relevance": <0-1>,
  "language_accuracy": <0-1>,
  "task_completion": <0-1>,
  "suggestions": ["<sugerencia 1>", "<sugerencia 2>"]
}`
    : `Evalua esta respuesta oral de un estudiante nivel ${level}.

Consigna (prompt hablado): ${questionText}
${instructions ? `Instrucciones adicionales: ${instructions}` : ''}
${keywords ? `Vocabulario esperado: ${keywords}` : ''}

Transcripcion de lo que dijo el estudiante: "${transcript}"

Criterios de evaluacion para nivel ${level}:
- Relevancia: ¿El estudiante respondio al tema pedido?
- Vocabulario: ¿Uso vocabulario apropiado para nivel ${level}?
- Gramatica: ¿La respuesta es gramaticalmente comprensible para nivel ${level}?
- Completitud: ¿Respondio de forma adecuada?

Puntaje maximo: ${points}

Responde SOLO en este JSON:
{
  "score": <numero entre 0 y ${points}>,
  "feedback": "<feedback constructivo en espanol, 1-2 oraciones>",
  "content_relevance": <0-1>,
  "language_accuracy": <0-1>,
  "task_completion": <0-1>,
  "suggestions": ["<sugerencia 1>", "<sugerencia 2>"]
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { /* use defaults */ }

    return {
      score: Math.min(Math.max(Number(parsed.score) || 0, 0), points),
      feedback: parsed.feedback || 'Evaluación de audio completada',
      content_relevance: Math.min(Math.max(Number(parsed.content_relevance) || 0, 0), 1),
      language_accuracy: Math.min(Math.max(Number(parsed.language_accuracy) || 0, 0), 1),
      task_completion: Math.min(Math.max(Number(parsed.task_completion) || 0, 0), 1),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    // Partial credit if we at least have a transcript
    const partialScore = Math.round(points * 0.5);
    return {
      score: partialScore,
      feedback: 'Audio recibido y transcrito. Evaluación parcial aplicada.',
      content_relevance: 0.5,
      language_accuracy: 0.5,
      task_completion: 0.5,
      suggestions: [],
    };
  }
}
