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

  /**
   * Generic метод для модерации контента (approve/reject)
   */
  protected async reviewContent<T extends QueryResultRow>(
    table: string,
    idColumn: string,
    id: string | number,
    action: 'approve' | 'reject',
    reviewerId: number,
    comment?: string,
    entityName: string = 'запись'
  ): Promise<T> {
    // Проверяем существование записи
    const checkRes = await this.executeQuery(
      `SELECT id, status FROM ${table} WHERE ${idColumn} = $1`,
      [id],
      {
        action: 'reviewContent_check',
        params: { table, idColumn, id, action },
      }
    );

    if (checkRes.rowCount === 0) {
      throw errors.notFound(`${entityName} не найдена`);
    }

    const entity = checkRes.rows[0];

    if (entity.status !== 'pending') {
      throw errors.badRequest(`Можно модерировать только записи в статусе pending`);
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const result = await this.executeQuery<T>(
      `UPDATE ${table}
       SET status = $1, reviewed_by = $2, review_comment = $3, updated_at = NOW()
       WHERE ${idColumn} = $4
       RETURNING *`,
      [newStatus, reviewerId, comment ?? null, id],
      {
        action: 'reviewContent_update',
        params: { table, idColumn, id, action, reviewerId },
      }
    );

    return result.rows[0];
  }

  /**
   * Generic метод для отправки черновика на модерацию
   */
  protected async submitDraftBase<T extends QueryResultRow>(
    table: string,
    idColumn: string,
    id: string | number,
    userId: number,
    entityName: string = 'запись'
  ): Promise<T> {
    const checkRes = await this.executeQuery(
      `SELECT created_by, status FROM ${table} WHERE ${idColumn} = $1`,
      [id],
      {
        action: 'submitDraft_check',
        params: { table, idColumn, id, userId },
      }
    );

    if (checkRes.rowCount === 0) {
      throw errors.notFound(`${entityName} не найдена`);
    }

    const entity = checkRes.rows[0];

    if (entity.created_by !== userId) {
      throw errors.forbidden('Вы можете отправлять только свои черновики');
    }

    if (entity.status !== 'draft') {
      throw errors.badRequest('Можно отправлять только черновики');
    }

    const result = await this.executeQuery<T>(
      `UPDATE ${table} SET status = 'pending', updated_at = NOW() WHERE ${idColumn} = $1 RETURNING *`,
      [id],
      {
        action: 'submitDraft_update',
        params: { table, idColumn, id, userId },
      }
    );

    return result.rows[0];
  }

  /**
   * Generic метод для удаления черновика
   */
  protected async deleteDraftBase(
    table: string,
    idColumn: string,
    id: string | number,
    userId: number,
    entityName: string = 'запись'
  ): Promise<void> {
    const checkRes = await this.executeQuery(
      `SELECT created_by, status FROM ${table} WHERE ${idColumn} = $1`,
      [id],
      {
        action: 'deleteDraft_check',
        params: { table, idColumn, id, userId },
      }
    );

    if (checkRes.rowCount === 0) {
      throw errors.notFound(`${entityName} не найдена`);
    }

    const entity = checkRes.rows[0];

    if (entity.created_by !== userId) {
      throw errors.forbidden('Вы можете удалять только свои записи');
    }

    if (entity.status !== 'draft') {
      throw errors.badRequest('Можно удалять только черновики');
    }

    await this.executeQuery(`DELETE FROM ${table} WHERE ${idColumn} = $1`, [id], {
      action: 'deleteDraft_delete',
      params: { table, idColumn, id, userId },
    });
  }
}
