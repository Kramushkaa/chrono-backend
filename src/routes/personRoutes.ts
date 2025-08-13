import { Router, Request, Response } from 'express';
import { z } from 'zod'
import { UpsertPersonSchema, LifePeriodsSchema, PersonEditPayloadSchema, AchievementGenericSchema } from '../dto'
import { Pool } from 'pg';
import { authenticateToken, requireRoleMiddleware } from '../middleware/auth';
import { ApiError, errors, mapPgError, asyncHandler } from '../utils/errors';

export function createPersonRoutes(pool: Pool) {
  const router = Router();


  const allowedPersonFields = new Set([
    'name', 'birthYear', 'deathYear', 'category', 'description', 'imageUrl', 'wikiLink'
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
  router.post('/admin/persons', authenticateToken, requireRoleMiddleware(['admin', 'moderator']), asyncHandler(async (req: Request, res: Response) => {
      const parsed = UpsertPersonSchema.safeParse(req.body || {})
      if (!parsed.success) throw errors.badRequest('Некорректные данные персоны', 'validation_error', parsed.error.flatten())
      const { id, name, birthYear, deathYear, category, description, imageUrl, wikiLink } = parsed.data
      await pool.query(
      `INSERT INTO persons (id, name, birth_year, death_year, category, description, image_url, wiki_link, status, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'approved',$9,$9)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name,
           birth_year=EXCLUDED.birth_year,
           death_year=EXCLUDED.death_year,
           category=EXCLUDED.category,
           description=EXCLUDED.description,
           image_url=EXCLUDED.image_url,
           wiki_link=EXCLUDED.wiki_link,
           status='approved',
         updated_by=$9,
           reviewed_at=NOW(),
         reviewed_by=$9`,
      [id, name.trim(), Number(birthYear), Number(deathYear), category.trim(), (typeof description === 'string' ? description : ''), imageUrl ?? null, wikiLink ?? null, (req as any).user!.sub]
      );
      res.json({ success: true });
  }))

  // User: propose person (pending review)
  router.post('/persons/propose', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
      const parsed = UpsertPersonSchema.safeParse(req.body || {})
      if (!parsed.success) throw errors.badRequest('Некорректные данные персоны', 'validation_error', parsed.error.flatten())
      const { id, name, birthYear, deathYear, category, description, imageUrl, wikiLink } = parsed.data
    // создаем запись/обновляем как pending
      await pool.query(
      `INSERT INTO persons (id, name, birth_year, death_year, category, description, image_url, wiki_link, status, created_by, updated_by, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$9,NOW())
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name,
           birth_year=EXCLUDED.birth_year,
           death_year=EXCLUDED.death_year,
           category=EXCLUDED.category,
           description=EXCLUDED.description,
           image_url=EXCLUDED.image_url,
           wiki_link=EXCLUDED.wiki_link,
           status='pending',
         updated_by=$9,
           submitted_at=NOW()`,
      [id, name, birthYear, deathYear, category, description, imageUrl ?? null, wikiLink ?? null, (req as any).user!.sub]
      );
      res.json({ success: true });
  }))

  // Admin/Moderator: review person (approve / reject)
  router.post('/admin/persons/:id/review', authenticateToken, requireRoleMiddleware(['admin', 'moderator']), asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { action, comment } = req.body || {}; // action: 'approve' | 'reject'
      if (!id || !action) {
        throw errors.badRequest('id и action обязательны')
      }
      if (action === 'approve') {
        await pool.query(
          `UPDATE persons SET status='approved', reviewed_at=NOW(), reviewed_by=$2, review_comment=$3 WHERE id=$1`,
          [id, (req as any).user!.sub, comment ?? null]
        );
      } else if (action === 'reject') {
        await pool.query(
          `UPDATE persons SET status='rejected', reviewed_at=NOW(), reviewed_by=$2, review_comment=$3 WHERE id=$1`,
          [id, (req as any).user!.sub, comment ?? null]
        );
      } else {
        throw errors.badRequest('action должен быть approve или reject')
      }
      res.json({ success: true });
  }))

  // User: propose an edit (diff payload) for an existing person
  router.post('/persons/:id/edits', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const rawPayload = req.body?.payload;
      if (!id || !rawPayload || typeof rawPayload !== 'object') {
        throw errors.badRequest('person id и payload обязательны')
      }
      const payload = sanitizePayload(rawPayload);
      const parsed = PersonEditPayloadSchema.safeParse(payload)
      if (!parsed.success) throw errors.badRequest('Некорректные данные правки', 'validation_error', parsed.error.flatten())
      const result = await pool.query(
        `INSERT INTO person_edits (person_id, proposer_user_id, payload, status)
         VALUES ($1,$2,$3,'pending') RETURNING id, created_at`,
        [id, (req as any).user!.sub, payload]
      );
      res.status(201).json({ success: true, data: result.rows[0] });
  }))

  // Removed legacy admin/persons pending & edits review routes (replaced by /api/admin/persons/moderation)

  // (removed) Public achievements listing is defined centrally in server.ts as /api/achievements

  // Admin/Moderator: create achievement not bound to person (global or by country)

  router.post('/achievements', authenticateToken, requireRoleMiddleware(['admin', 'moderator']), asyncHandler(async (req: Request, res: Response) => {
      const parsed = AchievementGenericSchema.safeParse(req.body || {})
      if (!parsed.success) throw errors.badRequest('Некорректные данные достижения', 'validation_error', parsed.error.flatten())
      const { year, description, wikipedia_url, image_url, country_id } = parsed.data
      // Insert with optional country_id and denormalized country name for tiles
      const sql = `
        INSERT INTO achievements (person_id, country_id, year, description, wikipedia_url, image_url, country)
        VALUES (NULL, $1, $2, btrim($3), $4, $5,
                CASE WHEN $1 IS NULL THEN NULL ELSE (SELECT name FROM countries WHERE id = $1) END)
        ON CONFLICT (country_id, year, lower(btrim(description)))
        WHERE country_id IS NOT NULL AND person_id IS NULL
        DO UPDATE SET wikipedia_url = EXCLUDED.wikipedia_url, image_url = EXCLUDED.image_url, country = EXCLUDED.country
        RETURNING *
      `;
      const params = [country_id ?? null, year, description, wikipedia_url ?? null, image_url ?? null];
      const result = await pool.query(sql, params);
      res.status(201).json({ success: true, data: result.rows[0] });
  }))

  // Admin/Moderator: replace person's life country periods
  router.post('/persons/:id/life-periods', authenticateToken, requireRoleMiddleware(['admin', 'moderator']), asyncHandler(async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params as any;
      const parsed = LifePeriodsSchema.safeParse(req.body || {})
      if (!parsed.success) throw errors.badRequest('Некорректные периоды', 'validation_error', parsed.error.flatten())
      const periods: Array<{ country_id: number; start_year: number; end_year: number; period_type?: string }> = parsed.data.periods
      const personRes = await client.query('SELECT birth_year, death_year FROM persons WHERE id=$1', [id]);
      if (personRes.rowCount === 0) {
        res.status(404).json({ success: false, message: 'Персона не найдена' });
        return;
      }
      const birth: number = Number(personRes.rows[0].birth_year);
      const death: number = Number(personRes.rows[0].death_year);
      if (!Number.isInteger(birth) || !Number.isInteger(death) || birth > death) {
        res.status(400).json({ success: false, message: 'Некорректные годы жизни персоны' });
        return;
      }
      if (periods.length === 0) {
        res.status(400).json({ success: false, message: 'Нужно передать хотя бы одну страну' });
        return;
      }
      // Normalize: when only one country, fill full lifespan
      let norm = periods.map(p => ({ country_id: Number(p.country_id), start_year: Number(p.start_year), end_year: Number(p.end_year) }));
      if (norm.length === 1) {
        norm[0].start_year = birth;
        norm[0].end_year = death;
      }
      // Validate countries and years
      for (const p of norm) {
        if (!Number.isInteger(p.country_id) || p.country_id <= 0) {
          res.status(400).json({ success: false, message: 'Некорректная страна' });
          return;
        }
        if (!Number.isInteger(p.start_year) || !Number.isInteger(p.end_year) || p.start_year > p.end_year) {
          res.status(400).json({ success: false, message: 'Некорректный период проживания' });
          return;
        }
      }
      // Sort by start_year
      norm.sort((a, b) => a.start_year - b.start_year || a.end_year - b.end_year);
      // Check coverage and overlap (no overlaps allowed)
      if (norm[0].start_year > birth || norm[norm.length - 1].end_year < death) {
        res.status(400).json({ success: false, message: 'Периоды должны покрывать все годы жизни' });
        return;
      }
      for (let i = 1; i < norm.length; i++) {
        const prev = norm[i - 1];
        const cur = norm[i];
        // Allow shared boundary, forbid overlap
        if (cur.start_year < prev.end_year) {
          res.status(400).json({ success: false, message: 'Периоды стран не должны пересекаться' });
          return;
        }
        // Ensure no gaps in coverage
        if (cur.start_year > prev.end_year + 1) {
          res.status(400).json({ success: false, message: 'Периоды стран должны покрывать все годы жизни без пропусков' });
          return;
        }
      }
      await client.query('BEGIN');
      const role = (req as any).user?.role || 'user';
      if (role === 'admin' || role === 'moderator') {
        await client.query(`DELETE FROM periods WHERE person_id = $1 AND period_type = 'life'`, [id]);
        for (const p of norm) {
          await client.query(
            `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, comment, status, created_by)
             VALUES ($1, $2, $3, 'life', $4, NULL, 'approved', $5)`,
            [id, p.start_year, p.end_year, p.country_id, (req as any).user!.sub]
          );
        }
      } else {
        for (const p of norm) {
          await client.query(
            `INSERT INTO periods (person_id, start_year, end_year, period_type, country_id, comment, status, created_by, submitted_at)
             VALUES ($1, $2, $3, 'life', $4, NULL, 'pending', $5, NOW())`,
            [id, p.start_year, p.end_year, p.country_id, (req as any).user!.sub]
          );
        }
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (e: any) {
      await (pool as any).query?.('ROLLBACK').catch(() => {});
      const mapped = mapPgError(e)
      if (mapped) throw mapped
      throw e
    } finally {
      client.release();
    }
  }))

  return router;
}


