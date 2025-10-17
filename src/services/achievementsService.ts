import { Pool } from 'pg';
import { determineContentStatus, User } from '../utils/content-status';
import { QueryBuilder } from '../utils/query-builder';
import { errors } from '../utils/errors';
import { paginateRows, parseLimitOffset, PaginationDefaults } from '../utils/api';
import { TelegramService } from './telegramService';

export interface AchievementCreateData {
  personId?: string;
  countryId?: number | null;
  year: number;
  description: string;
  wikipediaUrl?: string | null;
  imageUrl?: string | null;
}

export interface AchievementFilters {
  q?: string;
  personId?: string;
  countryId?: number;
  yearFrom?: number;
  yearTo?: number;
}

export class AchievementsService {
  private pool: Pool;
  private telegramService: TelegramService;

  constructor(pool: Pool, telegramService: TelegramService) {
    this.pool = pool;
    this.telegramService = telegramService;
  }

  /**
   * Валидация года достижения относительно годов жизни личности
   */
  async validateAchievementYears(year: number, personId: string): Promise<void> {
    const personRes = await this.pool.query(
      'SELECT birth_year, death_year, name FROM persons WHERE id = $1',
      [personId]
    );

    if (personRes.rowCount === 0) {
      throw errors.notFound('Личность не найдена');
    }

    const { birth_year, death_year } = personRes.rows[0];
    if (birth_year != null && death_year != null) {
      if (year < Number(birth_year) || year > Number(death_year)) {
        throw errors.badRequest(
          `Год достижения (${year}) должен входить в годы жизни Личности (${birth_year}–${death_year})`
        );
      }
    }
  }

  /**
   * Создание достижения для личности
   */
  async createAchievement(
    data: AchievementCreateData,
    user: User,
    saveAsDraft: boolean = false
  ): Promise<any> {
    const { personId, countryId, year, description, wikipediaUrl, imageUrl } = data;

    // Валидация годов для достижений личности
    if (personId) {
      await this.validateAchievementYears(year, personId);
    }

    const status = determineContentStatus(user, saveAsDraft);
    const personName = personId
      ? (await this.pool.query('SELECT name FROM persons WHERE id = $1', [personId])).rows[0]?.name
      : null;

    let result;

    if (status === 'approved' && personId) {
      // Админы/модераторы - с ON CONFLICT для дедупликации
      result = await this.pool.query(
        `INSERT INTO achievements (person_id, country_id, year, description, wikipedia_url, image_url, status, created_by)
         VALUES ($1, $2, $3, btrim($4), $5, $6, 'approved', $7)
         ON CONFLICT (person_id, year, lower(btrim(description)))
         WHERE person_id IS NOT NULL
         DO UPDATE SET wikipedia_url = EXCLUDED.wikipedia_url, image_url = EXCLUDED.image_url
         RETURNING *`,
        [
          personId,
          countryId ?? null,
          year,
          description,
          wikipediaUrl ?? null,
          imageUrl ?? null,
          user.sub,
        ]
      );
    } else {
      // Черновики и pending - без ON CONFLICT
      result = await this.pool.query(
        `INSERT INTO achievements (person_id, country_id, year, description, wikipedia_url, image_url, status, created_by)
         VALUES ($1, $2, $3, btrim($4), $5, $6, $7, $8)
         RETURNING *`,
        [
          personId ?? null,
          countryId ?? null,
          year,
          description,
          wikipediaUrl ?? null,
          imageUrl ?? null,
          status,
          user.sub,
        ]
      );
    }

    // Telegram уведомление (если не черновик)
    if (status !== 'draft' && personName) {
      const userEmail = user.email || 'unknown';
      this.telegramService
        .notifyAchievementCreated(description, year, userEmail, status, personName)
        .catch(err => console.warn('Telegram notification failed (achievement created):', err));
    }

    return result.rows[0];
  }

  /**
   * Получение достижений с фильтрами и пагинацией
   */
  async getAchievements(
    filters: AchievementFilters,
    limit?: number,
    offset?: number
  ): Promise<{ data: any[]; meta: any }> {
    const { limitParam, offsetParam } = parseLimitOffset(limit, offset, {
      defLimit: 200,
      maxLimit: 500,
    } as PaginationDefaults);

    const builder = new QueryBuilder();

    // Поиск по нескольким полям
    if (filters.q && filters.q.trim().length > 0) {
      builder.addSearch(['v.description', 'v.person_name', 'v.country_name'], filters.q.trim());
    }

    // Фильтры
    if (filters.personId) builder.addFilter('v.person_id', filters.personId);
    if (filters.countryId) builder.addNumericFilter('v.country_id', filters.countryId);
    if (filters.yearFrom) builder.addNumericFilter('v.year', filters.yearFrom, '>=');
    if (filters.yearTo) builder.addNumericFilter('v.year', filters.yearTo, '<=');

    const { whereClause, params } = builder.build();
    const nextParamIndex = builder.getNextParamIndex();

    const sql = `
      SELECT v.id, v.person_id, v.country_id, v.year, v.description, v.wikipedia_url, v.image_url,
             v.person_name, v.country_name
        FROM v_approved_achievements v
       WHERE ${whereClause}
       ORDER BY v.year ASC, v.id ASC
       LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}
    `;

    params.push(limitParam + 1, offsetParam);
    const result = await this.pool.query(sql, params);
    return paginateRows(result.rows, limitParam, offsetParam);
  }

