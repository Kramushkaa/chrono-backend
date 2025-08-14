import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { Pool } from 'pg'
import { authenticateToken } from '../middleware/auth'
import { asyncHandler, errors } from '../utils/errors'

export function createListsRoutes(pool: Pool): Router {
  const router = Router()

  // Create a share token for a list (owner only)
  router.post('/lists/:listId/share', authenticateToken, asyncHandler(async (req: any, res: any) => {
    const userId = req.user?.sub;
    const { listId } = req.params;
    const own = await pool.query('SELECT owner_user_id, title FROM lists WHERE id = $1', [listId]);
    if (own.rowCount === 0) throw errors.notFound('Список не найден');
    if (own.rows[0].owner_user_id !== userId) throw errors.forbidden('Нет прав на публикацию списка');
    const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-secret';
    const code = jwt.sign({ listId: Number(listId), owner: String(userId) }, secret, { expiresIn: '365d' });
    res.json({ success: true, data: { code } });
  }))

  // Resolve a share token to list metadata and items (no auth required)
  router.get('/list-shares/:code', asyncHandler(async (req: any, res: any) => {
    const { code } = req.params;
    const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-secret';
    try {
      const payload: any = jwt.verify(code, secret);
      const listId = Number(payload.listId);
      if (!Number.isFinite(listId) || listId <= 0) throw new Error('bad list');
      const listRow = await pool.query('SELECT id, owner_user_id, title FROM lists WHERE id = $1', [listId]);
      if (listRow.rowCount === 0) throw errors.notFound('Список не найден');
      const items = await pool.query('SELECT id, list_id, item_type, person_id, achievement_id, period_id, position FROM list_items WHERE list_id = $1 ORDER BY position ASC, id ASC', [listId]);
      res.json({ success: true, data: { list_id: listId, owner_user_id: listRow.rows[0].owner_user_id, title: listRow.rows[0].title, items: items.rows } });
    } catch (e) {
      res.status(400).json({ success: false, message: 'invalid_share_code' });
    }
  }))

  // Get all lists for current user
  router.get('/lists', authenticateToken, asyncHandler(async (req: any, res: any) => {
    const userId = req.user?.sub;
    const rows = await pool.query(
      'SELECT id, owner_user_id, title, created_at, updated_at FROM lists WHERE owner_user_id = $1 ORDER BY id ASC',
      [userId]
    );
    const ids = rows.rows.map((r: any) => r.id);
    let counts: Record<number, number> = {};
    if (ids.length) {
      const inParams = ids.map((_: string | number, i: number) => `$${i + 1}`).join(',');
      const c = await pool.query(`SELECT list_id, COUNT(*)::int AS cnt FROM list_items WHERE list_id IN (${inParams}) GROUP BY list_id`, ids);
      counts = Object.fromEntries(c.rows.map((r: any) => [r.list_id, r.cnt]));
    }
    const data = rows.rows.map((r: any) => ({ id: r.id, title: r.title, items_count: counts[r.id] || 0 }));
    res.json({ success: true, data });
  }))

  // Create list
  router.post('/lists', authenticateToken, asyncHandler(async (req: any, res: any) => {
    const userId = req.user?.sub;
    const { title } = req.body || {};
    const t = (title ?? '').toString().trim();
    if (t.length === 0) throw errors.badRequest('Название списка обязательно');
    if (t.length > 200) throw errors.badRequest('Название списка слишком длинное (макс. 200)');
    const result = await pool.query(
      'INSERT INTO lists (owner_user_id, title) VALUES ($1, $2) RETURNING id, title',
      [userId, t]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  }))

  // List items
  router.get('/lists/:listId/items', authenticateToken, asyncHandler(async (req: any, res: any) => {
    const { listId } = req.params;
    const own = await pool.query('SELECT 1 FROM lists WHERE id = $1 AND owner_user_id = $2', [listId, (req as any).user?.sub]);
    if (own.rowCount === 0) throw errors.forbidden('Нет прав на доступ к списку');
    const rows = await pool.query(
      'SELECT id, list_id, item_type, person_id, achievement_id, period_id, position, created_at FROM list_items WHERE list_id = $1 ORDER BY position ASC, id ASC',
      [listId]
    );
    res.json({ success: true, data: rows.rows });
  }))

  router.post('/lists/:listId/items', authenticateToken, asyncHandler(async (req: any, res: any) => {
    const { listId } = req.params;
    const { item_type, person_id, achievement_id, period_id } = req.body || {};
    const own = await pool.query('SELECT 1 FROM lists WHERE id = $1 AND owner_user_id = $2', [listId, (req as any).user?.sub]);
    if (own.rowCount === 0) throw errors.forbidden('Нет прав на изменение списка');
    if (!['person','achievement','period'].includes(item_type)) throw errors.badRequest('Некорректный тип элемента');
    if (item_type === 'person') {
      const r = await pool.query('SELECT 1 FROM persons WHERE id = $1', [person_id]);
      if (r.rowCount === 0) throw errors.notFound('Личность не найдена');
      const exists = await pool.query('SELECT id FROM list_items WHERE list_id=$1 AND item_type=$2 AND person_id=$3 LIMIT 1', [listId, 'person', person_id]);
      if ((exists && (exists as any).rowCount || 0) > 0) { res.status(200).json({ success: true, data: exists.rows[0], message: 'already_exists' }); return; }
    } else if (item_type === 'achievement') {
      const r = await pool.query('SELECT 1 FROM achievements WHERE id = $1', [achievement_id]);
      if (r.rowCount === 0) throw errors.notFound('Достижение не найдено');
      const exists = await pool.query('SELECT id FROM list_items WHERE list_id=$1 AND item_type=$2 AND achievement_id=$3 LIMIT 1', [listId, 'achievement', achievement_id]);
      if ((exists && (exists as any).rowCount || 0) > 0) { res.status(200).json({ success: true, data: exists.rows[0], message: 'already_exists' }); return; }
    } else if (item_type === 'period') {
      const r = await pool.query('SELECT 1 FROM periods WHERE id = $1', [period_id]);
      if (r.rowCount === 0) throw errors.notFound('Период не найден');
      const exists = await pool.query('SELECT id FROM list_items WHERE list_id=$1 AND item_type=$2 AND period_id=$3 LIMIT 1', [listId, 'period', period_id]);
      if ((exists && (exists as any).rowCount || 0) > 0) { res.status(200).json({ success: true, data: exists.rows[0], message: 'already_exists' }); return; }
    }
    const ins = await pool.query(
      'INSERT INTO list_items (list_id, item_type, person_id, achievement_id, period_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [listId, item_type, person_id ?? null, achievement_id ?? null, period_id ?? null]
    );
    res.status(201).json({ success: true, data: ins.rows[0] });
  }))

  router.delete('/lists/:listId/items/:itemId', authenticateToken, asyncHandler(async (req: any, res: any) => {
    const { listId, itemId } = req.params;
    const own = await pool.query('SELECT 1 FROM lists WHERE id = $1 AND owner_user_id = $2', [listId, (req as any).user?.sub]);
    if (own.rowCount === 0) throw errors.forbidden('Нет прав на изменение списка');
    await pool.query('DELETE FROM list_items WHERE id = $1 AND list_id = $2', [itemId, listId]);
    res.json({ success: true });
  }))

  // Delete list (only owner)
  router.delete('/lists/:listId', authenticateToken, asyncHandler(async (req: any, res: any) => {
    const userId = req.user?.sub;
    const { listId } = req.params;
    const own = await pool.query('SELECT 1 FROM lists WHERE id = $1 AND owner_user_id = $2', [listId, userId]);
    if (own.rowCount === 0) throw errors.forbidden('Нет прав на удаление списка');
    await pool.query('DELETE FROM list_items WHERE list_id = $1', [listId]);
    await pool.query('DELETE FROM lists WHERE id = $1 AND owner_user_id = $2', [listId, userId]);
    res.json({ success: true });
  }))

  // Copy list from a public share code into current user's account
  router.post('/lists/copy-from-share', authenticateToken, asyncHandler(async (req: any, res: any) => {
    const userId = req.user?.sub;
    const code = (req.body?.code || '').toString().trim();
    const newTitleRaw = (req.body?.title || '').toString();
    if (!code) throw errors.badRequest('Не указан код');
    const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-secret';
    let listId: number;
    try {
      const payload: any = jwt.verify(code, secret);
      listId = Number(payload.listId);
      if (!Number.isFinite(listId) || listId <= 0) throw new Error('bad list');
    } catch {
      throw errors.badRequest('Некорректный код');
    }
    const src = await pool.query('SELECT id, title FROM lists WHERE id = $1', [listId]);
    if (src.rowCount === 0) throw errors.notFound('Список не найден');
    const fallbackTitle = src.rows[0].title || 'Импортированный список';
    const t0 = newTitleRaw.trim();
    const newTitle = t0.length > 0 ? t0 : fallbackTitle;
    if (newTitle.length > 200) throw errors.badRequest('Название списка слишком длинное (макс. 200)');
    const ins = await pool.query('INSERT INTO lists (owner_user_id, title) VALUES ($1, $2) RETURNING id', [userId, newTitle]);
    const newListId = ins.rows[0].id;
    await pool.query(
      `INSERT INTO list_items (list_id, item_type, person_id, achievement_id, period_id, position)
       SELECT $1, item_type, person_id, achievement_id, period_id, position
         FROM list_items WHERE list_id = $2
       ORDER BY position ASC, id ASC`,
      [newListId, listId]
    );
    res.status(201).json({ success: true, data: { id: newListId, title: newTitle } });
  }))

  return router
}


