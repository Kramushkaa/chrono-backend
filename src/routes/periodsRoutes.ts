import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import {
  authenticateToken,
  requireVerifiedEmail,
  requireRoleMiddleware,
  rateLimit,
} from '../middleware/auth';
import { asyncHandler, errors } from '../utils/errors';
import { UserRole } from '../utils/content-status';
import { TelegramService } from '../services/telegramService';
import { PeriodsService } from '../services/periodsService';
import {
  validateQuery,
  validateBody,
  validateParams,
  commonSchemas,
} from '../middleware/validation';
import { z } from 'zod';

// Валидационные схемы для periods
const periodsSchemas = {
  // Схема для пагинации
  pagination: commonSchemas.pagination,

  // Схема для ID периода
  periodId: z.object({
    id: commonSchemas.numericId,
  }),

  // Схема для создания периода
  createPeriod: z.object({
    start_year: commonSchemas.year,
    end_year: commonSchemas.year,
    description: z.string().min(1, 'Описание обязательно'),
    type: z.string().min(1, 'Тип периода обязателен'),
    country_id: z.number().int().positive().optional().nullable(),
    person_id: z.string().min(1, 'ID личности обязателен'),
    saveAsDraft: z.boolean().optional().default(false),
  }),

  // Схема для обновления периода
  updatePeriod: z.object({
    start_year: commonSchemas.year.optional(),
    end_year: commonSchemas.year.optional(),
    period_type: z.string().min(1, 'Тип периода обязателен').optional(),
    country_id: z.number().int().positive().optional().nullable(),
    comment: z.string().optional(),
  }),
};

// Helper function для преобразования роли пользователя из JWT в UserRole
function getUserRole(userRole: string): UserRole {
  if (userRole === 'admin' || userRole === 'moderator' || userRole === 'user') {
    return userRole;
  }
  return 'user'; // fallback для неизвестных ролей
}

