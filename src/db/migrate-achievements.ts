import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function migrateAchievements() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : (undefined as any),
  });

  try {
    console.log('🔍 Starting achievements migration...');

    // Ensure table exists (lightweight DDL only, no triggers)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS achievements (
        id SERIAL PRIMARY KEY,
        person_id TEXT NULL,
        year INTEGER NOT NULL,
        description TEXT NOT NULL,
        wikipedia_url TEXT NULL,
        image_url TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_achievements_person_id ON achievements(person_id);
      CREATE INDEX IF NOT EXISTS idx_achievements_year ON achievements(year);
    `);

    // Fetch persons with achievements or years
    const personsRes = await pool.query(
      `SELECT id, achievements, achievement_year_1, achievement_year_2, achievement_year_3
       FROM persons
       WHERE (achievements IS NOT NULL AND achievements <> '{}')
          OR achievement_year_1 IS NOT NULL
          OR achievement_year_2 IS NOT NULL
          OR achievement_year_3 IS NOT NULL`
    );

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const row of personsRes.rows) {
      const personId: string = String(row.id);
      const years: Array<number | null> = [row.achievement_year_1, row.achievement_year_2, row.achievement_year_3];
      let descriptions: string[] = [];

      const raw = row.achievements;
      if (Array.isArray(raw)) {
        descriptions = raw.filter((s: any) => typeof s === 'string' && s.trim().length > 0).map((s: string) => s.trim());
      } else if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            descriptions = parsed.filter((s: any) => typeof s === 'string' && s.trim().length > 0).map((s: string) => s.trim());
          } else if (raw.trim().length > 0) {
            descriptions = [raw.trim()];
          }
        } catch {
          if (raw.trim().length > 0) descriptions = [raw.trim()];
        }
      }

      for (let i = 0; i < Math.min(descriptions.length, 3); i++) {
        const description = descriptions[i];
        const year = years[i];
        if (!description || description.length < 1) { totalSkipped++; continue; }
        if (typeof year !== 'number' || !Number.isInteger(year)) { totalSkipped++; continue; }

        // Insert if not exists
        await pool.query(
          `INSERT INTO achievements (person_id, year, description, wikipedia_url, image_url)
           SELECT $1, $2, $3, NULL, NULL
           WHERE NOT EXISTS (
             SELECT 1 FROM achievements WHERE person_id = $1 AND year = $2 AND description = $3
           )`,
          [personId, year, description]
        );
        totalInserted++;
      }
    }

    console.log(`✅ Migration complete. Inserted: ${totalInserted}, skipped: ${totalSkipped}`);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exitCode = 1;
  }
}

migrateAchievements().then(() => process.exit());


