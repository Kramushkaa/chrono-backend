import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { AuthService } from './services/authService';
import { AuthController } from './controllers/authController';
import { createAuthRoutes } from './routes/authRoutes';
import { logRequest, errorHandler, authenticateToken, requireRoleMiddleware } from './middleware/auth';
import { z } from 'zod';
import { asyncHandler, errors } from './utils/errors';
import { DTO_VERSION as DTO_VERSION_BE } from './dtoDescriptors';
import { AchievementPersonSchema } from './dto';
import { validateConfig } from './config';
import { createPersonRoutes } from './routes/personRoutes';

// Загрузка переменных окружения
dotenv.config();
// Валидация обязательных настроек окружения
validateConfig();

// Конфигурация базы данных
const isLocal = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'chrononinja',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined as any,
});

// Создание сервисов и контроллеров
const authService = new AuthService(pool);
const authController = new AuthController(authService);

// Создание Express приложения
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// CORS: поддержка списка доменов (через запятую) и шаблонов вида *.chrono.ninja или голых доменов
const rawOrigins = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '*';
const allowedOriginPatterns = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

function isOriginAllowed(origin: string, patterns: string[]): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();

    for (const pat of patterns) {
      if (pat === '*') return true;
      if (pat.startsWith('http://') || pat.startsWith('https://')) {
        if (origin === pat) return true;
        continue;
      }
      // Голодомен или подстановочный *.domain
      const p = pat.toLowerCase();
      if (p.startsWith('*.')) {
        const base = p.slice(2);
        if (host === base || host.endsWith(`.${base}`)) return true;
      } else {
        if (host === p || host.endsWith(`.${p}`)) return true; // разрешаем и поддомены для голодомена
      }
    }
  } catch {}
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin, allowedOriginPatterns)) return callback(null, true);
    return callback(new Error(`CORS: Origin ${origin} is not allowed`));
  },
  credentials: true
}));

// Логирование запросов
app.use(logRequest);

// Маршруты аутентификации
app.use('/api/auth', createAuthRoutes(authController));
// Маршруты управления персонами (создание/модерация)
app.use('/api', createPersonRoutes(pool));

// Корневой маршрут
app.get('/', (req, res) => {
  res.json({
    message: 'Хронониндзя API',
    version: '1.0.0',
    endpoints: {
      persons: '/api/persons',
      categories: '/api/categories',
      countries: '/api/countries',
      stats: '/api/stats',
      health: '/api/health',
      auth: '/api/auth'
    }
  });
});

// Основные маршруты API
app.get('/api/health', asyncHandler(async (_req: any, res: any) => {
  res.json({ success: true, data: { message: 'Хронониндзя API работает', timestamp: new Date().toISOString(), version: '1.0.0' } });
}));