  /**
   * Получение достижений пользователя
   */
  async getUserAchievements(
    userId: number,
    limit?: number,
    offset?: number
  ): Promise<{ data: any[]; meta: any }> {
    const { limitParam, offsetParam } = parseLimitOffset(limit, offset, {
      defLimit: 200,
      maxLimit: 500,
    } as PaginationDefaults);

    const sql = `
      SELECT a.id,
             a.person_id,
             a.country_id,
             a.year,
             a.description,
             a.wikipedia_url,
             a.image_url,
             a.status,
             a.updated_at,
             a.review_comment,
             COALESCE(
               CASE WHEN a.country_id IS NOT NULL THEN c.name
                    WHEN a.person_id IS NOT NULL THEN p.name
                    ELSE NULL END,
               ''
             ) AS title,
             COALESCE(p.name, c.name, '') AS related_name
        FROM achievements a
        LEFT JOIN persons   p ON p.id = a.person_id
        LEFT JOIN countries c ON c.id = a.country_id
       WHERE a.created_by = $1
       ORDER BY a.updated_at DESC NULLS LAST, a.id DESC
       LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(sql, [userId, limitParam + 1, offsetParam]);
    return paginateRows(result.rows, limitParam, offsetParam);
  }

  /**
   * Получение pending достижений (для модераторов)
   */
  async getPendingAchievements(
    limit?: number,
    offset?: number
  ): Promise<{ data: any[]; meta: any }> {
    const { limitParam, offsetParam } = parseLimitOffset(limit, offset, {
      defLimit: 200,
      maxLimit: 500,
    } as PaginationDefaults);

    const sql = `
      SELECT a.id,
             a.person_id,
             a.country_id,
             a.year,
             a.description,
             a.wikipedia_url,
             a.image_url,
             a.status,
             a.created_by,
             a.updated_at,
             COALESCE(
               CASE WHEN a.country_id IS NOT NULL THEN c.name
                    WHEN a.person_id IS NOT NULL THEN p.name
                    ELSE NULL END,
               ''
             ) AS title,
             u.email AS creator_email,
             u.username AS creator_username
        FROM achievements a
        LEFT JOIN persons   p ON p.id = a.person_id
        LEFT JOIN countries c ON c.id = a.country_id
        LEFT JOIN users     u ON u.id = a.created_by
       WHERE a.status = 'pending'
       ORDER BY a.updated_at DESC NULLS LAST, a.id DESC
       LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(sql, [limitParam + 1, offsetParam]);
    return paginateRows(result.rows, limitParam, offsetParam);
  }

