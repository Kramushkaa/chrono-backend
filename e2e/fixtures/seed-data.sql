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
  ('test-person-5', 'Исаак Ньютон', 1643, 1727, 'scientists', 'Английский физик, математик и астроном.', 'https://ru.wikipedia.org/wiki/Ньютон,_Исаак', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-6', 'Наполеон Бонапарт', 1769, 1821, 'politicians', 'Французский военный и политический деятель.', 'https://ru.wikipedia.org/wiki/Наполеон_I', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-7', 'Фёдор Достоевский', 1821, 1881, 'writers', 'Русский писатель, мыслитель.', 'https://ru.wikipedia.org/wiki/Достоевский,_Фёдор_Михайлович', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-draft', 'Тестовая личность', 1900, 1990, 'scientists', 'Черновик личности для сценариев модерации.', NULL, NULL, 'draft', (SELECT id FROM test.users WHERE email = 'testuser@test.com'))
ON CONFLICT (id) DO NOTHING;

-- Достижения
INSERT INTO test.achievements (person_id, year, description, wikipedia_url, status, created_by)
VALUES
  -- Эйнштейн
  ('test-person-1', 1905, 'Публикация специальной теории относительности.', 'https://ru.wikipedia.org/wiki/Специальная_теория_относительности', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-1', 1915, 'Завершение общей теории относительности.', 'https://ru.wikipedia.org/wiki/Общая_теория_относительности', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-1', 1921, 'Нобелевская премия по физике за фотоэффект.', 'https://ru.wikipedia.org/wiki/Нобелевская_премия_по_физике', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-1', 1933, 'Эмиграция в США из нацистской Германии.', 'https://ru.wikipedia.org/wiki/Эмиграция_учёных_из_нацистской_Германии', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Мария Кюри
  ('test-person-2', 1903, 'Нобелевская премия по физике (вместе с мужем).', 'https://ru.wikipedia.org/wiki/Нобелевская_премия_по_физике', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-2', 1911, 'Нобелевская премия по химии за открытие радия.', 'https://ru.wikipedia.org/wiki/Нобелевская_премия_по_химии', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-2', 1898, 'Открытие химических элементов полония и радия.', 'https://ru.wikipedia.org/wiki/Полоний', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Черчилль
  ('test-person-3', 1940, 'Становление Премьер-министром Великобритании.', 'https://ru.wikipedia.org/wiki/Премьер-министр_Великобритании', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-3', 1945, 'Победа над фашизмом в Европе.', 'https://ru.wikipedia.org/wiki/Вторая_мировая_война', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-3', 1953, 'Нобелевская премия по литературе.', 'https://ru.wikipedia.org/wiki/Нобелевская_премия_по_литературе', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Толстой
  ('test-person-4', 1869, 'Публикация романа «Война и мир».', 'https://ru.wikipedia.org/wiki/Война_и_мир', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-4', 1877, 'Публикация романа «Анна Каренина».', 'https://ru.wikipedia.org/wiki/Анна_Каренина', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-4', 1881, 'Создание школы для крестьянских детей.', 'https://ru.wikipedia.org/wiki/Педагогическая_деятельность_Л._Н._Толстого', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Ньютон
  ('test-person-5', 1687, 'Публикация «Математических начал натуральной философии».', 'https://ru.wikipedia.org/wiki/Математические_начала_натуральной_философии', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-5', 1666, 'Открытие закона всемирного тяготения.', 'https://ru.wikipedia.org/wiki/Закон_всемирного_тяготения_Ньютона', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-5', 1704, 'Публикация «Оптики» с теорией цветов.', 'https://ru.wikipedia.org/wiki/Оптика_(Ньютон)', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Наполеон
  ('test-person-6', 1799, 'Переворот 18 брюмера, приход к власти.', 'https://ru.wikipedia.org/wiki/Переворот_18_брюмера', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-6', 1804, 'Коронация императором Франции.', 'https://ru.wikipedia.org/wiki/Наполеон_I', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-6', 1815, 'Поражение при Ватерлоо.', 'https://ru.wikipedia.org/wiki/Битва_при_Ватерлоо', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Достоевский
  ('test-person-7', 1866, 'Публикация романа «Преступление и наказание».', 'https://ru.wikipedia.org/wiki/Преступление_и_наказание', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-7', 1880, 'Публикация романа «Братья Карамазовы».', 'https://ru.wikipedia.org/wiki/Братья_Карамазовы', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-7', 1869, 'Публикация романа «Идиот».', 'https://ru.wikipedia.org/wiki/Идиот_(роман)', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com'))
ON CONFLICT DO NOTHING;

-- Периоды жизни по странам
INSERT INTO test.periods (person_id, start_year, end_year, period_type, country_id, comment, status, created_by)
VALUES
  -- Эйнштейн
  ('test-person-1', 1879, 1895, 'life', (SELECT id FROM test.countries WHERE name = 'Германия'), 'Детство и учеба в Германии.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-1', 1896, 1901, 'life', (SELECT id FROM test.countries WHERE name = 'Швейцария'), 'Учеба в Цюрихе, Швейцария.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-1', 1902, 1909, 'life', (SELECT id FROM test.countries WHERE name = 'Швейцария'), 'Работа в патентном бюро Берна.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-1', 1914, 1933, 'life', (SELECT id FROM test.countries WHERE name = 'Германия'), 'Профессор в Берлине, Германия.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-1', 1933, 1955, 'life', (SELECT id FROM test.countries WHERE name = 'США'), 'Работа и жизнь в США.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Мария Кюри
  ('test-person-2', 1867, 1891, 'life', (SELECT id FROM test.countries WHERE name = 'Польша'), 'Детство и учеба в Польше.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-2', 1891, 1894, 'life', (SELECT id FROM test.countries WHERE name = 'Франция'), 'Учеба в Сорбонне, Париж.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-2', 1895, 1906, 'life', (SELECT id FROM test.countries WHERE name = 'Франция'), 'Семейная жизнь и первые исследования.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-2', 1906, 1934, 'life', (SELECT id FROM test.countries WHERE name = 'Франция'), 'Научная деятельность в Париже.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Черчилль
  ('test-person-3', 1874, 1895, 'life', (SELECT id FROM test.countries WHERE name = 'Великобритания'), 'Детство и образование в Великобритании.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-3', 1895, 1900, 'life', (SELECT id FROM test.countries WHERE name = 'Индия'), 'Военная служба в Индии.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-3', 1900, 1940, 'life', (SELECT id FROM test.countries WHERE name = 'Великобритания'), 'Политическая карьера в Великобритании.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-3', 1940, 1945, 'life', (SELECT id FROM test.countries WHERE name = 'Великобритания'), 'Руководство Великобританией во время войны.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-3', 1945, 1965, 'life', (SELECT id FROM test.countries WHERE name = 'Великобритания'), 'Послевоенная деятельность.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Толстой
  ('test-person-4', 1828, 1841, 'life', (SELECT id FROM test.countries WHERE name = 'Россия'), 'Детство в Ясной Поляне.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-4', 1841, 1847, 'life', (SELECT id FROM test.countries WHERE name = 'Россия'), 'Обучение в Казани.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-4', 1847, 1861, 'life', (SELECT id FROM test.countries WHERE name = 'Россия'), 'Военная служба на Кавказе.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-4', 1861, 1910, 'life', (SELECT id FROM test.countries WHERE name = 'Россия'), 'Творчество и жизнь в Ясной Поляне.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Ньютон
  ('test-person-5', 1643, 1661, 'life', (SELECT id FROM test.countries WHERE name = 'Великобритания'), 'Детство в Англии.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-5', 1661, 1665, 'life', (SELECT id FROM test.countries WHERE name = 'Великобритания'), 'Учеба в Кембридже.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-5', 1665, 1666, 'life', (SELECT id FROM test.countries WHERE name = 'Великобритания'), 'Годы великих открытий (чума).', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-5', 1669, 1701, 'life', (SELECT id FROM test.countries WHERE name = 'Великобритания'), 'Профессор в Кембридже.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-5', 1701, 1727, 'life', (SELECT id FROM test.countries WHERE name = 'Великобритания'), 'Президент Королевского общества.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Наполеон
  ('test-person-6', 1769, 1785, 'life', (SELECT id FROM test.countries WHERE name = 'Франция'), 'Обучение в военных училищах Франции.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-6', 1785, 1799, 'life', (SELECT id FROM test.countries WHERE name = 'Франция'), 'Военная карьера во время революции.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-6', 1799, 1815, 'life', (SELECT id FROM test.countries WHERE name = 'Франция'), 'Императорская Франция.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-6', 1815, 1821, 'life', (SELECT id FROM test.countries WHERE name = 'Великобритания'), 'Изгнание на острове Святой Елены.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Достоевский
  ('test-person-7', 1821, 1838, 'life', (SELECT id FROM test.countries WHERE name = 'Россия'), 'Детство в Москве.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-7', 1838, 1844, 'life', (SELECT id FROM test.countries WHERE name = 'Россия'), 'Учеба в Петербурге.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-7', 1844, 1859, 'life', (SELECT id FROM test.countries WHERE name = 'Россия'), 'Литературная деятельность и ссылка.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-7', 1859, 1881, 'life', (SELECT id FROM test.countries WHERE name = 'Россия'), 'Зрелое творчество в Петербурге.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com'))
ON CONFLICT DO NOTHING;


