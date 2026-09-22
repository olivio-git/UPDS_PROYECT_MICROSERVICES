import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import config from '../config';

// ================================
// MONGODB CONNECTION
// ================================

let mongoClient: MongoClient;
let database: Db;

export const connectMongoDB = async (): Promise<void> => {
  try {
    console.log('🔄 Conectando a MongoDB...');
    
    mongoClient = new MongoClient(config.mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    await mongoClient.connect();
    database = mongoClient.db(config.mongoDbName);
    
    // Test the connection
    await database.admin().ping();
    
    console.log('✅ MongoDB conectado exitosamente');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    throw error;
  }
};

export const getDatabase = (): Db => { 
  if (!database) {
    throw new Error('Base de datos no inicializada. Llama connectMongoDB() primero.');
  }
  return database;
};

export const closeMongoDB = async (): Promise<void> => {
  if (mongoClient) {
    await mongoClient.close();
    console.log('✅ Conexión MongoDB cerrada');
  }
};

// ================================
// REDIS CONNECTION
// ================================

let redisClient: Redis;

export const connectRedis = async (): Promise<void> => {
  try {
    console.log('🔄 Conectando a Redis...');
    
    redisClient = new Redis(config.redisUri, {
      maxRetriesPerRequest: null,
      lazyConnect: true
    });
    
    await redisClient.connect();
    
    // Test the connection
    await redisClient.ping();
    
    console.log('✅ Redis conectado exitosamente');
  } catch (error) {
    console.error('❌ Error conectando a Redis:', error);
    throw error;
  }
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis no inicializado. Llama connectRedis() primero.');
  }
  return redisClient;
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.disconnect();
    console.log('✅ Conexión Redis cerrada');
  }
};

// ================================
// CONNECT ALL DATABASES
// ================================

export const connectDatabases = async (): Promise<void> => {
  await connectMongoDB();
  await connectRedis();
  // Not awaited: kafkajs retries internally before failing, and login must not
  // wait for that. connectKafka() never throws and keeps retrying in background.
  void connectKafka();
};

// Alias para mantener compatibilidad
export const initializeConnections = connectDatabases;

export const closeDatabases = async (): Promise<void> => {
  await closeMongoDB();
  await closeRedis();
  await closeKafka();
};

// ================================
// KAFKA CONNECTION
// ================================

let kafka: Kafka;
let producer: Producer;
let consumer: Consumer;

// Kafka is not allowed to be a fatal dependency: login/OTP/user CRUD must keep
// working when the broker is down. connectKafka() below never throws — on
// failure it logs a warning and keeps retrying in the background with
// exponential backoff (capped at 30s) until the broker comes back.
let kafkaRetryTimer: NodeJS.Timeout | null = null;
let kafkaRetryDelayMs = 1000;
const KAFKA_MAX_RETRY_DELAY_MS = 30000;

const scheduleKafkaRetry = (): void => {
  if (kafkaRetryTimer) return;
  kafkaRetryTimer = setTimeout(() => {
    kafkaRetryTimer = null;
    void connectKafkaInternal();
  }, kafkaRetryDelayMs);
  kafkaRetryTimer.unref();
  kafkaRetryDelayMs = Math.min(kafkaRetryDelayMs * 2, KAFKA_MAX_RETRY_DELAY_MS);
};

const connectKafkaInternal = async (): Promise<void> => {
  try {
    console.log('🔄 Conectando a Kafka...');

    kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: [config.kafka.broker],
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    // Crear producer
    producer = kafka.producer({
      transactionTimeout: 30000,
      idempotent: true,
      maxInFlightRequests: 1
    });

    await producer.connect();

    // Crear consumer (opcional para este servicio)
    consumer = kafka.consumer({
      groupId: `${config.kafka.clientId}-group`,
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });

    // No conectar consumer por defecto, solo cuando se necesite

    kafkaRetryDelayMs = 1000; // reset backoff once we're back up
    console.log('✅ Kafka conectado exitosamente');
  } catch (error) {
    console.warn('⚠️ Kafka no disponible, continuando sin Kafka. Reintentando en background:', error);
    scheduleKafkaRetry();
  }
};

// Never throws: startup (connectDatabases) must not die because Kafka is down.
export const connectKafka = async (): Promise<void> => {
  await connectKafkaInternal();
};

export const getKafka = (): Kafka => {
  if (!kafka) {
    throw new Error('Kafka no inicializado. Llama connectKafka() primero.');
  }
  return kafka;
};

export const getProducer = (): Producer => {
  if (!producer) {
    throw new Error('Producer de Kafka no inicializado. Llama connectKafka() primero.');
  }
  return producer;
};

export const getConsumer = (): Consumer => {
  if (!consumer) {
    throw new Error('Consumer de Kafka no inicializado. Llama connectKafka() primero.');
  }
  return consumer;
};

export const closeKafka = async (): Promise<void> => {
  if (kafkaRetryTimer) {
    clearTimeout(kafkaRetryTimer);
    kafkaRetryTimer = null;
  }
  try {
    if (producer) {
      await producer.disconnect();
      console.log('✅ Producer de Kafka desconectado');
    }
    if (consumer) {
      await consumer.disconnect();
      console.log('✅ Consumer de Kafka desconectado');
    }
  } catch (error) {
    console.error('❌ Error cerrando conexiones de Kafka:', error);
  }
};

// ================================
// KAFKA CONNECTION OBJECT
// ================================

export const kafkaConnection = {
  getKafka,
  getProducer,
  getConsumer,
  connect: connectKafka,
  disconnect: closeKafka
};
