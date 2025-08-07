import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

export const config = {
  // Настройки сервера
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || 'localhost',
    nodeEnv: process.env.NODE_ENV || 'development'
  },

  // Настройки базы данных
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true'
  },

  // Настройки JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
  },

  // Настройки CORS
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },

  // Настройки email (для будущего использования)
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || ''
  },

  // Настройки безопасности
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 минут
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100')
  },

  // Настройки приложения
  app: {
    name: 'Хроно ниндзя API',
    version: '1.0.0',
    description: 'Backend API для проекта Хроно ниндзя'
  }
};

// Проверка обязательных переменных окружения
export const validateConfig = (): void => {
  const requiredEnvVars = [
    'DB_HOST',
    'DB_NAME', 
    'DB_USER',
    'DB_PASSWORD'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('⚠️  Предупреждение: Отсутствуют следующие переменные окружения:');
    missingVars.forEach(varName => console.warn(`   - ${varName}`));
    console.warn('   Используются значения по умолчанию.');
  }

  // Проверка JWT секрета в продакшене
  if (config.server.nodeEnv === 'production' && config.jwt.secret === 'your-super-secret-jwt-key-change-in-production') {
    console.error('❌ ОШИБКА: JWT_SECRET должен быть изменен в продакшене!');
    process.exit(1);
  }
};

// Экспорт типов для конфигурации
export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  ssl: boolean;
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