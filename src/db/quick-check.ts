import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined as any,
  });
  try {
    const client = await pool.connect();
    console.log('✅ DB connect ok');

    const resUsers = await client.query("SELECT to_regclass('public.users') as users_reg");
    const resSessions = await client.query("SELECT to_regclass('public.user_sessions') as sessions_reg");
    console.log('tables:', resUsers.rows[0], resSessions.rows[0]);

  const admin = await client.query('SELECT id, email, role, is_active, password_hash IS NOT NULL as has_hash FROM users WHERE email = $1', ['admin@chrono.ninja']);
    console.log('admin:', admin.rows[0] || null);
  } catch (e) {
    console.error('❌ DB check error:', e);
  } finally {
    process.exit(0);
  }
}

main();


