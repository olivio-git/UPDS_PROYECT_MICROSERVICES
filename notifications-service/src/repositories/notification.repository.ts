import { Collection, Db } from 'mongodb';
import { EmailNotification, EmailTemplate, EmailQueue } from '../types';
import { config } from '../config';

export class NotificationRepository {
  private emailsCollection: Collection<EmailNotification>;
  private templatesCollection: Collection<EmailTemplate>;
  private queueCollection: Collection<EmailQueue>;

  constructor(database: Db) {
    this.emailsCollection = database.collection(config.database.collections.emails);
    this.templatesCollection = database.collection(config.database.collections.templates);
    this.queueCollection = database.collection('email_queue');
    this.createIndexes();
  }

  private async createIndexes(): Promise<void> {
    try {
      // Índices para emails
      await this.emailsCollection.createIndex({ status: 1 });
      await this.emailsCollection.createIndex({ to: 1 });
      await this.emailsCollection.createIndex({ createdAt: 1 });
      await this.emailsCollection.createIndex({ priority: 1, createdAt: 1 });
      
      // Índices para templates
      await this.templatesCollection.createIndex({ name: 1 }, { unique: true });
      await this.templatesCollection.createIndex({ category: 1 });
      await this.templatesCollection.createIndex({ isActive: 1 });
      
      // Índices para queue
      await this.queueCollection.createIndex({ status: 1 });
      await this.queueCollection.createIndex({ priority: 1, scheduledAt: 1 });
      await this.queueCollection.createIndex({ scheduledAt: 1 });
      
      console.log('✅ Índices de notifications creados');
    } catch (error) {
      console.error('❌ Error creando índices de notifications:', error);
    }
  }

  // Email operations
  async createEmailNotification(emailData: Omit<EmailNotification, '_id' | 'createdAt' | 'updatedAt'>): Promise<EmailNotification> {
    const now = new Date();
    const email: EmailNotification = {
      ...emailData,
      createdAt: now,
      updatedAt: now
    };

    const result = await this.emailsCollection.insertOne(email);
    return { ...email, _id: result.insertedId.toString() };
  }

  async updateEmailStatus(
    emailId: string, 
    status: EmailNotification['status'], 
    additionalData?: Partial<EmailNotification>
  ): Promise<EmailNotification | null> {
    const updateData = {
      status,
      updatedAt: new Date(),
      ...additionalData
    };

    if (status === 'sent') {
      updateData.sentAt = new Date();
    }

    const result = await this.emailsCollection.findOneAndUpdate(
      { _id: emailId as any },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result;
  }

  async getEmailById(emailId: string): Promise<EmailNotification | null> {
    return await this.emailsCollection.findOne({ _id: emailId as any });
  }

  async getEmailsByStatus(status: EmailNotification['status']): Promise<EmailNotification[]> {
    return await this.emailsCollection.find({ status }).toArray();
  }

  async getPendingEmails(limit: number = 50): Promise<EmailNotification[]> {
    return await this.emailsCollection
      .find({ 
        status: { $in: ['pending', 'retrying'] },
        $expr: { $lt: ['$retryCount', '$maxRetries'] }
      })
      .sort({ priority: -1, createdAt: 1 })
      .limit(limit)
      .toArray();
  }

  async getEmailsByRecipient(email: string, limit: number = 20): Promise<EmailNotification[]> {
    return await this.emailsCollection
      .find({ to: email })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async incrementRetryCount(emailId: string): Promise<void> {
    await this.emailsCollection.updateOne(
      { _id: emailId as any },
      { 
        $inc: { retryCount: 1 },
        $set: { 
          lastAttempt: new Date(),
          updatedAt: new Date()
        }
      }
    );
  }

  // Template operations
  async createTemplate(templateData: Omit<EmailTemplate, '_id' | 'createdAt' | 'updatedAt'>): Promise<EmailTemplate> {
    const now = new Date();
    const template: EmailTemplate = {
      ...templateData,
      createdAt: now,
      updatedAt: now
    };

    const result = await this.templatesCollection.insertOne(template);
    return { ...template, _id: result.insertedId.toString() };
  }

  async getTemplateByName(name: string): Promise<EmailTemplate | null> {
    return await this.templatesCollection.findOne({ name, isActive: true });
  }

  async getAllTemplates(): Promise<EmailTemplate[]> {
    return await this.templatesCollection.find({ isActive: true }).toArray();
  }

  async updateTemplate(templateId: string, updateData: Partial<EmailTemplate>): Promise<EmailTemplate | null> {
    const result = await this.templatesCollection.findOneAndUpdate(
      { _id: templateId as any },
      { 
        $set: { 
          ...updateData, 
          updatedAt: new Date() 
        } 
      },
      { returnDocument: 'after' }
    );
    return result;
  }

  // Queue operations
  async addToQueue(emailId: string, priority: number, scheduledAt: Date = new Date()): Promise<EmailQueue> {
    const queueItem: EmailQueue = {
      emailId,
      priority,
      scheduledAt,
      status: 'queued',
      createdAt: new Date()
    };

    const result = await this.queueCollection.insertOne(queueItem);
    return { ...queueItem, _id: result.insertedId.toString() };
  }

  async getQueuedEmails(limit: number = 50): Promise<EmailQueue[]> {
    return await this.queueCollection
      .find({
        status: 'queued',
        scheduledAt: { $lte: new Date() }
      })
      .sort({ priority: -1, scheduledAt: 1 })
      .limit(limit)
      .toArray();
  }

  async updateQueueStatus(queueId: string, status: EmailQueue['status']): Promise<void> {
    const updateData: any = { status };
    
    if (status === 'processing') {
      updateData.processedAt = new Date();
    }

    await this.queueCollection.updateOne(
      { _id: queueId as any },
      { $set: updateData }
    );
  }

  async removeFromQueue(queueId: string): Promise<void> {
    await this.queueCollection.deleteOne({ _id: queueId as any });
  }

  // Analytics
  async getEmailStats(): Promise<{
    total: number;
    sent: number;
    pending: number;
    failed: number;
    today: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, sent, pending, failed, todayCount] = await Promise.all([
      this.emailsCollection.countDocuments(),
      this.emailsCollection.countDocuments({ status: 'sent' }),
      this.emailsCollection.countDocuments({ status: 'pending' }),
      this.emailsCollection.countDocuments({ status: 'failed' }),
      this.emailsCollection.countDocuments({ createdAt: { $gte: today } })
    ]);

    return { total, sent, pending, failed, today: todayCount };
  }
}
