import { Pool } from 'pg';
import { determineContentStatus, User } from '../utils/content-status';
import { errors } from '../utils/errors';
import { paginateRows, parseLimitOffset, PaginationDefaults, mapApiPersonRow } from '../utils/api';
import { TelegramService } from './telegramService';
import { sanitizePayload, PersonPayload, applyPayloadToPerson } from '../routes/persons/helpers';

export interface PersonCreateData {
  name: string;
  birthYear: number;
  deathYear: number;
  category: string;
  description: string;
  imageUrl?: string | null;
  wikiLink?: string | null;
}

export interface PersonFilters {
  category?: string | string[];
  country?: string | string[];
  startYear?: number;
  endYear?: number;
  q?: string;
}

export class PersonsService {
  private pool: Pool;
  private telegramService: TelegramService;

  constructor(pool: Pool, telegramService: TelegramService) {
    this.pool = pool;
    this.telegramService = telegramService;
  }

  /**
   * Создание личности
   */
  async createPerson(
    data: PersonCreateData,
    user: User,
    saveAsDraft: boolean = false
  ): Promise<any> {
    const { name, birthYear, deathYear, category, description, imageUrl, wikiLink } = data;

    // Генерация ID из имени
    const id = name
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/gi, '')
      .replace(/\s+/g, '-')
      .slice(0, 100);

    const status = determineContentStatus(user, saveAsDraft);

    const result = await this.pool.query(
      `INSERT INTO persons (id, name, birth_year, death_year, category, description, image_url, wiki_link, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        name,
        birthYear,
        deathYear,
        category,
        description,
        imageUrl ?? null,
        wikiLink ?? null,
        status,
        user.sub,
      ]
    );

    // Telegram уведомление (если не черновик)
    if (status !== 'draft') {
      const userEmail = user.email || 'unknown';
      this.telegramService
        .notifyPersonCreated(name, userEmail, status as 'pending' | 'approved', id)
        .catch(err => console.warn('Telegram notification failed (person created):', err));
    }

    return result.rows[0];
  }

  /**
   * Получение личностей с фильтрами
   */
  async getPersons(
    filters: PersonFilters,
    limit?: number,
    offset?: number
  ): Promise<{ data: any[]; meta: any }> {
    const { limitParam, offsetParam } = parseLimitOffset(limit, offset, {
      defLimit: 100,
      maxLimit: 1000,
    } as PaginationDefaults);

    let where = ' WHERE 1=1';
    const params: (string | number | string[])[] = [];
    let paramIndex = 1;

    // Категория
    if (filters.category) {
      const categoryArray = Array.isArray(filters.category)
        ? filters.category
        : filters.category.toString().split(',');
      where += ` AND v.category = ANY($${paramIndex}::text[])`;
      params.push(categoryArray);
      paramIndex++;
    }

    // Страна
    if (filters.country) {
      const countryArray = Array.isArray(filters.country)
        ? filters.country
        : filters.country.toString().split(',').map((c: string) => c.trim());
      where += ` AND (
        (v.country_names IS NOT NULL AND v.country_names && $${paramIndex}::text[])
        OR (v.country_names IS NULL AND EXISTS (
          SELECT 1 FROM unnest(string_to_array(v.country, '/')) AS c
          WHERE trim(c) = ANY($${paramIndex}::text[])
        ))
      )`;
      params.push(countryArray);
      paramIndex++;
    }

    // Временной диапазон
    if (filters.startYear) {
      where += ` AND v.death_year >= $${paramIndex}`;
      params.push(filters.startYear);
      paramIndex++;
    }
    if (filters.endYear) {
      where += ` AND v.birth_year <= $${paramIndex}`;
      params.push(filters.endYear);
      paramIndex++;
    }

    // Поиск
    if (filters.q && filters.q.trim().length > 0) {
      const search = filters.q.trim();
      where += ` AND (v.name ILIKE $${paramIndex} OR v.category ILIKE $${paramIndex} OR v.country ILIKE $${paramIndex} OR v.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    let query = `SELECT v.* FROM v_approved_persons v` + where;
    query += ' ORDER BY v.birth_year ASC, v.id ASC';
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitParam + 1, offsetParam);

    const result = await this.pool.query(query, params);
    const persons = result.rows.map(mapApiPersonRow);
    return paginateRows(persons, limitParam, offsetParam);
  }

  /**
   * Получение личности по ID
   */
  async getPersonById(id: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT v.*, p.status 
       FROM v_api_persons v 
       JOIN persons p ON p.id = v.id 
       WHERE v.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw errors.notFound('Историческая Личность не найдена');
    }

    const row = result.rows[0];

    // Получаем периоды
    const periodsRes = await this.pool.query(
      'SELECT periods FROM v_person_periods WHERE person_id = $1',
      [row.id]
    );
    const periods = periodsRes.rows[0]?.periods || [];

