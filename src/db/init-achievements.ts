import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Загружаем .env
dotenv.config();

// Конфигурация базы данных
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chrononinja',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : (undefined as any),
});

async function initAchievements() {
  try {
    console.log('🏗️  Инициализация таблицы achievements...');
    const sqlPath = path.join(__dirname, 'achievements-init.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error('achievements-init.sql не найден');
    }
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sqlContent);
    const check = await pool.query("SELECT to_regclass('public.achievements') AS reg");
    console.log('✅ achievements OK:', check.rows[0]?.reg);
  } catch (error) {
    console.error('❌ Ошибка инициализации achievements:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

initAchievements().catch(() => process.exit(1));


