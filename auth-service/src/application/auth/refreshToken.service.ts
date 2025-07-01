import { injectable, inject } from "tsyringe";
import { JwtService } from "../../infrastructure/services/jwt.service";
import { CustomError, InvalidCredentialsError } from "../middleware/error.middleware";
import { MongoDBAuthRepository } from "../../infrastructure/repositories/mongo.auth.repository";
import { RefreshTokenRequest, RefreshTokenResponse } from "../../domain/ports/Interfaces";

@injectable()
export class RefreshTokenService {
    constructor(
        @inject('MongoAuthRepository') private authRepository: MongoDBAuthRepository,
        @inject('JwtService') private jwtService: JwtService
    ) { }

    async execute(credentials: RefreshTokenRequest): Promise<RefreshTokenResponse | null> {
        const decode = await this.jwtService.decodeToken(credentials.refresh_token);
        if (!decode) {
            throw new InvalidCredentialsError();
        }

        const user = await this.authRepository.findById(decode.userId);
        if (!user) {
            throw new InvalidCredentialsError();
        }

        const tokens = await this.jwtService.generateTokens({
            userId: user._id.toString(),
            role: user.role
        });
        if (!tokens) {
            throw new CustomError('Error generating tokens', 500);
        }
        const updatedUser = await this.authRepository.refreshToken(user._id.toString(), tokens.refreshToken);
        if (!updatedUser) {
            throw new CustomError('Error updating refresh token', 500);
        };

        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            userId: user._id.toString(),
            role: user.role,
            tokenType: 'Bearer',
            expiresIn: 60 // 1 minute for access token
        }

    }
}