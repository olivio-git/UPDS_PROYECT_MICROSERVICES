import { inject, injectable } from "tsyringe";
import { AuthRedisRepository } from "../../domain/ports/auth.redis.repository";
import Redis from "ioredis";

@injectable()
export class RedisDBAuthRepository implements AuthRedisRepository {
    constructor(
        @inject('RedisClient') private redisClient: Redis
    ) {}
    async findToken(token: string): Promise<any | null> {
        // Implement your logic to find the token in Redis
        return await this.redisClient.get(token);
    }
}