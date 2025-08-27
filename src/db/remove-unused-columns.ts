import { Pool } from 'pg'
import dotenv from 'dotenv'
import path from 'path'

// Загружаем .env из корневой директории проекта
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

async function removeUnusedColumns() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('🚀 Начинаем удаление неиспользуемых колонок...')

    // Удаление индексов
    console.log('Удаляем индексы...')
    await pool.query('DROP INDEX IF EXISTS idx_achievements_submitted_at')
    await pool.query('DROP INDEX IF EXISTS idx_periods_submitted_at')

    // Удаление колонок из achievements
    console.log('Удаляем колонки из таблицы achievements...')
    await pool.query('ALTER TABLE achievements DROP COLUMN IF EXISTS submitted_at')
    await pool.query('ALTER TABLE achievements DROP COLUMN IF EXISTS reviewed_at')

    // Удаление колонок из periods
    console.log('Удаляем колонки из таблицы periods...')
    await pool.query('ALTER TABLE periods DROP COLUMN IF EXISTS submitted_at')
    await pool.query('ALTER TABLE periods DROP COLUMN IF EXISTS reviewed_at')

    console.log('✅ Удаление колонок завершено успешно!')
  } catch (error) {
    console.error('❌ Ошибка при удалении колонок:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

removeUnusedColumns()
