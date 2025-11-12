import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function initTestSchema() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🚀 Начинаем создание тестовой схемы...\n');

    // Создаём схему test если не существует
    console.log('1️⃣ Создание схемы test...');
    await pool.query('CREATE SCHEMA IF NOT EXISTS test');
    console.log('✅ Схема test создана\n');

    // Получаем список всех таблиц из public схемы
    console.log('2️⃣ Получение списка таблиц из схемы public...');
    const tablesResult = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const tables = tablesResult.rows.map(row => row.tablename);
    console.log(`📋 Найдено таблиц: ${tables.length}`);
    console.log(`   ${tables.join(', ')}\n`);

    // Копируем структуру каждой таблицы
    console.log('3️⃣ Копирование структуры таблиц...');
    for (const tableName of tables) {
      try {
        // Удаляем таблицу если существует (для повторных запусков)
        await pool.query(`DROP TABLE IF EXISTS test.${tableName} CASCADE`);

        // Создаём таблицу со всеми constraint, индексами и default значениями
        await pool.query(`
          CREATE TABLE test.${tableName} 
          (LIKE public.${tableName} INCLUDING ALL)
        `);

        console.log(`   ✅ ${tableName}`);
      } catch (error) {
        console.error(`   ❌ Ошибка при копировании ${tableName}:`, error);
      }
    }

    console.log('\n4️⃣ Восстановление внешних ключей...');

    // Получаем все внешние ключи из public схемы
    const foreignKeysResult = await pool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name
    `);

    for (const fk of foreignKeysResult.rows) {
      try {
        const deleteRule = fk.delete_rule === 'NO ACTION' ? 'NO ACTION' : fk.delete_rule;
        const updateRule = fk.update_rule === 'NO ACTION' ? 'NO ACTION' : fk.update_rule;

        await pool.query(`
          ALTER TABLE test.${fk.table_name}
          ADD CONSTRAINT ${fk.constraint_name}
          FOREIGN KEY (${fk.column_name})
          REFERENCES test.${fk.foreign_table_name}(${fk.foreign_column_name})
          ON DELETE ${deleteRule}
          ON UPDATE ${updateRule}
        `);

        console.log(`   ✅ ${fk.table_name}.${fk.constraint_name}`);
      } catch (error) {
        // Игнорируем ошибки, так как некоторые FK могли быть скопированы с INCLUDING ALL
        console.log(`   ⚠️  ${fk.table_name}.${fk.constraint_name} (уже существует или ошибка)`);
      }
    }

    // Копируем sequences и устанавливаем их для автоинкрементных полей
    console.log('\n5️⃣ Настройка sequences...');
    const sequencesResult = await pool.query(`
      SELECT 
        c.relname as sequence_name,
        t.relname as table_name,
        a.attname as column_name
      FROM pg_class c
      JOIN pg_depend d ON d.objid = c.oid
      JOIN pg_class t ON d.refobjid = t.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'S'
        AND n.nspname = 'public'
      ORDER BY t.relname, a.attname
    `);

    for (const seq of sequencesResult.rows) {
      try {
        // Создаём sequence в test схеме если не существует
        await pool.query(`
          CREATE SEQUENCE IF NOT EXISTS test.${seq.sequence_name}
        `);

        // Связываем sequence с колонкой
        await pool.query(`
          ALTER TABLE test.${seq.table_name}
          ALTER COLUMN ${seq.column_name}
          SET DEFAULT nextval('test.${seq.sequence_name}'::regclass)
        `);

        console.log(`   ✅ test.${seq.sequence_name} → ${seq.table_name}.${seq.column_name}`);
      } catch (error) {
        console.log(`   ⚠️  ${seq.sequence_name} (уже существует или ошибка)`);
      }
    }

    console.log('\n✅ Тестовая схема успешно создана!');
    console.log('\n📝 Следующие шаги:');
    console.log('   1. Заполните тестовыми данными: npm run seed:test');
    console.log('   2. Запустите тестовый сервер: npm run dev:test');
    console.log('   3. Или установите DB_SCHEMA=test в .env файле\n');
  } catch (error) {
    console.error('\n❌ Ошибка при создании тестовой схемы:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initTestSchema();




