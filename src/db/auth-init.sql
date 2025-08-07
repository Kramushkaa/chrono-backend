-- Миграция для аутентификации и авторизации
-- Создание таблиц для пользователей, сессий и ролей

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE,
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  email_verification_token VARCHAR(255),
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица сессий/токенов
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица ролей
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица разрешений
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица связи ролей и разрешений
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id)
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Вставка базовых ролей
INSERT INTO roles (name, description) VALUES
  ('user', 'Обычный пользователь'),
  ('moderator', 'Модератор контента'),
  ('admin', 'Администратор системы')
ON CONFLICT (name) DO NOTHING;

-- Вставка базовых разрешений
INSERT INTO permissions (name, description) VALUES
  ('read:persons', 'Чтение данных о исторических личностях'),
  ('write:persons', 'Создание и редактирование данных о исторических личностях'),
  ('delete:persons', 'Удаление данных о исторических личностях'),
  ('read:users', 'Просмотр списка пользователей'),
  ('write:users', 'Создание и редактирование пользователей'),
  ('delete:users', 'Удаление пользователей'),
  ('manage:roles', 'Управление ролями и разрешениями'),
  ('manage:system', 'Управление системными настройками')
ON CONFLICT (name) DO NOTHING;

-- Назначение разрешений ролям
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'user' AND p.name IN ('read:persons')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'moderator' AND p.name IN ('read:persons', 'write:persons', 'read:users')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'admin' AND p.name IN ('read:persons', 'write:persons', 'delete:persons', 'read:users', 'write:users', 'delete:users', 'manage:roles', 'manage:system')
ON CONFLICT DO NOTHING;

-- Создание пользователя-администратора по умолчанию (пароль: admin123)
-- В реальном проекте пароль должен быть изменен после первого входа
INSERT INTO users (email, password_hash, username, full_name, role, email_verified) VALUES
  ('admin@chrononinja.app', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/5Qq8K8e', 'admin', 'Системный администратор', 'admin', true)
ON CONFLICT (email) DO NOTHING; 