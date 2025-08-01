import { readFileSync } from 'fs';
import { join } from 'path';
import pool from './connection';

export async function initDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Инициализация базы данных...');
    
    // Сначала удаляем существующие представления и таблицу для чистого пересоздания
    await client.query('DROP VIEW IF EXISTS unique_countries');
    await client.query('DROP VIEW IF EXISTS unique_categories');
    await client.query('DROP TABLE IF EXISTS persons');
    console.log('🗑️ Старые таблицы и представления удалены');


    const sql = readFileSync(join(__dirname, 'init.sql'), 'utf-8');
    await client.query(sql);
    
    console.log('✅ База данных успешно инициализирована');
    console.log('📋 Созданы таблицы:');
    console.log('   - persons (исторические личности)');
    console.log('   - unique_categories (представление)');
    console.log('   - unique_countries (представление)');
    console.log('📊 Созданы индексы для оптимизации запросов');
    
  } catch (error) {
    console.error('❌ Ошибка при инициализации базы данных:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Запуск инициализации, если файл выполняется напрямую
if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('🎉 Инициализация завершена успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Ошибка:', error);
      process.exit(1);
    });
} 