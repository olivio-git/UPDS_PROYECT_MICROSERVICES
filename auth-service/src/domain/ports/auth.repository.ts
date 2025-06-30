import { UserAuth } from "./Interfaces";

export interface AuthRepository {
  findByEmail(email: string): Promise<UserAuth | null>;
//   updateLastLogin(userId: string): Promise<void>;
}