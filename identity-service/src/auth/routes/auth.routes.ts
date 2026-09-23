import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { OtpController } from '../controllers/otp.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { asyncHandler, validateBody } from '../../middleware';
import { ChangePasswordSchema,
  VerifyPasswordSchema, LoginSchema, RefreshTokenSchema, RegisterSchema, ResetPasswordSchema } from '../schemas/auth.schemas';
import { authRateLimiter } from '../middleware/rate-limit.middleware';

export const createAuthRoutes = (authController: AuthController, otpController: OtpController): Router => {
  const router = Router();

  // Public self-registration (defaults to role=student, same as before).
  router.post('/register', validateBody(RegisterSchema), asyncHandler(authController.register));

  router.post(
    '/login',
    authRateLimiter(10, 15 * 60), // 10 intentos por 15 minutos, same window auth-service used
    validateBody(LoginSchema),
    asyncHandler(authController.login)
  );

  router.post('/refresh', validateBody(RefreshTokenSchema), asyncHandler(authController.refreshToken));

  router.post('/logout', authMiddleware.authenticate, asyncHandler(authController.logout));
  router.post('/logout-all', authMiddleware.authenticate, asyncHandler(authController.logoutAll));

  router.get('/profile', authMiddleware.authenticate, asyncHandler(authController.getProfile));
  router.get('/validate', authMiddleware.authenticate, asyncHandler(authController.validateToken));

  // Confirms the current password of an already signed-in user (used by the
  // password-change screen); never issues tokens.
  router.post(
    '/verify-password',
    authMiddleware.authenticate,
    authRateLimiter(10, 5 * 60),
    validateBody(VerifyPasswordSchema),
    asyncHandler(authController.verifyPassword)
  );

  router.post(
    '/change-password',
    authMiddleware.authenticate,
    validateBody(ChangePasswordSchema),
    asyncHandler(authController.changePassword)
  );

  router.post(
    '/reset-password',
    authRateLimiter(3, 5 * 60),
    validateBody(ResetPasswordSchema),
    asyncHandler(authController.resetPassword)
  );

  // OTP routes
  router.post('/otp/generate', asyncHandler(otpController.generateOtp));
  router.post('/otp/verify', authRateLimiter(10, 5 * 60), asyncHandler(otpController.verifyOtp));
  router.get('/otp/status', asyncHandler(otpController.getOtpStatus));
  router.delete('/otp/revoke', asyncHandler(otpController.revokeOtp));

  return router;
};
