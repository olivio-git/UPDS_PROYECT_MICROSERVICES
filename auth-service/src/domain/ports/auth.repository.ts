import { UserAuth } from "./Interfaces";

export interface AuthRepository {
  findByEmail(email: string): Promise<UserAuth | null>;
  refreshToken(userId: string, refreshToken: string): Promise<UserAuth | null>;
  
}