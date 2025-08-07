import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { AuthService } from './services/authService';
import { AuthController } from './controllers/authController';
import { createAuthRoutes } from './routes/authRoutes';
import { logRequest, errorHandler } from './middleware/auth';

// Конфигурация базы данных
const isLocal = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

const pool = new Pool({
  host: process.env.DB_HOST || (isLocal ? 'chronoline-kramushka.db-msk0.amvera.tech' : 'amvera-kramushka-cnpg-chronoline-rw'),
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'chronoline',
  user: process.env.DB_USER || 'Kramushka',
  password: process.env.DB_PASSWORD || '1qwertyu',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false
  }
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
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Логирование запросов
app.use(logRequest);

// Маршруты аутентификации
app.use('/api/auth', createAuthRoutes(authController));

// Корневой маршрут
app.get('/', (req, res) => {
  res.json({
    message: 'Хроно ниндзя API',
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
    message: 'Хроно ниндзя API работает',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Маршрут для получения данных о исторических личностях с фильтрацией
app.get('/api/persons', async (req, res) => {
  try {
    const { category, country, startYear, endYear } = req.query;
    
    let query = 'SELECT * FROM persons WHERE 1=1';
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
    
    const persons = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      birthYear: row.birth_year,
      deathYear: row.death_year,
      reignStart: row.reign_start,
      reignEnd: row.reign_end,
      category: row.category,
      country: row.country,
      description: row.description,
      achievements: row.achievements,
      achievementYear1: row.achievement_year_1,
      achievementYear2: row.achievement_year_2,
      achievementYear3: row.achievement_year_3,
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
    const query = 'SELECT * FROM persons WHERE id = $1';
    
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
      achievements: row.achievements,
      achievementYear1: row.achievement_year_1,
      achievementYear2: row.achievement_year_2,
      achievementYear3: row.achievement_year_3,
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
    // Пробуем сначала использовать таблицу unique_countries, если она существует
    let query = 'SELECT country FROM unique_countries';
    let result = await pool.query(query);
    
    // Если таблица не существует, используем DISTINCT
    if (result.rows.length === 0) {
      query = `
        SELECT DISTINCT country 
        FROM persons 
        WHERE country IS NOT NULL 
        ORDER BY country
      `;
      result = await pool.query(query);
    }
    
    const countries = result.rows.map(row => row.country);
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
        COUNT(DISTINCT country) as unique_countries
      FROM persons
    `);
    
    const categoryStatsResult = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM persons
      GROUP BY category
      ORDER BY count DESC
    `);
    
    const countryStatsResult = await pool.query(`
      SELECT country, COUNT(*) as count
      FROM persons
      GROUP BY country
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

// Обработка 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: 'Маршрут не найден'
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Хроно ниндзя API сервер запущен на порту ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
  console.log(`👥 Persons API: http://localhost:${PORT}/api/persons`);
  console.log(`📈 Stats API: http://localhost:${PORT}/api/stats`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  pool.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  pool.end();
  process.exit(0);
});

export default app; 