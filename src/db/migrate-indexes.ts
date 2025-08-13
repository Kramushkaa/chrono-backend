import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined as any,
  })
  const client = await pool.connect()
  try {
    console.log('Applying helpful indexes...')
    const statements = [
      `CREATE INDEX IF NOT EXISTS idx_persons_status ON persons(status)`,
      `CREATE INDEX IF NOT EXISTS idx_persons_created_by ON persons(created_by)`,
      `CREATE INDEX IF NOT EXISTS idx_achievements_created_by ON achievements(created_by)`,
      `CREATE INDEX IF NOT EXISTS idx_achievements_status ON achievements(status)`,
      `CREATE INDEX IF NOT EXISTS idx_periods_created_by ON periods(created_by)`,
      `CREATE INDEX IF NOT EXISTS idx_periods_period_type ON periods(period_type)`,
      `CREATE INDEX IF NOT EXISTS idx_periods_country_id ON periods(country_id)`,
      `CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON list_items(list_id)`,
      `CREATE INDEX IF NOT EXISTS idx_list_items_unique_person ON list_items(list_id, item_type, person_id)`,
      `CREATE INDEX IF NOT EXISTS idx_list_items_unique_achievement ON list_items(list_id, item_type, achievement_id)`,
      `CREATE INDEX IF NOT EXISTS idx_list_items_unique_period ON list_items(list_id, item_type, period_id)`,
      // Trigram indexes for ILIKE search (requires pg_trgm extension)
      `DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_trgm; EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;`,
      `CREATE INDEX IF NOT EXISTS idx_persons_name_trgm ON persons USING gin (name gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS idx_persons_category_trgm ON persons USING gin (category gin_trgm_ops)`,
      // persons.country column is no longer in use; skip trigram index for it
      `CREATE INDEX IF NOT EXISTS idx_persons_description_trgm ON persons USING gin (description gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS idx_achievements_description_trgm ON achievements USING gin (description gin_trgm_ops)`,
      // Unique partial indexes to enforce no duplicates per list/type
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_list_items_person ON list_items(list_id, item_type, person_id) WHERE item_type = 'person' AND person_id IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_list_items_achievement ON list_items(list_id, item_type, achievement_id) WHERE item_type = 'achievement' AND achievement_id IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_list_items_period ON list_items(list_id, item_type, period_id) WHERE item_type = 'period' AND period_id IS NOT NULL`,
    ]
    for (const sql of statements) {
      console.log('> ' + sql)
      await client.query(sql)
    }
    console.log('Indexes applied.')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })


