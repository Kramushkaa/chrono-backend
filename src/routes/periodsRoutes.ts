import { Router } from 'express'
import { Pool } from 'pg'
import { asyncHandler } from '../utils/errors'
import { paginateRows, parseLimitOffset } from '../utils/api'

export function createPeriodsRoutes(pool: Pool): Router {
  const router = Router()

  // Public periods list
  router.get('/periods', asyncHandler(async (req: any, res: any) => {
    const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 200, maxLimit: 500 });
    const type = (req.query.type || '').toString().trim().toLowerCase();
    const q = (req.query.q || '').toString().trim();
    const personId = (req.query.person_id || '').toString().trim();
    const countryIdNum = parseInt((req.query.country_id as string) || '');
    const yearFromNum = parseInt((req.query.year_from as string) || '');
    const yearToNum = parseInt((req.query.year_to as string) || '');
    const params: any[] = [];
    let where = ` WHERE pr.status = 'approved'`;
    if (type === 'life' || type === 'ruler') { where += ` AND pr.period_type = $${params.length + 1}`; params.push(type); }
    if (q.length > 0) { where += ` AND (p.name ILIKE $${params.length + 1} OR c.name ILIKE $${params.length + 1})`; params.push(`%${q}%`); }
    if (personId.length > 0) { where += ` AND pr.person_id = $${params.length + 1}`; params.push(personId); }
    if (Number.isInteger(countryIdNum)) { where += ` AND pr.country_id = $${params.length + 1}`; params.push(countryIdNum); }
    if (Number.isInteger(yearFromNum)) { where += ` AND pr.start_year >= $${params.length + 1}`; params.push(yearFromNum); }
    if (Number.isInteger(yearToNum)) { where += ` AND pr.end_year <= $${params.length + 1}`; params.push(yearToNum); }
    params.push(limitParam + 1, offsetParam);
    const sql = `
      SELECT pr.id,
             pr.person_id,
             pr.country_id,
             pr.start_year,
             pr.end_year,
             pr.period_type,
             p.name  AS person_name,
             c.name  AS country_name
        FROM periods pr
        LEFT JOIN persons   p ON p.id = pr.person_id
        LEFT JOIN countries c ON c.id = pr.country_id
       ${where}
       ORDER BY pr.start_year ASC, pr.id ASC
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


