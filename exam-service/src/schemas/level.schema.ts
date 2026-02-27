import { z } from 'zod';
import { CONSTANTS } from '../utils/constants';

const canDoStatementSchema = z.string().min(10).max(500);

const competencyRequirementSchema = z.object({
  minScore: z.number().min(0).max(100),
  description: z.string(),
  canDoStatements: z.array(canDoStatementSchema).min(1)
});

export const levelSchema = {
  create: z.object({
    code: z.enum(Object.values(CONSTANTS.LEVELS) as [string, ...string[]]),
    name: z.string().min(3).max(100),
    description: z.string().max(1000),
    competencyRequirements: z.object({
      reading: competencyRequirementSchema,
      writing: competencyRequirementSchema,
      listening: competencyRequirementSchema,
      speaking: competencyRequirementSchema,
      grammar: competencyRequirementSchema,
      vocabulary: competencyRequirementSchema
    }),
    overallMinScore: z.number().min(0).max(100),
    isActive: z.boolean().optional().default(true)
  }),

  update: z.object({
    name: z.string().min(3).max(100).optional(),
    description: z.string().max(1000).optional(),
    competencyRequirements: z.object({
      reading: competencyRequirementSchema.optional(),
      writing: competencyRequirementSchema.optional(),
      listening: competencyRequirementSchema.optional(),
      speaking: competencyRequirementSchema.optional(),
      grammar: competencyRequirementSchema.optional(),
      vocabulary: competencyRequirementSchema.optional()
    }).optional(),
    overallMinScore: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional()
  }),

  params: z.object({
    code: z.enum(Object.values(CONSTANTS.LEVELS) as [string, ...string[]])
  }),

  idParams: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de MongoDB inválido')
  }),

  query: z.object({
    isActive: z.string().optional()
  })
};
