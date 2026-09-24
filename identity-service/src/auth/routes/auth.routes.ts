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
    authRateLimiter(10, 15 * 60, true), // 10 intentos por cuenta cada 15 minutos
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
    authRateLimiter(10, 5 * 60, true),
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
  //
  // /otp/status and /otp/revoke used to live here unauthenticated, taking a
  // bare email in the query string / body. Neither the frontend nor any
  // other service ever called them (verified by repo-wide grep for
  // "otp/status" and "otp/revoke" before removal) — they only exposed a way
  // for anyone to probe whether an OTP is pending for an arbitrary email, or
  // to cancel someone else's in-flight login/reset code. Removed rather than
  // gated behind auth, since nothing needs them; re-add only behind an
  // authenticated/proof-of-email-ownership check if a real caller appears.
  router.post('/otp/generate', asyncHandler(otpController.generateOtp));
  router.post('/otp/verify', authRateLimiter(10, 5 * 60, true), asyncHandler(otpController.verifyOtp));

  return router;
};