// Маршрут для получения данных о исторических личностях с фильтрацией
app.get('/api/persons', asyncHandler(async (req: any, res: any) => {
    const { category, country, q } = req.query as any;
    const startYear = (req.query.startYear ?? req.query.year_from) as any;
    const endYear = (req.query.endYear ?? req.query.year_to) as any;
    
    // Build WHERE conditions against alias `v` to avoid ambiguity after JOIN
    let where = ' WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    
    // Фильтрация по категориям
    if (category) {
      const categoryArray = Array.isArray(category) 
        ? category 
        : category.toString().split(',');
      where += ` AND v.category = ANY($${paramIndex}::text[])`;
      params.push(categoryArray);
      paramIndex++;
    }
    
    // Фильтрация по странам (массив country_names, fallback на строку country)
    if (country) {
      const countryArray = Array.isArray(country) 
        ? (country as string[])
        : country.toString().split(',').map((c: string) => c.trim());
      where += ` AND (
        (v.country_names IS NOT NULL AND v.country_names && $${paramIndex}::text[])
        OR (v.country_names IS NULL AND EXISTS (
          SELECT 1 FROM unnest(string_to_array(v.country, '/')) AS c
          WHERE trim(c) = ANY($${paramIndex}::text[])
        ))
      )`;
      params.push(countryArray);
      paramIndex++;
    }
    
    // Фильтрация по годам
    if (startYear) {
      where += ` AND v.death_year >= $${paramIndex}`;
      params.push(parseInt(startYear.toString()));
      paramIndex++;
    }
    
    if (endYear) {
      where += ` AND v.birth_year <= $${paramIndex}`;
      params.push(parseInt(endYear.toString()));
      paramIndex++;
    }
    // Поиск (имя/категория/страна/описание)
    const search = (q || '').toString().trim();
    if (search.length > 0) {
      where += ` AND (v.name ILIKE $${paramIndex} OR v.category ILIKE $${paramIndex} OR v.country ILIKE $${paramIndex} OR v.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Только одобренные по умолчанию (используем JOIN для оптимизации)
    let query = `SELECT v.* FROM v_api_persons v JOIN persons p2 ON p2.id = v.id AND p2.status = 'approved'` + where;

    // Сортировка и пагинация (единый формат ответа)
    query += ' ORDER BY birth_year ASC';
    const limitParam = Math.min(parseInt((req.query.limit as string) || '100'), 1000);
    const offsetParam = Math.max(parseInt((req.query.offset as string) || '0'), 0);
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitParam + 1, offsetParam);

    const result = await pool.query(query, params);
    
    const persons = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        birthYear: row.birth_year,
        deathYear: row.death_year,
        reignStart: row.reign_start,
        reignEnd: row.reign_end,
        category: row.category,
        country: row.country,
        description: row.description,
        wikiLink: row.wiki_link || null,
        achievementsWiki: Array.isArray(row.achievements_wiki) ? row.achievements_wiki : [],
        achievements: row.achievements || [],
        achievementYears: Array.isArray(row.achievement_years) ? row.achievement_years : undefined,
        // Top-3 legacy removed; frontend reads achievementYears array
        rulerPeriods: Array.isArray(row.ruler_periods)
          ? row.ruler_periods.map((p: any) => ({
              startYear: p.start_year,
              endYear: p.end_year,
              countryId: p.country_id,
              countryName: p.country_name,
            }))
          : [],
        imageUrl: row.image_url
      }));
    
    const hasMore = result.rows.length > limitParam;
    const data = hasMore ? persons.slice(0, limitParam) : persons;
    res.json({ success: true, data, meta: { limit: limitParam, offset: offsetParam, hasMore, nextOffset: hasMore ? offsetParam + limitParam : null } });
}));

// Moderation queue for persons (includes: new/updated persons pending, pending person edits, pending life periods)
app.get('/api/admin/persons/moderation', authenticateToken, requireRoleMiddleware(['moderator', 'admin']), asyncHandler(async (req: any, res: any) => {
  const limitParam = Math.min(parseInt((req.query.limit as string) || '200'), 500);
  const offsetParam = Math.max(parseInt((req.query.offset as string) || '0'), 0);
  const countOnly = String(req.query.count || 'false') === 'true';

  const baseTargetsSql = `
    WITH targets AS (
      SELECT p.id FROM persons p WHERE p.status = 'pending'
      UNION
      SELECT DISTINCT pr.person_id FROM periods pr WHERE pr.status = 'pending' AND pr.person_id IS NOT NULL
      UNION
      SELECT DISTINCT pe.person_id FROM person_edits pe WHERE pe.status = 'pending'
    )
  `;

  if (countOnly) {
    const result = await pool.query(`${baseTargetsSql} SELECT COUNT(*)::int AS cnt FROM targets`);
    res.json({ success: true, data: { count: result.rows[0]?.cnt || 0 } });
    return;
  }

  const sql = `${baseTargetsSql}
    SELECT v.*
      FROM v_api_persons v
      JOIN targets t ON t.id = v.id
     ORDER BY v.name ASC
     LIMIT $1 OFFSET $2`;
  const result = await pool.query(sql, [limitParam + 1, offsetParam]);
  const persons = result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    birthYear: row.birth_year,
    deathYear: row.death_year,
    reignStart: row.reign_start,
    reignEnd: row.reign_end,
    category: row.category,
    country: row.country,
    description: row.description,
    wikiLink: row.wiki_link || null,
    achievementsWiki: Array.isArray(row.achievements_wiki) ? row.achievements_wiki : [],
    achievements: row.achievements || [],
    achievementYears: Array.isArray(row.achievement_years) ? row.achievement_years : undefined,
    // Top-3 legacy removed; frontend reads achievementYears array
    rulerPeriods: Array.isArray(row.ruler_periods)
      ? row.ruler_periods.map((p: any) => ({
          startYear: p.start_year,
          endYear: p.end_year,
          countryId: p.country_id,
          countryName: p.country_name,
        }))
      : [],
    imageUrl: row.image_url
  }));
  const hasMore = result.rows.length > limitParam;
  const data = hasMore ? persons.slice(0, limitParam) : persons;
  res.json({ success: true, data, meta: { limit: limitParam, offset: offsetParam, hasMore, nextOffset: hasMore ? offsetParam + limitParam : null } });
}));

// Persons created by current user
app.get('/api/persons/mine', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const userId = req.user?.sub;
  if (!userId) { throw errors.unauthorized('Требуется аутентификация'); }
  const limitParam = Math.min(parseInt((req.query.limit as string) || '200'), 500);
  const offsetParam = Math.max(parseInt((req.query.offset as string) || '0'), 0);
  const countOnly = String(req.query.count || 'false') === 'true';
  if (countOnly) {
    const c = await pool.query(`SELECT COUNT(*)::int AS cnt FROM persons WHERE created_by = $1`, [userId]);
    res.json({ success: true, data: { count: c.rows[0]?.cnt || 0 } });
    return;
  }
  const sql = `
    SELECT v.*
      FROM v_api_persons v
      JOIN persons p ON p.id = v.id
     WHERE p.created_by = $1
     ORDER BY p.created_at DESC NULLS LAST
     LIMIT $2 OFFSET $3`;
  const result = await pool.query(sql, [userId, limitParam + 1, offsetParam]);
  const persons = result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    birthYear: row.birth_year,
    deathYear: row.death_year,
    reignStart: row.reign_start,
    reignEnd: row.reign_end,
    category: row.category,
    country: row.country,
    description: row.description,
    wikiLink: row.wiki_link || null,
    achievementsWiki: Array.isArray(row.achievements_wiki) ? row.achievements_wiki : [],
    achievements: row.achievements || [],
    achievementYears: Array.isArray(row.achievement_years) ? row.achievement_years : undefined,
    // Top-3 legacy removed; frontend reads achievementYears array
    rulerPeriods: Array.isArray(row.ruler_periods)
      ? row.ruler_periods.map((p: any) => ({
          startYear: p.start_year,
          endYear: p.end_year,
          countryId: p.country_id,
          countryName: p.country_name,
        }))
      : [],
    imageUrl: row.image_url
  }));
  const hasMore = result.rows.length > limitParam;
  const data = hasMore ? persons.slice(0, limitParam) : persons;
  res.json({ success: true, data, meta: { limit: limitParam, offset: offsetParam, hasMore, nextOffset: hasMore ? offsetParam + limitParam : null } });
}));

// /api/persons/list — удалено. Используйте /api/persons с параметрами фильтров и пагинации.

// Маршрут для получения данных о конкретной личности
app.get('/api/persons/:id', asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    
    if (!id) {
      throw errors.badRequest('ID не указан')
    }
    
    const query = 'SELECT * FROM v_api_persons WHERE id = $1';
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw errors.notFound('Историческая личность не найдена')
    }
    
    const row = result.rows[0];
    // Подтягиваем агрегированные периоды
    const periodsRes = await pool.query('SELECT periods FROM v_person_periods WHERE person_id = $1', [row.id]);
    const periods = periodsRes.rows[0]?.periods || [];
    const person = {
      id: row.id,
      name: row.name,
      birthYear: row.birth_year,
      deathYear: row.death_year,
      reignStart: row.reign_start || null,
      reignEnd: row.reign_end || null,
      category: row.category,
      country: row.country,
      description: row.description,
      wikiLink: row.wiki_link || null,
      achievementsWiki: Array.isArray(row.achievements_wiki) ? row.achievements_wiki : [],
      achievements: row.achievements || [],
      achievementYears: Array.isArray(row.achievement_years) ? row.achievement_years : undefined,
      periods,
      rulerPeriods: Array.isArray(row.ruler_periods)
        ? row.ruler_periods.map((p: any) => ({
            startYear: p.start_year,
            endYear: p.end_year,
            countryId: p.country_id,
            countryName: p.country_name,
          }))
        : [],
      imageUrl: row.image_url
    };
    
    res.json({ success: true, data: person });
}));

// Achievements pending (moderation)
app.get('/api/admin/achievements/pending', authenticateToken, requireRoleMiddleware(['moderator', 'admin']), asyncHandler(async (req: any, res: any) => {
  const limitParam = Math.min(parseInt((req.query.limit as string) || '200'), 500);
  const offsetParam = Math.max(parseInt((req.query.offset as string) || '0'), 0);
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
           COALESCE(
             CASE WHEN a.country_id IS NOT NULL THEN c.name
                  WHEN a.person_id IS NOT NULL THEN p.name
                  ELSE NULL END,
             ''
           ) AS title
      FROM achievements a
      LEFT JOIN persons   p ON p.id = a.person_id
      LEFT JOIN countries c ON c.id = a.country_id
     WHERE a.status = 'pending'
     ORDER BY a.created_at DESC NULLS LAST, a.id DESC
     LIMIT $1 OFFSET $2`;
  const result = await pool.query(sql, [limitParam + 1, offsetParam]);
  const rows = result.rows;
  const hasMore = rows.length > limitParam;
  const data = hasMore ? rows.slice(0, limitParam) : rows;
  res.json({ success: true, data, meta: { limit: limitParam, offset: offsetParam, hasMore, nextOffset: hasMore ? offsetParam + limitParam : null } });
}));

// Periods listing (approved only), optional filter by type ('life' | 'ruler'), sorted by start_year ASC
app.get('/api/periods', asyncHandler(async (req: any, res: any) => {
  const limitParam = Math.min(parseInt((req.query.limit as string) || '200'), 500);
  const offsetParam = Math.max(parseInt((req.query.offset as string) || '0'), 0);
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
  const hasMore = rows.length > limitParam;
  const data = hasMore ? rows.slice(0, limitParam) : rows;
  res.json({ success: true, data, meta: { limit: limitParam, offset: offsetParam, hasMore, nextOffset: hasMore ? offsetParam + limitParam : null } });
}));

// Achievements created by current user
app.get('/api/achievements/mine', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const userId = req.user?.sub;
  if (!userId) { throw errors.unauthorized('Требуется аутентификация'); }
  const limitParam = Math.min(parseInt((req.query.limit as string) || '200'), 500);
  const offsetParam = Math.max(parseInt((req.query.offset as string) || '0'), 0);
  const countOnly = String(req.query.count || 'false') === 'true';
  if (countOnly) {
    const c = await pool.query(`SELECT COUNT(*)::int AS cnt FROM achievements WHERE created_by = $1`, [userId]);
    res.json({ success: true, data: { count: c.rows[0]?.cnt || 0 } });
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
     ORDER BY a.created_at DESC NULLS LAST, a.id DESC
     LIMIT $2 OFFSET $3`;
  const result = await pool.query(sql, [userId, limitParam + 1, offsetParam]);
  const rows = result.rows;
  const hasMore = rows.length > limitParam;
  const data = hasMore ? rows.slice(0, limitParam) : rows;
  res.json({ success: true, data, meta: { limit: limitParam, offset: offsetParam, hasMore, nextOffset: hasMore ? offsetParam + limitParam : null } });
}));

// Aggregated counts for "mine" (persons, achievements, periods)
app.get('/api/mine/counts', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const userId = req.user?.sub;
  const [pc, ac, prc] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS cnt FROM persons WHERE created_by = $1`, [userId]),
    pool.query(`SELECT COUNT(*)::int AS cnt FROM achievements WHERE created_by = $1`, [userId]),
    pool.query(`SELECT COUNT(*)::int AS cnt FROM periods WHERE created_by = $1`, [userId]),
  ]);
  res.json({ success: true, data: { persons: pc.rows[0]?.cnt || 0, achievements: ac.rows[0]?.cnt || 0, periods: prc.rows[0]?.cnt || 0 } });
}));

