import { z } from 'zod';

// Schema for user ID parameter
export const idParamsSchema = z.object({
  id: z.string().uuid()
});

// Schema for user creation
export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['student', 'teacher', 'admin', 'proctor']),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  metadata: z.record(z.any()).optional()
});

// Schema for user update
export const UpdateUserSchema = CreateUserSchema.partial();

// Schema for user list query parameters
export const getUsersQuerySchema = z.object({
  page: z.number().min(1).optional(),
  limit: z.number().min(1).optional(),
  search: z.string().optional(),
  role: z.enum(['student', 'teacher', 'admin', 'proctor']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});
