import { sign, verify } from "jsonwebtoken";
import { injectable } from "tsyringe";

@injectable()
export class JwtService {
    private readonly JWTSECRET: string = process.env.JWT_SECRET!;
    private readonly REFRESH_TOKEN: string = process.env.REFRESH_TOKEN_SECRET!;

    async generateTokens(payload: { userId: string, role: string }): Promise<any | null> {
        return {
            accessToken: sign(payload, this.JWTSECRET, {
                expiresIn: '1m',
            }),
            refreshToken: sign(payload, this.REFRESH_TOKEN, {
                expiresIn: '7d',
            })
        }
    }

    async decodeToken(token: string): Promise<any | null> {
        try {
            return verify(token, this.REFRESH_TOKEN);
        } catch (error) {
            console.error('Error decoding token:', error);
            return null;
        }
    }
}