import { Request, Response } from "express";
import { container, injectable } from "tsyringe";
import { LoginService } from "../../application/auth/login.service";

@injectable()
export class AuthController {
    async login(req: Request, res: Response) {
        const loginService = container.resolve(LoginService);
        const tokens = await loginService.execute(req.body);

        res.status(200).json(tokens);
    }
}