-- Удаление колонок submitted_at и reviewed_at из таблиц achievements и periods
-- Выполнять в порядке: сначала индексы, затем колонки

-- Удаление индексов для achievements
DROP INDEX IF EXISTS idx_achievements_submitted_at;

-- Удаление индексов для periods
DROP INDEX IF EXISTS idx_periods_submitted_at;

-- Удаление колонок из achievements
ALTER TABLE achievements DROP COLUMN IF EXISTS submitted_at;
ALTER TABLE achievements DROP COLUMN IF EXISTS reviewed_at;

-- Удаление колонок из periods
ALTER TABLE periods DROP COLUMN IF EXISTS submitted_at;
ALTER TABLE periods DROP COLUMN IF EXISTS reviewed_at;
