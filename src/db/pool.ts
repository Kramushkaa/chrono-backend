import { Pool } from 'pg';

export function createPool(): Pool {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000, // Увеличиваем таймаут для удаленной БД
    ssl: { rejectUnauthorized: false }, // Включаем SSL для удаленной базы данных
  });
}