// Public achievements list with search and pagination
app.get('/api/achievements', asyncHandler(async (req: any, res: any) => {
  const q = (req.query.q || '').toString().trim()
  const limitParam = Math.min(parseInt((req.query.limit as string) || '100'), 500)
  const offsetParam = Math.max(parseInt((req.query.offset as string) || '0'), 0)
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
  const hasMore = rows.length > limitParam
  const data = hasMore ? rows.slice(0, limitParam) : rows
  res.json({ success: true, data, meta: { limit: limitParam, offset: offsetParam, hasMore, nextOffset: hasMore ? offsetParam + limitParam : null } })
}))

// CRUD для достижений (минимально: список по персоне и создание)
app.get('/api/persons/:id/achievements', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const result = await pool.query(
    'SELECT id, person_id, year, description, wikipedia_url, image_url FROM achievements WHERE person_id = $1 ORDER BY year ASC',
    [id]
  );
  res.json({ success: true, data: result.rows });
}));

// Periods by person (with IDs)
app.get('/api/persons/:id/periods', asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const sql = `
    SELECT pr.id,
           pr.person_id,
           pr.country_id,
           pr.start_year,
           pr.end_year,
           pr.period_type,
           c.name AS country_name
      FROM periods pr
      LEFT JOIN countries c ON c.id = pr.country_id
     WHERE pr.person_id = $1
     ORDER BY pr.start_year ASC, pr.id ASC`;
  const result = await pool.query(sql, [id]);
  res.json({ success: true, data: result.rows });
}));

