const http = require('http');
const { Pool } = require('pg');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

// Определяем, какое подключение использовать
const isLocal = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

// Настройка подключения к базе данных
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

const server = http.createServer(async (req, res) => {
  // Устанавливаем CORS заголовки для работы с любым origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Обработка preflight запросов
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const fullUrl = path + url.search; // Собираем полный URL с параметрами

    console.log(`${new Date().toISOString()} - ${req.method} ${fullUrl}`);

    // Корневой маршрут
    if (path === '/' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        message: 'Хроно ниндзя API',
        version: '1.0.0',
        endpoints: {
          persons: '/api/persons',
          categories: '/api/categories',
          countries: '/api/countries',
          stats: '/api/stats'
        }
      }));
      return;
    }

    // Получить всех исторических личностей
    if (path === '/api/persons' && req.method === 'GET') {
      const { searchParams } = url;
      const category = searchParams.get('category');
      const country = searchParams.get('country');
      const startYear = searchParams.get('startYear');
      const endYear = searchParams.get('endYear');
      
      let query = 'SELECT * FROM persons WHERE 1=1';
      const params = [];
      let paramIndex = 1;
      
      if (category) {
        // Разбиваем строку категорий в массив
        const categoryArray = category.split(',');
        query += ` AND category = ANY($${paramIndex}::text[])`;
        params.push(categoryArray);
        paramIndex++;
      }
      
      if (country) {
        // Разбиваем строку стран (из query ?country=США,Германия)
        const countryArray = country.split(',').map(c => c.trim());
        query += ` AND EXISTS ( 
          SELECT 1 FROM unnest(string_to_array(country, '/')) AS c
          WHERE trim(c) = ANY($${paramIndex}::text[])
        )`;
        params.push(countryArray);
        paramIndex++;
      }
      
      if (startYear) {
        query += ` AND death_year >= $${paramIndex}`;
        params.push(parseInt(startYear));
        paramIndex++;
      }
      
      if (endYear) {
        query += ` AND birth_year <= $${paramIndex}`;
        params.push(parseInt(endYear));
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
      
      res.writeHead(200);
      res.end(JSON.stringify(persons));
      return;
    }

    // Получить историческую личность по ID
    if (path.startsWith('/api/persons/') && req.method === 'GET') {
      const id = path.split('/').pop();
      
      if (!id) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'ID не указан' }));
        return;
      }
      
      const result = await pool.query('SELECT * FROM persons WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Историческая личность не найдена' }));
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
      
      res.writeHead(200);
      res.end(JSON.stringify(person));
      return;
    }

    // Получить категории
    if (path === '/api/categories' && req.method === 'GET') {
      const result = await pool.query('SELECT category FROM unique_categories');
      const categories = result.rows.map(row => row.category);
      
      res.writeHead(200);
      res.end(JSON.stringify(categories));
      return;
    }

    // Получить страны
    if (path === '/api/countries' && req.method === 'GET') {
      const result = await pool.query('SELECT country FROM unique_countries');
      const countries = result.rows.map(row => row.country);
      
      res.writeHead(200);
      res.end(JSON.stringify(countries));
      return;
    }

    // Получить статистику
    if (path === '/api/stats' && req.method === 'GET') {
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
      
      res.writeHead(200);
      res.end(JSON.stringify(stats));
      return;
    }

    // 404 - маршрут не найден
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Маршрут не найден' }));

  } catch (error) {
    console.error('Ошибка сервера:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Внутренняя ошибка сервера' }));
  }
});

async function startServer() {
  try {
    // Проверка подключения к базе данных
    const client = await pool.connect();
    console.log('✅ Подключение к базе данных установлено');
    client.release();
    
    // Запуск сервера
    server.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`📊 API доступен по адресу: http://localhost:${PORT}`);
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

startServer(); 