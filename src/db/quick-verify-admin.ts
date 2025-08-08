import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

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
    const res = await pool.query('SELECT id, email, password_hash FROM users WHERE email=$1', ['admin@chrononinja.app']);
    const row = res.rows[0];
    if (!row) {
      console.log('admin not found');
      return;
    }
    const ok = await bcrypt.compare('admin123', row.password_hash);
    console.log('compare result:', ok);
  } catch (e) {
    console.error('verify error:', e);
  } finally {
    process.exit(0);
  }
}

main();


