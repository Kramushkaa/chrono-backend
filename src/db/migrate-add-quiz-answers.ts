import { Pool } from 'pg';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

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
    console.log('▶ Running quiz_attempts answers migration against DB:', process.env.DB_NAME);

    // Read SQL migration file
    const migrationPath = path.join(__dirname, 'migrations', '003_add_answers_to_quiz_attempts.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await client.query('BEGIN');

    // Execute migration
    await client.query(migrationSQL);

    await client.query('COMMIT');
    console.log('✅ Migration completed: added answers and questions to quiz_attempts');
    console.log('✅ Index created for user quiz history');
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

