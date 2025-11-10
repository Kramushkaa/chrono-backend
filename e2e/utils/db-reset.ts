import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

/**
 * Утилиты для работы с тестовой базой данных
 */

// Создание connection pool для тестовой БД
export function createTestPool(): Pool {
  const sslMode = (process.env.DB_SSL || '').toLowerCase();
  let ssl: boolean | { rejectUnauthorized: boolean } | undefined;

  if (sslMode === 'true' || sslMode === 'require') {
    const rejectUnauthorized =
      (process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';
    ssl = { rejectUnauthorized };
  } else if (sslMode === 'disable' || sslMode === 'false') {
    ssl = false;
  }

  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    options: `-c search_path=test,public`,
    ssl,
  });
}

/**
 * Очистка всех таблиц в тестовой схеме
 */
export async function clearTestData(): Promise<void> {
  const pool = createTestPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'test'");
    const tables = result.rows.map((row: { tablename: string }) => row.tablename);

    for (const table of tables) {
      await client.query(`TRUNCATE TABLE test.${table} RESTART IDENTITY CASCADE`);
    }

    await client.query('COMMIT');
    console.log('✅ Тестовые данные очищены');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка при очистке данных:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Полный сброс тестовой БД (очистка + seed)
 */
export async function resetDatabase(): Promise<void> {
  await clearTestData();
}

/**
 * Загрузка seed данных из SQL файла
 */
export async function seedTestData(): Promise<void> {
  const pool = createTestPool();
  const client = await pool.connect();

  try {
    // Путь к seed файлу
    const seedFilePath = path.join(__dirname, '../fixtures/seed-data.sql');

    // Проверяем существование файла
    if (!fs.existsSync(seedFilePath)) {
      console.warn('⚠️  Файл seed-data.sql не найден, создаём базовых тестовых пользователей');
      await createTestUsers(client);
      return;
    }

    // Читаем и выполняем SQL
    const seedSQL = fs.readFileSync(seedFilePath, 'utf-8');
    let seededViaFile = false;
    try {
      await client.query(seedSQL);
      seededViaFile = true;
    } catch (seedError: any) {
      console.warn('⚠️  Не удалось выполнить seed-data.sql, используем минимальный набор пользователей:', seedError.message || seedError);
      await createTestUsers(client);
    }

    console.log(seededViaFile ? '✅ Seed данные загружены' : '✅ Базовые пользователи созданы');
  } catch (error) {
    console.error('❌ Ошибка при загрузке seed данных:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Создание базовых тестовых пользователей
 */
async function createTestUsers(client: any): Promise<void> {
  const passwordHash = await bcrypt.hash('Test123!', 10);

  const users = [
    {
      username: 'testuser',
      email: 'testuser@test.com',
      role: 'user',
    },
    {
      username: 'testmoderator',
      email: 'testmoderator@test.com',
      role: 'moderator',
    },
    {
      username: 'testadmin',
      email: 'testadmin@test.com',
      role: 'admin',
    },
  ];

  for (const user of users) {
    await client.query(
      `INSERT INTO test.users (username, email, password_hash, role, is_active, email_verified)
       VALUES ($1, $2, $3, $4, true, true)
       ON CONFLICT (email) DO NOTHING`,
      [user.username, user.email, passwordHash, user.role]
    );
  }

  console.log('✅ Тестовые пользователи созданы');
}

/**
 * Выполнение произвольного SQL запроса в тестовой схеме
 */
export async function executeSQL(sql: string): Promise<any> {
  const pool = createTestPool();
  const client = await pool.connect();

  try {
    const result = await client.query(sql);
    return result.rows;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Получение текущего количества записей в таблице
 */
export async function getTableCount(tableName: string): Promise<number> {
  const rows = await executeSQL(`SELECT COUNT(*) FROM test.${tableName}`);
  return parseInt(rows[0].count);
}
