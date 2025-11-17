import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { asyncHandler } from '../utils/errors';
import { DTO_VERSION as DTO_VERSION_BE } from '@chrononinja/dto';
import { cache } from '../utils/cache';
import { rateLimit } from '../middleware/auth';

export function createMetaRoutes(pool: Pool): Router {
  const router = Router();
  const DEFAULT_TTL = 5 * 60 * 1000;
  const STATS_TTL = 2 * 60 * 1000;
  const DTO_HEADER = 'X-DTO-Version';

  const applyCacheHeaders = (res: Response, ttlMs: number, etag?: string) => {
    res.setHeader('Cache-Control', `public, max-age=${Math.floor(ttlMs / 1000)}`);
    res.setHeader(DTO_HEADER, DTO_VERSION_BE);
    if (etag) {
      res.setHeader('ETag', etag);
    }
  };

  const isNotModified = (req: Request, etag?: string): boolean => {
    if (!etag) return false;
    const header = req.headers['if-none-match'];
    if (!header) return false;
    const values = Array.isArray(header) ? header : header.split(',');
    return values.map(v => v.trim()).some(value => value === etag);
  };

  const respondWithCache = async <T>(
    req: Request,
    res: Response,
    key: string,
    ttlMs: number,
    fallback: () => Promise<T>
  ) => {
    const cached = cache.getEntry<{ success: boolean; data: T }>(key);
    if (cached) {
      if (isNotModified(req, cached.metadata?.etag)) {
        applyCacheHeaders(res, cached.metadata?.ttlMs ?? ttlMs, cached.metadata?.etag);
        res.status(304).end();
        return;
      }

      applyCacheHeaders(res, cached.metadata?.ttlMs ?? ttlMs, cached.metadata?.etag);
      res.json(cached.value);
      return;
    }

    const data = await fallback();
    const response = { success: true, data };
    const etag = cache.computeEtag(response);
    cache.set(key, response, ttlMs, {
      etag,
      generatedAt: new Date().toISOString(),
    });
    applyCacheHeaders(res, ttlMs, etag);
    res.json(response);
  };

  // Health endpoint - no rate limiting for load balancer checks
  router.get(
    '/health',
    asyncHandler(async (_req: Request, res: Response) => {
      res.setHeader(DTO_HEADER, DTO_VERSION_BE);
      res.json({
        success: true,
        data: {
          message: 'Хронониндзя API работает',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    })
  );

  // DTO version - no rate limiting
  router.get(
    '/dto-version',
    asyncHandler(async (_req: Request, res: Response) => {
      res.setHeader(DTO_HEADER, DTO_VERSION_BE);
      res.json({ success: true, data: { version: DTO_VERSION_BE } });
    })
  );

  // Rate limiting for metadata endpoints: 1000 requests per 15 minutes
  // This protects against abuse while being liberal for public data
  router.use(rateLimit(15 * 60 * 1000, 1000));

  // Categories (only from approved persons for public filters)
  router.get(
    '/categories',
    asyncHandler(async (req: Request, res: Response) =>
      respondWithCache<string[]>(req, res, 'categories', DEFAULT_TTL, async () => {
          const query = `
        SELECT DISTINCT category 
          FROM persons 
         WHERE category IS NOT NULL 
           AND status = 'approved'
         ORDER BY category`;
          const result = await pool.query(query);
          return result.rows.map(row => row.category);
        })
    )
  );

  // Countries (names only - from approved persons)
  router.get(
    '/countries',
    asyncHandler(async (req: Request, res: Response) =>
      respondWithCache<string[]>(req, res, 'countries', DEFAULT_TTL, async () => {
          const result = await pool.query('SELECT name FROM v_countries ORDER BY name');
          return result.rows.map(r => r.name);
        })
    )
  );

  // Country options (id + name)
  router.get(
    '/countries/options',
    asyncHandler(async (req: Request, res: Response) =>
      respondWithCache<{ id: number; name: string }[]>(req, res, 'countries_options', DEFAULT_TTL, async () => {
          const result = await pool.query('SELECT id, name FROM countries ORDER BY name');
          return result.rows;
        })
    )
  );

  // Stats (only approved persons for public statistics)
  router.get(
    '/stats',
    asyncHandler(async (req: Request, res: Response) =>
      respondWithCache(req, res, 'stats', STATS_TTL, async () => {
          const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_persons,
        MIN(birth_year) as earliest_birth,
        MAX(death_year) as latest_death,
        COUNT(DISTINCT category) as unique_categories,
        (SELECT COUNT(*) FROM v_countries) as unique_countries
      FROM persons
      WHERE status = 'approved'`);
          const categoryStatsResult = await pool.query(`
      SELECT category, COUNT(*) as count
        FROM persons
       WHERE status = 'approved'
       GROUP BY category
       ORDER BY count DESC`);
          const countryStatsResult = await pool.query(`
      SELECT name AS country, persons_with_periods AS count
        FROM v_country_stats
       ORDER BY count DESC`);
          return {
            overview: statsResult.rows[0],
            categories: categoryStatsResult.rows,
            countries: countryStatsResult.rows,
          };
        })
    )
  );

  router.get(
    '/cache/stats',
    asyncHandler(async (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, data: cache.getStats() });
    })
  );

  // Cache management endpoint (для разработки)
  router.post(
    '/cache/clear',
    asyncHandler(async (_req: Request, res: Response) => {
      cache.clearAll();
      res.json({ success: true, message: 'Cache cleared' });
    })
  );

  return router;
}