app.post('/api/persons/:id/achievements', authenticateToken, requireRoleMiddleware(['moderator', 'admin']), asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const parsed = AchievementPersonSchema.safeParse(req.body || {})
  if (!parsed.success) throw errors.badRequest('Некорректные данные достижения', 'validation_error', parsed.error.flatten())
  const { year, description, wikipedia_url, image_url } = parsed.data

  // Validate year in lifespan
  const personRes = await pool.query('SELECT birth_year, death_year FROM persons WHERE id = $1', [id]);
  if (personRes.rowCount === 0) {
    throw errors.notFound('Персона не найдена')
  }
  const { birth_year, death_year } = personRes.rows[0];
  if (birth_year != null && death_year != null) {
    if (year < Number(birth_year) || year > Number(death_year)) {
      throw errors.badRequest(`Год достижения (${year}) должен входить в годы жизни персоны (${birth_year}–${death_year})`)
    }
  }
  const role = (req as any).user?.role || 'user'
  let result
  if (role === 'admin' || role === 'moderator') {
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
    result = await pool.query(
      `INSERT INTO achievements (person_id, year, description, wikipedia_url, image_url, status, created_by, submitted_at)
       VALUES ($1, $2, btrim($3), $4, $5, 'pending', $6, NOW())
       RETURNING *`,
      [id, year, description, wikipedia_url ?? null, image_url ?? null, (req as any).user!.sub]
    );
  }
  res.status(201).json({ success: true, data: result.rows[0] });
}));

    // Маршрут для получения категорий
