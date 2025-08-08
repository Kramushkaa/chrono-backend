import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

async function resetAdminPassword() {
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'chrononinja',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined as any,
  });

  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  const newHash = await bcrypt.hash(password, rounds);

  try {
    console.log('🔑 Сброс пароля администратора...');
    const res = await pool.query(
      `UPDATE users SET password_hash = $1, is_active = true, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING id, email`,
      [newHash, 'admin@chrono.ninja']
    );
    if (res.rowCount === 0) {
      console.log('Администратор не найден, создаю...');
      await pool.query(
        `INSERT INTO users (email, password_hash, username, full_name, role, email_verified, is_active)
         VALUES ($1, $2, 'admin', 'Системный администратор', 'admin', true, true)
         ON CONFLICT (email) DO NOTHING`,
        ['admin@chrono.ninja', newHash]
      );
    }
    console.log(`✅ Пароль администратора установлен на ${password}`);
  } catch (e) {
    console.error('❌ Ошибка при сбросе пароля администратора:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetAdminPassword();

