import { ApiError, errors, mapPgError, PgError } from '../../utils/errors';

describe('errors.ts Utils', () => {
  // ============================================================================
  // 3.1. ApiError Class
  // ============================================================================

  describe('ApiError Class', () => {
    it('should create error with all fields set correctly', () => {
      const error = new ApiError({
        status: 404,
        code: 'not_found',
        message: 'Resource not found',
        details: { resource: 'user', id: 123 },
      });

      expect(error.status).toBe(404);
      expect(error.code).toBe('not_found');
      expect(error.message).toBe('Resource not found');
      expect(error.details).toEqual({ resource: 'user', id: 123 });
    });

    it('should be instance of Error', () => {
      const error = new ApiError({
        status: 500,
        message: 'Internal error',
      });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('ApiError');
    });

    it('should work with minimal fields', () => {
      const error = new ApiError({
        status: 400,
        message: 'Bad request',
      });

      expect(error.status).toBe(400);
      expect(error.message).toBe('Bad request');
      expect(error.code).toBeUndefined();
      expect(error.details).toBeUndefined();
    });
  });

  // ============================================================================
  // 3.2. Error Factory Methods
  // ============================================================================

  describe('Error Factory Methods', () => {
    it('should create badRequest error with status 400', () => {
      const error = errors.badRequest('Invalid input');

      expect(error.status).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('bad_request');
    });

    it('should create unauthorized error with status 401', () => {
      const error = errors.unauthorized('Token expired');

      expect(error.status).toBe(401);
      expect(error.message).toBe('Token expired');
      expect(error.code).toBe('unauthorized');
    });

    it('should create forbidden error with status 403', () => {
      const error = errors.forbidden('Access denied');

      expect(error.status).toBe(403);
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('forbidden');
    });

    it('should create notFound error with status 404', () => {
      const error = errors.notFound('User not found');

      expect(error.status).toBe(404);
      expect(error.message).toBe('User not found');
      expect(error.code).toBe('not_found');
    });

    it('should create conflict error with status 409', () => {
      const error = errors.conflict('Email already exists');

      expect(error.status).toBe(409);
      expect(error.message).toBe('Email already exists');
      expect(error.code).toBe('conflict');
    });

    it('should create tooMany error with status 429', () => {
      const error = errors.tooMany('Rate limit exceeded');

      expect(error.status).toBe(429);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe('too_many_requests');
    });

    it('should create server error with status 500', () => {
      const error = errors.server('Database connection failed');

      expect(error.status).toBe(500);
      expect(error.message).toBe('Database connection failed');
      expect(error.code).toBe('internal_error');
    });

    it('should use default messages when not provided', () => {
      expect(errors.badRequest().message).toBe('Некорректный запрос');
      expect(errors.unauthorized().message).toBe('Требуется аутентификация');
      expect(errors.forbidden().message).toBe('Недостаточно прав');
      expect(errors.notFound().message).toBe('Не найдено');
    });

    it('should accept custom codes and details', () => {
      const error = errors.badRequest('Invalid field', 'validation_error', {
        field: 'email',
        reason: 'invalid format',
      });

      expect(error.code).toBe('validation_error');
      expect(error.details).toEqual({
        field: 'email',
        reason: 'invalid format',
      });
    });
  });

  // ============================================================================
  // 3.3. PostgreSQL Error Mapping
  // ============================================================================

  describe('mapPgError', () => {
    it('should map unique violation (23505)', () => {
      const pgError: PgError = {
        name: 'error',
        message: 'duplicate key',
        code: '23505',
        detail: 'Key (email)=(test@example.com) already exists.',
        constraint: 'users_email_key',
      };

      const apiError = mapPgError(pgError);

      expect(apiError).toBeInstanceOf(ApiError);
      expect(apiError?.status).toBe(409);
      expect(apiError?.message).toBe('Нарушение уникальности');
      expect(apiError?.code).toBe('unique_violation');
      expect(apiError?.details).toEqual({
        detail: pgError.detail,
        constraint: pgError.constraint,
      });
    });

    it('should map foreign key violation (23503)', () => {
      const pgError: PgError = {
        name: 'error',
        message: 'foreign key violation',
        code: '23503',
        detail: 'Key (user_id)=(999) is not present in table "users".',
      };

      const apiError = mapPgError(pgError);

      expect(apiError).toBeInstanceOf(ApiError);
      expect(apiError?.status).toBe(409);
      expect(apiError?.message).toBe('Нарушение внешнего ключа');
      expect(apiError?.code).toBe('foreign_key_violation');
      expect(apiError?.details).toEqual({
        detail: pgError.detail,
      });
    });

    it('should map exclusion violation (23P01)', () => {
      const pgError: PgError = {
        name: 'error',
        message: 'exclusion violation',
        code: '23P01',
        detail: 'Key (period)=(["2020-01-01","2020-12-31")) conflicts with existing key.',
      };

      const apiError = mapPgError(pgError);

      expect(apiError).toBeInstanceOf(ApiError);
      expect(apiError?.status).toBe(409);
      expect(apiError?.message).toBe('Нарушение ограничения: пересечение периодов');
      expect(apiError?.code).toBe('exclusion_violation');
      expect(apiError?.details).toEqual({
        detail: pgError.detail,
      });
    });

    it('should map unknown PG error codes to server error', () => {
      const pgError: PgError = {
        name: 'error',
        message: 'some db error',
        code: '42P01',
        detail: 'relation "unknown_table" does not exist',
      };

      const apiError = mapPgError(pgError);

      expect(apiError).toBeInstanceOf(ApiError);
      expect(apiError?.status).toBe(500);
      expect(apiError?.message).toBe('Ошибка базы данных');
      expect(apiError?.code).toBe('db_error');
      expect(apiError?.details).toEqual({
        code: '42P01',
        detail: pgError.detail,
      });
    });

    it('should return null for non-PG errors', () => {
      const regularError = new Error('Regular error');
      const apiError = mapPgError(regularError);

      expect(apiError).toBeNull();
    });

    it('should return null for errors without code', () => {
      const errorWithoutCode = {
        name: 'error',
        message: 'some error',
      };

      const apiError = mapPgError(errorWithoutCode);

      expect(apiError).toBeNull();
    });
  });
});
