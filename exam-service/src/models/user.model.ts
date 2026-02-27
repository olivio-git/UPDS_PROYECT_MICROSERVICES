import mongoose, { Schema, Document } from 'mongoose';

// Interfaz mínima para populate
export interface IUser extends Document {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

// Schema mínimo solo para populate/aggregate
const userSchema = new Schema<IUser>({
  email: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  collection: 'users'
});

// Users and candidates are stored in the user-management-service database (cba_user_management_db).
// exam-service connects to cba_platform by default, so we use useDb() to read from
// the correct database without creating a second connection.
// NOTE: Hardcoded to avoid env var resolution issues in Docker (MONGO_UMS_DB_NAME sometimes resolves incorrectly).
const umsDb = mongoose.connection.useDb('cba_user_management_db', { useCache: true });

export const User = umsDb.model<IUser>('User', userSchema);
