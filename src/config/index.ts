import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { APP_VERSION } from '../version';

// Загружаем переменные окружения
// override: false - не перезаписываем существующие переменные (для Amvera и других PaaS)
dotenv.config({ override: false });

// Helper функция для получения обязательных переменных окружения
// Критичные переменные должны быть установлены всегда, без fallback-ов
function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    logger.error(`ОШИБКА: ${key} должен быть установлен! Это критичная переменная окружения.`);
    process.exit(1);
  }

  return value;
}

export const config = {
  // Настройки сервера
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || 'localhost',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Настройки базы данных
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    // Критичная переменная - должна быть установлена всегда
    password: getRequiredEnv('DB_PASSWORD'),
    schema: process.env.DB_SCHEMA || 'public',
    ssl: process.env.DB_SSL === 'true',
    sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false', // По умолчанию true для безопасности
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
    },
    sslCert: process.env.DB_SSL_CA,
  },

  // Настройки JWT
  jwt: {
    // Критичная переменная - должна быть установлена всегда
    secret: getRequiredEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  // Настройки CORS
  cors: createCorsConfig(),

  // Настройки Telegram бота для уведомлений
  // Критичные переменные - должны быть установлены всегда
  telegram: {
    botToken: getRequiredEnv('TELEGRAM_BOT_TOKEN'),
    adminChatId: getRequiredEnv('TELEGRAM_ADMIN_CHAT_ID'),
  },

  // Настройки безопасности
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 минут
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '300'),
  },

  // Настройки приложения
  app: {
    name: 'Хроно ниндзя API',
    version: APP_VERSION,
    description: 'Backend API для проекта Хроно ниндзя',
  },

  // Фичеветки
  features: {
    publicLists: process.env.FEATURE_PUBLIC_LISTS === 'true',
  },
};

// Проверка обязательных переменных окружения
export const validateConfig = (): void => {
  const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const criticalEnvVars = ['JWT_SECRET'];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  const criticalMissingVars = criticalEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.warn('Предупреждение: Отсутствуют следующие переменные окружения', {
      missingVars,
      message: 'Используются значения по умолчанию',
    });
  }

  // Критичные переменные должны быть установлены в production
  if (config.server.nodeEnv === 'production') {
    if (criticalMissingVars.length > 0) {
      logger.error('ОШИБКА: В production должны быть установлены следующие переменные', {
        criticalMissingVars,
      });
      process.exit(1);
    }

    // Проверка JWT секрета в продакшене
    if (config.jwt.secret === 'your-super-secret-jwt-key-change-in-production') {
      logger.error('ОШИБКА: JWT_SECRET должен быть изменен в продакшене!');
      process.exit(1);
    }

    // Проверка CORS в продакшене
    if (config.cors.allowedOrigins.includes('*')) {
      logger.error('ОШИБКА: CORS не может быть "*" в продакшене!');
      process.exit(1);
    }
  }
};

// Отладочная информация о схеме БД
const schemaSource = process.env.DB_SCHEMA ? 'из DB_SCHEMA' : 'по умолчанию (public)';
logger.info('Используется схема БД', { schema: config.database.schema, source: schemaSource });

// Экспорт типов для конфигурации
export interface DatabasePoolConfig {
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  schema: string;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
  pool: DatabasePoolConfig;
  sslCert?: string;
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: string;
}

export interface FeaturesConfig {
  publicLists: boolean;
}

export interface CorsConfig {
  credentials: boolean;
  allowedOrigins: string[];
  raw: string;
}

function createCorsConfig(): CorsConfig {
  // Критичная переменная - должна быть установлена всегда
  const rawOrigins = process.env.CORS || process.env.CORS_ORIGIN || process.env.CORS_ORIGINS;

  if (!rawOrigins) {
    logger.error(
      'ОШИБКА: CORS должен быть установлен! Установите CORS, CORS_ORIGIN или CORS_ORIGINS'
    );
    process.exit(1);
  }

  const allowedOrigins = rawOrigins
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    logger.error('ОШИБКА: CORS должен содержать хотя бы один валидный origin!');
    process.exit(1);
  }

  return {
    credentials: true,
    allowedOrigins,
    raw: rawOrigins,
  };
}
