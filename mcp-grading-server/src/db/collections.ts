import { Collection } from 'mongodb';
import { getClient, getDB } from './connection.js';
import { config } from '../config.js';
import type { IAttempt, IResponse, IQuestion, IExamResult, IExam, IRubric, ILevel } from '../types/index.js';

export function getAttempts(): Collection<IAttempt> {
  return getDB().collection<IAttempt>('attempts');
}

export function getResponses(): Collection<IResponse> {
  return getDB().collection<IResponse>('responses');
}

export function getQuestions(): Collection<IQuestion> {
  return getDB().collection<IQuestion>('questions');
}

export function getExamResults(): Collection<IExamResult> {
  return getDB().collection<IExamResult>('exam_results');
}

export function getExams(): Collection<IExam> {
  return getDB().collection<IExam>('exams');
}

export function getSessions(): Collection {
  return getDB().collection('sessions');
}

export function getRubrics(): Collection<IRubric> {
  // Rubrics live in exam-service's own DB (rubric.model.ts, default mongoose
  // connection = cba_platform), same DB grading-service connects to.
  return getDB().collection<IRubric>('rubrics');
}

export function getLevels(): Collection<ILevel> {
  // Levels live in exam-service's own DB (no useDb() override there), same DB grading-service connects to.
  return getDB().collection<ILevel>('levels');
}

export function getCandidates(): Collection {
  // Candidates live in identity-service's DB (exam-service reads them via useDb('cba_identity_db')).
  return getClient().db(config.mongo.candidatesDbName).collection('candidates');
}
