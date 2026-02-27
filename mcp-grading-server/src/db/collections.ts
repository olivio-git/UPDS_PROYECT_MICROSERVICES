import { Collection } from 'mongodb';
import { getClient, getDB } from './connection.js';
import { config } from '../config.js';
import type { IAttempt, IResponse, IQuestion, IExamResult, IExam } from '../types/index.js';

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

export function getLevels(): Collection {
  // Levels are managed by user-management-service in its own DB
  return getClient().db(config.mongo.levelsDbName).collection('levels');
}

export function getCandidates(): Collection {
  // Candidates are managed by user-management-service in its own DB
  return getClient().db(config.mongo.levelsDbName).collection('candidates');
}
