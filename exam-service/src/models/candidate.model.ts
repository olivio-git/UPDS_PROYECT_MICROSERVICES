import mongoose, { Schema, Document } from 'mongoose';

// Minimal schema for name lookup only — actual data lives in user-management-service
export interface ICandidate extends Document {
  personalInfo: {
    firstName: string;
    lastName: string;
    email?: string;
    dni?: string;
  };
  authServiceUserId?: string;
}

const candidateSchema = new Schema<ICandidate>({
  personalInfo: {
    firstName: { type: String, default: '' },
    lastName:  { type: String, default: '' },
    email:     { type: String },
    dni:       { type: String }
  },
  authServiceUserId: { type: String }
}, {
  timestamps: true,
  collection: 'candidates'
});

const umsDb = mongoose.connection.useDb('cba_user_management_db', { useCache: true });
export const Candidate = umsDb.model<ICandidate>('CandidateMonitor', candidateSchema);
