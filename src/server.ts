import { createPool } from './db/pool';
import { config, validateConfig } from './config';
import { cleanupExpiredQuizSessions } from './jobs/cleanup-quiz-sessions';
import { logger } from './utils/logger';
import { createApp } from './app';

validateConfig();

const pool = createPool();
const app = createApp({ pool });
const PORT = config.server.port;

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
        nodeEnv: config.server.nodeEnv,
      });
      logger.info('API endpoints доступны', {
        base: `http://localhost:${PORT}`,
        health: `http://localhost:${PORT}/api/health`,
        auth: `http://localhost:${PORT}/api/auth`,
        persons: `http://localhost:${PORT}/api/persons`,
        stats: `http://localhost:${PORT}/api/stats`,
      });

      logger.info('CORS настроен', { allowedOrigins: config.cors.allowedOrigins });
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
