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
      .transform(val => val ? parseInt(val, 10) : undefined)
      .refine(val => !val || (val > 0 && val <= 1000), {
        message: 'limit должен быть от 1 до 1000',
      }),
    offset: z
      .string()
      .optional()
      .transform(val => val ? parseInt(val, 10) : undefined)
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
};
