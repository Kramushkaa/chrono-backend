import { Router, Request, Response } from 'express';
import { PersonEditPayloadSchema } from '../../dto';
import { Pool } from 'pg';
import { authenticateToken } from '../../middleware/auth';
import { errors, asyncHandler } from '../../utils/errors';
import { parseLimitOffset, paginateRows, mapApiPersonRow } from '../../utils/api';
import { TelegramService } from '../../services/telegramService';
import { sanitizePayload } from './helpers';

export function createUserPersonRoutes(pool: Pool, telegramService: TelegramService) {
  const router = Router();

  // Persons created by current user
  router.get(
    '/persons/mine',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = (req as any).user?.sub;
      if (!userId) {
        throw errors.unauthorized('Требуется аутентификация');
      }
      const { limitParam, offsetParam } = parseLimitOffset(
        req.query.limit as string | undefined,
        req.query.offset as string | undefined,
        {
          defLimit: 200,
          maxLimit: 500,
        }
      );
      const countOnly = String((req.query.count as string) || 'false') === 'true';

      // Поддержка фильтрации по статусам
      const statusFilter = req.query.status as string;
      let statusCondition = '';
      const queryParams = [userId];

      if (statusFilter) {
        // Поддерживаем multiple статусы через запятую
        const statuses = statusFilter
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
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
    })
  );

  // Update person (for drafts or own persons)
  router.put(
    '/persons/:id',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const parsed = PersonEditPayloadSchema.safeParse(req.body || {});
      if (!parsed.success)
        throw errors.badRequest(
          'Некорректные данные правки',
          'validation_error',
          parsed.error.flatten()
        );

      // Проверяем наличие периодов жизни
      const lifePeriods = req.body?.lifePeriods || [];

      // Проверяем, что личность принадлежит пользователю или является черновиком
      const personRes = await pool.query(
        'SELECT created_by, status, birth_year, death_year FROM persons WHERE id = $1',
        [id]
      );

      if (personRes.rowCount === 0) {
        throw errors.notFound('Личность не найдена');
      }

      const person = personRes.rows[0];
      const userId = (req as any).user!.sub;

      if (person.created_by !== userId && person.status !== 'draft') {
        throw errors.forbidden('Нет прав для редактирования этой личности');
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Обновляем личность
        const payload = sanitizePayload(parsed.data);
        const fields: string[] = [];
        const values: (string | number | null)[] = [];
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
          const column = mapping[k];
          if (!column) continue;
          fields.push(`${column} = $${idx++}`);
          values.push(v as string | number | null);
        }

        // Добавляем обновление времени редактирования
        fields.push(`updated_at = NOW()`);

        if (fields.length > 1) {
          // больше 1, потому что updated_at всегда есть
          const sql = `UPDATE persons SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
          values.push(id);

          await client.query(sql, values);
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
            if (p.start_year < currentBirthYear || p.end_year > currentDeathYear) {
              throw errors.badRequest('Периоды должны быть в пределах годов жизни');
            }
          }

          // Сортируем по году начала
          normalizedPeriods.sort(
            (a: any, b: any) => a.start_year - b.start_year || a.end_year - b.end_year
          );

          // Удаляем существующие периоды для этой персоны
          await client.query(`DELETE FROM periods WHERE person_id = $1 AND period_type = 'life'`, [
            id,
          ]);

          // Вставляем новые периоды (как черновики)
          for (const p of normalizedPeriods) {
            await client.query(
              `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, status, created_by)
             VALUES ($1, $2, $3, 'life', $4, 'draft', $5)`,
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
    })
  );

  // Submit draft for moderation
  router.post(
    '/persons/:id/submit',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      // Проверяем, что личность является черновиком и принадлежит пользователю
      const personRes = await pool.query(
        'SELECT created_by, status, name FROM persons WHERE id = $1',
        [id]
      );

      if (personRes.rowCount === 0) {
        throw errors.notFound('Личность не найдена');
      }

      const person = personRes.rows[0];
      const userId = (req as any).user!.sub;

      if (person.created_by !== userId) {
        throw errors.forbidden('Нет прав для отправки этой личности');
      }

      if (person.status !== 'draft') {
        throw errors.badRequest('Можно отправлять на модерацию только черновики');
      }

      // Отправляем на модерацию (используем транзакцию)
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Обновляем персону
        const result = await client.query(
          `UPDATE persons 
         SET status = 'pending'
         WHERE id = $1
         RETURNING *`,
          [id]
        );

        // Также обновляем статус связанных периодов жизни, но только тех, которые являются черновиками
        await client.query(
          `UPDATE periods 
         SET status = 'pending'
         WHERE person_id = $1 AND period_type = 'life' AND status = 'draft'`,
          [id]
        );

        await client.query('COMMIT');

        // Отправка уведомления в Telegram об отправке черновика на модерацию (неблокирующее)
        const userEmail = (req as any).user?.email || 'unknown';
        telegramService
          .notifyPersonCreated(person.name, userEmail, 'pending', id)
          .catch(err => console.warn('Telegram notification failed (draft submitted):', err));

        res.json({ success: true, data: result.rows[0] });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    })
  );

  // Get user's drafts
  router.get(
    '/persons/drafts',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const { limitParam, offsetParam } = parseLimitOffset(
        String(req.query.limit || ''),
        String(req.query.offset || ''),
        {
          defLimit: 200,
          maxLimit: 500,
        }
      );
      const countOnly = String((req.query.count as string) || 'false') === 'true';

      if (countOnly) {
        const cRes = await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM persons WHERE created_by = $1 AND status = 'draft'`,
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
             p.created_at,
             p.updated_at
        FROM persons p
       WHERE p.created_by = $1 AND p.status = 'draft'
       ORDER BY p.updated_at DESC NULLS LAST, p.id DESC
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
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      const { data, meta } = paginateRows(persons, limitParam, offsetParam);
      res.json({ success: true, data, meta });
    })
  );

  // Revert person from pending to draft status
  router.post(
    '/persons/:id/revert-to-draft',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
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
         SET status = 'draft'
         WHERE id = $1`,
          [person.id]
        );

        // Update related periods to draft
        await client.query(
          `UPDATE periods 
         SET status = 'draft'
         WHERE person_id = $1 AND status = 'pending'`,
          [person.id]
        );

        // Update related achievements to draft
        await client.query(
          `UPDATE achievements 
         SET status = 'draft'
         WHERE person_id = $1 AND status = 'pending'`,
          [person.id]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Личность и связанные данные возвращены в черновики' });
      } catch (e: any) {
        try {
          await client.query('ROLLBACK');
        } catch {}
        throw e;
      } finally {
        client.release();
      }
    })
  );

  return router;
}
