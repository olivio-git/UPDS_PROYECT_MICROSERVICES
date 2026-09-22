import { MongoClient, Db } from 'mongodb';
import { config } from '../config.js';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(config.mongo.uri);
  await client.connect();
  db = client.db(config.mongo.dbName);
  return db;
}

export function getDB(): Db {
  if (!db) throw new Error('Database not connected. Call connectDB() first.');
  return db;
}

export function getClient(): MongoClient {
  if (!client) throw new Error('Database not connected. Call connectDB() first.');
  return client;
}

export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

/**
 * Ensures the indexes grading-service relies on exist. `createIndex()` is
 * idempotent (a no-op if the index already matches), so this is safe to call
 * on every startup. Failure is logged and swallowed — an index issue must
 * never prevent the service from booting.
 */
export async function ensureIndexes(): Promise<void> {
  try {
    // Enforces at-most-one exam_result per attempt: a duplicate insert (e.g.
    // the Kafka consumer and a concurrent HTTP /api/v1/grading/exam call
    // both grading the same attempt) fails with a duplicate-key error
    // instead of creating a second result — grade-exam.ts treats that error
    // as "already graded" (see gradeExam()).
    await getDB().collection('exam_results').createIndex({ attemptId: 1 }, { unique: true });
    console.log('[grading-service] Unique index ensured on exam_results.attemptId');
  } catch (error: any) {
    console.error('[grading-service] Failed to ensure unique index on exam_results.attemptId:', error?.message || error);
  }
}
