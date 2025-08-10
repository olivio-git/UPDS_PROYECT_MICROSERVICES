import { z } from 'zod';

export const ExamSchema = z.object({
  title: z.string().min(1, 'El título del examen es requerido'),
  description: z.string().optional(),
  duration: z.number().min(1, 'La duración del examen debe ser al menos 1 minuto'),
  questions: z.array(
    z.object({
      questionText: z.string().min(1, 'El texto de la pregunta es requerido'),
      options: z.array(
        z.object({
          optionText: z.string().min(1, 'El texto de la opción es requerido'),
          isCorrect: z.boolean()
        })
      ).min(2, 'Debe haber al menos dos opciones')
    })
  ).min(1, 'Debe haber al menos una pregunta')
});

export const ExamParamsSchema = z.object({
  id: z.string().uuid('El ID del examen debe ser un UUID válido')
});

export const ExamUpdateSchema = z.object({
  title: z.string().min(1, 'El título del examen es requerido').optional(),
  description: z.string().optional(),
  duration: z.number().min(1, 'La duración del examen debe ser al menos 1 minuto').optional(),
  questions: z.array(
    z.object({
      questionText: z.string().min(1, 'El texto de la pregunta es requerido'),
      options: z.array(
        z.object({
          optionText: z.string().min(1, 'El texto de la opción es requerido'),
          isCorrect: z.boolean()
        })
      ).min(2, 'Debe haber al menos dos opciones')
    })
  ).optional()
});

export const ExamGenerateQuestionsSchema = z.object({
  numberOfQuestions: z.number().min(1, 'Debe generar al menos una pregunta')
});

export const examSchema = {
  create: ExamSchema,
  params: ExamParamsSchema,
  update: ExamUpdateSchema,
  generateQuestions: ExamGenerateQuestionsSchema
};
export const create = ExamSchema;
export const params = ExamParamsSchema;
export type Exam = z.infer<typeof ExamSchema>;
export type ExamParams = z.infer<typeof ExamParamsSchema>;
export type ExamUpdate = z.infer<typeof ExamUpdateSchema>;
