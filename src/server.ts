import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { AuthService } from './services/authService';
import { AuthController } from './controllers/authController';
import { createAuthRoutes } from './routes/authRoutes';
import { logRequest, errorHandler } from './middleware/auth';

// Конфигурация базы данных
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chrononinja',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
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

// Основные маршруты API
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Хроно ниндзя API работает',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Маршрут для получения данных о исторических личностях
app.get('/api/persons', async (req, res) => {
  try {
    const query = `
      SELECT 
        id, 
        name, 
        birth_year, 
        death_year, 
        category, 
        description, 
        achievements,
        country,
        image_url
      FROM historical_persons 
      ORDER BY birth_year ASC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows
    });
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
    const query = `
      SELECT 
        id, 
        name, 
        birth_year, 
        death_year, 
        category, 
        description, 
        achievements,
        country,
        image_url
      FROM historical_persons 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Person not found',
        message: 'Историческая личность не найдена'
      });
      return;
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
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
    const query = `
      SELECT DISTINCT category 
      FROM historical_persons 
      WHERE category IS NOT NULL 
      ORDER BY category
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows.map(row => row.category)
    });
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
    const query = `
      SELECT DISTINCT country 
      FROM historical_persons 
      WHERE country IS NOT NULL 
      ORDER BY country
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows.map(row => row.country)
    });
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Ошибка при получении стран'
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