import Redis from "ioredis";

export class RedisDBConnection {
    private static instance: Redis
    private static uri: string = process.env.REDIS_URI!;

    private constructor() { }

    public static async getInstance(): Promise<Redis> {
        if (!RedisDBConnection.instance) {
            RedisDBConnection.instance = new Redis(this.uri); 
            console.log("✅: Redis connection established successfully.");
        }
        return RedisDBConnection.instance;
    }
}

export default RedisDBConnection;