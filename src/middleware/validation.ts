import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema, ZodIssue } from 'zod';
import { errors } from '../utils/errors';

/**
 * Middleware для валидации query параметров
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedQuery = schema.parse(req.query);
      req.query = validatedQuery as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.issues
          .map((err: ZodIssue) => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        next(errors.badRequest(`Некорректные параметры запроса: ${errorMessage}`));
      } else {
        next(errors.badRequest('Ошибка валидации параметров'));
      }
    }
  };
};

/**
 * Middleware для валидации body параметров
 */
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedBody = schema.parse(req.body);
      req.body = validatedBody;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.issues
          .map((err: ZodIssue) => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        next(errors.badRequest(`Некорректные данные: ${errorMessage}`));
      } else {
        next(errors.badRequest('Ошибка валидации данных'));
      }
    }
  };
};

/**
 * Middleware для валидации params
 */
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedParams = schema.parse(req.params);
      req.params = validatedParams as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.issues
          .map((err: ZodIssue) => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        next(errors.badRequest(`Некорректные параметры пути: ${errorMessage}`));
      } else {
        next(errors.badRequest('Ошибка валидации параметров пути'));
      }
    }
  };
};

// Общие схемы валидации
export const commonSchemas = {
  // Pagination schema
  pagination: z.object({
    limit: z
      .string()
      .optional()
      .transform(val => (val ? parseInt(val, 10) : undefined))
      .refine(val => !val || (val > 0 && val <= 1000), {
        message: 'limit должен быть от 1 до 1000',
      }),
    offset: z
      .string()
      .optional()
      .transform(val => (val ? parseInt(val, 10) : undefined))
      .refine(val => !val || val >= 0, {
        message: 'offset не может быть отрицательным',
      }),
    count: z
      .string()
      .optional()
      .transform(val => val === 'true'),
  }),

  // Year validation
  year: z
    .number()
    .int()
    .min(-3000, 'Год не может быть меньше -3000')
    .max(2100, 'Год не может быть больше 2100'),

  // ID validation
  id: z.string().min(1, 'ID не может быть пустым'),
  numericId: z
    .string()
    .min(1)
    .transform(val => parseInt(val, 10))
    .refine(val => !Number.isNaN(val) && val > 0, {
      message: 'ID должен быть положительным числом',
    }),

  // Auth schemas
  register: z.object({
    email: z.string().email('Некорректный email'),
    password: z.string().min(8, 'Пароль должен содержать минимум 8 символов'),
    username: z.string().optional(),
    fullName: z.string().optional(),
  }),

  login: z.object({
    email: z.string().email('Некорректный email'),
    password: z.string().min(1, 'Пароль обязателен'),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Текущий пароль обязателен'),
    newPassword: z.string().min(8, 'Новый пароль должен содержать минимум 8 символов'),
  }),

  // Content schemas
  updateAchievement: z.object({
    year: z.number().int().min(-3000).max(2100).optional(),
    description: z.string().max(2000, 'Описание слишком длинное').optional(),
    wikipedia_url: z.string().url('Некорректный URL Википедии').optional().nullable(),
    image_url: z.string().url('Некорректный URL изображения').optional().nullable(),
  }),

  // Person schemas
  personId: z.object({
    id: z.string().min(1, 'ID персоны не может быть пустым'),
  }),

  // Person search/filter schemas
  personSearch: z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    country: z.string().optional(),
    startYear: z.string().optional(),
    endYear: z.string().optional(),
    year_from: z.string().optional(),
    year_to: z.string().optional(),
  }),

  // Person lookup by IDs
  personLookup: z.object({
    ids: z.string().optional(),
  }),
};

// Quiz schemas
export const quizSchemas = {
  // Share code validation
  shareCode: z.object({
    shareCode: z.string().min(1, 'Код викторины не может быть пустым'),
  }),

  // Attempt ID validation
  attemptId: z.object({
    attemptId: z
      .string()
      .min(1)
      .transform(val => parseInt(val, 10))
      .refine(val => !Number.isNaN(val) && val > 0, {
        message: 'ID попытки должен быть положительным числом',
      }),
  }),

  // Session token validation
  sessionToken: z.object({
    sessionToken: z.string().min(1, 'Токен сессии не может быть пустым'),
  }),

  // Quiz attempt validation
  saveQuizAttempt: z.object({
    correctAnswers: z
      .number()
      .int()
      .min(0, 'Количество правильных ответов не может быть отрицательным'),
    totalQuestions: z.number().int().min(1, 'Общее количество вопросов должно быть больше 0'),
    totalTimeMs: z.number().int().min(0, 'Время не может быть отрицательным'),
    config: z.any().optional(),
    questionTypes: z.array(z.string()).optional(),
    answers: z.array(z.any()).optional(),
    questions: z.array(z.any()).optional(),
  }),

  // Check answer validation
  checkAnswer: z.object({
    sessionToken: z.string().min(1, 'Токен сессии обязателен'),
    questionId: z.string().min(1, 'ID вопроса обязателен'),
    answer: z.any(), // Answer can be of different types
    timeSpent: z.number().int().min(0, 'Время ответа не может быть отрицательным'),
  }),

  // Finish quiz validation
  finishQuiz: z.object({
    sessionToken: z.string().min(1, 'Токен сессии обязателен'),
  }),
};
