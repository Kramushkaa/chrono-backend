-- Создание таблицы достижений (нормализованной)
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  person_id TEXT NULL, -- ссылка на persons.id (может быть NULL)
  year INTEGER NOT NULL,
  description TEXT NOT NULL,
  wikipedia_url TEXT NULL,
  image_url TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для ускорения выборок
CREATE INDEX IF NOT EXISTS idx_achievements_person_id ON achievements(person_id);
CREATE INDEX IF NOT EXISTS idx_achievements_year ON achievements(year);

-- Триггер для автообновления updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_achievements_set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_achievements_set_updated_at
    BEFORE UPDATE ON achievements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END$$;

-- Приведение существующих данных: заполняем отсутствующие годы нулём
UPDATE achievements SET year = 0 WHERE year IS NULL;

-- Гарантируем NOT NULL для года
DO $$
BEGIN
  BEGIN
    ALTER TABLE achievements ALTER COLUMN year SET NOT NULL;
  EXCEPTION WHEN others THEN
    -- игнорируем ошибку, если ограничение уже установлено
    NULL;
  END;
END$$;


