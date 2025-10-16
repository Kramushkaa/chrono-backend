import { Router, Request, Response } from 'express';
import { UpsertPersonSchema } from '../../dto';
import { Pool } from 'pg';
import { authenticateToken, requireRoleMiddleware } from '../../middleware/auth';
import { errors, asyncHandler } from '../../utils/errors';
import { mapApiPersonRow, parseLimitOffset, paginateRows } from '../../utils/api';
import { TelegramService } from '../../services/telegramService';
import { PersonsService } from '../../services/personsService';
import { applyPayloadToPerson } from './helpers';

export function createAdminPersonRoutes(pool: Pool, telegramService: TelegramService, personsService: PersonsService) {
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
      const { id, name, birthYear, deathYear, category, description, imageUrl, wikiLink } =
        parsed.data;
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
         updated_by=$9`,
        [
          id,
          name.trim(),
          Number(birthYear),
          Number(deathYear),
          category.trim(),
          typeof description === 'string' ? description : '',
          imageUrl ?? null,
          wikiLink ?? null,
          (req as any).user!.sub,
        ]
      );

      // Отправка уведомления в Telegram о создании личности модератором (неблокирующее)
      const userEmail = (req as any).user?.email || 'unknown';
      telegramService
        .notifyPersonCreated(name.trim(), userEmail, 'approved', id)
        .catch(err => console.warn('Telegram notification failed (admin person created):', err));

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
      const sql = `SELECT * FROM v_pending_moderation${whereClause} ORDER BY created_at DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
      const { id } = req.params;
      const { action, comment } = req.body || {}; // action: 'approve' | 'reject'
      if (!id || !action) {
        throw errors.badRequest('id и action обязательны');
      }

      // Получаем информацию о личности для уведомления
      const personRes = await pool.query('SELECT name FROM persons WHERE id = $1', [id]);
      const personName = personRes.rows[0]?.name || 'Unknown';

      if (action === 'approve') {
        await pool.query(
          `UPDATE persons SET status='approved', reviewed_by=$2, review_comment=$3 WHERE id=$1`,
          [id, (req as any).user!.sub, comment ?? null]
        );
      } else if (action === 'reject') {
        await pool.query(
          `UPDATE persons SET status='rejected', reviewed_by=$2, review_comment=$3 WHERE id=$1`,
          [id, (req as any).user!.sub, comment ?? null]
        );
      } else {
        throw errors.badRequest('action должен быть approve или reject');
      }

      // Отправка уведомления в Telegram о решении модератора (неблокирующее)
      const reviewerEmail = (req as any).user?.email || 'unknown';
      telegramService
        .notifyPersonReviewed(personName, action, reviewerEmail, id)
        .catch(err => console.warn('Telegram notification failed (person reviewed):', err));

      res.json({ success: true });
    })
  );

  return router;
}
