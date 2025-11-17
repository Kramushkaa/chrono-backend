import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
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
import { createPersonRoutes } from './routes/persons';
import { createListsRoutes } from './routes/listsRoutes';
import { createAchievementsRoutes } from './routes/achievementsRoutes';
import { createPeriodsRoutes } from './routes/periodsRoutes';
import { createMetaRoutes } from './routes/metaRoutes';
import { createQuizRoutes } from './routes/quizRoutes';
import { createHealthRoutes } from './routes/healthRoutes';
import { config } from './config';
import { APP_VERSION } from './version';
import { logger } from './utils/logger';

interface CreateAppOptions {
  pool: Pool;
}

function isOriginAllowed(origin: string, patterns: string[]): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();

    for (const pattern of patterns) {
      if (pattern === '*') return true;
      if (pattern.startsWith('http://') || pattern.startsWith('https://')) {
        if (origin === pattern) return true;
        continue;
      }

      const normalized = pattern.toLowerCase();

      if (normalized.startsWith('*.')) {
        const base = normalized.slice(2);
        if (host === base || host.endsWith(`.${base}`)) return true;
      } else if (normalized.startsWith('.')) {
        const base = normalized.slice(1);
        if (host === base || host.endsWith(`.${base}`)) return true;
      } else if (host === normalized || host.endsWith(`.${normalized}`)) {
        return true;
      }
    }
  } catch {}

  return false;
}

export function createApp({ pool }: CreateAppOptions) {
  const telegramService = new TelegramService(
    config.telegram.botToken,
    config.telegram.adminChatId
  );
  const authService = new AuthService(pool);
  const emailService = new EmailService();
  const achievementsService = new AchievementsService(pool, telegramService);
  const periodsService = new PeriodsService(pool, telegramService);
  const personsService = new PersonsService(pool, telegramService);
  const listsService = new ListsService(pool, telegramService);
  const userService = new UserService(pool);
  const authController = new AuthController(
    authService,
    telegramService,
    emailService,
    userService
  );

  const app = express();
  const allowedOrigins = config.cors.allowedOrigins;
  const isProd = config.server.nodeEnv === 'production';

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(helmet());

  app.use(
    cors({
      credentials: config.cors.credentials,
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (isOriginAllowed(origin, allowedOrigins)) return callback(null, true);
        return callback(new Error(`CORS: Origin ${origin} is not allowed`));
      },
    })
  );

  if (isProd && allowedOrigins.includes('*')) {
    logger.error('В продакшене CORS_ORIGINS не может быть "*". Укажите явные источники.');
    process.exit(1);
  }

  app.use('/api/auth', createAuthRoutes(authController));
  app.use(logRequest);
  app.use('/', createHealthRoutes(pool, telegramService));
  app.use('/api', createPersonRoutes(pool, telegramService, personsService));
  app.use('/api', createAchievementsRoutes(pool, telegramService, achievementsService));
  app.use('/api', createPeriodsRoutes(pool, telegramService, periodsService));
  app.use('/api', createMetaRoutes(pool));
  app.use('/api', createListsRoutes(pool, listsService));
  app.use('/api', createQuizRoutes(pool));

  app.get(
    '/api/backend-info',
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          name: 'Хронониндзя API',
          version: APP_VERSION,
          environment: config.server.nodeEnv,
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

  app.post(
    '/api/backend-switch',
    asyncHandler(async (req: Request, res: Response) => {
      const { backendUrl } = req.body;

      if (!backendUrl || typeof backendUrl !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Invalid backend URL',
          message: "Необходимо указать URL backend'а",
        });
        return;
      }

      try {
        new URL(backendUrl);

        res.json({
          success: true,
          data: {
            message: 'Backend URL updated',
            backendUrl,
            timestamp: new Date().toISOString(),
          },
        });
      } catch {
        res.status(400).json({
          success: false,
          error: 'Invalid URL format',
          message: 'Неверный формат URL',
        });
      }
    })
  );

  app.get('/', (_req, res) => {
    res.json({
      message: 'Хронониндзя API',
      appVersion: APP_VERSION,
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

  app.use(errorHandler);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: 'Маршрут не найден',
    });
  });

  return app;
}

export default createApp;
