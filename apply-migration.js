require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const sqlPath = path.resolve('src/db/migrations/006_add_period_and_achievement_edits_tables.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'chrononinja',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

(async () => {
  try {
    console.log('Applying migration to test schema...');
    await pool.query('SET search_path TO test');
    await pool.query(sql);
    console.log('Test schema migration complete.');

    console.log('Applying migration to public schema...');
    await pool.query('SET search_path TO public');
    await pool.query(sql);
    console.log('Public schema migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
