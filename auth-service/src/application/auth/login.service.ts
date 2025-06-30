import { injectable, inject } from "tsyringe";
import { compare } from "bcryptjs";
import { JwtService } from "../../infrastructure/services/jwt.service";
import { CustomError, InvalidCredentialsError } from "../middleware/error.middleware";
import { LoginRequest, LoginResponse } from "../../domain/ports/Interfaces";
import { MongoDBAuthRepository } from "../../infrastructure/repositories/mongo.auth.repository";

@injectable()
export class LoginService {
    constructor(
        @inject('MongoAuthRepository') private authRepository: MongoDBAuthRepository,
        @inject('JwtService') private jwtService: JwtService
    ) { }

    async execute(credentials: LoginRequest): Promise<LoginResponse | null> {
        const user = await this.authRepository.findByEmail(credentials.email || '');
        if (!user) {
            throw new InvalidCredentialsError();
        }

        if (!user.is_active) {
            throw new CustomError('User is not active', 403);
        }

        // const isPasswordValid = await compare(credentials.password, user.password_hash);
        // if (!isPasswordValid) {
        //     throw new InvalidCredentialsError();
        // }

        const tokens = await this.jwtService.generateTokens({
            userId: user._id.toString(),
            role: user.role
        });

        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            userId: user._id.toString(),
            role: user.role
        }

    }
}