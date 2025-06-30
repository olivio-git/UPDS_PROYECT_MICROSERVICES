import { sign } from "jsonwebtoken";
import { injectable } from "tsyringe";

@injectable()
export class JwtService {
    private readonly JWTSECRET: string = process.env.JWT_SECRET!;
    private readonly REFRESH_TOKEN: string = process.env.REFRESH_TOKEN_SECRET!;

    async generateTokens(payload: { userId: string, role: string }): Promise<any | null> {
        return {
            accessToken: sign(payload, this.JWTSECRET, {
                expiresIn: '15m',
            }),
            refreshToken: sign(payload, this.REFRESH_TOKEN, {
                expiresIn: '7d',
            })
        }
    }
}