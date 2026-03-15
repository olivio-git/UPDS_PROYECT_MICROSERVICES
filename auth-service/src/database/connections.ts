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

  // Kafka Connection
  public async connectKafka(): Promise<{ kafka: Kafka; producer: Producer }> {
    if (this.kafkaClient && this.kafkaProducer) {
      return { kafka: this.kafkaClient, producer: this.kafkaProducer };
    }

    try {
      console.log('🔌 Conectando a Kafka...');
      this.kafkaClient = new Kafka({
        clientId: config.kafka.clientId,
        brokers: [config.kafka.broker],
        retry: {
          initialRetryTime: 100,
          retries: 8
        }
      });

      this.kafkaProducer = this.kafkaClient.producer();
      await this.kafkaProducer.connect();
      
      console.log('✅ Kafka conectado exitosamente');
      
      return { kafka: this.kafkaClient, producer: this.kafkaProducer };
    } catch (error) {
      console.error('❌ Error conectando a Kafka:', error);
      throw error;
    }
  }

  // Create Kafka Consumer
  public async createKafkaConsumer(groupId: string): Promise<Consumer> {
    if (!this.kafkaClient) {
      await this.connectKafka();
    }
    
    const consumer = this.kafkaClient!.consumer({ groupId });
    await consumer.connect();
    return consumer;
  }

  // Graceful shutdown
  public async closeConnections(): Promise<void> {
    console.log('🔄 Cerrando conexiones...');
    
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
}

export default DatabaseConnections;