app.get('/api/categories', asyncHandler(async (req: any, res: any) => {
    // Пробуем сначала использовать таблицу unique_categories, если она существует
    let query = 'SELECT category FROM unique_categories';
    let result = await pool.query(query);
    
    // Если таблица не существует, используем DISTINCT
    if (result.rows.length === 0) {
      query = `
        SELECT DISTINCT category 
        FROM persons 
        WHERE category IS NOT NULL 
        ORDER BY category
      `;
      result = await pool.query(query);
    }
    
    const categories = result.rows.map(row => row.category);
    res.json({ success: true, data: categories });
}));

// Маршрут для получения стран
app.get('/api/countries', asyncHandler(async (req: any, res: any) => {
    const result = await pool.query('SELECT name FROM v_countries ORDER BY name');
    const countries = result.rows.map(r => r.name);
    res.json({ success: true, data: countries });
}));

// Страны с идентификаторами (для выбора country_id при создании достижений)
app.get('/api/countries/options', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM countries ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching country options:', error);
    res.status(500).json({ success: false, message: 'Ошибка при получении списка стран' });
  }
});

// Маршрут для получения статистики
app.get('/api/stats', asyncHandler(async (req: any, res: any) => {
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_persons,
        MIN(birth_year) as earliest_birth,
        MAX(death_year) as latest_death,
        COUNT(DISTINCT category) as unique_categories,
        (SELECT COUNT(*) FROM v_countries) as unique_countries
      FROM persons
    `);

    const categoryStatsResult = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM persons
      GROUP BY category
      ORDER BY count DESC
    `);

    const countryStatsResult = await pool.query(`
      SELECT name AS country, persons_with_periods AS count
      FROM v_country_stats
      ORDER BY count DESC
    `);

    const stats = {
      overview: statsResult.rows[0],
      categories: categoryStatsResult.rows,
      countries: countryStatsResult.rows
    };

    res.json({ success: true, data: stats });
}));

