import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Pool } from 'pg';
import { AuthService } from './services/authService';
import { AuthController } from './controllers/authController';
import { createAuthRoutes } from './routes/authRoutes';
import { logRequest, errorHandler, authenticateToken, requireRoleMiddleware } from './middleware/auth';
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
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Хронониндзя API работает',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Маршрут для получения данных о исторических личностях с фильтрацией
app.get('/api/persons', async (req, res) => {
  try {
    const { category, country, startYear, endYear } = req.query;
    
    let query = 'SELECT * FROM v_api_persons WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    
    // Фильтрация по категориям
    if (category) {
      const categoryArray = Array.isArray(category) 
        ? category 
        : category.toString().split(',');
      query += ` AND category = ANY($${paramIndex}::text[])`;
      params.push(categoryArray);
      paramIndex++;
    }
    
    // Фильтрация по странам
    if (country) {
      const countryArray = Array.isArray(country) 
        ? country 
        : country.toString().split(',').map(c => c.trim());
      query += ` AND EXISTS ( 
        SELECT 1 FROM unnest(string_to_array(country, '/')) AS c
        WHERE trim(c) = ANY($${paramIndex}::text[])
      )`;
      params.push(countryArray);
      paramIndex++;
    }
    
    // Фильтрация по годам
    if (startYear) {
      query += ` AND death_year >= $${paramIndex}`;
      params.push(parseInt(startYear.toString()));
      paramIndex++;
    }
    
    if (endYear) {
      query += ` AND birth_year <= $${paramIndex}`;
      params.push(parseInt(endYear.toString()));
      paramIndex++;
    }
    
    query += ' ORDER BY birth_year ASC';
    
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
        achievementYear1: row.achievement_year_1 || null,
        achievementYear2: row.achievement_year_2 || null,
        achievementYear3: row.achievement_year_3 || null,
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
    
    res.json(persons);
  } catch (error) {
    console.error('Error fetching persons:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Ошибка при получении данных'
    });
  }
});

// Маршрут для получения данных о конкретной личности
app.get('/api/persons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        error: 'ID не указан'
      });
      return;
    }
    
    const query = 'SELECT * FROM v_api_persons WHERE id = $1';
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Person not found',
        message: 'Историческая личность не найдена'
      });
      return;
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
      achievementYear1: row.achievement_year_1 || null,
      achievementYear2: row.achievement_year_2 || null,
      achievementYear3: row.achievement_year_3 || null,
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
    
    res.json(person);
  } catch (error) {
    console.error('Error fetching person:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Ошибка при получении данных'
    });
  }
});

// CRUD для достижений (минимально: список по персоне и создание)
app.get('/api/persons/:id/achievements', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, person_id, year, description, wikipedia_url, image_url FROM achievements WHERE person_id = $1 ORDER BY year ASC',
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ success: false, message: 'Ошибка при получении достижений' });
  }
});

app.post('/api/persons/:id/achievements', authenticateToken, requireRoleMiddleware(['moderator', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { year, description, wikipedia_url, image_url } = req.body || {};
    if (!description || description.length < 2) {
      res.status(400).json({ success: false, message: 'Описание достижения обязательно' });
      return;
    }
    if (typeof year !== 'number' || !Number.isInteger(year)) {
      res.status(400).json({ success: false, message: 'Год достижения обязателен и должен быть целым числом' });
      return;
    }
    const result = await pool.query(
      'INSERT INTO achievements (person_id, year, description, wikipedia_url, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, year, description, wikipedia_url ?? null, image_url ?? null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating achievement:', error);
    res.status(500).json({ success: false, message: 'Ошибка при создании достижения' });
  }
});

    // Маршрут для получения категорий
app.get('/api/categories', async (req, res) => {
  try {
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
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Ошибка при получении категорий'
    });
  }
});

// Маршрут для получения стран
app.get('/api/countries', async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM v_countries ORDER BY name');
    const countries = result.rows.map(r => r.name);
    res.json(countries);
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Ошибка при получении стран'
    });
  }
});

// Маршрут для получения статистики
app.get('/api/stats', async (req, res) => {
  try {
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

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Ошибка при получении статистики'
    });
  }
});

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