export type ApiErrorOptions = {
  status: number
  code?: string
  message: string
  details?: unknown
}

export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(opts: ApiErrorOptions) {
    super(opts.message)
    this.name = 'ApiError'
    this.status = opts.status
    this.code = opts.code
    this.details = opts.details
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
}

export function mapPgError(err: any): ApiError | null {
  const code: string | undefined = err?.code
  if (!code) return null
  switch (code) {
    case '23505': // unique_violation
      return errors.conflict('Нарушение уникальности', 'unique_violation')
    case '23503': // foreign_key_violation
      return errors.conflict('Нарушение внешнего ключа', 'foreign_key_violation')
    case '23P01': // exclusion_violation
      return errors.conflict('Нарушение ограничения: пересечение периодов', 'exclusion_violation')
    default:
      return errors.server('Ошибка базы данных', 'db_error', { code })
  }
}

// Small helper to wrap async handlers
export const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}


