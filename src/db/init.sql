-- Создание базы данных (выполнить отдельно)
-- CREATE DATABASE chronoline_db;

-- Создание таблицы для исторических личностей
CREATE TABLE IF NOT EXISTS persons (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    birth_year INTEGER NOT NULL,
    death_year INTEGER NOT NULL,
    reign_start INTEGER,
    reign_end INTEGER,
    category VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    achievements TEXT[] NOT NULL,
    achievement_year_1 INTEGER,
    achievement_year_2 INTEGER,
    achievement_year_3 INTEGER,
    image_url VARCHAR(500)
);

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_persons_category ON persons(category);
CREATE INDEX IF NOT EXISTS idx_persons_country ON persons(country);
CREATE INDEX IF NOT EXISTS idx_persons_birth_year ON persons(birth_year);
CREATE INDEX IF NOT EXISTS idx_persons_death_year ON persons(death_year);

-- Создание представления для получения уникальных категорий
CREATE OR REPLACE VIEW unique_categories AS
SELECT DISTINCT category FROM persons ORDER BY category;

-- Создание представления для получения уникальных стран
CREATE OR REPLACE VIEW unique_countries AS
SELECT DISTINCT country FROM persons ORDER BY country; 