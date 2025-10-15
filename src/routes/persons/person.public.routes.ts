import { Router, Request, Response } from 'express';
import { UpsertPersonSchema, PersonEditPayloadSchema, LifePeriodsSchema } from '../../dto';
import { Pool } from 'pg';
import { authenticateToken, requireRoleMiddleware, requireVerifiedEmail } from '../../middleware/auth';
import { errors, mapPgError, asyncHandler } from '../../utils/errors';
import { mapApiPersonRow, parseLimitOffset, paginateRows } from '../../utils/api';
import { TelegramService } from '../../services/telegramService';
import { sanitizePayload } from './helpers';

export function createPublicPersonRoutes(pool: Pool, telegramService: TelegramService) {
  const router = Router();

  // --- Public persons listing with filters/pagination ---
  router.get(
    '/persons',
    asyncHandler(async (req: Request, res: Response) => {
      const { category, country, q } = req.query;
      const startYear = req.query.startYear ?? req.query.year_from;
      const endYear = req.query.endYear ?? req.query.year_to;
      let where = ' WHERE 1=1';
      const params: (string | number | string[])[] = [];
      let paramIndex = 1;
      if (category) {
        const categoryArray = Array.isArray(category) 
          ? (category as string[])
          : category.toString().split(',');
        where += ` AND v.category = ANY($${paramIndex}::text[])`;
        params.push(categoryArray);
        paramIndex++;
      }
      if (country) {
        const countryArray = Array.isArray(country)
          ? (country as string[])
          : country
              .toString()
              .split(',')
              .map((c: string) => c.trim());
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
      if (startYear) {
        where += ` AND v.death_year >= $${paramIndex}`;
        params.push(parseInt(startYear.toString()));
        paramIndex++;
      }
      if (endYear) {
        where += ` AND v.birth_year <= $${paramIndex}`;
        params.push(parseInt(endYear.toString()));
        paramIndex++;
      }
      const search = (q || '').toString().trim();
      if (search.length > 0) {
        where += ` AND (v.name ILIKE $${paramIndex} OR v.category ILIKE $${paramIndex} OR v.country ILIKE $${paramIndex} OR v.description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }
      let query = `SELECT v.* FROM v_approved_persons v` + where;
      query += ' ORDER BY v.birth_year ASC, v.id ASC';
      const { limitParam, offsetParam } = parseLimitOffset(
        req.query.limit as string | undefined,
        req.query.offset as string | undefined,
        {
        defLimit: 100,
        maxLimit: 1000,
      });
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limitParam + 1, offsetParam);
      const result = await pool.query(query, params);
      const persons = result.rows.map(mapApiPersonRow);
      const { data, meta } = paginateRows(persons, limitParam, offsetParam);
      res.json({ success: true, data, meta });
    })
  );

  // Person details
  router.get(
    '/persons/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      if (!id) {
        throw errors.badRequest('ID не указан');
      }
      const result = await pool.query(
        `
      SELECT v.*, p.status 
      FROM v_api_persons v 
      JOIN persons p ON p.id = v.id 
      WHERE v.id = $1
    `,
        [id]
      );
      if (result.rows.length === 0) {
        throw errors.notFound('Историческая Личность не найдена');
      }
      const row = result.rows[0];

      const periodsRes = await pool.query(
        'SELECT periods FROM v_person_periods WHERE person_id = $1',
        [row.id]
      );
      const periods = periodsRes.rows[0]?.periods || [];
      const person = {
        ...mapApiPersonRow(row),
        periods,
      };

      res.json({ success: true, data: person });
    })
  );

  // Persons lookup by ids (ordered)
  router.get(
    '/persons/lookup/by-ids',
    asyncHandler(async (req: Request, res: Response) => {
      const raw = (req.query.ids || '').toString().trim();
      if (!raw) {
        res.json({ success: true, data: [] });
        return;
      }
      const ids = raw
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
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
    })
  );

  // User: propose person (pending review OR save as draft)
  router.post(
    '/persons/propose',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = UpsertPersonSchema.safeParse(req.body || {});
      if (!parsed.success)
        throw errors.badRequest(
          'Некорректные данные Личности',
          'validation_error',
          parsed.error.flatten()
        );
      const {
        id,
        name,
        birthYear,
        deathYear,
        category,
        description,
        imageUrl,
        wikiLink,
        saveAsDraft = false,
      } = parsed.data;

      // Проверяем наличие периодов жизни
      const lifePeriods = req.body?.lifePeriods || [];
      if (!saveAsDraft && (!lifePeriods || lifePeriods.length === 0)) {
        throw errors.badRequest(
          'Для отправки на модерацию необходимо указать хотя бы один период жизни'
        );
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        if (saveAsDraft) {
          // Сохранение как черновик
          await client.query(
            `INSERT INTO persons (id, name, birth_year, death_year, category, description, image_url, wiki_link, status, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$9)
             ON CONFLICT (id) DO UPDATE SET
               name=EXCLUDED.name,
               birth_year=EXCLUDED.birth_year,
               death_year=EXCLUDED.death_year,
               category=EXCLUDED.category,
               description=EXCLUDED.description,
               image_url=EXCLUDED.image_url,
               wiki_link=EXCLUDED.wiki_link,
               status='draft',
               updated_by=$9`,
            [
              id,
              name,
              birthYear,
              deathYear,
              category,
              description,
              imageUrl ?? null,
              wikiLink ?? null,
              (req as any).user!.sub,
            ]
          );
        } else {
          // Создание как pending для модерации
          await client.query(
            `INSERT INTO persons (id, name, birth_year, death_year, category, description, image_url, wiki_link, status, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$9)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name,
           birth_year=EXCLUDED.birth_year,
           death_year=EXCLUDED.death_year,
           category=EXCLUDED.category,
           description=EXCLUDED.description,
           image_url=EXCLUDED.image_url,
           wiki_link=EXCLUDED.wiki_link,
           status='pending',
           updated_by=$9`,
            [
              id,
              name,
              birthYear,
              deathYear,
              category,
              description,
              imageUrl ?? null,
              wikiLink ?? null,
              (req as any).user!.sub,
            ]
          );
        }

        // Сохраняем периоды жизни, если они указаны
        if (lifePeriods && lifePeriods.length > 0) {
          // Преобразуем периоды из frontend формата в backend
          const normalizedPeriods = lifePeriods.map((lp: any) => ({
            country_id: Number(lp.countryId),
            start_year: Number(lp.start),
            end_year: Number(lp.end),
          }));

          // Валидация периодов
          for (const p of normalizedPeriods) {
            if (!Number.isInteger(p.country_id) || p.country_id <= 0) {
              throw errors.badRequest('Некорректная страна');
            }
            if (
              !Number.isInteger(p.start_year) ||
              !Number.isInteger(p.end_year) ||
              p.start_year > p.end_year
            ) {
              throw errors.badRequest('Некорректный период проживания');
            }
            if (p.start_year < birthYear || p.end_year > deathYear) {
              throw errors.badRequest('Периоды должны быть в пределах годов жизни');
            }
          }

          // Сортируем по году начала
          normalizedPeriods.sort(
            (a: any, b: any) => a.start_year - b.start_year || a.end_year - b.end_year
          );

          // Удаляем существующие периоды для этой персоны (если есть)
          await client.query(`DELETE FROM periods WHERE person_id = $1 AND period_type = 'life'`, [
            id,
          ]);

          // Статус периодов зависит от статуса персоны
          const periodStatus = saveAsDraft ? 'draft' : 'pending';

          // Вставляем новые периоды
          for (const p of normalizedPeriods) {
            if (saveAsDraft) {
              await client.query(
                `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, status, created_by)
                 VALUES ($1, $2, $3, 'life', $4, 'draft', $5)`,
                [id, p.start_year, p.end_year, p.country_id, (req as any).user!.sub]
              );
            } else {
              await client.query(
                `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, status, created_by)
                 VALUES ($1, $2, $3, 'life', $4, 'pending', $5)`,
                [id, p.start_year, p.end_year, p.country_id, (req as any).user!.sub]
              );
            }
          }
        }

        await client.query('COMMIT');

        // Отправка уведомления в Telegram о создании личности пользователем (только если не черновик)
        if (!saveAsDraft) {
          const userEmail = (req as any).user?.email || 'unknown';
          telegramService
            .notifyPersonCreated(name, userEmail, 'pending', id)
            .catch(err => console.warn('Telegram notification failed (person proposed):', err));
        }

        res.json({ success: true });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    })
  );

  // User: propose an edit for an existing approved person (uses person_edits table)
  router.post(
    '/persons/:id/edits',
    authenticateToken,
    requireVerifiedEmail,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const rawPayload = req.body?.payload;
      if (!id || !rawPayload || typeof rawPayload !== 'object') {
        throw errors.badRequest('person id и payload обязательны');
      }

      const payload = sanitizePayload(rawPayload);
      const parsed = PersonEditPayloadSchema.safeParse(payload);
      if (!parsed.success)
        throw errors.badRequest(
          'Некорректные данные правки',
          'validation_error',
          parsed.error.flatten()
        );

      // Проверяем, что персона существует и одобрена
      const existingPersonRes = await pool.query('SELECT id, status, name FROM persons WHERE id = $1', [
        id,
      ]);

      if (existingPersonRes.rowCount === 0) {
        throw errors.notFound('Личность не найдена');
      }

      const existingPerson = existingPersonRes.rows[0];
      if (existingPerson.status !== 'approved') {
        throw errors.badRequest('Можно предлагать изменения только для одобренных личностей');
      }

      const userId = (req as any).user!.sub;

      // Создаем запись в person_edits для модерации изменений
      const result = await pool.query(
        `INSERT INTO person_edits (person_id, proposer_user_id, payload, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id, created_at`,
        [id, userId, JSON.stringify(payload)]
      );

      // Отправка уведомления в Telegram о предложении изменений (неблокирующее)
      const userEmail = (req as any).user?.email || 'unknown';
      telegramService
        .notifyPersonEditProposed(existingPerson.name, userEmail, id)
        .catch(err => console.warn('Telegram notification failed (person edit proposed):', err));

      res.status(201).json({
        success: true,
        message: 'Предложение изменений отправлено на модерацию',
        data: result.rows[0],
      });
    })
  );

  // Admin/Moderator: replace person's life country periods
  router.post(
    '/persons/:id/life-periods',
    authenticateToken,
    requireRoleMiddleware(['admin', 'moderator']),
    asyncHandler(async (req: Request, res: Response) => {
      const client = await pool.connect();
      try {
        const { id } = req.params as any;
        const parsed = LifePeriodsSchema.safeParse(req.body || {});
        if (!parsed.success)
          throw errors.badRequest(
            'Некорректные периоды',
            'validation_error',
            parsed.error.flatten()
          );
        const periods: Array<{
          country_id: number;
          start_year: number;
          end_year: number;
          period_type?: string;
        }> = parsed.data.periods;
        const personRes = await client.query(
          'SELECT birth_year, death_year FROM persons WHERE id=$1',
          [id]
        );
        if (personRes.rowCount === 0) {
          throw errors.notFound('Личность не найдена');
        }
        const birth: number = Number(personRes.rows[0].birth_year);
        const death: number = Number(personRes.rows[0].death_year);
        if (!Number.isInteger(birth) || !Number.isInteger(death) || birth > death) {
          throw errors.badRequest('Некорректные годы жизни Личности');
        }
        if (periods.length === 0) {
          throw errors.badRequest('Нужно передать хотя бы одну страну');
        }
        // Normalize: when only one country, fill full lifespan
        const norm = periods.map(p => ({
          country_id: Number(p.country_id),
          start_year: Number(p.start_year),
          end_year: Number(p.end_year),
        }));
        if (norm.length === 1) {
          norm[0].start_year = birth;
          norm[0].end_year = death;
        }
        // Validate countries and years
        for (const p of norm) {
          if (!Number.isInteger(p.country_id) || p.country_id <= 0) {
            throw errors.badRequest('Некорректная страна');
          }
          if (
            !Number.isInteger(p.start_year) ||
            !Number.isInteger(p.end_year) ||
            p.start_year > p.end_year
          ) {
            throw errors.badRequest('Некорректный период проживания');
          }
        }
        // Sort by start_year
        norm.sort((a, b) => a.start_year - b.start_year || a.end_year - b.end_year);
        // Check coverage and overlap (no overlaps allowed)
        if (norm[0].start_year > birth || norm[norm.length - 1].end_year < death) {
          throw errors.badRequest('Периоды должны покрывать все годы жизни');
        }
        for (let i = 1; i < norm.length; i++) {
          const prev = norm[i - 1];
          const cur = norm[i];
          // Allow shared boundary, forbid overlap
          if (cur.start_year < prev.end_year) {
            throw errors.badRequest('Периоды стран не должны пересекаться');
          }
          // Ensure no gaps in coverage
          if (cur.start_year > prev.end_year + 1) {
            throw errors.badRequest('Периоды стран должны покрывать все годы жизни без пропусков');
          }
        }
        await client.query('BEGIN');
        const role = (req as any).user?.role || 'user';
        if (role === 'admin' || role === 'moderator') {
          await client.query(`DELETE FROM periods WHERE person_id = $1 AND period_type = 'life'`, [
            id,
          ]);
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
              `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, comment, status, created_by)
             VALUES ($1, $2, $3, 'life', $4, NULL, 'pending', $5)`,
              [id, p.start_year, p.end_year, p.country_id, (req as any).user!.sub]
            );
          }
        }
        await client.query('COMMIT');
        res.json({ success: true });
      } catch (e: any) {
        try {
          await client.query('ROLLBACK');
        } catch {}
        const mapped = mapPgError(e);
        if (mapped) throw mapped;
        throw e;
      } finally {
        client.release();
      }
    })
  );

  return router;
}

