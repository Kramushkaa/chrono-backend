import { Pool } from 'pg';
import { determineContentStatus, User } from '../utils/content-status';
import { QueryBuilder } from '../utils/query-builder';
import { errors } from '../utils/errors';
import { paginateRows, parseLimitOffset, PaginationDefaults } from '../utils/api';
import { TelegramService } from './telegramService';
import { PeriodRow } from '../types/database';
import { BaseService } from './BaseService';
import { logger } from '../utils/logger';
import { PaginatedResponse, SqlValue } from '../types/common';

export interface PeriodCreateData {
  personId: string;
  startYear: number;
  endYear: number;
  periodType: string;
  countryId?: number | null;
  comment?: string;
}

export interface PeriodFilters {
  q?: string;
  personId?: string;
  countryId?: number;
  periodType?: string;
  yearFrom?: number;
  yearTo?: number;
}

export class PeriodsService extends BaseService {
  private telegramService: TelegramService;

  constructor(pool: Pool, telegramService: TelegramService) {
    super(pool);
    this.telegramService = telegramService;
  }

  /**
   * Валидация годов периода относительно годов жизни личности
   */
  async validatePeriodYears(
    startYear: number,
    endYear: number,
    personId: string
  ): Promise<{ personName: string }> {
    if (startYear >= endYear) {
      throw errors.badRequest('start_year должен быть меньше end_year');
    }

    const personRes = await this.executeQuery(
      'SELECT id, birth_year, death_year, name FROM persons WHERE id = $1',
      [personId],
      {
        action: 'validatePeriodYears',
        params: { startYear, endYear, personId },
      }
    );

    if (personRes.rowCount === 0) {
      throw errors.notFound('Личность не найдена');
    }

    const person = personRes.rows[0];

    if (person.birth_year != null && person.death_year != null) {
      if (startYear < Number(person.birth_year) || endYear > Number(person.death_year)) {
        throw errors.badRequest(
          `Годы периода (${startYear}–${endYear}) должны входить в годы жизни Личности (${person.birth_year}–${person.death_year})`
        );
      }
    }

    return { personName: person.name };
  }

  /**
   * Проверка пересечения периодов для одной личности
   */
  async validatePeriodOverlap(
    personId: string,
    periodType: string,
    startYear: number,
    endYear: number,
    excludeId?: number
  ): Promise<void> {
    // Проверка пересечения только для периодов одного типа у одной личности
    let sql = `
      SELECT id, start_year, end_year
      FROM periods
      WHERE person_id = $1
        AND period_type = $2
        AND status != 'rejected'
        AND int4range(start_year, end_year) && int4range($3, $4)
    `;

    const params: SqlValue[] = [personId, periodType, startYear, endYear];

    if (excludeId) {
      sql += ` AND id != $5`;
      params.push(excludeId);
    }

    const result = await this.executeQuery(sql, params, {
      action: 'validatePeriodOverlap',
      params: { personId, periodType, startYear, endYear, excludeId },
    });

    if (result.rowCount && result.rowCount > 0) {
      const overlapping = result.rows[0];
      throw errors.badRequest(
        `Период пересекается с существующим периодом (${overlapping.start_year}–${overlapping.end_year})`
      );
    }
  }

