import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticateToken, requireVerifiedEmail, requireRoleMiddleware } from '../middleware/auth';
import { asyncHandler, errors } from '../utils/errors';
import { paginateRows, parseLimitOffset } from '../utils/api';
import { CountResult } from '../types/database';
import { TelegramService } from '../services/telegramService';
import { PeriodsService } from '../services/periodsService';

export function createPeriodsRoutes(pool: Pool, telegramService: TelegramService, periodsService: PeriodsService): Router {
  const router = Router();

  // Create standalone period (with person_id)
  router.post(
    '/periods',
    authenticateToken,
    requireVerifiedEmail,
    asyncHandler(async (req: Request, res: Response) => {
      const {
        start_year,
        end_year,
        description,
        type,
        country_id,
        person_id,
        saveAsDraft = false,
      } = req.body || {};

      if (!start_year || !end_year || !description || !type || !person_id) {
        throw errors.badRequest(
          'start_year, end_year, description, type и person_id обязательны'
        );
      }

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
          role: req.user!.role,
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
          role: req.user!.role,
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
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { start_year, end_year, period_type, country_id, comment } = req.body || {};

      // Проверяем, что период принадлежит пользователю или является черновиком
      const periodRes = await pool.query('SELECT created_by, status FROM periods WHERE id = $1', [
        id,
      ]);

      if (periodRes.rowCount === 0) {
        throw errors.notFound('Период не найден');
      }

      const period = periodRes.rows[0];
      const userId = req.user!.sub;

      if (period.created_by !== userId && period.status !== 'draft') {
        throw errors.forbidden('Нет прав для редактирования этого периода');
      }

      // Обновляем период
      const result = await pool.query(
        `UPDATE periods 
       SET start_year = COALESCE($2, start_year), 
           end_year = COALESCE($3, end_year), 
           period_type = COALESCE($4, period_type), 
           country_id = $5, 
           comment = $6
       WHERE id = $1
       RETURNING *`,
        [id, start_year, end_year, period_type, country_id ?? null, comment ?? null]
      );

      res.json({ success: true, data: result.rows[0] });
    })
  );

  // Submit draft for moderation
  router.post(
    '/periods/:id/submit',
    authenticateToken,
    requireVerifiedEmail,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      // Проверяем, что период является черновиком и принадлежит пользователю
      const periodRes = await pool.query('SELECT created_by, status FROM periods WHERE id = $1', [
        id,
      ]);

      if (periodRes.rowCount === 0) {
        throw errors.notFound('Период не найден');
      }

      const period = periodRes.rows[0];
      const userId = req.user!.sub;

      if (period.created_by !== userId) {
        throw errors.forbidden('Нет прав для отправки этого периода');
      }

      if (period.status !== 'draft') {
        throw errors.badRequest('Можно отправлять на модерацию только черновики');
      }

      // Отправляем на модерацию
      const result = await pool.query(
        `UPDATE periods 
       SET status = 'pending'
       WHERE id = $1
       RETURNING *`,
        [id]
      );

      res.json({ success: true, data: result.rows[0] });
    })
  );

  // Delete period (author of draft or moderator/admin)
  router.delete(
    '/periods/:id',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const userId = req.user!.sub;
      const role = req.user!.role;

      const periodRes = await pool.query('SELECT created_by, status FROM periods WHERE id = $1', [
        id,
      ]);
      if (periodRes.rowCount === 0) {
        throw errors.notFound('Период не найден');
      }
      const period = periodRes.rows[0];

      const isOwnerDraft = period.created_by === userId && period.status === 'draft';
      const isModerator = role === 'admin' || role === 'moderator';
      if (!isOwnerDraft && !isModerator) {
        throw errors.forbidden('Нет прав для удаления этого периода');
      }

      await pool.query('DELETE FROM periods WHERE id = $1', [id]);
      res.json({ success: true });
    })
  );

  // Get user's drafts
  router.get(
    '/periods/drafts',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const { limitParam, offsetParam } = parseLimitOffset(
        String((req.query.limit as string) || ''),
        String((req.query.offset as string) || ''),
        {
          defLimit: 200,
          maxLimit: 500,
        }
      );
      const countOnly = String((req.query.count as string) || 'false') === 'true';

      if (countOnly) {
        const cRes = await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM periods WHERE created_by = $1 AND status = 'draft'`,
          [req.user!.sub]
        );
        res.json({ success: true, data: { count: cRes.rows[0]?.cnt || 0 } });
        return;
      }

      const sql = `
      SELECT pr.id,
             pr.person_id,
             pr.country_id,
             pr.start_year,
             pr.end_year,
             pr.period_type,
             pr.comment,
             pr.status,
             pr.updated_at,
             p.name AS person_name,
             c.name AS country_name
        FROM periods pr
        LEFT JOIN persons   p ON p.id = pr.person_id
        LEFT JOIN countries c ON c.id = pr.country_id
       WHERE pr.created_by = $1 AND pr.status = 'draft'
       ORDER BY pr.updated_at DESC NULLS LAST, pr.id DESC
       LIMIT $2 OFFSET $3`;

      const result = await pool.query(sql, [req.user!.sub, limitParam + 1, offsetParam]);
      const rows = result.rows;
      const { data, meta } = paginateRows(rows, limitParam, offsetParam);
      res.json({ success: true, data, meta });
    })
  );

  // Admin: pending periods
  router.get(
    '/admin/periods/pending',
    authenticateToken,
    requireRoleMiddleware(['moderator', 'admin']),
    asyncHandler(async (req: Request, res: Response) => {
      const { limitParam, offsetParam } = parseLimitOffset(
        String((req.query.limit as string) || ''),
        String((req.query.offset as string) || ''),
        {
          defLimit: 200,
          maxLimit: 500,
        }
      );
      const countOnly = String((req.query.count as string) || 'false') === 'true';

      if (countOnly) {
        const cRes = await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM periods WHERE status = 'pending'`
        );
        res.json({ success: true, data: { count: cRes.rows[0]?.cnt || 0 } });
        return;
      }

      const sql = `
      SELECT pr.id,
             pr.person_id,
             pr.country_id,
             pr.start_year,
             pr.end_year,
             pr.period_type,
             pr.comment,
             pr.status,
             pr.created_by,
             pr.updated_at,
             p.name AS person_name,
             c.name AS country_name,
             u.email AS creator_email,
             u.username AS creator_username
        FROM periods pr
        LEFT JOIN persons   p ON p.id = pr.person_id
        LEFT JOIN countries c ON c.id = pr.country_id
        LEFT JOIN users     u ON u.id = pr.created_by
       WHERE pr.status = 'pending'
       ORDER BY pr.updated_at DESC NULLS LAST, pr.id DESC
       LIMIT $1 OFFSET $2`;

      const result = await pool.query(sql, [limitParam + 1, offsetParam]);
      const rows = result.rows;
      const { data, meta } = paginateRows(rows, limitParam, offsetParam);
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
      const { action, comment } = req.body || {}; // action: 'approve' | 'reject'

      if (!id || !action) {
        throw errors.badRequest('id и action обязательны');
      }

      if (action === 'approve') {
        await pool.query(
          `UPDATE periods SET status='approved', reviewed_by=$2, review_comment=$3 WHERE id=$1`,
          [id, req.user!.sub, comment ?? null]
        );
      } else if (action === 'reject') {
        await pool.query(
          `UPDATE periods SET status='rejected', reviewed_by=$2, review_comment=$3 WHERE id=$1`,
          [id, req.user!.sub, comment ?? null]
        );
      } else {
        throw errors.badRequest('action должен быть approve или reject');
      }

      res.json({ success: true });
    })
  );

  // User: my periods
  router.get(
    '/periods/mine',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const { limitParam, offsetParam } = parseLimitOffset(
        String((req.query.limit as string) || ''),
        String((req.query.offset as string) || ''),
        {
          defLimit: 200,
          maxLimit: 500,
        }
      );
      const countOnly = String((req.query.count as string) || 'false') === 'true';

      if (countOnly) {
        const cRes = await pool.query(
          `SELECT COALESCE(periods_count, 0) AS cnt FROM v_user_content_counts WHERE created_by = $1`,
          [req.user!.sub]
        );
        res.json({ success: true, data: { count: cRes.rows[0]?.cnt || 0 } });
        return;
      }

      const sql = `
      SELECT pr.id,
             pr.person_id,
             pr.country_id,
             pr.start_year,
             pr.end_year,
             pr.period_type,
             pr.comment,
             pr.status,
             pr.updated_at,
             pr.review_comment,
             p.name AS person_name,
             c.name AS country_name
        FROM periods pr
        LEFT JOIN persons   p ON p.id = pr.person_id
        LEFT JOIN countries c ON c.id = pr.country_id
       WHERE pr.created_by = $1
       ORDER BY pr.updated_at DESC NULLS LAST, pr.id DESC
       LIMIT $2 OFFSET $3`;

      const result = await pool.query(sql, [req.user!.sub, limitParam + 1, offsetParam]);
      const rows = result.rows;
      const { data, meta } = paginateRows(rows, limitParam, offsetParam);
      res.json({ success: true, data, meta });
    })
  );

  // Public periods list (via v_approved_periods)
  router.get(
    '/periods',
    asyncHandler(async (req: Request, res: Response) => {
      const { limitParam, offsetParam } = parseLimitOffset(
        String((req.query.limit as string) || ''),
        String((req.query.offset as string) || ''),
        {
          defLimit: 200,
          maxLimit: 500,
        }
      );
      const type = ((req.query.type as string) || '').toString().trim().toLowerCase();
      const q = ((req.query.q as string) || '').toString().trim();
      const personId = ((req.query.person_id as string) || '').toString().trim();
      const countryIdNum = parseInt((req.query.country_id as string) || '');
      const yearFromNum = parseInt((req.query.year_from as string) || '');
      const yearToNum = parseInt((req.query.year_to as string) || '');
      const params: any[] = [];
      let where = ` WHERE 1=1`;
      if (type === 'life' || type === 'ruler') {
        where += ` AND v.period_type = $${params.length + 1}`;
        params.push(type);
      }
      if (q.length > 0) {
        where += ` AND (v.person_name ILIKE $${params.length + 1} OR v.country_name ILIKE $${params.length + 1})`;
        params.push(`%${q}%`);
      }
      if (personId.length > 0) {
        where += ` AND v.person_id = $${params.length + 1}`;
        params.push(personId);
      }
      if (Number.isInteger(countryIdNum)) {
        where += ` AND v.country_id = $${params.length + 1}`;
        params.push(countryIdNum);
      }
      if (Number.isInteger(yearFromNum)) {
        where += ` AND v.start_year >= $${params.length + 1}`;
        params.push(yearFromNum);
      }
      if (Number.isInteger(yearToNum)) {
        where += ` AND v.end_year <= $${params.length + 1}`;
        params.push(yearToNum);
      }
      params.push(limitParam + 1, offsetParam);
      const sql = `
      SELECT v.id,
             v.person_id,
             v.country_id,
             v.start_year,
             v.end_year,
             v.period_type,
             v.person_name,
             v.country_name
        FROM v_approved_periods v
       ${where}
       ORDER BY v.start_year ASC, v.id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`;
      const result = await pool.query(sql, params);
      const rows = result.rows;
      const { data, meta } = paginateRows(rows, limitParam, offsetParam);
      res.json({ success: true, data, meta });
    })
  );

  // Lookup by ids
  router.get(
    '/periods/lookup/by-ids',
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
