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
