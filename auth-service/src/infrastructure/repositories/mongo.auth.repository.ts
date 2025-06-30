import { AuthRepository } from '../../domain/ports/auth.repository';
import { MongoClient, ObjectId } from 'mongodb';
import { UserAuth } from '../../domain/ports/Interfaces';
import { inject, injectable } from 'tsyringe';

@injectable()
export class MongoDBAuthRepository implements AuthRepository {
    private readonly collectionName = process.env.MONGO_COLLECTION_CREDENTIAL || 'auth_credentials';
    constructor(
        @inject('MongoClient') private mongoClient: MongoClient,
    ) { }

    async findByEmail(email: string): Promise<UserAuth | null> {
        const dbName = process.env.MONGO_DB_NAME || 'your_database_name';
        const collection = this.mongoClient.db(dbName).collection<UserAuth>(this.collectionName);
        return collection.findOne({ email });
    } 
}