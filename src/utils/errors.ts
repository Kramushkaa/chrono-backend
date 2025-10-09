import { Request, Response, NextFunction } from 'express';

export type ApiErrorOptions = {
  status: number;
  code?: string;
  message: string;
  details?: unknown;
};

// Тип для PostgreSQL ошибок
export interface PgError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
  table?: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(opts: ApiErrorOptions) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

export const errors = {
  badRequest: (message = 'Некорректный запрос', code = 'bad_request', details?: unknown) =>
    new ApiError({ status: 400, code, message, details }),
  unauthorized: (message = 'Требуется аутентификация', code = 'unauthorized', details?: unknown) =>
    new ApiError({ status: 401, code, message, details }),
  forbidden: (message = 'Недостаточно прав', code = 'forbidden', details?: unknown) =>
    new ApiError({ status: 403, code, message, details }),
  notFound: (message = 'Не найдено', code = 'not_found', details?: unknown) =>
    new ApiError({ status: 404, code, message, details }),
  conflict: (message = 'Конфликт', code = 'conflict', details?: unknown) =>
    new ApiError({ status: 409, code, message, details }),
  tooMany: (message = 'Слишком много запросов', code = 'too_many_requests', details?: unknown) =>
    new ApiError({ status: 429, code, message, details }),
  server: (message = 'Внутренняя ошибка сервера', code = 'internal_error', details?: unknown) =>
    new ApiError({ status: 500, code, message, details }),
};

export function mapPgError(err: unknown): ApiError | null {
  const pgError = err as PgError;
  const code = pgError?.code;

  if (!code) return null;

  switch (code) {
    case '23505': // unique_violation
      return errors.conflict('Нарушение уникальности', 'unique_violation', {
        detail: pgError.detail,
        constraint: pgError.constraint,
      });
    case '23503': // foreign_key_violation
      return errors.conflict('Нарушение внешнего ключа', 'foreign_key_violation', {
        detail: pgError.detail,
      });
    case '23P01': // exclusion_violation
      return errors.conflict('Нарушение ограничения: пересечение периодов', 'exclusion_violation', {
        detail: pgError.detail,
      });
    default:
      return errors.server('Ошибка базы данных', 'db_error', { code, detail: pgError.detail });
  }
}

// Типизированный helper для async route handlers
export type AsyncRouteHandler<TReq extends Request = Request, TRes extends Response = Response> = (
  req: TReq,
  res: TRes,
  next: NextFunction
) => Promise<void> | void;

export const asyncHandler = <TReq extends Request = Request, TRes extends Response = Response>(
  fn: AsyncRouteHandler<TReq, TRes>
) => {
  return (req: TReq, res: TRes, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
