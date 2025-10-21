import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../utils/logger';
import { errors, ApiError } from '../utils/errors';

export interface ErrorContext {
  userId?: number;
  action?: string;
  params?: unknown;
  query?: string;
  [key: string]: unknown;
}

export class BaseService {
  protected pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Выполнить запрос с логированием и обработкой ошибок
   */
  protected async executeQuery<T extends QueryResultRow = any>(
    query: string,
    params: unknown[] = [],
    context?: ErrorContext
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();

    try {
      logger.debug('Executing database query', {
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        paramsCount: params.length,
        ...context,
      });

      const result = await this.pool.query<T>(query, params);

      const duration = Date.now() - startTime;
      logger.slowQuery(duration, query.substring(0, 200), params);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const dbError = error as Error;

      logger.dbError('Query execution failed', dbError, query, params);

      // Определяем тип ошибки и выбрасываем соответствующую ApiError
      if (
        dbError.message.includes('duplicate key') ||
        dbError.message.includes('UNIQUE constraint')
      ) {
        throw errors.conflict('Запись с такими данными уже существует', 'duplicate_entry');
      }

      if (dbError.message.includes('foreign key constraint')) {
        throw errors.badRequest('Связанная запись не найдена', 'foreign_key_violation');
      }

      if (dbError.message.includes('not found') || dbError.message.includes('no rows')) {
        throw errors.notFound('Запись не найдена');
      }

      // Перебрасываем остальные ошибки как внутренние
      logger.serviceError(this.constructor.name, 'executeQuery', dbError, {
        duration,
        ...context,
      });

      throw errors.server('Произошла ошибка при работе с базой данных');
    }
  }

  /**
   * Выполнить транзакцию
   */
  protected async executeTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.serviceError(this.constructor.name, 'executeTransaction', error as Error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Обработка ошибок с контекстом
   */
  protected handleError(error: Error, context?: ErrorContext): never {
    logger.serviceError(this.constructor.name, context?.action || 'unknown', error, context);
    throw error;
  }

  /**
   * Проверить существование записи
   */
  protected async checkRecordExists(
    table: string,
    condition: string,
    params: unknown[],
    errorMessage?: string
  ): Promise<boolean> {
    try {
      const result = await this.executeQuery(
        `SELECT 1 FROM ${table} WHERE ${condition} LIMIT 1`,
        params,
        { action: 'checkRecordExists', table }
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      // ApiError from executeQuery with code 'not_found'
      if (error instanceof ApiError && error.code === 'not_found') {
        if (errorMessage) {
          throw errors.notFound(errorMessage);
        }
        return false;
      }
      throw error;
    }
  }
}
