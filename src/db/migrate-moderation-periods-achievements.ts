import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Загружаем .env из корневой директории проекта
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const achievementsOnly = args.includes('--achievements-only');
const checkOnly = args.includes('--check-only');

async function run() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: { rejectUnauthorized: false },
  });
  try {
    if (checkOnly) {
      console.log('Checking migration status...');
      await checkMigrationStatus(pool);
      return;
    }

    if (achievementsOnly) {
      console.log('Running migration: moderation fields for achievements only...');
      await migrateAchievementsOnly(pool);
    } else {
      console.log('Running migration: moderation fields for periods/achievements...');
      await migrateAll(pool);
    }

    console.log('Migration complete.');
  } catch (e) {
    console.error('Migration failed:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

async function checkMigrationStatus(pool: Pool) {
  // Check periods table
  const periodsResult = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'periods' 
    AND column_name IN ('status', 'created_by', 'submitted_at', 'created_at', 'updated_at')
    ORDER BY column_name
  `);

  // Check achievements table
  const achievementsResult = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'achievements' 
    AND column_name IN ('status', 'created_by', 'submitted_at', 'created_at', 'updated_at')
    ORDER BY column_name
  `);

  console.log('\nPeriods table status:');
  periodsResult.rows.forEach(row => {
    console.log(
      `  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`
    );
  });

  console.log('\nAchievements table status:');
  achievementsResult.rows.forEach(row => {
    console.log(
      `  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`
    );
  });
}

async function migrateAchievementsOnly(pool: Pool) {
  // Add moderation/audit fields to achievements only
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS created_by integer;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS updated_by integer;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS submitted_at timestamp;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS reviewed_at timestamp;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS reviewed_by integer;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS review_comment text;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);

  // Add missing timestamp fields for achievements
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT CURRENT_TIMESTAMP;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT CURRENT_TIMESTAMP;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);

  // Add foreign key constraints for achievements
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD CONSTRAINT fk_achievements_created_by 
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD CONSTRAINT fk_achievements_reviewed_by 
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // Add indexes for achievements moderation fields
  await pool.query(`
    DO $$ BEGIN
      CREATE INDEX IF NOT EXISTS idx_achievements_status ON achievements(status);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      CREATE INDEX IF NOT EXISTS idx_achievements_created_by ON achievements(created_by);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      CREATE INDEX IF NOT EXISTS idx_achievements_submitted_at ON achievements(submitted_at);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
}

async function migrateAll(pool: Pool) {
  // Add moderation/audit fields to periods
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE periods ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE periods ADD COLUMN IF NOT EXISTS created_by integer;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE periods ADD COLUMN IF NOT EXISTS updated_by integer;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE periods ADD COLUMN IF NOT EXISTS submitted_at timestamp;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE periods ADD COLUMN IF NOT EXISTS reviewed_at timestamp;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE periods ADD COLUMN IF NOT EXISTS reviewed_by integer;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE periods ADD COLUMN IF NOT EXISTS review_comment text;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);

  // Add moderation/audit fields to achievements
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS created_by integer;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS updated_by integer;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS submitted_at timestamp;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS reviewed_at timestamp;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS reviewed_by integer;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS review_comment text;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);

  // Add missing timestamp fields for achievements
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT CURRENT_TIMESTAMP;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT CURRENT_TIMESTAMP;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);

  // Add foreign key constraints for achievements
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD CONSTRAINT fk_achievements_created_by 
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE achievements ADD CONSTRAINT fk_achievements_reviewed_by 
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // Add indexes for achievements moderation fields
  await pool.query(`
    DO $$ BEGIN
      CREATE INDEX IF NOT EXISTS idx_achievements_status ON achievements(status);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      CREATE INDEX IF NOT EXISTS idx_achievements_created_by ON achievements(created_by);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      CREATE INDEX IF NOT EXISTS idx_achievements_submitted_at ON achievements(submitted_at);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // Add foreign key constraints for periods
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE periods ADD CONSTRAINT fk_periods_created_by 
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE periods ADD CONSTRAINT fk_periods_reviewed_by 
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // Add missing timestamp fields for periods
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE periods ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT CURRENT_TIMESTAMP;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE periods ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT CURRENT_TIMESTAMP;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  `);

  // Add indexes for periods moderation fields
  await pool.query(`
    DO $$ BEGIN
      CREATE INDEX IF NOT EXISTS idx_periods_status ON periods(status);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      CREATE INDEX IF NOT EXISTS idx_periods_created_by ON periods(created_by);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      CREATE INDEX IF NOT EXISTS idx_periods_submitted_at ON periods(submitted_at);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
}

run();
