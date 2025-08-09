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
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined as any,
});

async function initAuthTables() {
  try {
    console.log('🔐 Инициализация таблиц аутентификации...');
    
    // Читаем SQL файлы
    const authSqlPath = path.join(__dirname, 'auth-init.sql');
    const authSqlContent = fs.readFileSync(authSqlPath, 'utf8');
    
    // Выполняем SQL запросы (auth)
    await pool.query(authSqlContent);

    // Инициализация таблицы достижений (при наличии файла)
    try {
      const achievementsSqlPath = path.join(__dirname, 'achievements-init.sql');
      if (fs.existsSync(achievementsSqlPath)) {
        const achievementsSqlContent = fs.readFileSync(achievementsSqlPath, 'utf8');
        await pool.query(achievementsSqlContent);
        console.log('✅ Таблица achievements создана/актуализирована');
      }
    } catch (e) {
      console.warn('⚠️ Не удалось инициализировать таблицу achievements:', e);
    }
    
    console.log('✅ Таблицы аутентификации успешно созданы!');
    console.log('📋 Созданы таблицы:');
    console.log('   - users (пользователи)');
    console.log('   - user_sessions (сессии пользователей)');
    console.log('   - roles (роли)');
    console.log('   - permissions (разрешения)');
    console.log('   - role_permissions (связи ролей и разрешений)');
    console.log('');
    console.log('👤 Создан администратор по умолчанию:');
  console.log('   Email: admin@chrono.ninja');
    console.log('   Пароль: admin123');
    console.log('   Роль: admin');
    console.log('');
    console.log('⚠️  ВАЖНО: Измените пароль администратора после первого входа!');
    
  } catch (error) {
    console.error('❌ Ошибка при инициализации таблиц аутентификации:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Запускаем инициализацию
initAuthTables().catch(console.error); 