// DTO version endpoint for drift detection on FE
app.get('/api/dto-version', asyncHandler(async (_req: any, res: any) => {
  res.json({ success: true, data: { version: DTO_VERSION_BE } });
}));

// --- List share links (tokenized) ---
// Create a share token for a list (owner only)
app.post('/api/lists/:listId/share', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const userId = req.user?.sub;
  const { listId } = req.params;
  // Ensure ownership
  const own = await pool.query('SELECT owner_user_id, title FROM lists WHERE id = $1', [listId]);
  if (own.rowCount === 0) throw errors.notFound('Список не найден');
  if (own.rows[0].owner_user_id !== userId) throw errors.forbidden('Нет прав на публикацию списка');
  const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-secret';
  const code = jwt.sign({ listId: Number(listId), owner: String(userId) }, secret, { expiresIn: '365d' });
  res.json({ success: true, data: { code } });
}));

// Resolve a share token to list metadata and items (no auth required)
app.get('/api/list-shares/:code', asyncHandler(async (req: any, res: any) => {
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
}));

// --- User Lists API ---
// Get all lists for current user
app.get('/api/lists', authenticateToken, asyncHandler(async (req: any, res: any) => {
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
}));

// Create list
app.post('/api/lists', authenticateToken, asyncHandler(async (req: any, res: any) => {
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
}));

// List items
app.get('/api/lists/:listId/items', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const { listId } = req.params;
  // Ownership check
  const own = await pool.query('SELECT 1 FROM lists WHERE id = $1 AND owner_user_id = $2', [listId, (req as any).user?.sub]);
  if (own.rowCount === 0) throw errors.forbidden('Нет прав на доступ к списку');
  const rows = await pool.query(
    'SELECT id, list_id, item_type, person_id, achievement_id, period_id, position, created_at FROM list_items WHERE list_id = $1 ORDER BY position ASC, id ASC',
    [listId]
  );
  res.json({ success: true, data: rows.rows });
}));

