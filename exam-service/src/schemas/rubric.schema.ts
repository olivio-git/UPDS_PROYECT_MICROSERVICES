import { z } from 'zod';
import { CONSTANTS } from '../utils/constants';

const rubricLevelSchema = z.object({
  score: z.number().min(0),
  description: z.string(),
  examples: z.array(z.string()).optional()
});

const rubricCriterionSchema = z.object({
  name: z.string(),
  description: z.string(),
  weight: z.number().min(0).max(100),
  levels: z.array(rubricLevelSchema).min(2)
});

export const rubricSchema = {
  create: z.object({
    name: z.string().min(3).max(200),
    competency: z.enum(Object.values(CONSTANTS.COMPETENCIES) as [string, ...string[]]),
    level: z.enum(Object.values(CONSTANTS.LEVELS) as [string, ...string[]]),
    criteria: z.array(rubricCriterionSchema).min(1),
    scoringType: z.enum(Object.values(CONSTANTS.SCORING_TYPES) as [string, ...string[]]),
    maxScore: z.number().min(1).max(100),
    isActive: z.boolean().default(true)
  }),

  update: z.object({
    name: z.string().min(3).max(200).optional(),
    competency: z.enum(Object.values(CONSTANTS.COMPETENCIES) as [string, ...string[]]).optional(),
    level: z.enum(Object.values(CONSTANTS.LEVELS) as [string, ...string[]]).optional(),
    criteria: z.array(rubricCriterionSchema).min(1).optional(),
    scoringType: z.enum(Object.values(CONSTANTS.SCORING_TYPES) as [string, ...string[]]).optional(),
    maxScore: z.number().min(1).max(100).optional(),
    isActive: z.boolean().optional()
  }),

  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/)
  }),

  competencyLevelParams: z.object({
    competency: z.enum(Object.values(CONSTANTS.COMPETENCIES) as [string, ...string[]]),
    level: z.enum(Object.values(CONSTANTS.LEVELS) as [string, ...string[]])
  }),

  clone: z.object({
    name: z.string().min(3).max(200)
  }),

  query: z.object({
    page: z.number().min(1).default(1).optional(),
    limit: z.number().min(1).max(100).default(10).optional(),
    competency: z.enum(Object.values(CONSTANTS.COMPETENCIES) as [string, ...string[]]).optional(),
    level: z.enum(Object.values(CONSTANTS.LEVELS) as [string, ...string[]]).optional(),
    scoringType: z.enum(Object.values(CONSTANTS.SCORING_TYPES) as [string, ...string[]]).optional(),
    isActive: z.string().optional(),
    search: z.string().optional()
  })
};
