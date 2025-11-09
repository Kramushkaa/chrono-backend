-- Seed данные для E2E тестов Хронониндзя
-- Используем тестовую схему (test)

-- Тестовые пользователи
-- Пароль для всех: Test123!
-- Хэш сгенерирован через bcryptjs.hashSync('Test123!', 10)
INSERT INTO test.users (username, email, password_hash, role, is_active, email_verified, created_at)
VALUES 
  ('testuser', 'testuser@test.com', '$2a$10$YourHashHere', 'user', true, true, NOW()),
  ('testmoderator', 'testmoderator@test.com', '$2a$10$YourHashHere', 'moderator', true, true, NOW()),
  ('testadmin', 'testadmin@test.com', '$2a$10$YourHashHere', 'admin', true, true, NOW())
ON CONFLICT (email) DO NOTHING;

-- Тестовые личности (разные категории и страны)
INSERT INTO test.persons (id, name, birth_year, death_year, category, country, occupation, bio, wiki_link, image_url, moderation_status, created_at)
VALUES 
  ('test-person-1', 'Альберт Эйнштейн', 1879, 1955, 'scientists', 'Германия', 'Физик-теоретик', 'Автор теории относительности', 'https://ru.wikipedia.org/wiki/Эйнштейн,_Альберт', NULL, 'published', NOW()),
  ('test-person-2', 'Мария Кюри', 1867, 1934, 'scientists', 'Польша', 'Физик, химик', 'Первая женщина-лауреат Нобелевской премии', 'https://ru.wikipedia.org/wiki/Склодовская-Кюри,_Мария', NULL, 'published', NOW()),
  ('test-person-3', 'Уинстон Черчилль', 1874, 1965, 'politicians', 'Великобритания', 'Политик, премьер-министр', 'Премьер-министр Великобритании во время Второй мировой войны', 'https://ru.wikipedia.org/wiki/Черчилль,_Уинстон', NULL, 'published', NOW()),
  ('test-person-4', 'Лев Толстой', 1828, 1910, 'writers', 'Россия', 'Писатель, философ', 'Автор романов "Война и мир" и "Анна Каренина"', 'https://ru.wikipedia.org/wiki/Толстой,_Лев_Николаевич', NULL, 'published', NOW()),
  ('test-person-5', 'Фрида Кало', 1907, 1954, 'artists', 'Мексика', 'Художник', 'Мексиканская художница, автопортреты', 'https://ru.wikipedia.org/wiki/Кало,_Фрида', NULL, 'published', NOW()),
  ('test-person-6', 'Стив Джобс', 1955, 2011, 'entrepreneurs', 'США', 'Предприниматель', 'Сооснователь Apple Inc.', 'https://ru.wikipedia.org/wiki/Джобс,_Стив', NULL, 'published', NOW()),
  ('test-person-7', 'Никола Тесла', 1856, 1943, 'scientists', 'Сербия', 'Изобретатель, инженер', 'Изобретатель в области электротехники', 'https://ru.wikipedia.org/wiki/Тесла,_Никола', NULL, 'published', NOW()),
  ('test-person-8', 'Клеопатра', -69, -30, 'politicians', 'Египет', 'Фараон', 'Последняя царица Египта', 'https://ru.wikipedia.org/wiki/Клеопатра', NULL, 'published', NOW()),
  ('test-person-9', 'Чарльз Дарвин', 1809, 1882, 'scientists', 'Великобритания', 'Натуралист', 'Автор теории эволюции', 'https://ru.wikipedia.org/wiki/Дарвин,_Чарльз', NULL, 'published', NOW()),
  ('test-person-10', 'Махатма Ганди', 1869, 1948, 'politicians', 'Индия', 'Политик, философ', 'Лидер индийского движения за независимость', 'https://ru.wikipedia.org/wiki/Махатма_Ганди', NULL, 'published', NOW()),
  -- Draft личность для тестов модерации
  ('test-person-draft', 'Тестовая Личность', 1900, 2000, 'scientists', 'Россия', 'Тестер', 'Тестовое описание', NULL, NULL, 'draft', NOW())
ON CONFLICT (id) DO NOTHING;

-- Тестовые достижения
INSERT INTO test.achievements (person_id, year, title, description, created_at)
VALUES 
  ('test-person-1', 1905, 'Специальная теория относительности', 'Публикация работы о специальной теории относительности', NOW()),
  ('test-person-1', 1915, 'Общая теория относительности', 'Завершение общей теории относительности', NOW()),
  ('test-person-1', 1921, 'Нобелевская премия по физике', 'Награда за объяснение фотоэлектрического эффекта', NOW()),
  ('test-person-2', 1903, 'Нобелевская премия по физике', 'Совместно с мужем за исследование радиации', NOW()),
  ('test-person-2', 1911, 'Нобелевская премия по химии', 'За открытие радия и полония', NOW()),
  ('test-person-3', 1953, 'Нобелевская премия по литературе', 'За мастерство исторического и биографического описания', NOW()),
  ('test-person-4', 1869, 'Война и мир', 'Публикация романа "Война и мир"', NOW()),
  ('test-person-4', 1877, 'Анна Каренина', 'Публикация романа "Анна Каренина"', NOW()),
  ('test-person-6', 1976, 'Основание Apple', 'Сооснование компании Apple Computer', NOW()),
  ('test-person-6', 2007, 'Презентация iPhone', 'Представление первого iPhone', NOW())
ON CONFLICT DO NOTHING;

-- Тестовые периоды жизни
INSERT INTO test.life_periods (person_id, start_year, end_year, title, description, location, created_at)
VALUES 
  ('test-person-1', 1879, 1894, 'Детство', 'Ранние годы в Германии', 'Ульм, Германия', NOW()),
  ('test-person-1', 1896, 1900, 'Обучение в Цюрихе', 'Учёба в Политехникуме', 'Цюрих, Швейцария', NOW()),
  ('test-person-1', 1902, 1909, 'Работа в патентном бюро', 'Служащий патентного бюро', 'Берн, Швейцария', NOW()),
  ('test-person-1', 1914, 1933, 'Профессор в Берлине', 'Работа в университете', 'Берлин, Германия', NOW()),
  ('test-person-2', 1891, 1894, 'Обучение в Сорбонне', 'Изучение физики и математики', 'Париж, Франция', NOW()),
  ('test-person-2', 1895, 1906, 'Научные исследования', 'Работа над радиоактивностью', 'Париж, Франция', NOW()),
  ('test-person-4', 1828, 1844, 'Детство', 'Ранние годы в Ясной Поляне', 'Ясная Поляна, Россия', NOW()),
  ('test-person-4', 1851, 1853, 'Служба на Кавказе', 'Военная служба', 'Кавказ, Россия', NOW()),
  ('test-person-4', 1862, 1910, 'Писательская деятельность', 'Период создания главных произведений', 'Ясная Поляна, Россия', NOW())
ON CONFLICT DO NOTHING;

-- Примечание: В реальном использовании нужно заменить '$2a$10$YourHashHere' на реальный хэш
-- Можно сгенерировать через Node.js:
-- const bcrypt = require('bcryptjs');
-- const hash = bcrypt.hashSync('Test123!', 10);
-- console.log(hash);