app.post('/api/lists/:listId/items', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const { listId } = req.params;
  const { item_type, person_id, achievement_id, period_id } = req.body || {};
  // Ownership check
  const own = await pool.query('SELECT 1 FROM lists WHERE id = $1 AND owner_user_id = $2', [listId, (req as any).user?.sub]);
  if (own.rowCount === 0) throw errors.forbidden('Нет прав на изменение списка');
  if (!['person','achievement','period'].includes(item_type)) throw errors.badRequest('Некорректный тип элемента');
  if (item_type === 'person') {
    const r = await pool.query('SELECT 1 FROM persons WHERE id = $1', [person_id]);
    if (r.rowCount === 0) throw errors.notFound('Персона не найдена');
    // prevent duplicates
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
}));

app.delete('/api/lists/:listId/items/:itemId', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const { listId, itemId } = req.params;
  // Ownership check
  const own = await pool.query('SELECT 1 FROM lists WHERE id = $1 AND owner_user_id = $2', [listId, (req as any).user?.sub]);
  if (own.rowCount === 0) throw errors.forbidden('Нет прав на изменение списка');
  await pool.query('DELETE FROM list_items WHERE id = $1 AND list_id = $2', [itemId, listId]);
  res.json({ success: true });
}));

// Delete list (only owner)
app.delete('/api/lists/:listId', authenticateToken, asyncHandler(async (req: any, res: any) => {
  const userId = req.user?.sub;
  const { listId } = req.params;
  // Ensure ownership
  const own = await pool.query('SELECT 1 FROM lists WHERE id = $1 AND owner_user_id = $2', [listId, userId]);
  if (own.rowCount === 0) throw errors.forbidden('Нет прав на удаление списка');
  // Remove items first to be safe
  await pool.query('DELETE FROM list_items WHERE list_id = $1', [listId]);
  await pool.query('DELETE FROM lists WHERE id = $1 AND owner_user_id = $2', [listId, userId]);
  res.json({ success: true });
}));

// Copy list from a public share code into current user's account
app.post('/api/lists/copy-from-share', authenticateToken, asyncHandler(async (req: any, res: any) => {
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
  // Get source list meta for default title
  const src = await pool.query('SELECT id, title FROM lists WHERE id = $1', [listId]);
  if (src.rowCount === 0) throw errors.notFound('Список не найден');
  const fallbackTitle = src.rows[0].title || 'Импортированный список';
  const t0 = newTitleRaw.trim();
  const newTitle = t0.length > 0 ? t0 : fallbackTitle;
  if (newTitle.length > 200) throw errors.badRequest('Название списка слишком длинное (макс. 200)');

  // Create destination list
  const ins = await pool.query('INSERT INTO lists (owner_user_id, title) VALUES ($1, $2) RETURNING id', [userId, newTitle]);
  const newListId = ins.rows[0].id;
  // Bulk copy items preserving order/position
  await pool.query(
    `INSERT INTO list_items (list_id, item_type, person_id, achievement_id, period_id, position)
     SELECT $1, item_type, person_id, achievement_id, period_id, position
       FROM list_items WHERE list_id = $2
     ORDER BY position ASC, id ASC`,
    [newListId, listId]
  );
  res.status(201).json({ success: true, data: { id: newListId, title: newTitle } });
}));

