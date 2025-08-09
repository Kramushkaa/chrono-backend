import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

type DatabaseConfig = Pick<PoolConfig, 'host' | 'port' | 'database' | 'user' | 'password' | 'ssl'>;

const createPool = (config: DatabaseConfig): Pool => {
  const poolConfig: PoolConfig = {
    ...config,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  } as PoolConfig;

  const pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('Pool error:', err);
  });

  return pool;
};

async function testConnections() {
  console.log('🔍 Тестирование подключений к базам данных...\n');

  // Тестируем исходную базу данных
  // Источник: SRC_DB_* или DB_*
  const sourceConfig: DatabaseConfig = {
    host: process.env.SRC_DB_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.SRC_DB_PORT || process.env.DB_PORT || '5432'),
    database: process.env.SRC_DB_NAME || process.env.DB_NAME || 'chrononinja',
    user: process.env.SRC_DB_USER || process.env.DB_USER || 'postgres',
    password: process.env.SRC_DB_PASSWORD || process.env.DB_PASSWORD || 'password',
    ssl: (process.env.SRC_DB_SSL || process.env.DB_SSL) === 'true' ? { rejectUnauthorized: false } : undefined as any,
  };

  console.log('📊 Исходная база данных:');
  console.log(`   Host: ${sourceConfig.host}`);
  console.log(`   Port: ${sourceConfig.port}`);
  console.log(`   Database: ${sourceConfig.database}`);
  console.log(`   User: ${sourceConfig.user}`);
  const sourcePool = createPool(sourceConfig);
  
  try {
    const result = await sourcePool.query('SELECT NOW() as current_time, version() as version');
    console.log('   ✅ Подключение успешно!');
    console.log(`   Время сервера: ${result.rows[0].current_time}`);
    console.log(`   Версия PostgreSQL: ${result.rows[0].version.split(' ')[0]}`);
  } catch (error) {
    console.error('   ❌ Ошибка подключения:', error instanceof Error ? error.message : String(error));
  } finally {
    await sourcePool.end();
  }

  // Цель: TGT_DB_* или DB_*
  const targetConfig: DatabaseConfig = {
    host: process.env.TGT_DB_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.TGT_DB_PORT || process.env.DB_PORT || '5432'),
    database: process.env.TGT_DB_NAME || process.env.DB_NAME || 'chrononinja',
    user: process.env.TGT_DB_USER || process.env.DB_USER || 'postgres',
    password: process.env.TGT_DB_PASSWORD || process.env.DB_PASSWORD || 'password',
    ssl: (process.env.TGT_DB_SSL || process.env.DB_SSL) === 'true' ? { rejectUnauthorized: false } : undefined as any,
  };

  console.log('\n📊 Целевая база данных:');
  console.log(`   Host: ${targetConfig.host}`);
  console.log(`   Port: ${targetConfig.port}`);
  console.log(`   Database: ${targetConfig.database}`);
  console.log(`   User: ${targetConfig.user}`);
  const targetPool = createPool(targetConfig);
  
  try {
    const result = await targetPool.query('SELECT NOW() as current_time, version() as version');
    console.log('   ✅ Подключение успешно!');
    console.log(`   Время сервера: ${result.rows[0].current_time}`);
    console.log(`   Версия PostgreSQL: ${result.rows[0].version.split(' ')[0]}`);
  } catch (error) {
    console.error('   ❌ Ошибка подключения:', error instanceof Error ? error.message : String(error));
  } finally {
    await targetPool.end();
  }
}

// Запускаем тест
testConnections().catch(console.error); 