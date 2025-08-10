import { Router } from 'express';
import { Pool } from 'pg';
import { authenticateToken, requireRoleMiddleware } from '../middleware/auth';

export function createPersonRoutes(pool: Pool) {
  const router = Router();

  const allowedPersonFields = new Set([
    'name', 'birthYear', 'deathYear', 'category', 'country', 'description', 'imageUrl', 'wikiLink'
  ]);

  function sanitizePayload(raw: any) {
    const out: any = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const key of Object.keys(raw)) {
      if (allowedPersonFields.has(key)) {
        out[key] = raw[key];
      }
    }
    return out;
  }

  async function applyPayloadToPerson(id: string, payload: any, reviewerUserId: number) {
    // Map camelCase -> snake_case
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    const mapping: Record<string, string> = {
      name: 'name',
      birthYear: 'birth_year',
      deathYear: 'death_year',
      category: 'category',
      country: 'country',
      description: 'description',
      imageUrl: 'image_url',
      wikiLink: 'wiki_link',
    };
    for (const [k, v] of Object.entries(payload)) {
      const column = mapping[k as keyof typeof mapping];
      if (!column) continue;
      fields.push(`${column} = $${idx++}`);
      values.push(v);
    }
    // Always update audit/status on approve
    fields.push(`status = 'approved'`);
    fields.push(`updated_by = $${idx++}`);
    fields.push(`reviewed_at = NOW()`);
    fields.push(`reviewed_by = $${idx++}`);
    values.push(reviewerUserId, reviewerUserId);
    const sql = `UPDATE persons SET ${fields.join(', ')} WHERE id = $${idx}`;
    values.push(id);
    await pool.query(sql, values);
  }

  // Admin/Moderator: create or upsert person immediately (approved)
  router.post('/admin/persons', authenticateToken, requireRoleMiddleware(['admin', 'moderator']), async (req, res) => {
    try {
      const { id, name, birthYear, deathYear, category, country, description, imageUrl, wikiLink } = req.body || {};
      if (!id || !name || !birthYear || !deathYear || !category || !country || !description) {
        res.status(400).json({ success: false, message: 'id, name, birthYear, deathYear, category, country, description обязательны' });
        return;
      }
      await pool.query(
        `INSERT INTO persons (id, name, birth_year, death_year, category, country, description, image_url, wiki_link, status, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved',$10,$10)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name,
           birth_year=EXCLUDED.birth_year,
           death_year=EXCLUDED.death_year,
           category=EXCLUDED.category,
           country=EXCLUDED.country,
           description=EXCLUDED.description,
           image_url=EXCLUDED.image_url,
           wiki_link=EXCLUDED.wiki_link,
           status='approved',
           updated_by=$10,
           reviewed_at=NOW(),
           reviewed_by=$10`,
        [id, name, birthYear, deathYear, category, country, description, imageUrl ?? null, wikiLink ?? null, req.user!.userId]
      );
      res.json({ success: true });
    } catch (e) {
      console.error('admin upsert person failed', e);
      res.status(500).json({ success: false, message: 'Ошибка при сохранении персоны' });
    }
  });

  // User: propose person (pending review)
  router.post('/persons/propose', authenticateToken, async (req, res) => {
    try {
      const { id, name, birthYear, deathYear, category, country, description, imageUrl, wikiLink } = req.body || {};
      if (!id || !name || !birthYear || !deathYear || !category || !country || !description) {
        res.status(400).json({ success: false, message: 'id, name, birthYear, deathYear, category, country, description обязательны' });
        return;
      }
      // создаем запись/обновляем как pending
      await pool.query(
        `INSERT INTO persons (id, name, birth_year, death_year, category, country, description, image_url, wiki_link, status, created_by, updated_by, submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$10,NOW())
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name,
           birth_year=EXCLUDED.birth_year,
           death_year=EXCLUDED.death_year,
           category=EXCLUDED.category,
           country=EXCLUDED.country,
           description=EXCLUDED.description,
           image_url=EXCLUDED.image_url,
           wiki_link=EXCLUDED.wiki_link,
           status='pending',
           updated_by=$10,
           submitted_at=NOW()`,
        [id, name, birthYear, deathYear, category, country, description, imageUrl ?? null, wikiLink ?? null, req.user!.userId]
      );
      res.json({ success: true });
    } catch (e) {
      console.error('propose person failed', e);
      res.status(500).json({ success: false, message: 'Ошибка при предложении персоны' });
    }
  });

  // Admin/Moderator: review person (approve / reject)
  router.post('/admin/persons/:id/review', authenticateToken, requireRoleMiddleware(['admin', 'moderator']), async (req, res) => {
    try {
      const { id } = req.params;
      const { action, comment } = req.body || {}; // action: 'approve' | 'reject'
      if (!id || !action) {
        res.status(400).json({ success: false, message: 'id и action обязательны' });
        return;
      }
      if (action === 'approve') {
        await pool.query(
          `UPDATE persons SET status='approved', reviewed_at=NOW(), reviewed_by=$2, review_comment=$3 WHERE id=$1`,
          [id, req.user!.userId, comment ?? null]
        );
      } else if (action === 'reject') {
        await pool.query(
          `UPDATE persons SET status='rejected', reviewed_at=NOW(), reviewed_by=$2, review_comment=$3 WHERE id=$1`,
          [id, req.user!.userId, comment ?? null]
        );
      } else {
        res.status(400).json({ success: false, message: 'action должен быть approve или reject' });
        return;
      }
      res.json({ success: true });
    } catch (e) {
      console.error('review person failed', e);
      res.status(500).json({ success: false, message: 'Ошибка при модерации персоны' });
    }
  });

  // User: propose an edit (diff payload) for an existing person
  router.post('/persons/:id/edits', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const rawPayload = req.body?.payload;
      if (!id || !rawPayload || typeof rawPayload !== 'object') {
        res.status(400).json({ success: false, message: 'person id и payload обязательны' });
        return;
      }
      const payload = sanitizePayload(rawPayload);
      const result = await pool.query(
        `INSERT INTO person_edits (person_id, proposer_user_id, payload, status)
         VALUES ($1,$2,$3,'pending') RETURNING id, created_at`,
        [id, (req as any).user!.userId, payload]
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (e) {
      console.error('propose edit failed', e);
      res.status(500).json({ success: false, message: 'Ошибка при создании правки' });
    }
  });

  // Admin/Moderator: list pending persons
  router.get('/admin/persons/pending', authenticateToken, requireRoleMiddleware(['admin', 'moderator']), async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, name, birth_year, death_year, category, country, submitted_at, created_by, updated_by, review_comment
           FROM persons WHERE status='pending' ORDER BY submitted_at DESC NULLS LAST`
      );
      res.json({ success: true, data: result.rows });
    } catch (e) {
      console.error('list pending persons failed', e);
      res.status(500).json({ success: false, message: 'Ошибка при получении списка' });
    }
  });

  // Admin/Moderator: list pending edits
  router.get('/admin/persons/edits/pending', authenticateToken, requireRoleMiddleware(['admin', 'moderator']), async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT pe.id, pe.person_id, p.name, pe.proposer_user_id, pe.payload, pe.created_at
           FROM person_edits pe
           LEFT JOIN persons p ON p.id = pe.person_id
          WHERE pe.status='pending'
          ORDER BY pe.created_at DESC`
      );
      res.json({ success: true, data: result.rows });
    } catch (e) {
      console.error('list pending edits failed', e);
      res.status(500).json({ success: false, message: 'Ошибка при получении правок' });
    }
  });

  // Admin/Moderator: review an edit (approve applies payload to person)
  router.post('/admin/persons/edits/:editId/review', authenticateToken, requireRoleMiddleware(['admin', 'moderator']), async (req, res) => {
    try {
      const { editId } = req.params;
      const { action, comment } = req.body || {};
      if (!editId || !action) {
        res.status(400).json({ success: false, message: 'editId и action обязательны' });
        return;
      }
      const editRes = await pool.query(`SELECT * FROM person_edits WHERE id=$1`, [editId]);
      if (editRes.rowCount === 0) {
        res.status(404).json({ success: false, message: 'Правка не найдена' });
        return;
      }
      const edit = editRes.rows[0];

      if (action === 'approve') {
        await applyPayloadToPerson(edit.person_id, edit.payload, (req as any).user!.userId);
        await pool.query(
          `UPDATE person_edits SET status='approved', reviewed_at=NOW(), reviewed_by=$2, review_comment=$3 WHERE id=$1`,
          [editId, (req as any).user!.userId, comment ?? null]
        );
      } else if (action === 'reject') {
        await pool.query(
          `UPDATE person_edits SET status='rejected', reviewed_at=NOW(), reviewed_by=$2, review_comment=$3 WHERE id=$1`,
          [editId, (req as any).user!.userId, comment ?? null]
        );
      } else {
        res.status(400).json({ success: false, message: 'action должен быть approve или reject' });
        return;
      }
      res.json({ success: true });
    } catch (e) {
      console.error('review edit failed', e);
      res.status(500).json({ success: false, message: 'Ошибка при модерации правки' });
    }
  });

  // User: list own edits for a person
  router.get('/persons/:id/edits', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT id, status, created_at, reviewed_at, review_comment
           FROM person_edits WHERE person_id=$1 AND proposer_user_id=$2 ORDER BY created_at DESC`,
        [id, (req as any).user!.userId]
      );
      res.json({ success: true, data: result.rows });
    } catch (e) {
      console.error('list own edits failed', e);
      res.status(500).json({ success: false, message: 'Ошибка при получении правок' });
    }
  });

  return router;
}