// Batch by-ids helpers (use lookup path to avoid conflict with /api/persons/:id)
app.get('/api/persons/lookup/by-ids', asyncHandler(async (req: any, res: any) => {
  const raw = (req.query.ids || '').toString().trim();
  if (!raw) { res.json({ success: true, data: [] }); return; }
  const ids = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
  const sql = `
    WITH req_ids AS (
      SELECT UNNEST($1::text[]) WITH ORDINALITY AS id, ord
    )
    SELECT v.*
      FROM req_ids r
      JOIN v_api_persons v ON v.id = r.id
     ORDER BY r.ord ASC`;
  const result = await pool.query(sql, [ids]);
  const persons = result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    birthYear: row.birth_year,
    deathYear: row.death_year,
    reignStart: row.reign_start,
    reignEnd: row.reign_end,
    category: row.category,
    country: row.country,
    description: row.description,
    achievements: row.achievements || [],
    achievementYears: Array.isArray(row.achievement_years) ? row.achievement_years : undefined,
    // Top-3 legacy removed; frontend reads achievementYears array
    rulerPeriods: Array.isArray(row.ruler_periods)
      ? row.ruler_periods.map((p: any) => ({
          startYear: p.start_year,
          endYear: p.end_year,
          countryId: p.country_id,
          countryName: p.country_name,
        }))
      : [],
    imageUrl: row.image_url,
    wikiLink: row.wiki_link || null,
    achievementsWiki: Array.isArray(row.achievements_wiki) ? row.achievements_wiki : [],
  }));
  res.json({ success: true, data: persons });
}));

app.get('/api/achievements/lookup/by-ids', asyncHandler(async (req: any, res: any) => {
  const raw = (req.query.ids || '').toString().trim();
  if (!raw) { res.json({ success: true, data: [] }); return; }
  const ids = raw.split(',').map((s: string) => parseInt(s, 10)).filter((n: number) => Number.isInteger(n));
  if (ids.length === 0) { res.json({ success: true, data: [] }); return; }
  const sql = `
    WITH req_ids AS (
      SELECT UNNEST($1::int[]) WITH ORDINALITY AS id, ord
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
     ORDER BY r.ord ASC`;
  const result = await pool.query(sql, [ids]);
  res.json({ success: true, data: result.rows });
}));

// Periods by-ids lookup (for enriching list items)
app.get('/api/periods/lookup/by-ids', asyncHandler(async (req: any, res: any) => {
  const raw = (req.query.ids || '').toString().trim();
  if (!raw) { res.json({ success: true, data: [] }); return; }
  const ids = raw.split(',').map((s: string) => parseInt(s, 10)).filter((n: number) => Number.isInteger(n));
  if (ids.length === 0) { res.json({ success: true, data: [] }); return; }
  const sql = `
    WITH req_ids AS (
      SELECT UNNEST($1::int[]) WITH ORDINALITY AS id, ord
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
}));

// Обработка ошибок
app.use(errorHandler);

// Обработка 404 (Express 5: без шаблона пути)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: 'Маршрут не найден'
  });
});

// Функция запуска сервера
async function startServer() {
  try {
    // Проверка подключения к базе данных
    const client = await pool.connect();
    console.log('✅ Подключение к базе данных установлено');
    client.release();
    
    // Запуск сервера
    app.listen(PORT, () => {
      console.log(`🚀 Хронониндзя API сервер запущен на порту ${PORT}`);
      console.log(`📊 API доступен по адресу: http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
      console.log(`👥 Persons API: http://localhost:${PORT}/api/persons`);
      console.log(`📈 Stats API: http://localhost:${PORT}/api/stats`);
      
      // Логгирование CORS
      const isLocal = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
      const corsInfo = isLocal ? 'http://localhost:3000' : 'все домены (*)';
      console.log(`🔗 CORS настроен для: ${corsInfo}`);
    });
  } catch (error) {
    console.error('❌ Ошибка при запуске сервера:', error);
    process.exit(1);
  }
}

// Запускаем сервер
startServer();

// Обработка завершения работы
process.on('SIGINT', async () => {
  console.log('\n🛑 Получен сигнал завершения работы');
  await pool.end();
  console.log('✅ Подключения к базе данных закрыты');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Получен сигнал завершения работы');
  await pool.end();
  console.log('✅ Подключения к базе данных закрыты');
  process.exit(0);
});

export default app; 