  /**
   * Создание периода
   */
  async createPeriod(
    data: PeriodCreateData,
    user: User,
    saveAsDraft: boolean = false
  ): Promise<PeriodRow> {
    const { personId, startYear, endYear, periodType, countryId, comment } = data;

    // Валидация
    const { personName } = await this.validatePeriodYears(startYear, endYear, personId);

    // Проверка пересечений (только для не-черновиков)
    if (!saveAsDraft) {
      await this.validatePeriodOverlap(personId, periodType, startYear, endYear);
    }

    const status = determineContentStatus(user, saveAsDraft);

    const result = await this.executeQuery(
      `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, comment, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        personId,
        startYear,
        endYear,
        periodType,
        countryId ?? null,
        comment ?? null,
        status,
        user.sub,
      ],
      {
        action: 'createPeriod',
        params: { personId, startYear, endYear, periodType, userId: user.sub, saveAsDraft },
      }
    );

    // Invalidate metadata cache if approved
    if (status === 'approved') {
      this.invalidateMetadataCache();
    }

    // Telegram уведомление (если не черновик)
    if (status !== 'draft') {
      const userEmail = user.email || 'unknown';
      this.telegramService
        .notifyPeriodCreated(
          periodType,
          startYear,
          endYear,
          userEmail,
          status === 'approved' ? 'approved' : 'pending',
          personName
        )
        .catch(err => logger.warn('Telegram notification failed (period created)', { error: err }));
    }

    return result.rows[0];
  }

  /**
   * Получение периодов с фильтрами
   */
  async getPeriods(
    filters: PeriodFilters,
    limit?: number,
    offset?: number
  ): Promise<PaginatedResponse<unknown>> {
    const { limitParam, offsetParam } = parseLimitOffset(limit, offset, {
      defLimit: 200,
      maxLimit: 500,
    } as PaginationDefaults);

    const builder = new QueryBuilder();

    // Поиск
    if (filters.q && filters.q.trim().length > 0) {
      builder.addSearch(['v.person_name', 'v.country_name', 'v.comment'], filters.q.trim());
    }

    // Фильтры
    if (filters.personId) builder.addFilter('v.person_id', filters.personId);
    if (filters.countryId) builder.addNumericFilter('v.country_id', filters.countryId);
    if (filters.periodType) builder.addFilter('v.period_type', filters.periodType);
    if (filters.yearFrom) builder.addNumericFilter('v.start_year', filters.yearFrom, '>=');
    if (filters.yearTo) builder.addNumericFilter('v.end_year', filters.yearTo, '<=');

    const { whereClause, params } = builder.build();
    const nextParamIndex = builder.getNextParamIndex();

    const sql = `
      SELECT v.id, v.person_id, v.country_id, v.start_year, v.end_year, v.period_type,
             v.person_name, v.country_name
        FROM v_approved_periods v
       WHERE ${whereClause}
       ORDER BY v.start_year ASC, v.id ASC
       LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}
    `;

    params.push(limitParam + 1, offsetParam);
    const result = await this.executeQuery(sql, params, {
      action: 'getPeriods',
      params: { filters, limitParam, offsetParam },
    });
    return paginateRows(result.rows, limitParam, offsetParam);
  }

  /**
   * Получение периодов пользователя
   */
  async getUserPeriods(
    userId: number,
    limit?: number,
    offset?: number
  ): Promise<PaginatedResponse<unknown>> {
    const { limitParam, offsetParam } = parseLimitOffset(limit, offset, {
      defLimit: 200,
      maxLimit: 500,
    } as PaginationDefaults);

    const sql = `
      SELECT pr.id,
             pr.person_id,
             pr.country_id,
             pr.start_year,
             pr.end_year,
             pr.period_type,
             pr.comment,
             pr.status,
             pr.updated_at,
             pr.review_comment,
             COALESCE(p.name, '') AS person_name,
             COALESCE(c.name, '') AS country_name
        FROM periods pr
        LEFT JOIN persons p ON p.id = pr.person_id
        LEFT JOIN countries c ON c.id = pr.country_id
       WHERE pr.created_by = $1
       ORDER BY pr.updated_at DESC NULLS LAST, pr.id DESC
       LIMIT $2 OFFSET $3
    `;

    const result = await this.executeQuery(sql, [userId, limitParam + 1, offsetParam], {
      action: 'getUserPeriods',
      params: { userId, limitParam, offsetParam },
    });
    return paginateRows(result.rows, limitParam, offsetParam);
  }

  /**
   * Получение pending периодов (для модераторов)
   */
  async getPendingPeriods(limit?: number, offset?: number): Promise<PaginatedResponse<unknown>> {
    const { limitParam, offsetParam } = parseLimitOffset(limit, offset, {
      defLimit: 200,
      maxLimit: 500,
    } as PaginationDefaults);

    const sql = `
      SELECT pr.id,
             pr.person_id,
             pr.country_id,
             pr.start_year,
             pr.end_year,
             pr.period_type,
             pr.comment,
             pr.status,
             pr.created_by,
             pr.updated_at,
             COALESCE(p.name, '') AS person_name,
             COALESCE(c.name, '') AS country_name,
             u.email AS creator_email,
             u.username AS creator_username
        FROM periods pr
        LEFT JOIN persons p ON p.id = pr.person_id
        LEFT JOIN countries c ON c.id = pr.country_id
        LEFT JOIN users u ON u.id = pr.created_by
       WHERE pr.status = 'pending'
       ORDER BY pr.updated_at DESC NULLS LAST, pr.id DESC
       LIMIT $1 OFFSET $2
    `;

    const result = await this.executeQuery(sql, [limitParam + 1, offsetParam], {
      action: 'getPendingPeriods',
      params: { limitParam, offsetParam },
    });
    return paginateRows(result.rows, limitParam, offsetParam);
  }

  /**
   * Модерация периода
   */
  async reviewPeriod(
    periodId: number,
    action: 'approve' | 'reject',
    reviewerId: number,
    comment?: string
  ): Promise<any> {
    return this.reviewContent<PeriodRow>(
      'periods',
      'id',
      periodId,
      action,
      reviewerId,
      comment,
      'Период'
    );
  }

  /**
   * Обновление периода (только черновики)
   */
  async updatePeriod(
    periodId: number,
    userId: number,
    updates: Partial<PeriodCreateData>
  ): Promise<any> {
    const checkRes = await this.executeQuery(
      'SELECT created_by, status, person_id, period_type, start_year, end_year FROM periods WHERE id = $1',
      [periodId],
      {
        action: 'updatePeriod_check',
        params: { periodId, userId },
      }
    );

    if (checkRes.rowCount === 0) {
      throw errors.notFound('Период не найден');
    }

    const period = checkRes.rows[0];

    if (period.created_by !== userId) {
      throw errors.forbidden('Вы можете редактировать только свои периоды');
    }

    if (period.status !== 'draft') {
      throw errors.badRequest('Можно редактировать только черновики');
    }

    // Валидация новых годов
    const newStartYear = updates.startYear ?? period.start_year;
    const newEndYear = updates.endYear ?? period.end_year;
    const newPersonId = updates.personId ?? period.person_id;

    await this.validatePeriodYears(newStartYear, newEndYear, newPersonId);

    // Проверка пересечений с исключением текущего периода
    const newPeriodType = updates.periodType ?? period.period_type;
    await this.validatePeriodOverlap(
      newPersonId,
      newPeriodType,
      newStartYear,
      newEndYear,
      periodId
    );

    // Динамически строим UPDATE
    const fields: string[] = [];
    const values: SqlValue[] = [];
    let idx = 1;

    if (updates.startYear !== undefined) {
      fields.push(`start_year = $${idx++}`);
      values.push(updates.startYear);
    }
    if (updates.endYear !== undefined) {
      fields.push(`end_year = $${idx++}`);
      values.push(updates.endYear);
    }
    if (updates.periodType !== undefined) {
      fields.push(`period_type = $${idx++}`);
      values.push(updates.periodType);
    }
    if (updates.countryId !== undefined) {
      fields.push(`country_id = $${idx++}`);
      values.push(updates.countryId ?? null);
    }
    if (updates.comment !== undefined) {
      fields.push(`comment = $${idx++}`);
      values.push(updates.comment ?? null);
    }

    if (fields.length === 0) {
      throw errors.badRequest('Нет полей для обновления');
    }

    fields.push(`updated_at = NOW()`);
    fields.push(`updated_by = $${idx++}`);
    values.push(userId);

    const sql = `UPDATE periods SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    values.push(periodId);

    const result = await this.executeQuery(sql, values, {
      action: 'updatePeriod_update',
      params: { periodId, userId },
    });
    return result.rows[0];
  }

