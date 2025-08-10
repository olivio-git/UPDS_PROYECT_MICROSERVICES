import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
});

export const RegisterSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  role: z.enum(['admin', 'teacher', 'proctor', 'student']).default('student')
});

export const ChangePasswordSchema = z.object({
  userId: z.string().min(1, 'ID de usuario requerido'),
  oldPassword: z.string().min(6, 'La contraseña antigua debe tener al menos 6 caracteres'),
  newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres')
});
export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido')
});

export type LoginRequest = z.infer<typeof LoginSchema>;
export type RegisterRequest = z.infer<typeof RegisterSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordSchema>;