import { Router } from 'express'
import { Pool } from 'pg'
import { authenticateToken, requireRoleMiddleware, requireVerifiedEmail } from '../middleware/auth'
import { asyncHandler, errors } from '../utils/errors'
import { parseLimitOffset, paginateRows } from '../utils/api'

export function createAchievementsRoutes(pool: Pool): Router {
  const router = Router()

  // Admin: pending achievements
  router.get('/admin/achievements/pending', authenticateToken, requireRoleMiddleware(['moderator', 'admin']), asyncHandler(async (req: any, res: any) => {
    const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 200, maxLimit: 500 });
    const countOnly = String(req.query.count || 'false') === 'true';
    if (countOnly) {
      const cRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM achievements WHERE status = 'pending'`);
      res.json({ success: true, data: { count: cRes.rows[0]?.cnt || 0 } });
      return;
    }
    const sql = `
      SELECT a.id,
             a.person_id,
             a.country_id,
             a.year,
             a.description,
             a.wikipedia_url,
             a.image_url,
             a.status,
             a.created_by,
             a.submitted_at,
             COALESCE(
               CASE WHEN a.country_id IS NOT NULL THEN c.name
                    WHEN a.person_id IS NOT NULL THEN p.name
                    ELSE NULL END,
               ''
             ) AS title,
             u.email AS creator_email,
             u.username AS creator_username
        FROM achievements a
        LEFT JOIN persons   p ON p.id = a.person_id
        LEFT JOIN countries c ON c.id = a.country_id
        LEFT JOIN users     u ON u.id = a.created_by
       WHERE a.status = 'pending'
       ORDER BY a.submitted_at DESC NULLS LAST, a.id DESC
       LIMIT $1 OFFSET $2`;
    const result = await pool.query(sql, [limitParam + 1, offsetParam]);
    const rows = result.rows;
    const { data, meta } = paginateRows(rows, limitParam, offsetParam);
    res.json({ success: true, data, meta });
  }))

  // User: my achievements
  router.get('/achievements/mine', authenticateToken, asyncHandler(async (req: any, res: any) => {
    const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 200, maxLimit: 500 });
    const countOnly = String(req.query.count || 'false') === 'true';
    if (countOnly) {
      const cRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM achievements WHERE created_by = $1`, [(req as any).user!.sub]);
      res.json({ success: true, data: { count: cRes.rows[0]?.cnt || 0 } });
      return;
    }
    const sql = `
      SELECT a.id,
             a.person_id,
             a.country_id,
             a.year,
             a.description,
             a.wikipedia_url,
             a.image_url,
             a.status,
             a.submitted_at,
             a.reviewed_at,
             a.review_comment,
             COALESCE(
               CASE WHEN a.country_id IS NOT NULL THEN c.name
                    WHEN a.person_id IS NOT NULL THEN p.name
                    ELSE NULL END,
               ''
             ) AS title
        FROM achievements a
        LEFT JOIN persons   p ON p.id = a.person_id
        LEFT JOIN countries c ON c.id = a.country_id
       WHERE a.created_by = $1
       ORDER BY a.submitted_at DESC NULLS LAST, a.id DESC
       LIMIT $2 OFFSET $3`;
    const result = await pool.query(sql, [(req as any).user!.sub, limitParam + 1, offsetParam]);
    const rows = result.rows;
    const { data, meta } = paginateRows(rows, limitParam, offsetParam);
    res.json({ success: true, data, meta });
  }))

  // Public achievements list
  router.get('/achievements', asyncHandler(async (req: any, res: any) => {
    const q = (req.query.q || '').toString().trim()
    const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 100, maxLimit: 500 });
    const personId = (req.query.person_id || '').toString().trim()
    const countryIdNum = parseInt((req.query.country_id as string) || '')
    const yearFromNum = parseInt((req.query.year_from as string) || '')
    const yearToNum = parseInt((req.query.year_to as string) || '')
    const params: any[] = []
    let paramIndex = 1
    let sql = `
      SELECT a.id, a.person_id, a.country_id, a.year, a.description, a.wikipedia_url, a.image_url,
             p.name AS person_name, c.name AS country_name
        FROM achievements a
        LEFT JOIN persons p ON p.id = a.person_id
        LEFT JOIN countries c ON c.id = a.country_id
       WHERE a.status = 'approved'
    `
    if (q.length > 0) {
      sql += ` AND (a.description ILIKE $${paramIndex} OR p.name ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`
      params.push(`%${q}%`)
      paramIndex++
    }
    if (personId.length > 0) {
      sql += ` AND a.person_id = $${paramIndex}`
      params.push(personId)
      paramIndex++
    }
    if (Number.isInteger(countryIdNum)) {
      sql += ` AND a.country_id = $${paramIndex}`
      params.push(countryIdNum)
      paramIndex++
    }
    if (Number.isInteger(yearFromNum)) {
      sql += ` AND a.year >= $${paramIndex}`
      params.push(yearFromNum)
      paramIndex++
    }
    if (Number.isInteger(yearToNum)) {
      sql += ` AND a.year <= $${paramIndex}`
      params.push(yearToNum)
      paramIndex++
    }
    sql += ` ORDER BY a.year ASC, a.id ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limitParam + 1, offsetParam)
    const r = await pool.query(sql, params)
    const rows = r.rows
    const { data, meta } = paginateRows(rows, limitParam, offsetParam)
    res.json({ success: true, data, meta })
  }))

  // Achievements by person
  router.get('/persons/:id/achievements', asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, person_id, year, description, wikipedia_url, image_url FROM achievements WHERE person_id = $1 AND status = $2 ORDER BY year ASC',
      [id, 'approved']
    );
    res.json({ success: true, data: result.rows });
  }))

  // Create achievement for person (admin/moderator OR verified user)
  router.post('/persons/:id/achievements', authenticateToken, requireVerifiedEmail, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { AchievementPersonSchema } = await import('../dto')
    const parsed = AchievementPersonSchema.safeParse(req.body || {})
    if (!parsed.success) throw errors.badRequest('Некорректные данные достижения', 'validation_error', parsed.error.flatten())
    const { year, description, wikipedia_url, image_url, saveAsDraft = false } = parsed.data

    const personRes = await pool.query('SELECT birth_year, death_year FROM persons WHERE id = $1', [id]);
    if (personRes.rowCount === 0) {
      throw errors.notFound('Личность не найдена')
    }
    const { birth_year, death_year } = personRes.rows[0];
    if (birth_year != null && death_year != null) {
      if (year < Number(birth_year) || year > Number(death_year)) {
        throw errors.badRequest(`Год достижения (${year}) должен входить в годы жизни Личности (${birth_year}–${death_year})`)
      }
    }
    const role = (req as any).user?.role || 'user'
    let result
    
    if (saveAsDraft) {
      // Сохранение как черновик
      result = await pool.query(
        `INSERT INTO achievements (person_id, year, description, wikipedia_url, image_url, status, created_by, is_draft, draft_saved_at, last_edited_at)
         VALUES ($1, $2, btrim($3), $4, $5, 'draft', $6, true, NOW(), NOW())
         RETURNING *`,
        [id, year, description, wikipedia_url ?? null, image_url ?? null, (req as any).user!.sub]
      );
    } else if (role === 'admin' || role === 'moderator') {
      result = await pool.query(
        `INSERT INTO achievements (person_id, year, description, wikipedia_url, image_url, status, created_by)
         VALUES ($1, $2, btrim($3), $4, $5, 'approved', $6)
         ON CONFLICT (person_id, year, lower(btrim(description)))
         WHERE person_id IS NOT NULL
         DO UPDATE SET wikipedia_url = EXCLUDED.wikipedia_url, image_url = EXCLUDED.image_url
         RETURNING *`,
        [id, year, description, wikipedia_url ?? null, image_url ?? null, (req as any).user!.sub]
      );
    } else {
      // Обычные пользователи с подтверждённой почтой создают достижения в статусе pending
      result = await pool.query(
        `INSERT INTO achievements (person_id, year, description, wikipedia_url, image_url, status, created_by, submitted_at)
         VALUES ($1, $2, btrim($3), $4, $5, 'pending', $6, NOW())
         RETURNING *`,
        [id, year, description, wikipedia_url ?? null, image_url ?? null, (req as any).user!.sub]
      );
    }
    res.status(201).json({ success: true, data: result.rows[0] });
  }))

  // Update achievement (for drafts or own achievements)
  router.put('/achievements/:id', authenticateToken, requireVerifiedEmail, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { year, description, wikipedia_url, image_url } = req.body || {};
    
    // Проверяем, что достижение принадлежит пользователю или является черновиком
    const achievementRes = await pool.query(
      'SELECT created_by, is_draft, status FROM achievements WHERE id = $1',
      [id]
    );
    
    if (achievementRes.rowCount === 0) {
      throw errors.notFound('Достижение не найдено')
    }
    
    const achievement = achievementRes.rows[0];
    const userId = (req as any).user!.sub;
    
    if (achievement.created_by !== userId && achievement.status !== 'draft') {
      throw errors.forbidden('Нет прав для редактирования этого достижения')
    }
    
    // Обновляем достижение
    const result = await pool.query(
      `UPDATE achievements 
       SET year = COALESCE($2, year), 
           description = COALESCE($3, description), 
           wikipedia_url = $4, 
           image_url = $5,
           last_edited_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, year, description, wikipedia_url ?? null, image_url ?? null]
    );
    
    res.json({ success: true, data: result.rows[0] });
  }))

  // Submit draft for moderation
  router.post('/achievements/:id/submit', authenticateToken, requireVerifiedEmail, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    
    // Проверяем, что достижение является черновиком и принадлежит пользователю
    const achievementRes = await pool.query(
      'SELECT created_by, is_draft, status FROM achievements WHERE id = $1',
      [id]
    );
    
    if (achievementRes.rowCount === 0) {
      throw errors.notFound('Достижение не найдено')
    }
    
    const achievement = achievementRes.rows[0];
    const userId = (req as any).user!.sub;
    
    if (achievement.created_by !== userId) {
      throw errors.forbidden('Нет прав для отправки этого достижения')
    }
    
    if (achievement.status !== 'draft') {
      throw errors.badRequest('Можно отправлять на модерацию только черновики')
    }
    
    // Отправляем на модерацию
    const result = await pool.query(
      `UPDATE achievements 
       SET status = 'pending', 
           is_draft = false, 
           submitted_at = NOW(),
           last_edited_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    
    res.json({ success: true, data: result.rows[0] });
  }))

  // Get user's drafts
  router.get('/achievements/drafts', authenticateToken, asyncHandler(async (req: any, res: any) => {
    const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 200, maxLimit: 500 });
    const countOnly = String(req.query.count || 'false') === 'true';
    
    if (countOnly) {
      const cRes = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM achievements WHERE created_by = $1 AND is_draft = true`, 
        [(req as any).user!.sub]
      );
      res.json({ success: true, data: { count: cRes.rows[0]?.cnt || 0 } });
      return;
    }
    
    const sql = `
      SELECT a.id,
             a.person_id,
             a.country_id,
             a.year,
             a.description,
             a.wikipedia_url,
             a.image_url,
             a.status,
             a.draft_saved_at,
             a.last_edited_at,
             COALESCE(
               CASE WHEN a.country_id IS NOT NULL THEN c.name
                    WHEN a.person_id IS NOT NULL THEN p.name
                    ELSE NULL END,
               ''
             ) AS title
        FROM achievements a
        LEFT JOIN persons   p ON p.id = a.person_id
        LEFT JOIN countries c ON c.id = a.country_id
       WHERE a.created_by = $1 AND a.is_draft = true
       ORDER BY a.last_edited_at DESC NULLS LAST, a.id DESC
       LIMIT $2 OFFSET $3`;
    
    const result = await pool.query(sql, [(req as any).user!.sub, limitParam + 1, offsetParam]);
    const rows = result.rows;
    const { data, meta } = paginateRows(rows, limitParam, offsetParam);
    res.json({ success: true, data, meta });
  }))

  // Lookup achievements by ids
  router.get('/achievements/lookup/by-ids', asyncHandler(async (req: any, res: any) => {
    const raw = (req.query.ids || '').toString().trim();
    if (!raw) { res.json({ success: true, data: [] }); return; }
    const ids = raw.split(',').map((s: string) => parseInt(s, 10)).filter((n: number) => Number.isInteger(n));
    if (ids.length === 0) { res.json({ success: true, data: [] }); return; }
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
  }))

  // Admin/Moderator: review achievement (approve / reject)
  router.post('/admin/achievements/:id/review', authenticateToken, requireRoleMiddleware(['moderator', 'admin']), asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { action, comment } = req.body || {}; // action: 'approve' | 'reject'
    if (!id || !action) {
      throw errors.badRequest('id и action обязательны')
    }
    if (action === 'approve') {
      await pool.query(
        `UPDATE achievements SET status='approved', reviewed_at=NOW(), reviewed_by=$2, review_comment=$3 WHERE id=$1`,
        [id, (req as any).user!.sub, comment ?? null]
      );
    } else if (action === 'reject') {
      await pool.query(
        `UPDATE achievements SET status='rejected', reviewed_at=NOW(), reviewed_by=$2, review_comment=$3 WHERE id=$1`,
        [id, (req as any).user!.sub, comment ?? null]
      );
    } else {
      throw errors.badRequest('action должен быть approve или reject')
    }
    res.json({ success: true });
  }))

  return router
}


