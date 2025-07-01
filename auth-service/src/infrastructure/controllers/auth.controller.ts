import { Request, Response } from "express";
import { container, injectable } from "tsyringe";
import { LoginService } from "../../application/auth/login.service";
import { RefreshTokenService } from "../../application/auth/refreshToken.service";
import { InvalidCredentialsError } from "../../application/middleware/error.middleware";
@injectable()
export class AuthController {
    async login(req: Request, res: Response) {
        const loginService = container.resolve(LoginService);
        const tokens = await loginService.execute(req.body);

        res.status(200).json(tokens);
    }

    async refreshToken(req: Request, res: Response) { 
        const refreshTokenService = container.resolve(RefreshTokenService);
        const tokens = await refreshTokenService.execute(req.body);
        if (!tokens) {
            throw new InvalidCredentialsError();
        }
        res.status(200).json(tokens);
    }
}