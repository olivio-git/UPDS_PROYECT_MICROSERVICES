import { z } from 'zod';
import { CONSTANTS } from '../utils/constants';

const examSectionSchema = z.object({
  name: z.string().min(1),
  competency: z.enum(Object.values(CONSTANTS.COMPETENCIES) as [string, ...string[]]),
  duration: z.number().min(1).max(240),
  questionCount: z.number().min(1).max(100),
  weight: z.number().min(0).max(100)
});

const placementConfigSchema = z.object({
  mode: z.enum(['static', 'adaptive']).optional(),
  startingLevel: z.enum(Object.values(CONSTANTS.LEVELS) as [string, ...string[]]).optional(),
  maxQuestions: z.number().min(1).max(100).optional(),
  consecutiveWrongThreshold: z.number().min(1).max(10).optional(),
  levelPassingThreshold: z.number().min(1).max(100).optional()
}).optional();

export const examSchema = {
  create: z.object({
    name: z.string().min(3).max(200),
    description: z.string().max(1000).optional().default(''),
    type: z.enum(Object.values(CONSTANTS.EXAM_TYPES) as [string, ...string[]]),
    targetLevel: z.enum(Object.values(CONSTANTS.LEVELS) as [string, ...string[]]),
    structure: z.object({
      sections: z.array(examSectionSchema).min(0),
      totalDuration: z.number().min(0).max(480),
      passingScore: z.number().min(0).max(100)
    }),
    placementConfig: placementConfigSchema,
    configuration: z.object({
      randomizeQuestions: z.boolean().default(true),
      allowReview: z.boolean().default(false),
      showResults: z.boolean().default(true),
      attemptsAllowed: z.number().min(1).max(10).default(1),
      timeBetweenAttempts: z.number().min(0).max(720).default(24)
    }).optional(),
    questionPool: z.array(z.string()).optional(),
    isActive: z.boolean().default(true),
    isTemplate: z.boolean().default(false)
  }),

  update: z.object({
    name: z.string().min(3).max(200).optional(),
    description: z.string().max(1000).optional(),
    type: z.enum(Object.values(CONSTANTS.EXAM_TYPES) as [string, ...string[]]).optional(),
    targetLevel: z.enum(Object.values(CONSTANTS.LEVELS) as [string, ...string[]]).optional(),
    structure: z.object({
      sections: z.array(examSectionSchema).min(0),
      totalDuration: z.number().min(0).max(480),
      passingScore: z.number().min(0).max(100)
    }).optional(),
    placementConfig: placementConfigSchema,
    configuration: z.object({
      randomizeQuestions: z.boolean().optional(),
      allowReview: z.boolean().optional(),
      showResults: z.boolean().optional(),
      attemptsAllowed: z.number().min(1).max(10).optional(),
      timeBetweenAttempts: z.number().min(0).max(720).optional()
    }).optional(),
    questionPool: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    isTemplate: z.boolean().optional(),
    approvedBy: z.string().optional()
  }),

  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/)
  }),

  generateQuestions: z.object({
    candidateId: z.string().regex(/^[0-9a-fA-F]{24}$/)
  })
};
