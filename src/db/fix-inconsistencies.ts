import { Pool, PoolClient } from 'pg';
const VIEWS_SQL = `
-- View: top-3 achievements per person (descriptions and first 3 years)
CREATE OR REPLACE VIEW v_achievements_top3 AS
SELECT
  a.person_id,
  (ARRAY_AGG(a.description ORDER BY a.year NULLS LAST))[1:3] AS achievements_top3,
  (ARRAY_AGG(a.year ORDER BY a.year NULLS LAST))[1] AS achievement_year_1,
  (ARRAY_AGG(a.year ORDER BY a.year NULLS LAST))[2] AS achievement_year_2,
  (ARRAY_AGG(a.year ORDER BY a.year NULLS LAST))[3] AS achievement_year_3
FROM achievements a
GROUP BY a.person_id;

-- View: periods with country names
CREATE OR REPLACE VIEW v_periods_with_names AS
SELECT
  p.id,
  p.person_id,
  p.start_year,
  p.end_year,
  p.period_type,
  p.comment,
  p.country_id,
  c.name AS country_name
FROM periods p
LEFT JOIN countries c ON c.id = p.country_id;

-- View: aggregated periods per person as JSONB array
CREATE OR REPLACE VIEW v_person_periods AS
SELECT
  person_id,
  JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'id', id,
      'start_year', start_year,
      'end_year', end_year,
      'type', period_type,
      'country_id', country_id,
      'country_name', country_name,
      'comment', comment
    ) ORDER BY start_year
  ) AS periods
FROM v_periods_with_names
GROUP BY person_id;

-- View: ruler span per person (min/max years)
CREATE OR REPLACE VIEW v_person_ruler_span AS
SELECT
  person_id,
  MIN(start_year) AS reign_start,
  MAX(end_year) AS reign_end
FROM periods
WHERE period_type = 'ruler'
GROUP BY person_id;

-- View: aggregated life countries per person
CREATE OR REPLACE VIEW v_person_countries_life AS
SELECT
  person_id,
  STRING_AGG(DISTINCT country_name, '/' ORDER BY country_name) AS countries
FROM v_periods_with_names
WHERE period_type = 'life' AND country_name IS NOT NULL
GROUP BY person_id;

-- View: aggregated ruler periods per person
CREATE OR REPLACE VIEW v_person_ruler_periods AS
SELECT
  person_id,
  JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'start_year', start_year,
      'end_year', end_year,
      'country_id', country_id,
      'country_name', country_name
    ) ORDER BY start_year
  ) AS ruler_periods
FROM v_periods_with_names
WHERE period_type = 'ruler'
GROUP BY person_id;

-- View: API-friendly persons with aggregated achievements
CREATE OR REPLACE VIEW v_api_persons AS
SELECT
  p.id,
  p.name,
  p.birth_year,
  p.death_year,
  rs.reign_start,
  rs.reign_end,
  p.category,
  CAST(cl.countries AS VARCHAR(100)) AS country,
  p.description,
  p.image_url,
  COALESCE(a.achievements_top3, ARRAY[]::text[]) AS achievements,
  a.achievement_year_1,
  a.achievement_year_2,
  a.achievement_year_3,
  rp.ruler_periods
FROM persons p
LEFT JOIN v_achievements_top3 a ON a.person_id = p.id
LEFT JOIN v_person_ruler_span rs ON rs.person_id = p.id
LEFT JOIN v_person_countries_life cl ON cl.person_id = p.id
LEFT JOIN v_person_ruler_periods rp ON rp.person_id = p.id;

-- View: countries list
CREATE OR REPLACE VIEW v_countries AS
SELECT id, name, created_at FROM countries;

-- View: country stats by periods
CREATE OR REPLACE VIEW v_country_stats AS
SELECT
  c.id,
  c.name,
  COUNT(DISTINCT pr.person_id) AS persons_with_periods,
  COUNT(*) FILTER (WHERE pr.period_type = 'ruler') AS ruler_periods,
  COUNT(*) FILTER (WHERE pr.period_type = 'life') AS life_periods
FROM countries c
LEFT JOIN periods pr ON pr.country_id = c.id
GROUP BY c.id, c.name;`;
import dotenv from 'dotenv';

dotenv.config();

async function ensureVarcharPersonId(executor: Pool | PoolClient, table: 'achievements' | 'periods') {
  // Coerce to varchar type if currently text
  const colTypeRes = await executor.query(
    `SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='person_id'`,
    [table]
  );
  const dataType = colTypeRes.rows[0]?.data_type;
  if (dataType && dataType.toLowerCase() === 'text') {
    console.log(`🔧 Altering ${table}.person_id to character varying ...`);
    await executor.query(`ALTER TABLE ${table} ALTER COLUMN person_id TYPE varchar USING person_id::varchar`);
  }

  // Nullify invalid references to avoid FK add failure
  console.log(`🔎 Nullifying ${table}.person_id not present in persons ...`);
  await executor.query(
    `UPDATE ${table} t
     SET person_id = NULL
     WHERE person_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM persons p WHERE p.id = t.person_id)`
  );
}

async function addForeignKeyIfMissing(executor: Pool | PoolClient, table: 'achievements' | 'periods', constraint: string) {
  const existsRes = await executor.query(
    `SELECT 1 FROM pg_constraint WHERE conname = $1`,
    [constraint]
  );
  if (existsRes.rowCount && existsRes.rowCount > 0) {
    console.log(`ℹ️  Constraint ${constraint} already exists`);
    return;
  }
  console.log(`🔗 Adding FK ${constraint} on ${table}.person_id → persons(id) ...`);
  await executor.query(
    `ALTER TABLE ${table}
     ADD CONSTRAINT ${constraint}
     FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE SET NULL`
  );
}

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined as any,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop dependent views to allow type changes
    console.log('🧹 Dropping dependent views (if exist)...');
    const dropViews = [
      'v_api_persons',
      'v_person_ruler_periods',
      'v_person_countries_life',
      'v_person_ruler_span',
      'v_person_periods',
      'v_periods_with_names',
      'v_achievements_top3',
      'v_country_stats',
      'v_countries'
    ];
    for (const v of dropViews) {
      await client.query(`DROP VIEW IF EXISTS ${v} CASCADE`);
    }

    // Achievements
    await ensureVarcharPersonId(client, 'achievements');
    await addForeignKeyIfMissing(client, 'achievements', 'fk_achievements_person');

    // Periods
    await ensureVarcharPersonId(client, 'periods');
    await addForeignKeyIfMissing(client, 'periods', 'fk_periods_person');

    // Recreate views
    console.log('🏗️ Recreating views ...');
    await client.query(VIEWS_SQL);

    await client.query('COMMIT');
    console.log('✅ Inconsistencies fixed');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to fix inconsistencies:', e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


