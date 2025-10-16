import { Router, Request, Response } from 'express';
import { UpsertPersonSchema, PersonEditPayloadSchema, LifePeriodsSchema } from '../../dto';
import { Pool } from 'pg';
import {
  authenticateToken,
  requireRoleMiddleware,
  requireVerifiedEmail,
} from '../../middleware/auth';
import { errors, mapPgError, asyncHandler } from '../../utils/errors';
import { mapApiPersonRow, parseLimitOffset, paginateRows } from '../../utils/api';
import { TelegramService } from '../../services/telegramService';
import { sanitizePayload } from './helpers';

import { PersonsService } from '../../services/personsService';

export function createPublicPersonRoutes(
  pool: Pool,
  telegramService: TelegramService,
  personsService: PersonsService
) {
  const router = Router();

  // --- Public persons listing with filters/pagination ---
  router.get(
    '/persons',
    asyncHandler(async (req: Request, res: Response) => {
      const category = req.query.category;
      const country = req.query.country;
      const q = (req.query.q as string) || '';
      const startYear = req.query.startYear ?? req.query.year_from;
      const endYear = req.query.endYear ?? req.query.year_to;
      const limit = req.query.limit as string | undefined;
      const offset = req.query.offset as string | undefined;

      const { data, meta } = await personsService.getPersons(
        {
          category: category as string | string[] | undefined,
          country: country as string | string[] | undefined,
          q,
          startYear: startYear ? parseInt(startYear.toString()) : undefined,
          endYear: endYear ? parseInt(endYear.toString()) : undefined,
        },
        limit ? parseInt(limit) : undefined,
        offset ? parseInt(offset) : undefined
      );
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
      
      const person = await personsService.getPersonById(id);
      res.json({ success: true, data: person });
    })
  );

  // Persons lookup by ids (ordered)
  router.get(
    '/persons/lookup/by-ids',
    asyncHandler(async (req: Request, res: Response) => {
      const raw = ((req.query.ids as string) || '').toString().trim();
      if (!raw) {
        res.json({ success: true, data: [] });
        return;
      }
      const ids = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
      const data = await personsService.getPersonsByIds(ids);
      res.json({ success: true, data });
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
          const _periodStatus = saveAsDraft ? 'draft' : 'pending';

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

      const userId = (req as any).user!.sub;
      const result = await personsService.proposeEdit(id, payload, userId);

      // Отправка уведомления в Telegram (неблокирующее)
      const userEmail = (req as any).user?.email || 'unknown';
      const personRes = await pool.query('SELECT name FROM persons WHERE id = $1', [id]);
      const personName = personRes.rows[0]?.name || 'Unknown';
      
      telegramService
        .notifyPersonEditProposed(personName, userEmail, id)
        .catch(err => console.warn('Telegram notification failed (person edit proposed):', err));

      res.status(201).json({
        success: true,
        message: 'Предложение изменений отправлено на модерацию',
        data: result,
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
