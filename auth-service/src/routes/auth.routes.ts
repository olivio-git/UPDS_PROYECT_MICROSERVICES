import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { OtpController } from '../controllers/otp.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ServiceMiddleware } from '../middleware/service.middleware';
import { validateSchema } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { LoginSchema, RegisterSchema, RefreshTokenSchema, ChangePasswordSchema } from '../schemas/auth.schemas';

export const createAuthRoutes = (
  authController: AuthController,
  otpController: OtpController,
  authMiddleware: AuthMiddleware
): Router => {
  const router = Router();
  const serviceMiddleware = new ServiceMiddleware();

  // Registro público (para estudiantes - SIN token de servicio)
  router.post(
    '/register',
    validateSchema(RegisterSchema),
    asyncHandler(authController.register)
  );

  // Registro interno (para microservicios - CON token de servicio)
  router.post(
    '/internal/register',
    serviceMiddleware.authenticateService, // Solo user-management puede usar este
    validateSchema(RegisterSchema),
    asyncHandler(authController.register)
  );

  router.post('/change-password',
    authMiddleware.authenticate,
    validateSchema(ChangePasswordSchema),
    asyncHandler(authController.changePassword)
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
    // authMiddleware.rateLimiter(5, 10 * 60 * 1000), // 5 intentos por 10 minutos
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
