import { Router, Request, Response } from 'express';
import { PersonEditPayloadSchema } from '../../dto';
import { Pool } from 'pg';
import { authenticateToken } from '../../middleware/auth';
import { errors, asyncHandler } from '../../utils/errors';
import { parseLimitOffset, paginateRows, mapApiPersonRow } from '../../utils/api';
import { TelegramService } from '../../services/telegramService';
import { sanitizePayload } from './helpers';

import { PersonsService } from '../../services/personsService';

export function createUserPersonRoutes(
  pool: Pool,
  telegramService: TelegramService,
  personsService: PersonsService
) {
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

      const limit = req.query.limit as string | undefined;
      const offset = req.query.offset as string | undefined;
      const countOnly = String((req.query.count as string) || 'false') === 'true';

      if (countOnly) {
        const count = await personsService.getUserPersonsCount(userId);
        res.json({ success: true, data: { count } });
        return;
      }

      const { data, meta } = await personsService.getUserPersons(
        userId,
        limit ? parseInt(limit) : undefined,
        offset ? parseInt(offset) : undefined
      );
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

      if (!parsed.success) {
        throw errors.badRequest(
          'Некорректные данные правки',
          'validation_error',
          parsed.error.flatten()
        );
      }

      const userId = (req as any).user!.sub;
      const payload = sanitizePayload(parsed.data);

      // Преобразуем периоды из frontend формата
      const rawLifePeriods = req.body?.lifePeriods || [];
      const lifePeriods =
        rawLifePeriods.length > 0
          ? rawLifePeriods.map((lp: any) => ({
              countryId: Number(lp.countryId),
              start: Number(lp.start),
              end: Number(lp.end),
            }))
          : undefined;

      await personsService.updatePersonWithLifePeriods(id, userId, payload, lifePeriods);

      res.json({ success: true, message: 'Черновик обновлен' });
    })
  );

  // Submit draft for moderation
  router.post(
    '/persons/:id/submit',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = (req as any).user!.sub;
      const userEmail = (req as any).user?.email || 'unknown';

      const result = await personsService.submitPersonDraft(id, userId, userEmail);

      res.json({ success: true, data: result });
    })
  );

  // Get user's drafts
  router.get(
    '/persons/drafts',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = (req as any).user!.sub;
      const limit = req.query.limit as string | undefined;
      const offset = req.query.offset as string | undefined;
      const countOnly = String((req.query.count as string) || 'false') === 'true';

      if (countOnly) {
        // Фильтруем только черновики
        const draftCount = await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM persons WHERE created_by = $1 AND status = 'draft'`,
          [userId]
        );
        res.json({ success: true, data: { count: draftCount.rows[0]?.cnt || 0 } });
        return;
      }

      const { data, meta } = await personsService.getPersonDrafts(
        userId,
        limit ? parseInt(limit) : undefined,
        offset ? parseInt(offset) : undefined
      );

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

      await personsService.revertPersonToDraft(id, userId);

      res.json({ success: true, message: 'Личность и связанные данные возвращены в черновики' });
    })
  );

  return router;
}