  /**
   * Отправка черновика на модерацию
   */
  async submitDraft(periodId: number, userId: number): Promise<any> {
    return this.submitDraftBase<PeriodRow>('periods', 'id', periodId, userId, 'Период');
  }

  /**
   * Получение черновиков пользователя
   */
  async getUserDrafts(
    userId: number,
    limit?: number,
    offset?: number
  ): Promise<PaginatedResponse<unknown>> {
    const { limitParam, offsetParam } = parseLimitOffset(limit, offset, {
      defLimit: 200,
      maxLimit: 500,
    } as PaginationDefaults);

    const sql = `
      SELECT pr.id,
             pr.person_id,
             pr.country_id,
             pr.start_year,
             pr.end_year,
             pr.period_type,
             pr.comment,
             pr.status,
             pr.created_at,
             pr.updated_at,
             COALESCE(p.name, '') AS person_name,
             COALESCE(c.name, '') AS country_name
        FROM periods pr
        LEFT JOIN persons p ON p.id = pr.person_id
        LEFT JOIN countries c ON c.id = pr.country_id
       WHERE pr.created_by = $1 AND pr.status = 'draft'
       ORDER BY pr.updated_at DESC, pr.id DESC
       LIMIT $2 OFFSET $3
    `;

    const result = await this.executeQuery(sql, [userId, limitParam + 1, offsetParam], {
      action: 'getUserDrafts',
      params: { userId, limitParam, offsetParam },
    });
    return paginateRows(result.rows, limitParam, offsetParam);
  }

  /**
   * Получение периодов по person_id
   */
  async getPeriodsByPerson(personId: string): Promise<any[]> {
    const result = await this.executeQuery(
      `SELECT id, person_id, start_year, end_year, period_type, country_id, country_name
       FROM v_approved_periods
       WHERE person_id = $1
       ORDER BY start_year ASC`,
      [personId],
      {
        action: 'getPeriodsByPerson',
        params: { personId },
      }
    );
    return result.rows;
  }

  /**
   * Удаление периода (только свои черновики)
   */
  async deletePeriod(periodId: number, userId: number): Promise<void> {
    return this.deleteDraftBase('periods', 'id', periodId, userId, 'Период');
  }

  /**
   * Получение количества периодов пользователя
   */
  async getUserPeriodsCount(userId: number): Promise<number> {
    const result = await this.executeQuery(
      `SELECT COALESCE(periods_count, 0) AS cnt FROM v_user_content_counts WHERE created_by = $1`,
      [userId],
      {
        action: 'getUserPeriodsCount',
        params: { userId },
      }
    );
    return result.rows[0]?.cnt || 0;
  }

  /**
   * Получение количества pending периодов
   */
  async getPendingCount(): Promise<number> {
    const result = await this.executeQuery(
      `SELECT COUNT(*)::int AS cnt FROM periods WHERE status = 'pending'`,
      [],
      {
        action: 'getPendingCount',
        params: {},
      }
    );
    return result.rows[0]?.cnt || 0;
  }
}
