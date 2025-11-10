-- Seed данные для E2E тестов Хронониндзя
-- Используем схему test (search_path=test,public)

-- Пользователи (пароль для всех: Test123!)
INSERT INTO test.users (email, password_hash, username, full_name, role, is_active, email_verified)
VALUES
  ('testuser@test.com', '$2b$10$U7L.QhbqTY9nQopJ1nxateVUS3HHMCGnZVAS910lfQ98uOBMjn6gq', 'testuser', 'Тестовый пользователь', 'user', true, true),
  ('testmoderator@test.com', '$2b$10$U7L.QhbqTY9nQopJ1nxateVUS3HHMCGnZVAS910lfQ98uOBMjn6gq', 'testmoderator', 'Тестовый модератор', 'moderator', true, true),
  ('testadmin@test.com', '$2b$10$U7L.QhbqTY9nQopJ1nxateVUS3HHMCGnZVAS910lfQ98uOBMjn6gq', 'testadmin', 'Тестовый администратор', 'admin', true, true)
ON CONFLICT (email) DO NOTHING;

-- Справочник стран
INSERT INTO test.countries (id, name)
VALUES
  (1, 'Россия'),
  (2, 'США'),
  (3, 'Германия'),
  (4, 'Великобритания'),
  (5, 'Франция'),
  (6, 'Польша'),
  (7, 'Мексика'),
  (8, 'Сербия'),
  (9, 'Египет'),
  (10, 'Индия')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Личности
INSERT INTO test.persons (id, name, birth_year, death_year, category, description, wiki_link, image_url, status, created_by)
VALUES
  ('test-person-1', 'Альберт Эйнштейн', 1879, 1955, 'scientists', 'Теоретический физик, автор теории относительности.', 'https://ru.wikipedia.org/wiki/Эйнштейн,_Альберт', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-2', 'Мария Кюри', 1867, 1934, 'scientists', 'Физик и химик, дважды лауреат Нобелевской премии.', 'https://ru.wikipedia.org/wiki/Склодовская-Кюри,_Мария', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-3', 'Уинстон Черчилль', 1874, 1965, 'politicians', 'Премьер-министр Великобритании в годы Второй мировой войны.', 'https://ru.wikipedia.org/wiki/Черчилль,_Уинстон', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-4', 'Лев Толстой', 1828, 1910, 'writers', 'Русский писатель, автор «Войны и мира» и «Анны Карениной».', 'https://ru.wikipedia.org/wiki/Толстой,_Лев_Николаевич', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-draft', 'Тестовая личность', 1900, 1990, 'scientists', 'Черновик личности для сценариев модерации.', NULL, NULL, 'draft', (SELECT id FROM test.users WHERE email = 'testuser@test.com'))
ON CONFLICT (id) DO NOTHING;

-- Достижения
INSERT INTO test.achievements (person_id, year, description, wikipedia_url, status, created_by)
VALUES
  ('test-person-1', 1905, 'Публикация специальной теории относительности.', 'https://ru.wikipedia.org/wiki/Специальная_теория_относительности', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-1', 1915, 'Завершение общей теории относительности.', 'https://ru.wikipedia.org/wiki/Общая_теория_относительности', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-2', 1903, 'Нобелевская премия по физике.', 'https://ru.wikipedia.org/wiki/Нобелевская_премия_по_физике', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-4', 1869, 'Публикация романа «Война и мир».', 'https://ru.wikipedia.org/wiki/Война_и_мир', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com'))
ON CONFLICT DO NOTHING;

-- Периоды жизни по странам
INSERT INTO test.periods (person_id, start_year, end_year, period_type, country_id, comment, status, created_by)
VALUES
  ('test-person-1', 1879, 1895, 'life', (SELECT id FROM test.countries WHERE name = 'Германия'), 'Детство и учеба в Германии.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-1', 1933, 1955, 'life', (SELECT id FROM test.countries WHERE name = 'США'), 'Работа и жизнь в США.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-2', 1891, 1934, 'life', (SELECT id FROM test.countries WHERE name = 'Франция'), 'Научная деятельность в Париже.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-3', 1940, 1945, 'life', (SELECT id FROM test.countries WHERE name = 'Великобритания'), 'Руководство Великобританией во время войны.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-4', 1870, 1910, 'life', (SELECT id FROM test.countries WHERE name = 'Россия'), 'Творчество и жизнь в Ясной Поляне.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com'))
ON CONFLICT DO NOTHING;


