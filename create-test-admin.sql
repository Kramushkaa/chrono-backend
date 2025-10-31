-- Скрипт для создания тестового администратора
-- Используйте этот скрипт для создания админа в базе данных

-- Обновляем существующего пользователя testadmin@test.com до роли admin
UPDATE users 
SET role = 'admin' 
WHERE email = 'testadmin@test.com';

-- Или создаем нового админа напрямую:
-- INSERT INTO users (email, password_hash, username, full_name, role, is_active, email_verified, created_at, updated_at)
-- VALUES (
--   'admin@example.com',
--   '$2b$10$...',  -- Хеш пароля (используйте bcrypt)
--   'admin',
--   'Administrator',
--   'admin',
--   true,
--   true,
--   NOW(),
--   NOW()
-- );

-- Проверяем результат
SELECT id, email, username, role, is_active, email_verified 
FROM users 
WHERE role = 'admin';