export function createPeriodsRoutes(
  pool: Pool,
  telegramService: TelegramService,
  periodsService: PeriodsService
): Router {
  const router = Router();

  // Rate limiting: 30 requests per minute (content mutations)
  router.use(rateLimit(1 * 60 * 1000, 30));

  // Create standalone period (with person_id)
  router.post(
    '/periods',
    authenticateToken,
    requireVerifiedEmail,
    validateBody(periodsSchemas.createPeriod),
    asyncHandler(async (req: Request, res: Response) => {
      const {
        start_year,
        end_year,
        description,
        type,
        country_id,
        person_id,
        saveAsDraft = false,
      } = req.body;

      const result = await periodsService.createPeriod(
        {
          personId: person_id,
          startYear: start_year,
          endYear: end_year,
          periodType: type,
          countryId: country_id,
          comment: description,
        },
        {
          sub: req.user!.sub,
          role: getUserRole(req.user!.role),
          email: req.user?.email,
        },
        saveAsDraft
      );

      res.status(201).json({ success: true, data: result });
    })
  );

  // Create period for person (admin/moderator OR verified user)
  router.post(
    '/persons/:id/periods',
    authenticateToken,
    requireVerifiedEmail,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const {
        start_year,
        end_year,
        period_type,
        country_id,
        comment,
        saveAsDraft = false,
      } = req.body || {};

      if (!start_year || !end_year || !period_type) {
        throw errors.badRequest('start_year, end_year и period_type обязательны');
      }

      const result = await periodsService.createPeriod(
        {
          personId: id,
          startYear: start_year,
          endYear: end_year,
          periodType: period_type,
          countryId: country_id,
          comment,
        },
        {
          sub: req.user!.sub,
          role: getUserRole(req.user!.role),
          email: req.user?.email,
        },
        saveAsDraft
      );

      res.status(201).json({ success: true, data: result });
    })
  );

  // Update period (for drafts or own periods)
  router.put(
    '/periods/:id',
    authenticateToken,
    requireVerifiedEmail,
    validateParams(periodsSchemas.periodId),
    validateBody(periodsSchemas.updatePeriod),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params as unknown as { id: number };
      const { start_year, end_year, period_type, country_id, comment } = req.body;

      const result = await periodsService.updatePeriod(id, req.user!.sub, {
        startYear: start_year,
        endYear: end_year,
        periodType: period_type,
        countryId: country_id,
        comment,
      });

      res.json({ success: true, data: result });
    })
  );

  // Submit draft for moderation
  router.post(
    '/periods/:id/submit',
    authenticateToken,
    requireVerifiedEmail,
    validateParams(periodsSchemas.periodId),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params as unknown as { id: number };
      const result = await periodsService.submitDraft(id, req.user!.sub);
      res.json({ success: true, data: result });
    })
  );

  // Delete period (author of draft only)
  router.delete(
    '/periods/:id',
    authenticateToken,
    validateParams(periodsSchemas.periodId),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params as unknown as { id: number };
      await periodsService.deletePeriod(id, req.user!.sub);
      res.json({ success: true });
    })
  );

  // Get user's drafts
  router.get(
    '/periods/drafts',
    authenticateToken,
    validateQuery(periodsSchemas.pagination),
    asyncHandler(async (req: Request, res: Response) => {
      const limit = req.query.limit as number | undefined;
      const offset = req.query.offset as number | undefined;
      const countOnly = req.query.count as boolean | undefined;

      if (countOnly) {
        const count = await periodsService.getUserDrafts(req.user!.sub, 1, 0);
        res.json({ success: true, data: { count: count.data.length } });
        return;
      }

      const { data, meta } = await periodsService.getUserDrafts(req.user!.sub, limit, offset);
      res.json({ success: true, data, meta });
    })
  );

  // Admin: pending periods
  router.get(
    '/admin/periods/pending',
    authenticateToken,
    requireRoleMiddleware(['moderator', 'admin']),
    validateQuery(periodsSchemas.pagination),
    asyncHandler(async (req: Request, res: Response) => {
      const limit = req.query.limit as number | undefined;
      const offset = req.query.offset as number | undefined;
      const countOnly = req.query.count as boolean | undefined;

      if (countOnly) {
        const count = await periodsService.getPendingCount();
        res.json({ success: true, data: { count } });
        return;
      }

      const { data, meta } = await periodsService.getPendingPeriods(limit, offset);
      res.json({ success: true, data, meta });
    })
  );

  // Admin/Moderator: review period (approve / reject)
  router.post(
    '/admin/periods/:id/review',
    authenticateToken,
    requireRoleMiddleware(['moderator', 'admin']),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { action, comment } = req.body || {};

      if (!action || (action !== 'approve' && action !== 'reject')) {
        throw errors.badRequest('action должен быть approve или reject');
      }

      const result = await periodsService.reviewPeriod(
        parseInt(id),
        action,
        req.user!.sub,
        comment
      );

      res.json({ success: true, data: result });
    })
  );

  // User: my periods
  router.get(
    '/periods/mine',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const limit = req.query.limit as string | undefined;
      const offset = req.query.offset as string | undefined;
      const countOnly = String((req.query.count as string) || 'false') === 'true';

      if (countOnly) {
        const count = await periodsService.getUserPeriodsCount(req.user!.sub);
        res.json({ success: true, data: { count } });
        return;
      }

      const { data, meta } = await periodsService.getUserPeriods(
        req.user!.sub,
        limit ? parseInt(limit) : undefined,
        offset ? parseInt(offset) : undefined
      );
      res.json({ success: true, data, meta });
    })
  );

  // Public periods list (via v_approved_periods)
  router.get(
    '/periods',
    asyncHandler(async (req: Request, res: Response) => {
      const type = (req.query.type as string) || '';
      const q = (req.query.q as string) || '';
      const personId = (req.query.person_id as string) || '';
      const countryId = req.query.country_id ? parseInt(req.query.country_id as string) : undefined;
      const yearFrom = req.query.year_from ? parseInt(req.query.year_from as string) : undefined;
      const yearTo = req.query.year_to ? parseInt(req.query.year_to as string) : undefined;
      const limit = req.query.limit as string | undefined;
      const offset = req.query.offset as string | undefined;

      const { data, meta } = await periodsService.getPeriods(
        { q, personId, countryId, periodType: type, yearFrom, yearTo },
        limit ? parseInt(limit) : undefined,
        offset ? parseInt(offset) : undefined
      );
      res.json({ success: true, data, meta });
    })
  );

  // Lookup by ids
  router.get(
    '/periods/lookup/by-ids',
    asyncHandler(async (req: Request, res: Response) => {
      const idsParam = req.query.ids;
      const raw = Array.isArray(idsParam)
        ? idsParam.map(String).join(',')
        : (idsParam as string) || '';
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
      SELECT pr.id,
             pr.person_id,
             pr.country_id,
             pr.start_year,
             pr.end_year,
             pr.period_type,
             p.name  AS person_name,
             c.name  AS country_name
        FROM req_ids r
        JOIN periods pr ON pr.id = r.id
        LEFT JOIN persons   p ON p.id = pr.person_id
        LEFT JOIN countries c ON c.id = pr.country_id
       ORDER BY r.ord ASC`;
      const result = await pool.query(sql, [ids]);
      res.json({ success: true, data: result.rows });
    })
  );

  return router;
}
