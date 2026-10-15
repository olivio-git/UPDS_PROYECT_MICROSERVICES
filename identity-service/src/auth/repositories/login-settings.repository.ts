// src/auth/repositories/login-settings.repository.ts
//
// Runtime login settings an admin can change from the UI, without a restart.
// One document (_id 'login') in the `system_settings` collection. Read on
// every login, so a change applies to the very next sign-in.

import { Collection } from 'mongodb';
import { getDatabase } from '../../database/connections';

export interface LoginSettings {
  /** Quick login: email + password only, no OTP code. Off unless an admin turns it on. */
  quickLogin: boolean;
  updatedAt?: Date;
  updatedBy?: string;
}

interface LoginSettingsDocument extends LoginSettings {
  _id: string;
}

const DOCUMENT_ID = 'login';

export class LoginSettingsRepository {
  private get collection(): Collection<LoginSettingsDocument> {
    return getDatabase().collection<LoginSettingsDocument>('system_settings');
  }

  async get(): Promise<LoginSettings> {
    const doc = await this.collection.findOne({ _id: DOCUMENT_ID });
    return {
      quickLogin: doc?.quickLogin === true,
      updatedAt: doc?.updatedAt,
      updatedBy: doc?.updatedBy,
    };
  }

  async setQuickLogin(quickLogin: boolean, updatedBy: string): Promise<LoginSettings> {
    const updatedAt = new Date();
    await this.collection.updateOne(
      { _id: DOCUMENT_ID },
      { $set: { quickLogin, updatedAt, updatedBy } },
      { upsert: true }
    );
    return { quickLogin, updatedAt, updatedBy };
  }
}
