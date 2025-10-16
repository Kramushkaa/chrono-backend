import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { AuthService } from './services/authService';
import { TelegramService } from './services/telegramService';
import { QuizService } from './services/quizService';
import { AuthController } from './controllers/authController';
import { createAuthRoutes } from './routes/authRoutes';
import { logRequest, errorHandler } from './middleware/auth';
import { asyncHandler } from './utils/errors';
import { createPool } from './db/pool';
import { createPersonRoutes } from './routes/persons';
import { createListsRoutes } from './routes/listsRoutes';
import { createAchievementsRoutes } from './routes/achievementsRoutes';
import { createPeriodsRoutes } from './routes/periodsRoutes';
import { createMetaRoutes } from './routes/metaRoutes';
import { createQuizRoutes } from './routes/quizRoutes';
import { config } from './config';

// Загрузка переменных окружения
dotenv.config();

// Конфигурация базы данных
const pool = createPool();

// Создание сервисов и контроллеров
const authService = new AuthService(pool);
const telegramService = new TelegramService(config.telegram.botToken, config.telegram.adminChatId);
const quizService = new QuizService(pool);
const authController = new AuthController(authService, telegramService);

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
const rawOrigins = process.env.CORS || process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '*';
const allowedOriginPatterns = rawOrigins
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
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

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isOriginAllowed(origin, allowedOriginPatterns)) return callback(null, true);
      return callback(new Error(`CORS: Origin ${origin} is not allowed`));
    },
    credentials: true,
  })
);

// Маршруты аутентификации
app.use('/api/auth', createAuthRoutes(authController));

// Логирование запросов (после аутентификации, чтобы req.user был доступен)
app.use(logRequest);

// Маршруты управления Личностями (создание/модерация)
app.use('/api', createPersonRoutes(pool, telegramService));

// Маршруты для достижений
app.use('/api', createAchievementsRoutes(pool, telegramService));

// Маршруты для периодов жизни
app.use('/api', createPeriodsRoutes(pool, telegramService));

// Основные маршруты API
app.use('/api', createMetaRoutes(pool));

// Lists routes
app.use('/api', createListsRoutes(pool));

// Quiz routes
app.use('/api', createQuizRoutes(pool));

// Backend info endpoint (оставляем как отдельный информационный маршрут)
app.get(
  '/api/backend-info',
  asyncHandler(async (_req: any, res: any) => {
    res.json({
      success: true,
      data: {
        name: 'Хронониндзя API',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        endpoints: {
          auth: '/api/auth',
          persons: '/api/persons',
          achievements: '/api/achievements',
          periods: '/api/periods',
          lists: '/api/lists',
          quiz: '/api/quiz',
          stats: '/api/stats',
          health: '/api/health',
          categories: '/api/categories',
          countries: '/api/countries',
        },
      },
    });
  })
);

// Backend switch endpoint (для переключения между backend'ами)
app.post(
  '/api/backend-switch',
  asyncHandler(async (req: any, res: any) => {
    const { backendUrl } = req.body;

    if (!backendUrl || typeof backendUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid backend URL',
        message: "Необходимо указать URL backend'а",
      });
    }

    try {
      // Валидируем URL
      new URL(backendUrl);

      res.json({
        success: true,
        data: {
          message: 'Backend URL updated',
          backendUrl,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Invalid URL format',
        message: 'Неверный формат URL',
      });
    }
  })
);

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
      auth: '/api/auth',
      quiz: '/api/quiz',
    },
  });
});

// Removed unused endpoint /api/mine/counts (no longer referenced by frontend)

// Обработка ошибок
app.use(errorHandler);

// Обработка 404 (Express 5: без шаблона пути)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: 'Маршрут не найден',
  });
});

// Функция запуска сервера
async function startServer() {
  try {
    // Проверка подключения к базе данных
    const client = await pool.connect();
    console.log('✅ Подключение к базе данных установлено');
    client.release();

    // Очистка истекших незавершённых сессий квизов
    try {
      const cleanedCount = await quizService.cleanupExpiredSessions();
      if (cleanedCount > 0) {
        console.log(`🧹 Очищено просроченных quiz сессий: ${cleanedCount}`);
      }
    } catch (error) {
      console.error('⚠️ Ошибка при очистке quiz сессий:', error);
    }

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
