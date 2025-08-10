import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const createViewsSql = `
CREATE OR REPLACE VIEW v_achievements_top3 AS
SELECT person_id,
       (array_agg(description ORDER BY year))[1:3] AS achievements_top3,
       (array_agg(year ORDER BY year))[1] AS achievement_year_1,
       (array_agg(year ORDER BY year))[2] AS achievement_year_2,
       (array_agg(year ORDER BY year))[3] AS achievement_year_3,
       (array_agg(wikipedia_url ORDER BY year))[1:3] AS achievements_wiki_top3
  FROM achievements a
 GROUP BY person_id;

CREATE OR REPLACE VIEW v_api_persons AS
SELECT p.id,
       p.name,
       p.birth_year,
       p.death_year,
       rs.reign_start,
       rs.reign_end,
       p.category,
       (cl.countries)::character varying(100) AS country,
       p.description,
       p.image_url,
       COALESCE(a.achievements_top3, ARRAY[]::text[]) AS achievements,
       a.achievement_year_1,
       a.achievement_year_2,
       a.achievement_year_3,
       rp.ruler_periods,
       p.wiki_link,
       a.achievements_wiki_top3 AS achievements_wiki
  FROM persons p
  LEFT JOIN v_achievements_top3 a ON a.person_id::text = p.id::text
  LEFT JOIN v_person_ruler_span rs ON rs.person_id::text = p.id::text
  LEFT JOIN v_person_countries_life cl ON cl.person_id::text = p.id::text
  LEFT JOIN v_person_ruler_periods rp ON rp.person_id::text = p.id::text;
`;

async function run() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined as any,
  });
  try {
    console.log('Updating views: v_achievements_top3 and v_api_persons ...');
    await pool.query(createViewsSql);
    console.log('Views updated.');
  } catch (e) {
    console.error('View update failed:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();


