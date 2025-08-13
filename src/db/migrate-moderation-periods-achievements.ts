import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

async function run() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined as any,
  })
  try {
    console.log('Running migration: moderation fields for periods/achievements...')
    // Add moderation/audit fields to periods
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE periods ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE periods ADD COLUMN IF NOT EXISTS created_by integer;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE periods ADD COLUMN IF NOT EXISTS updated_by integer;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE periods ADD COLUMN IF NOT EXISTS submitted_at timestamp;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE periods ADD COLUMN IF NOT EXISTS reviewed_at timestamp;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE periods ADD COLUMN IF NOT EXISTS reviewed_by integer;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE periods ADD COLUMN IF NOT EXISTS review_comment text;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)

    // Add moderation/audit fields to achievements
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE achievements ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE achievements ADD COLUMN IF NOT EXISTS created_by integer;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE achievements ADD COLUMN IF NOT EXISTS updated_by integer;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE achievements ADD COLUMN IF NOT EXISTS submitted_at timestamp;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE achievements ADD COLUMN IF NOT EXISTS reviewed_at timestamp;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE achievements ADD COLUMN IF NOT EXISTS reviewed_by integer;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE achievements ADD COLUMN IF NOT EXISTS review_comment text;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `)

    console.log('Migration complete.')
  } catch (e) {
    console.error('Migration failed:', e)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

run()


