import { Router, Request, Response } from 'express';
import { UpsertPersonSchema } from '@chrononinja/dto';
import { Pool } from 'pg';
import { authenticateToken, requireRoleMiddleware } from '../../middleware/auth';
import { errors, asyncHandler } from '../../utils/errors';
import { mapApiPersonRow, parseLimitOffset, paginateRows } from '../../utils/api';
import { TelegramService } from '../../services/telegramService';
import { PersonsService } from '../../services/personsService';
import type { AuthenticatedRequest } from '../../types/auth';
import { logger } from '../../utils/logger';

export function createAdminPersonRoutes(
  pool: Pool,
  telegramService: TelegramService,
  personsService: PersonsService
) {
  const router = Router();

  // Admin/Moderator: create or upsert person immediately (approved)
  router.post(
    '/admin/persons',
    authenticateToken,
    requireRoleMiddleware(['admin', 'moderator']),
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = UpsertPersonSchema.safeParse(req.body || {});
      if (!parsed.success)
        throw errors.badRequest(
          'Некорректные данные Личности',
          'validation_error',
          parsed.error.flatten()
        );
      const authReq = req as unknown as AuthenticatedRequest;
      const { id, name, birthYear, deathYear, category, description, imageUrl, wikiLink } =
        parsed.data;

      const lifePeriods = parsed.data.lifePeriods;

      if (Array.isArray(lifePeriods)) {
        const user = {
          sub: authReq.user.sub,
          role: (authReq.user.role as 'admin' | 'moderator' | 'user') || 'user',
          email: authReq.user.email ?? 'unknown',
        };

        await personsService.proposePersonWithLifePeriods(
          {
            id,
            name: name.trim(),
            birthYear: Number(birthYear),
            deathYear: Number(deathYear),
            category: category.trim(),
            description: typeof description === 'string' ? description : '',
            imageUrl: imageUrl ?? null,
            wikiLink: wikiLink ?? null,
            lifePeriods,
          },
          user,
          false
        );
      } else {
        await personsService.createOrUpdatePersonDirectly(
          {
            id,
            name: name.trim(),
            birthYear: Number(birthYear),
            deathYear: Number(deathYear),
            category: category.trim(),
            description: typeof description === 'string' ? description : '',
            imageUrl: imageUrl ?? null,
            wikiLink: wikiLink ?? null,
          },
          authReq.user.sub
        );

        const userEmail = authReq.user.email ?? 'unknown';
        telegramService
          .notifyPersonCreated(name.trim(), userEmail, 'approved', id)
          .catch(err =>
            logger.warn('Telegram notification failed (admin person created)', { error: err })
          );
      }

      res.json({ success: true });
    })
  );

  // Moderation queue for persons
  router.get(
    '/admin/persons/moderation',
    authenticateToken,
    requireRoleMiddleware(['moderator', 'admin']),
    asyncHandler(async (req: Request, res: Response) => {
      const { limitParam, offsetParam } = parseLimitOffset(
        req.query.limit as string | undefined,
        req.query.offset as string | undefined,
        {
          defLimit: 200,
          maxLimit: 500,
        }
      );
      const countOnly = String((req.query.count as string) || 'false') === 'true';
      const contentType = req.query.content_type as string;
      let whereClause = '';
      const params: (string | number)[] = [];

      if (contentType) {
        whereClause = ` WHERE content_type = $1`;
        params.push(contentType);
      }

      if (countOnly) {
        const result = await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM v_pending_moderation${whereClause}`,
          params
        );
        res.json({ success: true, data: { count: result.rows[0]?.cnt || 0 } });
        return;
      }
      const sql = `SELECT id, name, birth_year, death_year, category, country, description, 
                          image_url, reign_start, reign_end, wiki_link, status, created_at, 
                          updated_at, created_by, updated_by 
                   FROM v_pending_moderation${whereClause} 
                   ORDER BY created_at DESC, id DESC 
                   LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limitParam + 1, offsetParam);
      const result = await pool.query(sql, params);
      const persons = result.rows.map(mapApiPersonRow);
      const { data, meta } = paginateRows(persons, limitParam, offsetParam);
      res.json({ success: true, data, meta });
    })
  );

  // Admin/Moderator: review person (approve / reject)
  router.post(
    '/admin/persons/:id/review',
    authenticateToken,
    requireRoleMiddleware(['admin', 'moderator']),
    asyncHandler(async (req: Request, res: Response) => {
      const authReq = req as unknown as AuthenticatedRequest;
      const { id } = req.params;
      const { action, comment } = req.body || {};

      if (!action || (action !== 'approve' && action !== 'reject')) {
        throw errors.badRequest('action должен быть approve или reject');
      }

      const result = await personsService.reviewPerson(id, action, authReq.user.sub, comment);

      // Отправка уведомления в Telegram (неблокирующее)
      const reviewerEmail = authReq.user.email ?? 'unknown';
      telegramService
        .notifyPersonReviewed(result.name, action, reviewerEmail, id)
        .catch(err =>
          logger.warn('Telegram notification failed (person reviewed)', { error: err })
        );

      res.json({ success: true, data: result });
    })
  );

  return router;
}