  /**
   * Модерация достижения (approve/reject)
   */
  async reviewAchievement(
    achievementId: number,
    action: 'approve' | 'reject',
    reviewerId: number,
    comment?: string
  ): Promise<any> {
    // Проверяем существование
    const checkRes = await this.pool.query(
      'SELECT id, status, created_by FROM achievements WHERE id = $1',
      [achievementId]
    );

    if (checkRes.rowCount === 0) {
      throw errors.notFound('Достижение не найдено');
    }

    const achievement = checkRes.rows[0];

    if (achievement.status !== 'pending') {
      throw errors.badRequest('Можно модерировать только достижения в статусе pending');
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const result = await this.pool.query(
      `UPDATE achievements
       SET status = $1, reviewed_by = $2, review_comment = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newStatus, reviewerId, comment ?? null, achievementId]
    );

    return result.rows[0];
  }

  /**
   * Обновление достижения (для черновиков или собственных)
   */
  async updateAchievement(
    achievementId: number,
    userId: number,
    updates: Partial<AchievementCreateData>
  ): Promise<any> {
    // Проверяем права
    const checkRes = await this.pool.query(
      'SELECT created_by, status FROM achievements WHERE id = $1',
      [achievementId]
    );

    if (checkRes.rowCount === 0) {
      throw errors.notFound('Достижение не найдено');
    }

    const achievement = checkRes.rows[0];

    if (achievement.created_by !== userId) {
      throw errors.forbidden('Вы можете редактировать только свои достижения');
    }

    if (achievement.status !== 'draft') {
      throw errors.badRequest('Можно редактировать только черновики');
    }

    // Динамически строим UPDATE
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.year !== undefined) {
      fields.push(`year = $${idx++}`);
      values.push(updates.year);
    }
    if (updates.description !== undefined) {
      fields.push(`description = btrim($${idx++})`);
      values.push(updates.description);
    }
    if (updates.wikipediaUrl !== undefined) {
      fields.push(`wikipedia_url = $${idx++}`);
      values.push(updates.wikipediaUrl ?? null);
    }
    if (updates.imageUrl !== undefined) {
      fields.push(`image_url = $${idx++}`);
      values.push(updates.imageUrl ?? null);
    }

    if (fields.length === 0) {
      throw errors.badRequest('Нет полей для обновления');
    }

    fields.push(`updated_at = NOW()`);
    fields.push(`updated_by = $${idx++}`);
    values.push(userId);

    const sql = `UPDATE achievements SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    values.push(achievementId);

    const result = await this.pool.query(sql, values);
    return result.rows[0];
  }

  /**
   * Отправка черновика на модерацию
   */
  async submitDraft(achievementId: number, userId: number): Promise<any> {
    const checkRes = await this.pool.query(
      'SELECT created_by, status FROM achievements WHERE id = $1',
      [achievementId]
    );

    if (checkRes.rowCount === 0) {
      throw errors.notFound('Достижение не найдено');
    }

    const achievement = checkRes.rows[0];

    if (achievement.created_by !== userId) {
      throw errors.forbidden('Вы можете отправлять только свои черновики');
    }

    if (achievement.status !== 'draft') {
      throw errors.badRequest('Можно отправлять только черновики');
    }

    const result = await this.pool.query(
      `UPDATE achievements SET status = 'pending', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [achievementId]
    );

    return result.rows[0];
  }

  /**
   * Получение черновиков пользователя
   */
  async getUserDrafts(
    userId: number,
    limit?: number,
    offset?: number
  ): Promise<{ data: any[]; meta: any }> {
    const { limitParam, offsetParam } = parseLimitOffset(limit, offset, {
      defLimit: 200,
      maxLimit: 500,
    } as PaginationDefaults);

    const sql = `
      SELECT a.id,
             a.person_id,
             a.country_id,
             a.year,
             a.description,
             a.wikipedia_url,
             a.image_url,
             a.status,
             a.created_at,
             a.updated_at,
             COALESCE(p.name, c.name, '') AS title
        FROM achievements a
        LEFT JOIN persons p ON p.id = a.person_id
        LEFT JOIN countries c ON c.id = a.country_id
       WHERE a.created_by = $1 AND a.status = 'draft'
       ORDER BY a.updated_at DESC, a.id DESC
       LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(sql, [userId, limitParam + 1, offsetParam]);
    return paginateRows(result.rows, limitParam, offsetParam);
  }

  /**
   * Получение достижений по person_id
   */
  async getAchievementsByPerson(personId: string): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT id, person_id, year, description, wikipedia_url, image_url FROM v_approved_achievements WHERE person_id = $1 ORDER BY year ASC',
      [personId]
    );
    return result.rows;
  }

  /**
   * Удаление достижения (только свои черновики)
   */
  async deleteAchievement(achievementId: number, userId: number): Promise<void> {
    const checkRes = await this.pool.query(
      'SELECT created_by, status FROM achievements WHERE id = $1',
      [achievementId]
    );

    if (checkRes.rowCount === 0) {
      throw errors.notFound('Достижение не найдено');
    }

    const achievement = checkRes.rows[0];

    if (achievement.created_by !== userId) {
      throw errors.forbidden('Вы можете удалять только свои достижения');
    }

    if (achievement.status !== 'draft') {
      throw errors.badRequest('Можно удалять только черновики');
    }

    await this.pool.query('DELETE FROM achievements WHERE id = $1', [achievementId]);
  }

  /**
   * Получение количества достижений пользователя
   */
  async getUserAchievementsCount(userId: number): Promise<number> {
    const result = await this.pool.query(
      `SELECT COALESCE(achievements_count, 0) AS cnt FROM v_user_content_counts WHERE created_by = $1`,
      [userId]
    );
    return result.rows[0]?.cnt || 0;
  }

  /**
   * Получение количества pending достижений
   */
  async getPendingCount(): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*)::int AS cnt FROM achievements WHERE status = 'pending'`
    );
    return result.rows[0]?.cnt || 0;
  }
}

