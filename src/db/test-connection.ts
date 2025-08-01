import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// Конфигурация исходной базы данных (локальная)
const sourceConfig: DatabaseConfig = {
  host: 'localhost',
  port: 5432,
  database: 'chronoline_db',
  user: 'postgres',
  password: '1qwertyu'
};

// Конфигурация целевой базы данных (удаленная)
const targetConfig: DatabaseConfig = {
  host: 'chronoline-kramushka.db-msk0.amvera.tech',
  port: 5432,
  database: 'chronoline',
  user: 'Kramushka',
  password: '1qwertyu'
};

const createPool = (config: DatabaseConfig): Pool => {
  const poolConfig: PoolConfig = {
    ...config,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    ssl: {
      rejectUnauthorized: false
    }
  };

  const pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('Pool error:', err);
  });

  return pool;
};

async function testConnections() {
  console.log('🔍 Тестирование подключений к базам данных...\n');

  // Тестируем исходную базу данных
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