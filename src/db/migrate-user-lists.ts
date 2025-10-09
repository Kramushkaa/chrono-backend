import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? ({ rejectUnauthorized: false } as any) : undefined,
  });
  const client = await pool.connect();
  try {
    console.log('▶ Running lists migration against DB:', process.env.DB_NAME);
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS lists (
        id SERIAL PRIMARY KEY,
        owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS list_items (
        id SERIAL PRIMARY KEY,
        list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
        item_type TEXT NOT NULL CHECK (item_type IN ('person','achievement','period')),
        person_id VARCHAR NULL REFERENCES persons(id) ON DELETE CASCADE,
        achievement_id INTEGER NULL REFERENCES achievements(id) ON DELETE CASCADE,
        period_id INTEGER NULL REFERENCES periods(id) ON DELETE CASCADE,
        period_json JSONB NULL,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items(list_id)`);
    await client.query('COMMIT');
    console.log('✅ Migration completed: lists, list_items');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
