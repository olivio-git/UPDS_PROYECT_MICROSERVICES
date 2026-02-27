import { Kafka } from 'kafkajs';
import { config } from '../config';
import { UserRepository } from '../repositories/user.repository';

export async function startUserEventsConsumer(db: any) {
  const kafka = new Kafka({ clientId: 'auth-service', brokers: [config.kafka.broker] });
  const consumer = kafka.consumer({ groupId: 'auth-service-users' }); 
  await consumer.connect();
  await consumer.subscribe({ topic: config.kafka.topics.userEvents, fromBeginning: false });

  const userRepo = new UserRepository(db);

  await consumer.run({
    eachMessage: async ({ message }) => {
      const eventType = message.headers?.eventType?.toString();
      const payload = message.value ? JSON.parse(message.value.toString()) : null;
      if (!eventType || !payload) return;

      if (eventType === 'USER_STATUS_CHANGED') {
        const userId: string = payload.userId;
        const newStatus: string = payload.userData?.newStatus;
        const isActive = newStatus === 'active';
        const result = await userRepo.updateUser(userId, { isActive });
        // invalidar cache y sesiones si desactivado
        //await cacheRepo.invalidateUserCache(userId);
        if (!isActive) {
          // await CacheRepository.deleteSession(userId);
          await userRepo.deleteUserSessions?.(userId); // si existe
        }
        console.log(`User ${userId} status -> ${newStatus}`);
      }

      // Handle full user updates coming from user-management-service
      if (eventType === 'USER_UPDATED') {
        try {
          const userId: string = payload.userId;
          const userData = payload.userData || {};

          // Only allow certain fields to be synced to auth-service
          const allowed: any = {};
          if (userData.firstName !== undefined) allowed.firstName = userData.firstName;
          if (userData.lastName !== undefined) allowed.lastName = userData.lastName;
          if (userData.role !== undefined) allowed.role = userData.role;
          if (userData.profile !== undefined) allowed.profile = userData.profile;

          if (Object.keys(allowed).length === 0) {
            console.log('USER_UPDATED received but no allowed fields to sync for', userId);
            return;
          }

          // Update user in auth DB (idempotent: set fields, update timestamp)
          const updated = await userRepo.updateUser(userId, allowed);
          console.log(`USER_UPDATED applied for user ${userId}`);
        } catch (err) {
          console.error('Error handling USER_UPDATED event:', err);
        }
      }
    },
  });
}