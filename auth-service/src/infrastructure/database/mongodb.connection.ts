import { MongoClient } from "mongodb";

export class MongoDBConnection {
    private static instance: MongoClient
    private static uri: string = process.env.MONGO_URI!;

    private constructor() { }

    public static async getInstance(): Promise<MongoClient> {
        if (!MongoDBConnection.instance) {
            MongoDBConnection.instance = new MongoClient(this.uri);
            await MongoDBConnection.instance.connect();
        }
        return MongoDBConnection.instance;
    }
}

export default MongoDBConnection;