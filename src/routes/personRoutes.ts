import { Router, Request, Response } from 'express';
import { z } from 'zod'
import { UpsertPersonSchema, LifePeriodsSchema, PersonEditPayloadSchema, AchievementGenericSchema } from '../dto'
import { Pool } from 'pg';
import { authenticateToken, requireRoleMiddleware, requireVerifiedEmail } from '../middleware/auth';
import { ApiError, errors, mapPgError, asyncHandler } from '../utils/errors';
import { mapApiPersonRow, parseLimitOffset, paginateRows } from '../utils/api'

export function createPersonRoutes(pool: Pool) {
  const router = Router();


  const allowedPersonFields = new Set([
    'name', 'birthYear', 'deathYear', 'category', 'description', 'imageUrl', 'wikiLink'
  ]);

  function sanitizePayload(raw: any) {
    const out: any = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const key of Object.keys(raw)) {
      if (allowedPersonFields.has(key)) {
        out[key] = raw[key];
      }
    }
    return out;
  }

  async function applyPayloadToPerson(id: string, payload: any, reviewerUserId: number) {
    // Map camelCase -> snake_case
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    const mapping: Record<string, string> = {
      name: 'name',
      birthYear: 'birth_year',
      deathYear: 'death_year',
      category: 'category',
      description: 'description',
      imageUrl: 'image_url',
      wikiLink: 'wiki_link',
    };
    for (const [k, v] of Object.entries(payload)) {
      const column = mapping[k as keyof typeof mapping];
      if (!column) continue;
      fields.push(`${column} = $${idx++}`);
      values.push(v);
    }
    // Always update audit/status on approve
    fields.push(`status = 'approved'`);
    fields.push(`updated_by = $${idx++}`);
    values.push(reviewerUserId);
    const sql = `UPDATE persons SET ${fields.join(', ')} WHERE id = $${idx}`;
    values.push(id);
    await pool.query(sql, values);
  }

  // Admin/Moderator: create or upsert person immediately (approved)
  router.post('/admin/persons', authenticateToken, requireRoleMiddleware(['admin', 'moderator']), asyncHandler(async (req: Request, res: Response) => {
      const parsed = UpsertPersonSchema.safeParse(req.body || {})
      if (!parsed.success) throw errors.badRequest('Некорректные данные Личности', 'validation_error', parsed.error.flatten())
      const { id, name, birthYear, deathYear, category, description, imageUrl, wikiLink } = parsed.data
      await pool.query(
      `INSERT INTO persons (id, name, birth_year, death_year, category, description, image_url, wiki_link, status, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'approved',$9,$9)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name,
           birth_year=EXCLUDED.birth_year,
           death_year=EXCLUDED.death_year,
           category=EXCLUDED.category,
           description=EXCLUDED.description,
           image_url=EXCLUDED.image_url,
           wiki_link=EXCLUDED.wiki_link,
           status='approved',
         updated_by=$9`,
      [id, name.trim(), Number(birthYear), Number(deathYear), category.trim(), (typeof description === 'string' ? description : ''), imageUrl ?? null, wikiLink ?? null, (req as any).user!.sub]
      );
      res.json({ success: true });
  }))

  // --- Public persons listing with filters/pagination ---
  router.get('/persons', asyncHandler(async (req: any, res: any) => {
    const { category, country, q } = req.query as any;
    const startYear = (req.query.startYear ?? req.query.year_from) as any;
    const endYear = (req.query.endYear ?? req.query.year_to) as any;
    let where = ' WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    if (category) {
      const categoryArray = Array.isArray(category) ? category : category.toString().split(',');
      where += ` AND v.category = ANY($${paramIndex}::text[])`;
      params.push(categoryArray);
      paramIndex++;
    }
    if (country) {
      const countryArray = Array.isArray(country) ? (country as string[]) : country.toString().split(',').map((c: string) => c.trim());
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
    if (startYear) { where += ` AND v.death_year >= $${paramIndex}`; params.push(parseInt(startYear.toString())); paramIndex++; }
    if (endYear) { where += ` AND v.birth_year <= $${paramIndex}`; params.push(parseInt(endYear.toString())); paramIndex++; }
    const search = (q || '').toString().trim();
    if (search.length > 0) {
      where += ` AND (v.name ILIKE $${paramIndex} OR v.category ILIKE $${paramIndex} OR v.country ILIKE $${paramIndex} OR v.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    let query = `SELECT v.* FROM v_approved_persons v` + where;
    query += ' ORDER BY v.birth_year ASC, v.id ASC';
    const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 100, maxLimit: 1000 });
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitParam + 1, offsetParam);
    const result = await pool.query(query, params);
    const persons = result.rows.map(mapApiPersonRow);
    const { data, meta } = paginateRows(persons, limitParam, offsetParam);
    res.json({ success: true, data, meta });
  }))

  // Moderation queue for persons
  router.get('/admin/persons/moderation', authenticateToken, requireRoleMiddleware(['moderator', 'admin']), asyncHandler(async (req: any, res: any) => {
    const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 200, maxLimit: 500 });
    const countOnly = String(req.query.count || 'false') === 'true';
    const contentType = req.query.content_type as string;
    let whereClause = '';
    const params: any[] = [];
    
    if (contentType) {
      whereClause = ` WHERE content_type = $1`;
      params.push(contentType);
    }
    
    if (countOnly) {
      const result = await pool.query(`SELECT COUNT(*)::int AS cnt FROM v_pending_moderation${whereClause}`, params);
      res.json({ success: true, data: { count: result.rows[0]?.cnt || 0 } });
      return;
    }
    const sql = `SELECT * FROM v_pending_moderation${whereClause} ORDER BY created_at DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitParam + 1, offsetParam);
    const result = await pool.query(sql, params);
    const persons = result.rows.map(mapApiPersonRow);
    const { data, meta } = paginateRows(persons, limitParam, offsetParam);
    res.json({ success: true, data, meta });
  }))

  // Persons created by current user
  router.get('/persons/mine', authenticateToken, asyncHandler(async (req: any, res: any) => {
    const userId = req.user?.sub;
    if (!userId) { throw errors.unauthorized('Требуется аутентификация'); }
    const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 200, maxLimit: 500 });
    const countOnly = String(req.query.count || 'false') === 'true';
    
    // Поддержка фильтрации по статусам
    const statusFilter = req.query.status as string;
    let statusCondition = '';
    const queryParams = [userId];
    
    if (statusFilter) {
      // Поддерживаем multiple статусы через запятую
      const statuses = statusFilter.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length > 0) {
        const placeholders = statuses.map((_, i) => `$${queryParams.length + i + 1}`).join(',');
        statusCondition = ` AND p.status IN (${placeholders})`;
        queryParams.push(...statuses);
      }
    }
    
    if (countOnly) {
      // Используем оптимизированное представление для подсчета
      const countSql = `
        SELECT COALESCE(persons_count, 0) AS cnt 
        FROM v_user_content_counts 
        WHERE created_by = $1
      `;
      const c = await pool.query(countSql, [userId]);
      res.json({ success: true, data: { count: c.rows[0]?.cnt || 0 } });
      return;
    }
    
    const sql = `
      SELECT v.*, p.status
        FROM v_api_persons v
        JOIN persons p ON p.id = v.id
       WHERE p.created_by = $1${statusCondition}
       ORDER BY p.updated_at DESC NULLS LAST, p.id DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    
    queryParams.push(limitParam + 1, offsetParam);
    const result = await pool.query(sql, queryParams);
    const persons = result.rows.map(mapApiPersonRow);
    const { data, meta } = paginateRows(persons, limitParam, offsetParam);
    res.json({ success: true, data, meta });
  }))

  // Person details
  router.get('/persons/:id', asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    if (!id) { throw errors.badRequest('ID не указан') }
    const result = await pool.query(`
      SELECT v.*, p.status 
      FROM v_api_persons v 
      JOIN persons p ON p.id = v.id 
      WHERE v.id = $1
    `, [id]);
    if (result.rows.length === 0) { throw errors.notFound('Историческая Личность не найдена') }
    const row = result.rows[0];

    const periodsRes = await pool.query('SELECT periods FROM v_person_periods WHERE person_id = $1', [row.id]);
    const periods = periodsRes.rows[0]?.periods || [];
    const person = {
      ...mapApiPersonRow(row),
      periods,
    };
    
    res.json({ success: true, data: person });
  }))

  // Persons lookup by ids (ordered)
  router.get('/persons/lookup/by-ids', asyncHandler(async (req: any, res: any) => {
    const raw = (req.query.ids || '').toString().trim();
    if (!raw) { res.json({ success: true, data: [] }); return; }
    const ids = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
    const sql = `
      WITH req_ids AS (
        SELECT ($1::text[])[g.ord] AS id, g.ord
          FROM generate_series(1, COALESCE(array_length($1::text[], 1), 0)) AS g(ord)
      )
      SELECT v.*
        FROM req_ids r
        JOIN v_api_persons v ON v.id = r.id
       ORDER BY r.ord ASC`;
    const result = await pool.query(sql, [ids]);
    const persons = result.rows.map(mapApiPersonRow);
    res.json({ success: true, data: persons });
  }))

  // User: propose person (pending review OR save as draft)
  router.post('/persons/propose', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
      const parsed = UpsertPersonSchema.safeParse(req.body || {})
      if (!parsed.success) throw errors.badRequest('Некорректные данные Личности', 'validation_error', parsed.error.flatten())
      const { id, name, birthYear, deathYear, category, description, imageUrl, wikiLink, saveAsDraft = false } = parsed.data
      
      // Проверяем наличие периодов жизни
      const lifePeriods = req.body?.lifePeriods || []
      if (!saveAsDraft && (!lifePeriods || lifePeriods.length === 0)) {
        throw errors.badRequest('Для отправки на модерацию необходимо указать хотя бы один период жизни')
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        if (saveAsDraft) {
          // Сохранение как черновик
          await client.query(
          `INSERT INTO persons (id, name, birth_year, death_year, category, description, image_url, wiki_link, status, created_by, updated_by, is_draft, draft_saved_at, last_edited_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$9,true,NOW(),NOW())
             ON CONFLICT (id) DO UPDATE SET
               name=EXCLUDED.name,
               birth_year=EXCLUDED.birth_year,
               death_year=EXCLUDED.death_year,
               category=EXCLUDED.category,
               description=EXCLUDED.description,
               image_url=EXCLUDED.image_url,
               wiki_link=EXCLUDED.wiki_link,
               status='draft',
               updated_by=$9,
               is_draft=true,
               draft_saved_at=NOW(),
               last_edited_at=NOW()`,
          [id, name, birthYear, deathYear, category, description, imageUrl ?? null, wikiLink ?? null, (req as any).user!.sub]
          );
        } else {
          // Создание как pending для модерации
          await client.query(
      `INSERT INTO persons (id, name, birth_year, death_year, category, description, image_url, wiki_link, status, created_by, updated_by, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$9,NOW())
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name,
           birth_year=EXCLUDED.birth_year,
           death_year=EXCLUDED.death_year,
           category=EXCLUDED.category,
           description=EXCLUDED.description,
           image_url=EXCLUDED.image_url,
           wiki_link=EXCLUDED.wiki_link,
           status='pending',
         updated_by=$9,
           submitted_at=NOW()`,
      [id, name, birthYear, deathYear, category, description, imageUrl ?? null, wikiLink ?? null, (req as any).user!.sub]
      );
        }

        // Сохраняем периоды жизни, если они указаны
        if (lifePeriods && lifePeriods.length > 0) {
          // Преобразуем периоды из frontend формата в backend
          const normalizedPeriods = lifePeriods.map((lp: any) => ({
            country_id: Number(lp.countryId),
            start_year: Number(lp.start),
            end_year: Number(lp.end)
          }));

          // Валидация периодов
          for (const p of normalizedPeriods) {
            if (!Number.isInteger(p.country_id) || p.country_id <= 0) {
              throw errors.badRequest('Некорректная страна')
            }
            if (!Number.isInteger(p.start_year) || !Number.isInteger(p.end_year) || p.start_year > p.end_year) {
              throw errors.badRequest('Некорректный период проживания')
            }
            if (p.start_year < birthYear || p.end_year > deathYear) {
              throw errors.badRequest('Периоды должны быть в пределах годов жизни')
            }
          }

          // Сортируем по году начала
          normalizedPeriods.sort((a: any, b: any) => a.start_year - b.start_year || a.end_year - b.end_year);

          // Удаляем существующие периоды для этой персоны (если есть)
          await client.query(`DELETE FROM periods WHERE person_id = $1 AND period_type = 'life'`, [id]);

          // Статус периодов зависит от статуса персоны
          const periodStatus = saveAsDraft ? 'draft' : 'pending';

          // Вставляем новые периоды
          for (const p of normalizedPeriods) {
            if (saveAsDraft) {
              await client.query(
                `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, status, created_by, is_draft, draft_saved_at, last_edited_at)
                 VALUES ($1, $2, $3, 'life', $4, 'draft', $5, true, NOW(), NOW())`,
                [id, p.start_year, p.end_year, p.country_id, (req as any).user!.sub]
              );
            } else {
              await client.query(
                `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, status, created_by, submitted_at)
                 VALUES ($1, $2, $3, 'life', $4, 'pending', $5, NOW())`,
                [id, p.start_year, p.end_year, p.country_id, (req as any).user!.sub]
              );
            }
          }
        }

        await client.query('COMMIT');
      res.json({ success: true });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
  }))

  // Admin/Moderator: review person (approve / reject)
  router.post('/admin/persons/:id/review', authenticateToken, requireRoleMiddleware(['admin', 'moderator']), asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { action, comment } = req.body || {}; // action: 'approve' | 'reject'
      if (!id || !action) {
        throw errors.badRequest('id и action обязательны')
      }
      if (action === 'approve') {
        await pool.query(
          `UPDATE persons SET status='approved', reviewed_at=NOW(), reviewed_by=$2, review_comment=$3 WHERE id=$1`,
          [id, (req as any).user!.sub, comment ?? null]
        );
      } else if (action === 'reject') {
        await pool.query(
          `UPDATE persons SET status='rejected', reviewed_at=NOW(), reviewed_by=$2, review_comment=$3 WHERE id=$1`,
          [id, (req as any).user!.sub, comment ?? null]
        );
      } else {
        throw errors.badRequest('action должен быть approve или reject')
      }
      res.json({ success: true });
  }))

  // User: propose an edit for an existing approved person (uses person_edits table)
  router.post('/persons/:id/edits', authenticateToken, requireVerifiedEmail, asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const rawPayload = req.body?.payload;
      if (!id || !rawPayload || typeof rawPayload !== 'object') {
        throw errors.badRequest('person id и payload обязательны')
      }
    
      const payload = sanitizePayload(rawPayload);
      const parsed = PersonEditPayloadSchema.safeParse(payload)
      if (!parsed.success) throw errors.badRequest('Некорректные данные правки', 'validation_error', parsed.error.flatten())
    
    // Проверяем, что персона существует и одобрена
    const existingPersonRes = await pool.query(
      'SELECT id, status FROM persons WHERE id = $1',
      [id]
    );
    
    if (existingPersonRes.rowCount === 0) {
      throw errors.notFound('Личность не найдена')
    }
    
    const existingPerson = existingPersonRes.rows[0];
    if (existingPerson.status !== 'approved') {
      throw errors.badRequest('Можно предлагать изменения только для одобренных личностей')
    }
    
    const userId = (req as any).user!.sub;
    
    // Создаем запись в person_edits для модерации изменений
      const result = await pool.query(
        `INSERT INTO person_edits (person_id, proposer_user_id, payload, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id, created_at`,
      [id, userId, JSON.stringify(payload)]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Предложение изменений отправлено на модерацию',
      data: result.rows[0] 
    });
  }))

  // Update person (for drafts or own persons)
  router.put('/persons/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const parsed = PersonEditPayloadSchema.safeParse(req.body || {})
    if (!parsed.success) throw errors.badRequest('Некорректные данные правки', 'validation_error', parsed.error.flatten())
    
    // Проверяем наличие периодов жизни
    const lifePeriods = req.body?.lifePeriods || []
    
    // Проверяем, что личность принадлежит пользователю или является черновиком
    const personRes = await pool.query(
      'SELECT created_by, is_draft, status, birth_year, death_year FROM persons WHERE id = $1',
      [id]
    );
    
    if (personRes.rowCount === 0) {
      throw errors.notFound('Личность не найдена')
    }
    
    const person = personRes.rows[0];
    const userId = (req as any).user!.sub;
    
    if (person.created_by !== userId && person.status !== 'draft') {
      throw errors.forbidden('Нет прав для редактирования этой личности')
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Обновляем личность
      const payload = sanitizePayload(parsed.data);
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;
      const mapping: Record<string, string> = {
        name: 'name',
        birthYear: 'birth_year',
        deathYear: 'death_year',
        category: 'category',
        description: 'description',
        imageUrl: 'image_url',
        wikiLink: 'wiki_link',
      };
      
      for (const [k, v] of Object.entries(payload)) {
        const column = mapping[k as keyof typeof mapping];
        if (!column) continue;
        fields.push(`${column} = $${idx++}`);
        values.push(v);
      }
      
      // Добавляем обновление времени редактирования
      fields.push(`last_edited_at = NOW()`);
      
      if (fields.length > 1) { // больше 1, потому что last_edited_at всегда есть
        const sql = `UPDATE persons SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
        values.push(id);
        
        const result = await client.query(sql, values);
      }

      // Обновляем периоды жизни, если они указаны
      if (lifePeriods && lifePeriods.length > 0) {
        // Получаем актуальные годы жизни (могли измениться в payload)
        const currentBirthYear = payload.birthYear ?? person.birth_year;
        const currentDeathYear = payload.deathYear ?? person.death_year;

        // Преобразуем периоды из frontend формата в backend
        const normalizedPeriods = lifePeriods.map((lp: any) => ({
          country_id: Number(lp.countryId),
          start_year: Number(lp.start),
          end_year: Number(lp.end)
        }));

        // Валидация периодов
        for (const p of normalizedPeriods) {
          if (!Number.isInteger(p.country_id) || p.country_id <= 0) {
            throw errors.badRequest('Некорректная страна')
          }
          if (!Number.isInteger(p.start_year) || !Number.isInteger(p.end_year) || p.start_year > p.end_year) {
            throw errors.badRequest('Некорректный период проживания')
          }
          if (p.start_year < currentBirthYear || p.end_year > currentDeathYear) {
            throw errors.badRequest('Периоды должны быть в пределах годов жизни')
          }
        }

        // Сортируем по году начала
        normalizedPeriods.sort((a: any, b: any) => a.start_year - b.start_year || a.end_year - b.end_year);

        // Удаляем существующие периоды для этой персоны
        await client.query(`DELETE FROM periods WHERE person_id = $1 AND period_type = 'life'`, [id]);

        // Вставляем новые периоды (как черновики)
        for (const p of normalizedPeriods) {
          await client.query(
            `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, status, created_by, is_draft, draft_saved_at, last_edited_at)
             VALUES ($1, $2, $3, 'life', $4, 'draft', $5, true, NOW(), NOW())`,
            [id, p.start_year, p.end_year, p.country_id, userId]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, message: 'Черновик обновлен' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }))

  // Submit draft for moderation
  router.post('/persons/:id/submit', authenticateToken, requireVerifiedEmail, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    // Проверяем, что личность является черновиком и принадлежит пользователю
    const personRes = await pool.query(
      'SELECT created_by, is_draft, status FROM persons WHERE id = $1',
      [id]
    );
    
    if (personRes.rowCount === 0) {
      throw errors.notFound('Личность не найдена')
    }
    
    const person = personRes.rows[0];
    const userId = (req as any).user!.sub;
    
    if (person.created_by !== userId) {
      throw errors.forbidden('Нет прав для отправки этой личности')
    }
    
    if (person.status !== 'draft') {
      throw errors.badRequest('Можно отправлять на модерацию только черновики')
    }
    
    // Отправляем на модерацию (используем транзакцию)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Обновляем персону
      const result = await client.query(
        `UPDATE persons 
         SET status = 'pending', 
             is_draft = false, 
             submitted_at = NOW(),
             last_edited_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      
      // Также обновляем статус связанных периодов жизни, но только тех, которые являются черновиками
      await client.query(
        `UPDATE periods 
         SET status = 'pending',
             is_draft = false,
             submitted_at = NOW(),
             last_edited_at = NOW()
         WHERE person_id = $1 AND period_type = 'life' AND status = 'draft' AND is_draft = true`,
        [id]
      );
      
      await client.query('COMMIT');
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }))

  // Get user's drafts
  router.get('/persons/drafts', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 200, maxLimit: 500 });
    const countOnly = String(req.query.count || 'false') === 'true';
    
    if (countOnly) {
      const cRes = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM persons WHERE created_by = $1 AND is_draft = true`, 
        [(req as any).user!.sub]
      );
      res.json({ success: true, data: { count: cRes.rows[0]?.cnt || 0 } });
      return;
    }
    
    const sql = `
      SELECT p.id,
             p.name,
             p.birth_year,
             p.death_year,
             p.category,
             p.description,
             p.image_url,
             p.wiki_link,
             p.draft_saved_at,
             p.last_edited_at
        FROM persons p
       WHERE p.created_by = $1 AND p.is_draft = true
       ORDER BY p.last_edited_at DESC NULLS LAST, p.id DESC
       LIMIT $2 OFFSET $3`;
    const result = await pool.query(sql, [(req as any).user!.sub, limitParam + 1, offsetParam]);
    const persons = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      birthYear: row.birth_year,
      deathYear: row.death_year,
      category: row.category,
      description: row.description,
      imageUrl: row.image_url,
      wikiLink: row.wiki_link,
      draftSavedAt: row.draft_saved_at,
      lastEditedAt: row.last_edited_at,
    }));
    const { data, meta } = paginateRows(persons, limitParam, offsetParam);
    res.json({ success: true, data, meta });
  }))

  // Removed legacy admin/persons pending & edits review routes (replaced by /api/admin/persons/moderation)

  // (removed) Public achievements listing is defined centrally in server.ts as /api/achievements

  // Admin/Moderator: create achievement not bound to person (global or by country)

  router.post('/achievements', authenticateToken, requireRoleMiddleware(['admin', 'moderator']), asyncHandler(async (req: Request, res: Response) => {
      const parsed = AchievementGenericSchema.safeParse(req.body || {})
      if (!parsed.success) throw errors.badRequest('Некорректные данные достижения', 'validation_error', parsed.error.flatten())
      const { year, description, wikipedia_url, image_url, country_id } = parsed.data
      // Insert with optional country_id and denormalized country name for tiles
      const sql = `
        INSERT INTO achievements (person_id, country_id, year, description, wikipedia_url, image_url, country)
        VALUES (NULL, $1, $2, btrim($3), $4, $5,
                CASE WHEN $1 IS NULL THEN NULL ELSE (SELECT name FROM countries WHERE id = $1) END)
        ON CONFLICT (country_id, year, lower(btrim(description)))
        WHERE country_id IS NOT NULL AND person_id IS NULL
        DO UPDATE SET wikipedia_url = EXCLUDED.wikipedia_url, image_url = EXCLUDED.image_url, country = EXCLUDED.country
        RETURNING *
      `;
      const params = [country_id ?? null, year, description, wikipedia_url ?? null, image_url ?? null];
      const result = await pool.query(sql, params);
      res.status(201).json({ success: true, data: result.rows[0] });
  }))

  // Admin/Moderator: replace person's life country periods
  router.post('/persons/:id/life-periods', authenticateToken, requireRoleMiddleware(['admin', 'moderator']), asyncHandler(async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params as any;
      const parsed = LifePeriodsSchema.safeParse(req.body || {})
      if (!parsed.success) throw errors.badRequest('Некорректные периоды', 'validation_error', parsed.error.flatten())
      const periods: Array<{ country_id: number; start_year: number; end_year: number; period_type?: string }> = parsed.data.periods
      const personRes = await client.query('SELECT birth_year, death_year FROM persons WHERE id=$1', [id]);
      if (personRes.rowCount === 0) {
        throw errors.notFound('Личность не найдена')
      }
      const birth: number = Number(personRes.rows[0].birth_year);
      const death: number = Number(personRes.rows[0].death_year);
      if (!Number.isInteger(birth) || !Number.isInteger(death) || birth > death) {
        throw errors.badRequest('Некорректные годы жизни Личности')
      }
      if (periods.length === 0) {
        throw errors.badRequest('Нужно передать хотя бы одну страну')
      }
      // Normalize: when only one country, fill full lifespan
      let norm = periods.map(p => ({ country_id: Number(p.country_id), start_year: Number(p.start_year), end_year: Number(p.end_year) }));
      if (norm.length === 1) {
        norm[0].start_year = birth;
        norm[0].end_year = death;
      }
      // Validate countries and years
      for (const p of norm) {
        if (!Number.isInteger(p.country_id) || p.country_id <= 0) {
          throw errors.badRequest('Некорректная страна')
        }
        if (!Number.isInteger(p.start_year) || !Number.isInteger(p.end_year) || p.start_year > p.end_year) {
          throw errors.badRequest('Некорректный период проживания')
        }
      }
      // Sort by start_year
      norm.sort((a, b) => a.start_year - b.start_year || a.end_year - b.end_year);
      // Check coverage and overlap (no overlaps allowed)
      if (norm[0].start_year > birth || norm[norm.length - 1].end_year < death) {
        throw errors.badRequest('Периоды должны покрывать все годы жизни')
      }
      for (let i = 1; i < norm.length; i++) {
        const prev = norm[i - 1];
        const cur = norm[i];
        // Allow shared boundary, forbid overlap
        if (cur.start_year < prev.end_year) {
          throw errors.badRequest('Периоды стран не должны пересекаться')
        }
        // Ensure no gaps in coverage
        if (cur.start_year > prev.end_year + 1) {
          throw errors.badRequest('Периоды стран должны покрывать все годы жизни без пропусков')
        }
      }
      await client.query('BEGIN');
      const role = (req as any).user?.role || 'user';
      if (role === 'admin' || role === 'moderator') {
        await client.query(`DELETE FROM periods WHERE person_id = $1 AND period_type = 'life'`, [id]);
        for (const p of norm) {
          await client.query(
            `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, comment, status, created_by)
             VALUES ($1, $2, $3, 'life', $4, NULL, 'approved', $5)`,
            [id, p.start_year, p.end_year, p.country_id, (req as any).user!.sub]
          );
        }
      } else {
        for (const p of norm) {
          await client.query(
            `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, comment, status, created_by, submitted_at)
             VALUES ($1, $2, $3, 'life', $4, NULL, 'pending', $5, NOW())`,
            [id, p.start_year, p.end_year, p.country_id, (req as any).user!.sub]
          );
        }
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (e: any) {
      try { await client.query('ROLLBACK'); } catch {}
      const mapped = mapPgError(e)
      if (mapped) throw mapped
      throw e
    } finally {
      client.release();
    }
  }))

  // Revert person from pending to draft status
  router.post('/persons/:id/revert-to-draft', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.sub;
    

    
    if (!userId) {
      throw errors.unauthorized('Требуется аутентификация');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Check if person exists and belongs to user
      const personRes = await client.query(
        `SELECT id, status, created_by FROM persons WHERE id = $1`,
        [id]
      );
      
      if (personRes.rows.length === 0) {
        throw errors.notFound('Личность не найдена');
      }
      
      const person = personRes.rows[0];
      
      // Check ownership
      if (person.created_by !== userId) {
        throw errors.forbidden('Можно возвращать в черновики только свои личности');
      }
      
      // Check status
      if (person.status !== 'pending') {
        throw errors.badRequest('Можно возвращать в черновики только личности на модерации');
      }
      
      // Update person to draft
      await client.query(
        `UPDATE persons 
         SET status = 'draft', 
             is_draft = true, 
             draft_saved_at = NOW(), 
             last_edited_at = NOW(),
             submitted_at = NULL
         WHERE id = $1`,
        [person.id]
      );
      
      // Update related periods to draft
      await client.query(
        `UPDATE periods 
         SET status = 'draft', 
             is_draft = true, 
             draft_saved_at = NOW(), 
             last_edited_at = NOW(),
             submitted_at = NULL
         WHERE person_id = $1 AND status = 'pending'`,
        [person.id]
      );
      
      // Update related achievements to draft
      await client.query(
        `UPDATE achievements 
         SET status = 'draft', 
             is_draft = true, 
             draft_saved_at = NOW(), 
             last_edited_at = NOW(),
             submitted_at = NULL
         WHERE person_id = $1 AND status = 'pending'`,
        [person.id]
      );
      
      await client.query('COMMIT');
      res.json({ success: true, message: 'Личность и связанные данные возвращены в черновики' });
      
    } catch (e: any) {
      try { await client.query('ROLLBACK'); } catch {}
      const mapped = mapPgError(e)
      if (mapped) throw mapped
      throw e
    } finally {
      client.release();
    }
  }))

  return router;
}