    return {
      ...mapApiPersonRow(row),
      periods,
    };
  }

  /**
   * Получение личностей по массиву ID (упорядоченно)
   */
  async getPersonsByIds(ids: string[]): Promise<any[]> {
    if (ids.length === 0) {
      return [];
    }

    const sql = `
      WITH req_ids AS (
        SELECT ($1::text[])[g.ord] AS id, g.ord
          FROM generate_series(1, COALESCE(array_length($1::text[], 1), 0)) AS g(ord)
      )
      SELECT v.*
        FROM req_ids r
        JOIN v_api_persons v ON v.id = r.id
       ORDER BY r.ord ASC
    `;

    const result = await this.pool.query(sql, [ids]);
    return result.rows.map(mapApiPersonRow);
  }

  /**
   * Получение личностей пользователя
   */
  async getUserPersons(
    userId: number,
    limit?: number,
    offset?: number
  ): Promise<{ data: any[]; meta: any }> {
    const { limitParam, offsetParam } = parseLimitOffset(limit, offset, {
      defLimit: 200,
      maxLimit: 500,
    } as PaginationDefaults);

    const sql = `
      SELECT p.id,
             p.name,
             p.birth_year,
             p.death_year,
             p.category,
             p.status,
             p.created_at,
             p.updated_at,
             p.review_comment
        FROM persons p
       WHERE p.created_by = $1
       ORDER BY p.updated_at DESC NULLS LAST, p.id DESC
       LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(sql, [userId, limitParam + 1, offsetParam]);
    return paginateRows(result.rows, limitParam, offsetParam);
  }

  /**
   * Получение pending личностей (для модераторов)
   */
  async getPendingPersons(
    limit?: number,
    offset?: number
  ): Promise<{ data: any[]; meta: any }> {
    const { limitParam, offsetParam } = parseLimitOffset(limit, offset, {
      defLimit: 200,
      maxLimit: 500,
    } as PaginationDefaults);

    const sql = `
      SELECT p.id,
             p.name,
             p.birth_year,
             p.death_year,
             p.category,
             p.description,
             p.status,
             p.created_by,
             p.updated_at,
             u.email AS creator_email,
             u.username AS creator_username
        FROM persons p
        LEFT JOIN users u ON u.id = p.created_by
       WHERE p.status = 'pending'
       ORDER BY p.updated_at DESC NULLS LAST, p.id DESC
       LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(sql, [limitParam + 1, offsetParam]);
    return paginateRows(result.rows, limitParam, offsetParam);
  }

  /**
   * Модерация личности
   */
  async reviewPerson(
    personId: string,
    action: 'approve' | 'reject',
    reviewerId: number,
    comment?: string
  ): Promise<any> {
    const checkRes = await this.pool.query(
      'SELECT id, status FROM persons WHERE id = $1',
      [personId]
    );

    if (checkRes.rowCount === 0) {
      throw errors.notFound('Личность не найдена');
    }

    const person = checkRes.rows[0];

    if (person.status !== 'pending') {
      throw errors.badRequest('Можно модерировать только личности в статусе pending');
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const result = await this.pool.query(
      `UPDATE persons
       SET status = $1, reviewed_by = $2, review_comment = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newStatus, reviewerId, comment ?? null, personId]
    );

    return result.rows[0];
  }

  /**
   * Предложение изменений личности
   */
  async proposeEdit(
    personId: string,
    payload: Partial<PersonPayload>,
    userId: number
  ): Promise<any> {
    // Проверяем существование личности
    const personRes = await this.pool.query('SELECT id FROM persons WHERE id = $1', [personId]);
    if (personRes.rowCount === 0) {
      throw errors.notFound('Личность не найдена');
    }

    // Санитизация и сохранение в person_edits
    const sanitized = sanitizePayload(payload);

    const result = await this.pool.query(
      `INSERT INTO person_edits (person_id, proposer_user_id, payload, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [personId, userId, JSON.stringify(sanitized)]
    );

    return result.rows[0];
  }

  /**
   * Модерация изменений личности
   */
  async reviewEdit(
    editId: number,
    action: 'approve' | 'reject',
    reviewerId: number,
    comment?: string
  ): Promise<any> {
    const editRes = await this.pool.query(
      'SELECT id, person_id, payload, status FROM person_edits WHERE id = $1',
      [editId]
    );

    if (editRes.rowCount === 0) {
      throw errors.notFound('Правка не найдена');
    }

    const edit = editRes.rows[0];

    if (edit.status !== 'pending') {
      throw errors.badRequest('Можно модерировать только правки в статусе pending');
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Обновляем статус правки
    await this.pool.query(
      `UPDATE person_edits
       SET status = $1, reviewed_by = $2, review_comment = $3
       WHERE id = $4`,
      [newStatus, reviewerId, comment ?? null, editId]
    );

    // Если approved - применяем изменения к личности
    if (action === 'approve') {
      await applyPayloadToPerson(this.pool, edit.person_id, edit.payload, reviewerId);
    }

    // Возвращаем обновлённую правку
    const result = await this.pool.query('SELECT * FROM person_edits WHERE id = $1', [editId]);
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
      SELECT p.id,
             p.name,
             p.birth_year,
             p.death_year,
             p.category,
             p.description,
             p.status,
             p.created_at,
             p.updated_at
        FROM persons p
       WHERE p.created_by = $1 AND p.status = 'draft'
       ORDER BY p.updated_at DESC, p.id DESC
       LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(sql, [userId, limitParam + 1, offsetParam]);
    return paginateRows(result.rows, limitParam, offsetParam);
  }

  /**
   * Обновление личности (только черновики)
   */
  async updatePerson(
    personId: string,
    userId: number,
    updates: Partial<PersonCreateData>
  ): Promise<any> {
    const checkRes = await this.pool.query(
      'SELECT created_by, status FROM persons WHERE id = $1',
      [personId]
    );

    if (checkRes.rowCount === 0) {
      throw errors.notFound('Личность не найдена');
    }

    const person = checkRes.rows[0];

    if (person.created_by !== userId) {
      throw errors.forbidden('Вы можете редактировать только свои личности');
    }

    if (person.status !== 'draft') {
      throw errors.badRequest('Можно редактировать только черновики');
    }

    // Динамическое обновление
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.birthYear !== undefined) {
      fields.push(`birth_year = $${idx++}`);
      values.push(updates.birthYear);
    }
    if (updates.deathYear !== undefined) {
      fields.push(`death_year = $${idx++}`);
      values.push(updates.deathYear);
    }
    if (updates.category !== undefined) {
      fields.push(`category = $${idx++}`);
      values.push(updates.category);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(updates.description);
    }
    if (updates.imageUrl !== undefined) {
      fields.push(`image_url = $${idx++}`);
      values.push(updates.imageUrl ?? null);
    }
    if (updates.wikiLink !== undefined) {
      fields.push(`wiki_link = $${idx++}`);
      values.push(updates.wikiLink ?? null);
    }

    if (fields.length === 0) {
      throw errors.badRequest('Нет полей для обновления');
    }

    fields.push(`updated_at = NOW()`);
    fields.push(`updated_by = $${idx++}`);
    values.push(userId);

    const sql = `UPDATE persons SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    values.push(personId);

    const result = await this.pool.query(sql, values);
    return result.rows[0];
  }

  /**
   * Отправка черновика на модерацию
   */
  async submitDraft(personId: string, userId: number): Promise<any> {
    const checkRes = await this.pool.query(
      'SELECT created_by, status FROM persons WHERE id = $1',
      [personId]
    );

    if (checkRes.rowCount === 0) {
      throw errors.notFound('Личность не найдена');
    }

    const person = checkRes.rows[0];

    if (person.created_by !== userId) {
      throw errors.forbidden('Вы можете отправлять только свои черновики');
    }

    if (person.status !== 'draft') {
      throw errors.badRequest('Можно отправлять только черновики');
    }

    const result = await this.pool.query(
      `UPDATE persons SET status = 'pending', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [personId]
    );

    return result.rows[0];
  }

  /**
   * Удаление личности (только свои черновики)
   */
  async deletePerson(personId: string, userId: number): Promise<void> {
    const checkRes = await this.pool.query(
      'SELECT created_by, status FROM persons WHERE id = $1',
      [personId]
    );

    if (checkRes.rowCount === 0) {
      throw errors.notFound('Личность не найдена');
    }

    const person = checkRes.rows[0];

    if (person.created_by !== userId) {
      throw errors.forbidden('Вы можете удалять только свои личности');
    }

    if (person.status !== 'draft') {
      throw errors.badRequest('Можно удалять только черновики');
    }

    await this.pool.query('DELETE FROM persons WHERE id = $1', [personId]);
  }

  /**
   * Получение количества личностей пользователя
   */
  async getUserPersonsCount(userId: number): Promise<number> {
    const result = await this.pool.query(
      `SELECT COALESCE(persons_count, 0) AS cnt FROM v_user_content_counts WHERE created_by = $1`,
      [userId]
    );
    return result.rows[0]?.cnt || 0;
  }

  /**
   * Получение количества pending личностей
   */
  async getPendingCount(): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*)::int AS cnt FROM persons WHERE status = 'pending'`
    );
    return result.rows[0]?.cnt || 0;
  }

  /**
   * Получение pending правок (для модераторов)
   */
  async getPendingEdits(
    limit?: number,
    offset?: number
  ): Promise<{ data: any[]; meta: any }> {
    const { limitParam, offsetParam } = parseLimitOffset(limit, offset, {
      defLimit: 200,
      maxLimit: 500,
    } as PaginationDefaults);

    const sql = `
      SELECT pe.id,
             pe.person_id,
             pe.payload,
             pe.status,
             pe.created_at,
             pe.proposer_user_id,
             p.name AS person_name,
             u.email AS proposer_email,
             u.username AS proposer_username
        FROM person_edits pe
        LEFT JOIN persons p ON p.id = pe.person_id
        LEFT JOIN users u ON u.id = pe.proposer_user_id
       WHERE pe.status = 'pending'
       ORDER BY pe.created_at DESC
       LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(sql, [limitParam + 1, offsetParam]);
    return paginateRows(result.rows, limitParam, offsetParam);
  }
}

