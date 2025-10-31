import { Router, Request, Response } from 'express';
import { UpsertPersonSchema, PersonEditPayloadSchema, LifePeriodsSchema } from '../../dto';
import { Pool } from 'pg';
import {
  authenticateToken,
  requireRoleMiddleware,
  requireVerifiedEmail,
} from '../../middleware/auth';
import { errors, asyncHandler } from '../../utils/errors';
import { TelegramService } from '../../services/telegramService';
import { sanitizePayload } from './helpers';
import { validateQuery, validateParams, commonSchemas } from '../../middleware/validation';

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
    validateQuery(commonSchemas.pagination.and(commonSchemas.personSearch)),
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
    validateParams(commonSchemas.personId),
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
    validateQuery(commonSchemas.personLookup),
    asyncHandler(async (req: Request, res: Response) => {
      const raw = ((req.query.ids as string) || '').toString().trim();
      if (!raw) {
        res.json({ success: true, data: [] });
        return;
      }
      const ids = raw
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
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

      // Преобразуем периоды из frontend формата
      const rawLifePeriods = req.body?.lifePeriods || [];
      const lifePeriods = rawLifePeriods.map((lp: any) => ({
        countryId: Number(lp.countryId),
        start: Number(lp.start),
        end: Number(lp.end),
      }));

      const user = {
        sub: (req as any).user!.sub,
        email: (req as any).user?.email || 'unknown',
        role: (req as any).user?.role || 'user',
      };

      await personsService.proposePersonWithLifePeriods(
        {
          id,
          name,
          birthYear,
          deathYear,
          category,
          description,
          imageUrl,
          wikiLink,
          lifePeriods,
        },
        user,
        saveAsDraft
      );

      res.json({ success: true });
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
      const { id } = req.params;
      const parsed = LifePeriodsSchema.safeParse(req.body || {});

      if (!parsed.success) {
        throw errors.badRequest('Некорректные периоды', 'validation_error', parsed.error.flatten());
      }

      const periods: Array<{
        country_id: number;
        start_year: number;
        end_year: number;
      }> = parsed.data.periods;

      const userId = (req as any).user!.sub;
      const role = (req as any).user?.role || 'user';

      await personsService.replacePersonLifePeriods(id, periods, userId, role);

      res.json({ success: true });
    })
  );

  return router;
}
