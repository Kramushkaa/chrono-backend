import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import {
  authenticateToken,
  requireRoleMiddleware,
  requireVerifiedEmail,
  rateLimit,
} from '../middleware/auth';
import { asyncHandler, errors } from '../utils/errors';
import { UserRole } from '../utils/content-status';
import { TelegramService } from '../services/telegramService';
import { AchievementsService } from '../services/achievementsService';
import { logger } from '../utils/logger';
import { AchievementPersonSchema } from '@chrononinja/dto';
import {
  validateQuery,
  validateParams,
  validateBody,
  commonSchemas,
} from '../middleware/validation';
import { z } from 'zod';

// Валидационные схемы
const achievementsSchemas = {
  // Схема для пагинации
  pagination: commonSchemas.pagination,

  // Схема для ID достижения
  achievementId: z.object({
    id: commonSchemas.numericId,
  }),

  // Схема для lookup achievements (опциональный ids)
  lookupByIds: z.object({
    ids: z
      .string()
      .optional()
      .transform(val => (val ? val.split(',').map(id => parseInt(id.trim(), 10)) : []))
      .refine(ids => ids.every(id => !Number.isNaN(id) && id > 0), {
        message: 'Все ID должны быть положительными числами',
      }),
  }),
};

export function createAchievementsRoutes(
  pool: Pool,
  telegramService: TelegramService,
  achievementsService: AchievementsService
): Router {
  const router = Router();

  // Rate limiting: 30 requests per minute (content mutations)
  router.use(rateLimit(1 * 60 * 1000, 30));

  // Admin: pending achievements
  router.get(
    '/admin/achievements/pending',
    authenticateToken,
    requireRoleMiddleware(['moderator', 'admin']),
    validateQuery(achievementsSchemas.pagination),
    asyncHandler(async (req: Request, res: Response) => {
      const limit = req.query.limit as number | undefined;
      const offset = req.query.offset as number | undefined;
      const countOnly = req.query.count as boolean | undefined;

      if (countOnly) {
        const count = await achievementsService.getPendingCount();
        res.json({ success: true, data: { count } });
        return;
      }

      const { data, meta } = await achievementsService.getPendingAchievements(limit, offset);
      res.json({ success: true, data, meta });
    })
  );

  // User: my achievements
  router.get(
    '/achievements/mine',
    authenticateToken,
    validateQuery(achievementsSchemas.pagination),
    asyncHandler(async (req: Request, res: Response) => {
      const limit = req.query.limit as number | undefined;
      const offset = req.query.offset as number | undefined;
      const countOnly = req.query.count as boolean | undefined;

      if (countOnly) {
        const count = await achievementsService.getUserAchievementsCount(req.user!.sub);
        res.json({ success: true, data: { count } });
        return;
      }

      const { data, meta } = await achievementsService.getUserAchievements(
        req.user!.sub,
        limit,
        offset
      );
      res.json({ success: true, data, meta });
    })
  );

  // Public achievements list
  router.get(
    '/achievements',
    asyncHandler(async (req: Request, res: Response) => {
      const q = (req.query.q as string) || '';
      const personId = (req.query.person_id as string) || '';
      const countryId = req.query.country_id ? parseInt(req.query.country_id as string) : undefined;
      const yearFrom = req.query.year_from ? parseInt(req.query.year_from as string) : undefined;
      const yearTo = req.query.year_to ? parseInt(req.query.year_to as string) : undefined;
      const limit = req.query.limit as string | undefined;
      const offset = req.query.offset as string | undefined;

      const { data, meta } = await achievementsService.getAchievements(
        { q, personId, countryId, yearFrom, yearTo },
        limit ? parseInt(limit) : undefined,
        offset ? parseInt(offset) : undefined
      );
      res.json({ success: true, data, meta });
    })
  );

  // Achievements by person
  router.get(
    '/persons/:id/achievements',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const data = await achievementsService.getAchievementsByPerson(id);
      res.json({ success: true, data });
    })
  );

  // Create achievement for person (admin/moderator OR verified user)
  router.post(
    '/persons/:id/achievements',
    authenticateToken,
    requireVerifiedEmail,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const parsed = AchievementPersonSchema.safeParse(req.body || {});
      if (!parsed.success)
        throw errors.badRequest(
          'Некорректные данные достижения',
          'validation_error',
          parsed.error.flatten()
        );

      const { year, description, wikipedia_url, image_url, saveAsDraft = false } = parsed.data;

      const result = await achievementsService.createAchievement(
        {
          personId: id,
          year,
          description,
          wikipediaUrl: wikipedia_url,
          imageUrl: image_url,
        },
        {
          sub: req.user!.sub,
          role: req.user!.role as UserRole,
          email: req.user?.email,
        },
        saveAsDraft
      );

      res.status(201).json({ success: true, data: result });
    })
  );

  // Update achievement (for drafts or own achievements)
  router.put(
    '/achievements/:id',
    authenticateToken,
    requireVerifiedEmail,
    validateBody(commonSchemas.updateAchievement),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { year, description, wikipedia_url, image_url } = req.body || {};

      const result = await achievementsService.updateAchievement(parseInt(id), req.user!.sub, {
        year,
        description,
        wikipediaUrl: wikipedia_url,
        imageUrl: image_url,
      });

      res.json({ success: true, data: result });
    })
  );

  // Delete achievement (author of draft only)
  router.delete(
    '/achievements/:id',
    authenticateToken,
    validateParams(achievementsSchemas.achievementId),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params as unknown as { id: number };
      await achievementsService.deleteAchievement(id, req.user!.sub);
      res.json({ success: true });
    })
  );

  // Submit draft for moderation
  router.post(
    '/achievements/:id/submit',
    authenticateToken,
    requireVerifiedEmail,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const result = await achievementsService.submitDraft(parseInt(id), req.user!.sub);
      res.json({ success: true, data: result });
    })
  );

  // User: propose an edit for an existing approved achievement (uses achievement_edits table)
  router.post(
    '/achievements/:id/edits',
    authenticateToken,
    requireVerifiedEmail,
    validateParams(achievementsSchemas.achievementId),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params as unknown as { id: number };
      const rawPayload = req.body?.payload || req.body;
      if (!rawPayload || typeof rawPayload !== 'object') {
        throw errors.badRequest('payload обязателен');
      }

      const payload = {
        year: rawPayload.year,
        description: rawPayload.description,
        wikipediaUrl: rawPayload.wikipediaUrl || rawPayload.wikipedia_url,
        imageUrl: rawPayload.imageUrl || rawPayload.image_url,
        personId: rawPayload.personId || rawPayload.person_id,
        countryId: rawPayload.countryId || rawPayload.country_id,
      };

      const userId = req.user!.sub;
      const result = await achievementsService.proposeEdit(id, payload, userId);

      // Отправка уведомления в Telegram (неблокирующее)
      const userEmail = req.user?.email || 'unknown';
      const achievementRes = await pool.query('SELECT person_id, year, description FROM achievements WHERE id = $1', [id]);
      const achievementData = achievementRes.rows[0];

      telegramService
        .notifyAchievementEditProposed(achievementData?.person_id ?? null, userEmail, id)
        .catch((err: unknown) =>
          logger.warn('Telegram notification failed (achievement edit proposed)', {
            error: err instanceof Error ? err : new Error(String(err)),
          })
        );

      res.status(201).json({
        success: true,
        message: 'Предложение изменений отправлено на модерацию',
        data: result,
      });
    })
  );

  // Get user's drafts
  router.get(
    '/achievements/drafts',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const limit = req.query.limit as string | undefined;
      const offset = req.query.offset as string | undefined;
      const countOnly = String((req.query.count as string) || 'false') === 'true';

      if (countOnly) {
        const count = await achievementsService.getUserDrafts(req.user!.sub, 1, 0);
        res.json({ success: true, data: { count: count.data.length } });
        return;
      }

      const { data, meta } = await achievementsService.getUserDrafts(
        req.user!.sub,
        limit ? parseInt(limit) : undefined,
        offset ? parseInt(offset) : undefined
      );
      res.json({ success: true, data, meta });
    })
  );

  // Lookup achievements by ids
  router.get(
    '/achievements/lookup/by-ids',
    validateQuery(achievementsSchemas.lookupByIds),
    asyncHandler(async (req: Request, res: Response) => {
      const ids = req.query.ids as unknown as number[];
      if (!ids || ids.length === 0) {
        res.json({ success: true, data: [] });
        return;
      }
      const sql = `
      WITH req_ids AS (
        SELECT ($1::int[])[g.ord] AS id, g.ord
          FROM generate_series(1, COALESCE(array_length($1::int[], 1), 0)) AS g(ord)
      )
      SELECT a.id,
             a.person_id,
             a.country_id,
             a.year,
             a.description,
             a.wikipedia_url,
             a.image_url,
             COALESCE(
               CASE WHEN a.country_id IS NOT NULL THEN c.name
                    WHEN a.person_id IS NOT NULL THEN p.name
                    ELSE NULL END,
               ''
             ) AS title
        FROM req_ids r
        JOIN achievements a ON a.id = r.id
        LEFT JOIN persons   p ON p.id = a.person_id
        LEFT JOIN countries c ON c.id = a.country_id
       WHERE a.status = 'approved'
       ORDER BY r.ord ASC`;
      const result = await pool.query(sql, [ids]);
      res.json({ success: true, data: result.rows });
    })
  );

  // Admin/Moderator: review achievement (approve / reject)
  router.post(
    '/admin/achievements/:id/review',
    authenticateToken,
    requireRoleMiddleware(['moderator', 'admin']),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { action, comment } = req.body || {};

      if (!action || (action !== 'approve' && action !== 'reject')) {
        throw errors.badRequest('action должен быть approve или reject');
      }

      const result = await achievementsService.reviewAchievement(
        parseInt(id),
        action,
        req.user!.sub,
        comment
      );

      res.json({ success: true, data: result });
    })
  );

  // Admin/Moderator: review achievement edit (approve / reject)
  router.post(
    '/admin/achievements/edits/:id/review',
    authenticateToken,
    requireRoleMiddleware(['moderator', 'admin']),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { action, comment } = req.body || {};

      if (!action || (action !== 'approve' && action !== 'reject')) {
        throw errors.badRequest('action должен быть approve или reject');
      }

      const result = await achievementsService.reviewEdit(
        parseInt(id),
        action,
        req.user!.sub,
        comment
      );

      res.json({ success: true, data: result });
    })
  );

  return router;
}
