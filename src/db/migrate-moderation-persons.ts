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
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined as any,
  });

  const sql = `
  DO $$ BEGIN
    BEGIN
      ALTER TABLE persons
        ADD COLUMN status TEXT NOT NULL DEFAULT 'approved',
        ADD COLUMN created_by INTEGER,
        ADD COLUMN updated_by INTEGER,
        ADD COLUMN submitted_at TIMESTAMP NULL,
        ADD COLUMN reviewed_at TIMESTAMP NULL,
        ADD COLUMN reviewed_by INTEGER,
        ADD COLUMN review_comment TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
  END $$;

  CREATE TABLE IF NOT EXISTS person_edits (
    id SERIAL PRIMARY KEY,
    person_id VARCHAR NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    proposer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected
    review_comment TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL
  );

  CREATE INDEX IF NOT EXISTS idx_person_edits_status ON person_edits(status);
  CREATE INDEX IF NOT EXISTS idx_persons_status ON persons(status);
  `;

  try {
    console.log('Running moderation migration (persons + person_edits)...');
    await pool.query(sql);
    console.log('Moderation migration complete.');
  } catch (e) {
    console.error('Migration failed:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();


