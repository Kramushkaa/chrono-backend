import { Router } from 'express'
import { Pool } from 'pg'
import { authenticateToken, requireVerifiedEmail, requireRoleMiddleware } from '../middleware/auth'
import { asyncHandler, errors } from '../utils/errors'
import { paginateRows, parseLimitOffset } from '../utils/api'

export function createPeriodsRoutes(pool: Pool): Router {
  const router = Router()

  // Create period for person (admin/moderator OR verified user)
  router.post('/persons/:id/periods', authenticateToken, requireVerifiedEmail, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { start_year, end_year, period_type, country_id, comment, saveAsDraft = false } = req.body || {};
    
    if (!start_year || !end_year || !period_type) {
      throw errors.badRequest('start_year, end_year и period_type обязательны')
    }
    
    if (start_year >= end_year) {
      throw errors.badRequest('start_year должен быть меньше end_year')
    }
    
    const personRes = await pool.query('SELECT birth_year, death_year FROM persons WHERE id = $1', [id]);
    if (personRes.rowCount === 0) {
      throw errors.notFound('Личность не найдена')
    }
    
    const { birth_year, death_year } = personRes.rows[0];
    if (birth_year != null && death_year != null) {
      if (start_year < Number(birth_year) || end_year > Number(death_year)) {
        throw errors.badRequest(`Годы периода (${start_year}–${end_year}) должны входить в годы жизни Личности (${birth_year}–${death_year})`)
      }
    }
    
    const role = (req as any).user?.role || 'user'
    let result
    
    if (saveAsDraft) {
      // Сохранение как черновик
      result = await pool.query(
        `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, comment, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
         RETURNING *`,
        [id, start_year, end_year, period_type, country_id ?? null, comment ?? null, (req as any).user!.sub]
      );
    } else if (role === 'admin' || role === 'moderator') {
      result = await pool.query(
        `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, comment, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7)
         RETURNING *`,
        [id, start_year, end_year, period_type, country_id ?? null, comment ?? null, (req as any).user!.sub]
      );
    } else {
      // Обычные пользователи с подтверждённой почтой создают периоды в статусе pending
      result = await pool.query(
        `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, comment, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
         RETURNING *`,
        [id, start_year, end_year, period_type, country_id ?? null, comment ?? null, (req as any).user!.sub]
      );
    }
    
    res.status(201).json({ success: true, data: result.rows[0] });
  }))

  // Update period (for drafts or own periods)
  router.put('/periods/:id', authenticateToken, requireVerifiedEmail, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { start_year, end_year, period_type, country_id, comment } = req.body || {};
    
    // Проверяем, что период принадлежит пользователю или является черновиком
    const periodRes = await pool.query(
      'SELECT created_by, status FROM periods WHERE id = $1',
      [id]
    );
    
    if (periodRes.rowCount === 0) {
      throw errors.notFound('Период не найден')
    }
    
    const period = periodRes.rows[0];
    const userId = (req as any).user!.sub;
    
    if (period.created_by !== userId && period.status !== 'draft') {
      throw errors.notFound('Нет прав для редактирования этого периода')
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
  }))

  // Submit draft for moderation
  router.post('/periods/:id/submit', authenticateToken, requireVerifiedEmail, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    
    // Проверяем, что период является черновиком и принадлежит пользователю
    const periodRes = await pool.query(
      'SELECT created_by, status FROM periods WHERE id = $1',
      [id]
    );
    
    if (periodRes.rowCount === 0) {
      throw errors.notFound('Период не найден')
    }
    
    const period = periodRes.rows[0];
    const userId = (req as any).user!.sub;
    
    if (period.created_by !== userId) {
      throw errors.forbidden('Нет прав для отправки этого периода')
    }
    
    if (period.status !== 'draft') {
      throw errors.badRequest('Можно отправлять на модерацию только черновики')
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
  }))

  // Get user's drafts
  router.get('/periods/drafts', authenticateToken, asyncHandler(async (req: any, res: any) => {
    const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 200, maxLimit: 500 });
    const countOnly = String(req.query.count || 'false') === 'true';
    
    if (countOnly) {
      const cRes = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM periods WHERE created_by = $1 AND status = 'draft'`, 
        [(req as any).user!.sub]
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
    
    const result = await pool.query(sql, [(req as any).user!.sub, limitParam + 1, offsetParam]);
    const rows = result.rows;
    const { data, meta } = paginateRows(rows, limitParam, offsetParam);
    res.json({ success: true, data, meta });
  }))

  // Admin: pending periods
  router.get('/admin/periods/pending', authenticateToken, requireRoleMiddleware(['moderator', 'admin']), asyncHandler(async (req: any, res: any) => {
    const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 200, maxLimit: 500 });
    const countOnly = String(req.query.count || 'false') === 'true';
    
    if (countOnly) {
      const cRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM periods WHERE status = 'pending'`);
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
  }))

  // Admin/Moderator: review period (approve / reject)
  router.post('/admin/periods/:id/review', authenticateToken, requireRoleMiddleware(['moderator', 'admin']), asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { action, comment } = req.body || {}; // action: 'approve' | 'reject'
    
    if (!id || !action) {
      throw errors.badRequest('id и action обязательны')
    }
    
    if (action === 'approve') {
      await pool.query(
        `UPDATE periods SET status='approved', reviewed_by=$2, review_comment=$3 WHERE id=$1`,
        [id, (req as any).user!.sub, comment ?? null]
      );
    } else if (action === 'reject') {
      await pool.query(
        `UPDATE periods SET status='rejected', reviewed_by=$2, review_comment=$3 WHERE id=$1`,
        [id, (req as any).user!.sub, comment ?? null]
      );
    } else {
      throw errors.badRequest('action должен быть approve или reject')
    }
    
    res.json({ success: true });
  }))

  // User: my periods
  router.get('/periods/mine', authenticateToken, asyncHandler(async (req: any, res: any) => {
    const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 200, maxLimit: 500 });
    const countOnly = String(req.query.count || 'false') === 'true';
    
    if (countOnly) {
      const cRes = await pool.query(`SELECT COALESCE(periods_count, 0) AS cnt FROM v_user_content_counts WHERE created_by = $1`, [(req as any).user!.sub]);
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
    
    const result = await pool.query(sql, [(req as any).user!.sub, limitParam + 1, offsetParam]);
    const rows = result.rows;
    const { data, meta } = paginateRows(rows, limitParam, offsetParam);
    res.json({ success: true, data, meta });
  }))

  // Public periods list (via v_approved_periods)
  router.get('/periods', asyncHandler(async (req: any, res: any) => {
    const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 200, maxLimit: 500 });
    const type = (req.query.type || '').toString().trim().toLowerCase();
    const q = (req.query.q || '').toString().trim();
    const personId = (req.query.person_id || '').toString().trim();
    const countryIdNum = parseInt((req.query.country_id as string) || '');
    const yearFromNum = parseInt((req.query.year_from as string) || '');
    const yearToNum = parseInt((req.query.year_to as string) || '');
    const params: any[] = [];
    let where = ` WHERE 1=1`;
    if (type === 'life' || type === 'ruler') { where += ` AND v.period_type = $${params.length + 1}`; params.push(type); }
    if (q.length > 0) { where += ` AND (v.person_name ILIKE $${params.length + 1} OR v.country_name ILIKE $${params.length + 1})`; params.push(`%${q}%`); }
    if (personId.length > 0) { where += ` AND v.person_id = $${params.length + 1}`; params.push(personId); }
    if (Number.isInteger(countryIdNum)) { where += ` AND v.country_id = $${params.length + 1}`; params.push(countryIdNum); }
    if (Number.isInteger(yearFromNum)) { where += ` AND v.start_year >= $${params.length + 1}`; params.push(yearFromNum); }
    if (Number.isInteger(yearToNum)) { where += ` AND v.end_year <= $${params.length + 1}`; params.push(yearToNum); }
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
  }))

  // Lookup by ids
  router.get('/periods/lookup/by-ids', asyncHandler(async (req: any, res: any) => {
    const raw = (req.query.ids || '').toString().trim();
    if (!raw) { res.json({ success: true, data: [] }); return; }
    const ids = raw.split(',').map((s: string) => parseInt(s, 10)).filter((n: number) => Number.isInteger(n));
    if (ids.length === 0) { res.json({ success: true, data: [] }); return; }
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
  }))

  return router
}


