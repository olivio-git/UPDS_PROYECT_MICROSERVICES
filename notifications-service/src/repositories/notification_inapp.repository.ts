import { Collection, Db, ObjectId } from 'mongodb';
import { Notification } from '../types';

export class NotificationInAppRepository {
  private collection: Collection<Notification>;

  constructor(database: Db) {
    this.collection = database.collection('user_notifications');
    this.createIndexes();
  }

  private async createIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ recipientId: 1, read: 1, createdAt: -1 });
      await this.collection.createIndex({ createdAt: -1 });
      await this.collection.createIndex({ type: 1 });
    } catch (error) {
      console.error('❌ Error creando índices en user_notifications:', error);
    }
  }

  async createNotification(payload: Omit<Notification, '_id' | 'createdAt' | 'updatedAt'>): Promise<Notification> {
    const now = new Date();
    const doc: Notification = {
      ...payload,
      read: payload.read || false,
      createdAt: now,
      updatedAt: now
    } as Notification;

    const result = await this.collection.insertOne(doc);
    return { ...doc, _id: result.insertedId.toString() };
  }

  async listNotifications(recipientId: string, onlyUnread = false, limit = 50, page = 1) {
    const query: any = { recipientId };
    if (onlyUnread) query.read = false;
    const skip = (page - 1) * limit;
    const items = await this.collection.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
    return items;
  }

  async markAsRead(notificationId: string): Promise<void> {
    try {
      // Support either string id or ObjectId input
      const _id = typeof notificationId === 'string' && ObjectId.isValid(notificationId)
        ? new ObjectId(notificationId)
        : (notificationId as any);

      const result = await this.collection.updateOne(
        { _id },
        { $set: { read: true, updatedAt: new Date() } }
      );

      if (result.matchedCount === 0) {
        console.warn(`🔍 markAsRead: no notification found for id=${notificationId}`);
      }
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const _id = typeof notificationId === 'string' && ObjectId.isValid(notificationId)
        ? new ObjectId(notificationId)
        : (notificationId as any);

      const result = await this.collection.deleteOne({ _id });
      if (result.deletedCount === 0) {
        console.warn(`🔍 deleteNotification: no notification deleted for id=${notificationId}`);
        return false;
      }
      return true;
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      throw error;
    }
  }
}

export default NotificationInAppRepository;
