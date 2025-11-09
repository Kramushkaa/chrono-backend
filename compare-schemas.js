const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Pool } = require('pg');

const sslMode = (process.env.DB_SSL || '').toLowerCase();
let ssl;
if (sslMode === 'true' || sslMode === 'require') {
  const reject = (process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';
  ssl = { rejectUnauthorized: reject };
} else if (sslMode === 'false' || sslMode === 'disable') {
  ssl = false;
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'chrononinja',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl,
});

(async () => {
  try {
    const query = "select schemaname, tablename from pg_tables where schemaname in ('public','test') order by schemaname, tablename";
    const res = await pool.query(query);
    const tables = {};
    for (const row of res.rows) {
      tables[row.schemaname] = tables[row.schemaname] || [];
      tables[row.schemaname].push(row.tablename);
    }

    const publicTables = new Set(tables.public || []);
    const testTables = new Set(tables.test || []);

    const missingInTest = [...publicTables].filter(t => !testTables.has(t));
    const extraInTest = [...testTables].filter(t => !publicTables.has(t));

    console.log('Всего таблиц в public:', publicTables.size);
    console.log('Всего таблиц в test:', testTables.size);
    console.log('Таблицы отсутствуют в test:', missingInTest.length ? missingInTest.join(', ') : 'нет');
    console.log('Таблицы лишние в test:', extraInTest.length ? extraInTest.join(', ') : 'нет');
  } catch (err) {
    console.error('Ошибка при сравнении схем:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
