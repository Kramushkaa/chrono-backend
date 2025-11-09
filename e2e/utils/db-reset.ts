import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Утилиты для работы с тестовой базой данных
 */

// Создание connection pool для тестовой БД
function createTestPool(): Pool {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    // Важно! Используем search_path для тестовой схемы
    options: `-c search_path=test,public`,
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

    // Очищаем таблицы в правильном порядке (с учётом foreign keys)
    const tables = [
      'quiz_attempt_answers',
      'quiz_attempts',
      'quiz_shared_sessions',
      'quiz_shared_questions',
      'quiz_shared',
      'list_items',
      'lists',
      'life_periods',
      'achievements',
      'persons',
      'refresh_tokens',
      'password_reset_tokens',
      'email_verification_tokens',
      'users',
    ];

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
    await client.query(seedSQL);

    console.log('✅ Seed данные загружены');
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
  // Хэш для пароля "Test123!" (bcrypt)
  // В реальности нужно использовать bcryptjs.hashSync()
  const passwordHash = '$2a$10$5PXxKxF.cPXnGN7d1x5pQ.DGj5kWh8wVvKx5JJK8MJ5kFh1x5pQ.D';

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

