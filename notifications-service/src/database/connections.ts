import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import { config } from '../config';

export class DatabaseConnections {
  private static instance: DatabaseConnections;
  private mongoClient: MongoClient | null = null;
  private database: Db | null = null;
  private redisClient: Redis | null = null;
  private kafkaClient: Kafka | null = null;
  private kafkaProducer: Producer | null = null;
  private kafkaConsumer: Consumer | null = null;

  // Kafka must never block boot or keep the HTTP API / Socket.IO down: on
  // connect failure we log a warning and retry in the background with
  // exponential backoff (capped at 30s) instead of throwing.
  private kafkaReady = false;
  private kafkaRetryTimer: NodeJS.Timeout | null = null;
  private kafkaRetryDelayMs = 1000;
  private readonly kafkaMaxRetryDelayMs = 30000;
  private kafkaReadyCallbacks: Array<() => void> = [];

  private constructor() {}

  public static getInstance(): DatabaseConnections {
    if (!DatabaseConnections.instance) {
      DatabaseConnections.instance = new DatabaseConnections();
    }
    return DatabaseConnections.instance;
  }

  // MongoDB Connection
  public async connectMongoDB(): Promise<Db> {
    if (this.database) {
      return this.database;
    }

    try {
      console.log('🔌 Conectando a MongoDB...');
      this.mongoClient = new MongoClient(config.database.mongoUri);
      await this.mongoClient.connect();
      this.database = this.mongoClient.db(config.database.dbName);
      
      // Test connection
      await this.database.admin().ping();
      console.log('✅ MongoDB conectado exitosamente');
      
      return this.database;
    } catch (error) {
      console.error('❌ Error conectando a MongoDB:', error);
      throw error;
    }
  }

  // Redis Connection
  public async connectRedis(): Promise<Redis> {
    if (this.redisClient) {
      return this.redisClient;
    }

    try {
      console.log('🔌 Conectando a Redis...');
      this.redisClient = new Redis(config.redis.uri, {
        // retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
      });

      this.redisClient.on('connect', () => {
        console.log('✅ Redis conectado exitosamente');
      });

      this.redisClient.on('error', (error) => {
        console.error('❌ Error de Redis:', error);
      });

      // Test connection
      await this.redisClient.ping();
      
      return this.redisClient;
    } catch (error) {
      console.error('❌ Error conectando a Redis:', error);
      throw error;
    }
  }

  // Kafka Connection — returns the client/producer/consumer immediately
  // (created but possibly not yet connected) and connects in the background,
  // so a broker outage never blocks the HTTP API / Socket.IO from starting.
  public async connectKafka(): Promise<{ kafka: Kafka; producer: Producer; consumer: Consumer }> {
    if (this.kafkaClient && this.kafkaProducer && this.kafkaConsumer) {
      return {
        kafka: this.kafkaClient,
        producer: this.kafkaProducer,
        consumer: this.kafkaConsumer
      };
    }

    console.log('🔌 Conectando a Kafka...');
    this.kafkaClient = new Kafka({
      clientId: config.kafka.clientId,
      brokers: [config.kafka.broker],
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    // Producer
    this.kafkaProducer = this.kafkaClient.producer();

    // Consumer
    this.kafkaConsumer = this.kafkaClient.consumer({
      groupId: config.kafka.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });

    // Fire-and-forget: never throw from here, connect in the background.
    void this.connectKafkaWithRetry();

    return {
      kafka: this.kafkaClient,
      producer: this.kafkaProducer,
      consumer: this.kafkaConsumer
    };
  }

  private async connectKafkaWithRetry(): Promise<void> {
    try {
      await this.kafkaProducer!.connect();
      await this.kafkaConsumer!.connect();

      this.kafkaReady = true;
      this.kafkaRetryDelayMs = 1000; // reset backoff once we're back up
      console.log('✅ Kafka conectado exitosamente');

      const callbacks = this.kafkaReadyCallbacks.splice(0);
      callbacks.forEach((cb) => cb());
    } catch (error) {
      this.kafkaReady = false;
      console.warn(`⚠️ Kafka no disponible, reintentando en ${this.kafkaRetryDelayMs}ms:`, error);
      this.scheduleKafkaRetry();
    }
  }

  private scheduleKafkaRetry(): void {
    if (this.kafkaRetryTimer) return;
    this.kafkaRetryTimer = setTimeout(() => {
      this.kafkaRetryTimer = null;
      void this.connectKafkaWithRetry();
    }, this.kafkaRetryDelayMs);
    this.kafkaRetryTimer.unref();
    this.kafkaRetryDelayMs = Math.min(this.kafkaRetryDelayMs * 2, this.kafkaMaxRetryDelayMs);
  }

  // Registers a one-shot callback fired once Kafka finishes connecting (used
  // by index.ts to defer consumer.subscribe()/run() until the broker is up).
  public onKafkaReady(callback: () => void): void {
    if (this.kafkaReady) {
      callback();
      return;
    }
    this.kafkaReadyCallbacks.push(callback);
  }

  // Graceful shutdown
  public async closeConnections(): Promise<void> {
    console.log('🔄 Cerrando conexiones...');

    if (this.kafkaRetryTimer) {
      clearTimeout(this.kafkaRetryTimer);
      this.kafkaRetryTimer = null;
    }

    if (this.kafkaConsumer) {
      await this.kafkaConsumer.disconnect();
    }

    if (this.kafkaProducer) {
      await this.kafkaProducer.disconnect();
    }
    
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
    
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
    
    console.log('✅ Conexiones cerradas exitosamente');
  }

  // Getters
  public getDatabase(): Db {
    if (!this.database) {
      throw new Error('Database not connected');
    }
    return this.database;
  }

  public getRedis(): Redis {
    if (!this.redisClient) {
      throw new Error('Redis not connected');
    }
    return this.redisClient;
  }

  public getKafkaProducer(): Producer {
    if (!this.kafkaProducer) {
      throw new Error('Kafka producer not connected');
    }
    return this.kafkaProducer;
  }

  public getKafkaConsumer(): Consumer {
    if (!this.kafkaConsumer) {
      throw new Error('Kafka consumer not connected');
    }
    return this.kafkaConsumer;
  }
}

export default DatabaseConnections;
