import { createPool } from './pool';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const pool = createPool();

  try {
    console.log('🔄 Running quiz indexes optimization migration...');

    const migrationPath = path.join(__dirname, 'migrations', '004_optimize_quiz_indexes.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    await pool.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('📊 Indexes created:');
    console.log('  - idx_quiz_attempts_config_gin');
    console.log('  - idx_quiz_attempts_shared_leaderboard');
    console.log('  - idx_quiz_attempts_global_leaderboard');
    console.log('  - idx_quiz_attempts_user_history');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

