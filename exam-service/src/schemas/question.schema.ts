import { z } from 'zod';
import { CONSTANTS } from '../utils/constants';

export const questionSchema = {
  create: z.object({
    type: z.enum(Object.values(CONSTANTS.QUESTION_TYPES) as [string, ...string[]]),
    competency: z.enum(Object.values(CONSTANTS.COMPETENCIES) as [string, ...string[]]),
    level: z.enum(Object.values(CONSTANTS.LEVELS) as [string, ...string[]]),
    difficulty: z.number().min(1).max(5),
    content: z.object({
      question: z.string(),
      instructions: z.string().optional(),
      context: z.string().optional(),
      mediaUrl: z.string().url().optional(),
      mediaType: z.enum(['audio', 'image']).optional(),
      options: z.array(z.object({
        id: z.string(),
        text: z.string(),
        isCorrect: z.boolean().optional()
      })).optional(),
      correctAnswer: z.string().optional(),
      sampleAnswer: z.string().optional(),
      keywords: z.array(z.string()).optional()
    }),
    metadata: z.object({
      topic: z.string().optional(),
      subtopic: z.string().optional(),
      tags: z.array(z.string()).optional(),
      estimatedTime: z.number().min(0).optional(),
      points: z.number().min(0).optional(),
      rubricId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional()
    }).optional(),
    isActive: z.boolean().default(true)
  }),

  update: z.object({
    type: z.enum(Object.values(CONSTANTS.QUESTION_TYPES) as [string, ...string[]]).optional(),
    competency: z.enum(Object.values(CONSTANTS.COMPETENCIES) as [string, ...string[]]).optional(),
    level: z.enum(Object.values(CONSTANTS.LEVELS) as [string, ...string[]]).optional(),
    difficulty: z.number().min(1).max(5).optional(),
    content: z.object({
      question: z.string().optional(),
      instructions: z.string().optional(),
      context: z.string().optional(),
      mediaUrl: z.string().url().optional(),
      mediaType: z.enum(['audio', 'image']).optional(),
      options: z.array(z.object({
        id: z.string(),
        text: z.string(),
        isCorrect: z.boolean().optional()
      })).optional(),
      correctAnswer: z.string().optional(),
      sampleAnswer: z.string().optional(),
      keywords: z.array(z.string()).optional()
    }).optional(),
    metadata: z.object({
      topic: z.string().optional(),
      subtopic: z.string().optional(),
      tags: z.array(z.string()).optional(),
      estimatedTime: z.number().min(0).optional(),
      points: z.number().min(0).optional(),
      rubricId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional()
    }).optional(),
    isActive: z.boolean().optional(),
    reviewedBy: z.string().regex(/^[0-9a-fA-F]{24}$/).optional()
  }),

  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/)
  }),

  query: z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    type: z.enum(Object.values(CONSTANTS.QUESTION_TYPES) as [string, ...string[]]).optional(),
    competency: z.enum(Object.values(CONSTANTS.COMPETENCIES) as [string, ...string[]]).optional(),
    level: z.enum(Object.values(CONSTANTS.LEVELS) as [string, ...string[]]).optional(),
    difficulty: z.coerce.number().min(1).max(5).optional(),
    tags: z.string().optional(),
    isActive: z.union([
      z.boolean(),
      z.enum(['true', 'false']).transform(val => val === 'true')
    ]).optional()
  })
};
