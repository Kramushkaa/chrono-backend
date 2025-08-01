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
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // SSL только для удаленной базы данных
    ssl: config.host !== 'localhost' ? {
      rejectUnauthorized: false
    } : false
  };

  const pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  return pool;
};

async function migrateData() {
  const sourcePool = createPool(sourceConfig);
  const targetPool = createPool(targetConfig);

  try {
    console.log('🔍 Подключение к базам данных...');
    
    // Проверяем подключения
    await sourcePool.query('SELECT NOW()');
    console.log('✅ Подключение к исходной базе данных установлено');
    
    await targetPool.query('SELECT NOW()');
    console.log('✅ Подключение к целевой базе данных установлено');

    // Получаем список всех таблиц из исходной базы
    console.log('📋 Получение списка таблиц...');
    const tablesResult = await sourcePool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(row => row.table_name);
    console.log(`📊 Найдено таблиц: ${tables.length}`);
    console.log('Таблицы:', tables);

    // Переносим данные из каждой таблицы
    for (const tableName of tables) {
      console.log(`\n🔄 Перенос таблицы: ${tableName}`);
      
      try {
        // Получаем структуру таблицы
        const structureResult = await sourcePool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = $1 
          AND table_schema = 'public'
          ORDER BY ordinal_position
        `, [tableName]);

        const columns = structureResult.rows;
        console.log(`   Структура: ${columns.length} колонок`);

        // Получаем данные из исходной таблицы
        const dataResult = await sourcePool.query(`SELECT * FROM "${tableName}"`);
        const rows = dataResult.rows;
        console.log(`   Данных: ${rows.length} строк`);

        if (rows.length === 0) {
          console.log(`   ⚠️  Таблица ${tableName} пуста, пропускаем`);
          continue;
        }

        // Очищаем целевую таблицу (если существует)
        try {
          await targetPool.query(`DELETE FROM "${tableName}"`);
          console.log(`   🗑️  Очищена целевая таблица ${tableName}`);
        } catch (error) {
          console.log(`   ℹ️  Таблица ${tableName} не существует или не может быть очищена`);
        }

        // Вставляем данные в целевую таблицу
        if (rows.length > 0) {
          const columnNames = Object.keys(rows[0]);
          const placeholders = columnNames.map((_, index) => `$${index + 1}`).join(', ');
          const insertQuery = `INSERT INTO "${tableName}" (${columnNames.map(name => `"${name}"`).join(', ')}) VALUES (${placeholders})`;

          // Вставляем данные пакетами для больших таблиц
          const batchSize = 1000;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            
            for (const row of batch) {
              const values = columnNames.map(col => row[col]);
              await targetPool.query(insertQuery, values);
            }
            
            console.log(`   📦 Вставлено ${Math.min(i + batchSize, rows.length)} из ${rows.length} строк`);
          }
        }

        console.log(`   ✅ Таблица ${tableName} успешно перенесена`);

             } catch (error) {
         console.error(`   ❌ Ошибка при переносе таблицы ${tableName}:`, error instanceof Error ? error.message : String(error));
       }
    }

    console.log('\n🎉 Миграция данных завершена!');

     } catch (error) {
     console.error('❌ Ошибка при миграции:', error instanceof Error ? error.message : String(error));
   } finally {
    await sourcePool.end();
    await targetPool.end();
    console.log('🔌 Соединения с базами данных закрыты');
  }
}

// Запускаем миграцию
migrateData().catch(console.error); 