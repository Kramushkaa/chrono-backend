import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { AuthService } from './services/authService';
import { AuthController } from './controllers/authController';
import { createAuthRoutes } from './routes/authRoutes';
import { logRequest, errorHandler, authenticateToken, requireRoleMiddleware } from './middleware/auth';
import { z } from 'zod';
import { asyncHandler, errors } from './utils/errors';
import { DTO_VERSION as DTO_VERSION_BE } from './dtoDescriptors';
import { mapApiPersonRow, parseLimitOffset, paginateRows } from './utils/api';
import { createPool } from './db/pool';
import { AchievementPersonSchema } from './dto';
import { validateConfig } from './config';
import { createPersonRoutes } from './routes/personRoutes';
import { createListsRoutes } from './routes/listsRoutes';
import { createAchievementsRoutes } from './routes/achievementsRoutes';
import { createPeriodsRoutes } from './routes/periodsRoutes';
import { createMetaRoutes } from './routes/metaRoutes';

// Загрузка переменных окружения
dotenv.config();
// Валидация обязательных настроек окружения
validateConfig();

// Конфигурация базы данных
const isLocal = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

const pool = createPool();

// Создание сервисов и контроллеров
const authService = new AuthService(pool);
const authController = new AuthController(authService);

// Создание Express приложения
const app = express();
const PORT = process.env.PORT || 3001;
// Доверять заголовкам прокси для корректного req.ip за балансировщиком
app.set('trust proxy', 1);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Security headers
app.use(helmet());
// CORS: поддержка списка доменов (через запятую) и шаблонов вида *.chrono.ninja, .chrono.ninja или голых доменов
// Поддерживаем переменные: CORS, CORS_ORIGIN, CORS_ORIGINS
const rawOrigins = process.env.CORS || process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '*';
const allowedOriginPatterns = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);
const isProd = process.env.NODE_ENV === 'production';
if (isProd && allowedOriginPatterns.includes('*')) {
  console.error('❌ В продакшене CORS_ORIGINS не может быть "*". Укажите явные источники.');
  process.exit(1);
}

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
      // Голодомен или подстановочный *.domain или .domain
      const p = pat.toLowerCase();
      if (p.startsWith('*.')) {
        const base = p.slice(2);
        if (host === base || host.endsWith(`.${base}`)) return true;
      } else if (p.startsWith('.')) {
        const base = p.slice(1);
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
// Маршруты управления Личностями (создание/модерация)
app.use('/api', createPersonRoutes(pool));
// Маршруты списков
app.use('/api', createListsRoutes(pool));
// Маршруты достижений
app.use('/api', createAchievementsRoutes(pool));
// Маршруты периодов
app.use('/api', createPeriodsRoutes(pool));

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
app.use('/api', createMetaRoutes(pool));

// Перенесено в routes/personRoutes.ts

// Moderation queue for persons (includes: new/updated persons pending, pending person edits, pending life periods)
app.get('/api/admin/persons/moderation', authenticateToken, requireRoleMiddleware(['moderator', 'admin']), asyncHandler(async (req: any, res: any) => {
  const { limitParam, offsetParam } = parseLimitOffset(req.query.limit, req.query.offset, { defLimit: 200, maxLimit: 500 });
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
  const { data, meta } = paginateRows(persons, limitParam, offsetParam);
  res.json({ success: true, data, meta });
}));

// Перенесено в routes/personRoutes.ts

// /api/persons/list — удалено. Используйте /api/persons с параметрами фильтров и пагинации.

// Перенесено в routes/personRoutes.ts

// Перенесено в routes/achievementsRoutes.ts

// Перенесено в routes/periodsRoutes.ts

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
  const { data, meta } = paginateRows(rows, limitParam, offsetParam);
  res.json({ success: true, data, meta });
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

// CRUD для достижений (минимально: список по Личности и создание)
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
app.get('/api/countries/options', asyncHandler(async (_req: any, res: any) => {
  const result = await pool.query('SELECT id, name FROM countries ORDER BY name');
  res.json({ success: true, data: result.rows });
}));

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

// Lists routes
app.use('/api', createListsRoutes(pool));

// Batch by-ids helpers (use lookup path to avoid conflict with /api/persons/:id)
app.get('/api/persons/lookup/by-ids', asyncHandler(async (req: any, res: any) => {
  const raw = (req.query.ids || '').toString().trim();
  if (!raw) { res.json({ success: true, data: [] }); return; }
  const ids = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
  const sql = `
    WITH req_ids AS (
      SELECT ($1::text[])[g.ord] AS id, g.ord
        FROM generate_series(1, COALESCE(array_length($1::text[], 1), 0)) AS g(ord)
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