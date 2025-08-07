import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Конфигурация базы данных
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chrononinja',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function initAuthTables() {
  try {
    console.log('🔐 Инициализация таблиц аутентификации...');
    
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, 'auth-init.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Выполняем SQL запросы
    await pool.query(sqlContent);
    
    console.log('✅ Таблицы аутентификации успешно созданы!');
    console.log('📋 Созданы таблицы:');
    console.log('   - users (пользователи)');
    console.log('   - user_sessions (сессии пользователей)');
    console.log('   - roles (роли)');
    console.log('   - permissions (разрешения)');
    console.log('   - role_permissions (связи ролей и разрешений)');
    console.log('');
    console.log('👤 Создан администратор по умолчанию:');
    console.log('   Email: admin@chrononinja.app');
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