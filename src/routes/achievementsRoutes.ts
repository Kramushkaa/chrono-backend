import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticateToken, requireRoleMiddleware, requireVerifiedEmail, rateLimit } from '../middleware/auth';
import { asyncHandler, errors } from '../utils/errors';
import { parseLimitOffset, paginateRows } from '../utils/api';
import { CountResult } from '../types/database';
import { TelegramService } from '../services/telegramService';
import { AchievementsService } from '../services/achievementsService';

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
    asyncHandler(async (req: Request, res: Response) => {
      const limit = req.query.limit as string | undefined;
      const offset = req.query.offset as string | undefined;
      const countOnly = String((req.query.count as string) || 'false') === 'true';

      if (countOnly) {
        const count = await achievementsService.getPendingCount();
        res.json({ success: true, data: { count } });
        return;
      }

      const { data, meta } = await achievementsService.getPendingAchievements(
        limit ? parseInt(limit) : undefined,
        offset ? parseInt(offset) : undefined
      );
      res.json({ success: true, data, meta });
    })
  );

  // User: my achievements
  router.get(
    '/achievements/mine',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const limit = req.query.limit as string | undefined;
      const offset = req.query.offset as string | undefined;
      const countOnly = String((req.query.count as string) || 'false') === 'true';

      if (countOnly) {
        const count = await achievementsService.getUserAchievementsCount(req.user!.sub);
        res.json({ success: true, data: { count } });
        return;
      }

      const { data, meta } = await achievementsService.getUserAchievements(
        req.user!.sub,
        limit ? parseInt(limit) : undefined,
        offset ? parseInt(offset) : undefined
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
      const { AchievementPersonSchema } = await import('../dto');
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
          role: req.user!.role,
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
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      await achievementsService.deleteAchievement(parseInt(id), req.user!.sub);
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
    asyncHandler(async (req: Request, res: Response) => {
      const raw = (req.query.ids || '').toString().trim();
      if (!raw) {
        res.json({ success: true, data: [] });
        return;
      }
      const ids = raw
        .split(',')
        .map((s: string) => parseInt(s, 10))
        .filter((n: number) => Number.isInteger(n));
      if (ids.length === 0) {
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

  return router;
}
