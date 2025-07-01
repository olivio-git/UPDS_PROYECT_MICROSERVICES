
export interface AuthRedisRepository {
  findToken(token: string): Promise<any | null>;
}