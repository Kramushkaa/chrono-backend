import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { AuthService } from './services/authService';
import { TelegramService } from './services/telegramService';
import { EmailService } from './services/emailService';
import { AchievementsService } from './services/achievementsService';
import { PeriodsService } from './services/periodsService';
import { PersonsService } from './services/personsService';
import { ListsService } from './services/listsService';
import { UserService } from './services/userService';
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
import { createHealthRoutes } from './routes/healthRoutes';
import { config, validateConfig } from './config';
import { cleanupExpiredQuizSessions } from './jobs/cleanup-quiz-sessions';
import { logger } from './utils/logger';

// Загрузка переменных окружения
// override: false - не перезаписываем существующие переменные (для Amvera и других PaaS)
dotenv.config({ override: false });

// Валидация конфигурации перед запуском
validateConfig();

// Конфигурация базы данных
const pool = createPool();

// Создание сервисов и контроллеров
const authService = new AuthService(pool);
const telegramService = new TelegramService(config.telegram.botToken, config.telegram.adminChatId);
const emailService = new EmailService();
const achievementsService = new AchievementsService(pool, telegramService);
const periodsService = new PeriodsService(pool, telegramService);
const personsService = new PersonsService(pool, telegramService);
const listsService = new ListsService(pool);
const userService = new UserService(pool);
const authController = new AuthController(authService, telegramService, emailService, userService);

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
  logger.error('В продакшене CORS_ORIGINS не может быть "*". Укажите явные источники.');
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

// Health check routes (без префикса /api для load balancers)
app.use('/', createHealthRoutes(pool, telegramService));

// Маршруты управления Личностями (создание/модерация)
app.use('/api', createPersonRoutes(pool, telegramService, personsService));

// Маршруты для достижений
app.use('/api', createAchievementsRoutes(pool, telegramService, achievementsService));

// Маршруты для периодов жизни
app.use('/api', createPeriodsRoutes(pool, telegramService, periodsService));

// Основные маршруты API
app.use('/api', createMetaRoutes(pool));

// Lists routes
app.use('/api', createListsRoutes(pool, listsService));

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
          quizHistory: '/api/quiz/history',
          quizLeaderboard: '/api/quiz/leaderboard',
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
    logger.info('Подключение к базе данных установлено');
    client.release();

    // Очистка истекших незавершённых сессий квизов
    try {
      const result = await cleanupExpiredQuizSessions(pool);
      if (result.deletedCount > 0) {
        logger.info('Очищено просроченных quiz сессий', { deletedCount: result.deletedCount });
      }
    } catch (error) {
      logger.error('Ошибка при очистке quiz сессий', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }

    // Запуск сервера
    app.listen(PORT, () => {
      logger.info('Хронониндзя API сервер запущен', {
        port: PORT,
        nodeEnv: process.env.NODE_ENV,
      });
      logger.info('API endpoints доступны', {
        base: `http://localhost:${PORT}`,
        health: `http://localhost:${PORT}/api/health`,
        auth: `http://localhost:${PORT}/api/auth`,
        persons: `http://localhost:${PORT}/api/persons`,
        stats: `http://localhost:${PORT}/api/stats`,
      });

      // Логгирование CORS
      const isLocal = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
      const corsInfo = isLocal ? 'http://localhost:3000' : 'все домены (*)';
      logger.info('CORS настроен', { corsInfo });
    });
  } catch (error) {
    logger.error('Ошибка при запуске сервера', {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    process.exit(1);
  }
}

// Запускаем сервер
startServer();

// Обработка завершения работы
process.on('SIGINT', async () => {
  logger.info('Получен сигнал завершения работы (SIGINT)');
  await pool.end();
  logger.info('Подключения к базе данных закрыты');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Получен сигнал завершения работы (SIGTERM)');
  await pool.end();
  logger.info('Подключения к базе данных закрыты');
  process.exit(0);
});

export default app;
