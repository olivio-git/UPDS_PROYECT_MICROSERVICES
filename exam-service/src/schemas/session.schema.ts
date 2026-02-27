import { z } from 'zod';
import { CONSTANTS } from '../utils/constants';

// Time slot schema
const timeSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  capacity: z.number().min(1).max(500)
});

// Scheduling schema
const schedulingSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/),
  timeSlots: z.array(timeSlotSchema)
}).refine((data) => new Date(data.endDate) > new Date(data.startDate), {
  message: "End date must be after start date",
  path: ["endDate"]
});

// Participants schema
const participantsSchema = z.object({
  maxCandidates: z.number().min(1).max(1000),
  registeredCandidates: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
  proctors: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional()
});

// Settings schema
const settingsSchema = z.object({
  requireProctor: z.boolean().default(true),
  enableRecording: z.boolean().default(false),
  enableLockdown: z.boolean().default(false),
  allowLateEntry: z.boolean().default(false),
  autoStart: z.boolean().default(false),
  lateEntryMinutes: z.number().min(0).max(30).default(0)
});

export const sessionSchema = {
  create: z.object({
    examId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    sessionName: z.string().min(3).max(200),
    scheduling: schedulingSchema,
    participants: participantsSchema.optional(),
    settings: settingsSchema.optional(),
    status: z.enum(Object.values(CONSTANTS.SESSION_STATUS) as [string, ...string[]]).default(CONSTANTS.SESSION_STATUS.SCHEDULED)
  }),

  update: z.object({
    sessionName: z.string().min(3).max(200).optional(),
    scheduling: schedulingSchema.partial().optional(),
    participants: participantsSchema.partial().optional(),
    settings: settingsSchema.partial().optional(),
    status: z.enum(Object.values(CONSTANTS.SESSION_STATUS) as [string, ...string[]]).optional()
  }),

  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/)
  }),

  addCandidate: z.object({
    candidateId: z.string().regex(/^[0-9a-fA-F]{24}$/)
  }),

  addProctor: z.object({
    proctorId: z.string().regex(/^[0-9a-fA-F]{24}$/)
  })
};
