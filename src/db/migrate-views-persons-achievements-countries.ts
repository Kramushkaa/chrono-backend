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
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : (undefined as any),
  });
  try {
    console.log('Running migration: update views for persons/achievements/countries...');

    // 1) Countries of life periods: add arrays country_names and country_ids, keep countries string for compatibility
    await pool.query(`
      CREATE OR REPLACE VIEW v_person_countries_life AS
      SELECT
        pr.person_id,
        COALESCE(string_agg(DISTINCT c.name, ' / ' ORDER BY c.name), '') AS countries,
        COALESCE(array_agg(DISTINCT c.name ORDER BY c.name), ARRAY[]::text[]) AS country_names,
        COALESCE(array_agg(DISTINCT c.id ORDER BY c.id), ARRAY[]::int[]) AS country_ids
      FROM periods pr
      LEFT JOIN countries c ON c.id = pr.country_id
      WHERE pr.period_type = 'life'
      GROUP BY pr.person_id;
    `);

    // 2) Drop obsolete top-3 view if present
    await pool.query(`
      DO $$ BEGIN
        PERFORM 1 FROM pg_views WHERE viewname = 'v_achievements_top3';
        IF FOUND THEN EXECUTE 'DROP VIEW IF EXISTS v_achievements_top3'; END IF;
      END $$;
    `);

    // 3) Main API view: drop and recreate to change column list
    await pool.query(`DROP VIEW IF EXISTS v_api_persons CASCADE`);
    await pool.query(`
      CREATE VIEW v_api_persons AS
      SELECT
        p.id,
        p.name,
        p.birth_year,
        p.death_year,
        rs.reign_start,
        rs.reign_end,
        p.category,
        (cl.countries)::varchar(100) AS country,
        cl.country_names,
        cl.country_ids,
        p.description,
        p.image_url,
        COALESCE(a.achievements_all, ARRAY[]::text[]) AS achievements,
        a.achievement_years,
        rp.ruler_periods,
        p.wiki_link,
        COALESCE(a.achievements_wiki_all, ARRAY[]::text[]) AS achievements_wiki,
        p.status
      FROM persons p
      LEFT JOIN v_person_achievements_all a ON a.person_id = p.id
      LEFT JOIN v_person_ruler_span rs ON rs.person_id = p.id
      LEFT JOIN v_person_countries_life cl ON cl.person_id = p.id
      LEFT JOIN v_person_ruler_periods rp ON rp.person_id = p.id;
    `);

    // 4) Recreate dependent views
    await pool.query(`
      CREATE VIEW v_approved_persons AS
      SELECT * FROM v_api_persons WHERE status = 'approved'
    `);

    await pool.query(`
      CREATE VIEW v_pending_moderation AS
      SELECT v.*, p.created_at, p.updated_at, p.created_by, p.updated_by
      FROM v_api_persons v
      JOIN persons p ON p.id = v.id
      WHERE p.status = 'pending'
    `);

    console.log('Migration complete.');
  } catch (e) {
    console.error('Migration failed:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
