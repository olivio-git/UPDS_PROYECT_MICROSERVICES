import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { OtpController } from '../controllers/otp.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { validateSchema } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { LoginSchema, RegisterSchema, RefreshTokenSchema } from '../schemas/auth.schemas';

export const createAuthRoutes = (
  authController: AuthController,
  otpController: OtpController,
  authMiddleware: AuthMiddleware
): Router => {
  const router = Router();

  // Rutas públicas
  router.post(
    '/register',
    validateSchema(RegisterSchema),
    asyncHandler(authController.register)
  );

  router.post(
    '/login',
    authMiddleware.rateLimiter(10, 15 * 60 * 1000), // 10 intentos por 15 minutos
    validateSchema(LoginSchema),
    asyncHandler(authController.login)
  );

  router.post(
    '/refresh',
    validateSchema(RefreshTokenSchema),
    asyncHandler(authController.refreshToken)
  );

  // Rutas protegidas
  router.post(
    '/logout',
    authMiddleware.authenticate,
    asyncHandler(authController.logout)
  );

  router.post(
    '/logout-all',
    authMiddleware.authenticate,
    asyncHandler(authController.logoutAll)
  );

  router.get(
    '/profile',
    authMiddleware.authenticate,
    asyncHandler(authController.getProfile)
  );

  router.get(
    '/validate',
    authMiddleware.authenticate,
    asyncHandler(authController.validateToken)
  );

  // Rutas OTP
  router.post(
    '/otp/generate',
    authMiddleware.rateLimiter(5, 10 * 60 * 1000), // 5 intentos por 10 minutos
    asyncHandler(otpController.generateOtp)
  );

  router.post(
    '/otp/verify',
    authMiddleware.rateLimiter(10, 5 * 60 * 1000), // 10 intentos por 5 minutos
    asyncHandler(otpController.verifyOtp)
  );

  router.get(
    '/otp/status',
    asyncHandler(otpController.getOtpStatus)
  );

  router.delete(
    '/otp/revoke',
    asyncHandler(otpController.revokeOtp)
  );

  return router;
};
