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
  ('test-person-8', 'Махатма Ганди', 1869, 1948, 'politicians', 'Лидер движения за независимость Индии.', 'https://ru.wikipedia.org/wiki/Махатма_Ганди', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-9', 'Никола Тесла', 1856, 1943, 'scientists', 'Изобретатель в области электричества и радиотехники.', 'https://ru.wikipedia.org/wiki/Тесла,_Никола', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-10', 'Ада Лавлейс', 1815, 1852, 'scientists', 'Первая в истории программистка, работала с Чарльзом Бэббиджем.', 'https://ru.wikipedia.org/wiki/Лавлейс,_Ада', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-11', 'Чарльз Дарвин', 1809, 1882, 'scientists', 'Естествознатель, автор теории эволюции.', 'https://ru.wikipedia.org/wiki/Дарвин,_Чарльз', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-12', 'Жанна д`Арк', 1412, 1431, 'politicians', 'Национальная героиня Франции, возглавляла французское войско.', 'https://ru.wikipedia.org/wiki/Жанна_д%27Арк', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-13', 'Марко Поло', 1254, 1324, 'explorers', 'Венецианский купец и путешественник, автор знаменитых записок.', 'https://ru.wikipedia.org/wiki/Марко_Поло', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-14', 'Леонардо да Винчи', 1452, 1519, 'artists', 'Художник и изобретатель эпохи Возрождения.', 'https://ru.wikipedia.org/wiki/Леонардо_да_Винчи', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-15', 'Галилео Галилей', 1564, 1642, 'scientists', 'Итальянский учёный, один из основателей современной физики.', 'https://ru.wikipedia.org/wiki/Галилей,_Галилео', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-16', 'Нельсон Мандела', 1918, 2013, 'politicians', 'Борец с апартеидом, президент ЮАР.', 'https://ru.wikipedia.org/wiki/Мандела,_Нельсон', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-17', 'Клеопатра', -69, -30, 'politicians', 'Последняя царица эллинистического Египта.', 'https://ru.wikipedia.org/wiki/Клеопатра', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-18', 'Вольфганг Амадей Моцарт', 1756, 1791, 'artists', 'Австрийский композитор, представитель венской классической школы.', 'https://ru.wikipedia.org/wiki/Моцарт,_Вольфганг_Амадей', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-19', 'Софья Ковалевская', 1850, 1891, 'scientists', 'Русская математик, первая женщина-профессор в Европе.', 'https://ru.wikipedia.org/wiki/Ковалевская,_Софья_Васильевна', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-20', 'Грейс Хоппер', 1906, 1992, 'scientists', 'Разработчик первых компиляторов, контр-адмирал ВМС США.', 'https://ru.wikipedia.org/wiki/Грейс_Хоппер', NULL, 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
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
  ('test-person-7', 1869, 'Публикация романа «Идиот».', 'https://ru.wikipedia.org/wiki/Идиот_(роман)', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  -- Ганди
  ('test-person-8', 1915, 'Возвращение в Индию и начало борьбы за независимость.', 'https://ru.wikipedia.org/wiki/Махатма_Ганди', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-8', 1930, 'Соляной поход против британской монополии.', 'https://ru.wikipedia.org/wiki/Соляной_поход', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-8', 1947, 'Добивается независимости Индии.', 'https://ru.wikipedia.org/wiki/Независимость_Индии', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  -- Тесла
  ('test-person-9', 1888, 'Изобретение асинхронного двигателя переменного тока.', 'https://ru.wikipedia.org/wiki/Тесла,_Никола', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-9', 1891, 'Создание резонансного трансформатора (катушка Тесла).', 'https://ru.wikipedia.org/wiki/Катушка_Тесла', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-9', 1898, 'Представление радиоуправляемой лодки.', 'https://ru.wikipedia.org/wiki/Радиоуправление', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  -- Ада Лавлейс
  ('test-person-10', 1843, 'Публикация заметок к аналитической машине Бэббиджа.', 'https://ru.wikipedia.org/wiki/Аналитическая_машина', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-10', 1843, 'Описание алгоритма вычисления чисел Бернулли.', 'https://ru.wikipedia.org/wiki/Числа_Бернулли', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  -- Чарльз Дарвин
  ('test-person-11', 1859, 'Публикация «Происхождения видов».', 'https://ru.wikipedia.org/wiki/Происхождение_видов', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-11', 1831, 'Отправляется в пятилетнее путешествие на корабле «Бигль».', 'https://ru.wikipedia.org/wiki/Путешествие_на_корабле_«Бигль»', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  -- Жанна д\'Арк
  ('test-person-12', 1429, 'Освобождение Орлеана от англичан.', 'https://ru.wikipedia.org/wiki/Орлеанская_осада', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-12', 1429, 'Коронация Карла VII в Реймсе.', 'https://ru.wikipedia.org/wiki/Карл_VII_(король_Франции)', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  -- Марко Поло
  ('test-person-13', 1271, 'Отправляется в путешествие на Восток.', 'https://ru.wikipedia.org/wiki/Марко_Поло', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-13', 1298, 'Венецианско-генуэзская война и пленение.', 'https://ru.wikipedia.org/wiki/Венецианско-генуэзская_война_(1294—1299)', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  -- Леонардо да Винчи
  ('test-person-14', 1503, 'Начало работы над «Мона Лизой».', 'https://ru.wikipedia.org/wiki/Мона_Лиза', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-14', 1498, 'Завершение «Тайной вечери».', 'https://ru.wikipedia.org/wiki/Тайная_вечеря_(Леонардо_да_Винчи)', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-14', 1487, 'Создание рисунка «Витрувианский человек».', 'https://ru.wikipedia.org/wiki/Витрувианский_человек', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  -- Галилео Галилей
  ('test-person-15', 1609, 'Изобретение телескопа и наблюдение Луны.', 'https://ru.wikipedia.org/wiki/Телескоп', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-15', 1633, 'Суд инквизиции за поддержку гелиоцентризма.', 'https://ru.wikipedia.org/wiki/Суд_над_Галилео', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  -- Нельсон Мандела
  ('test-person-16', 1993, 'Нобелевская премия мира.', 'https://ru.wikipedia.org/wiki/Нобелевская_премия_мира', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-16', 1994, 'Становится президентом ЮАР.', 'https://ru.wikipedia.org/wiki/Мандела,_Нельсон', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  -- Клеопатра
  ('test-person-17', -48, 'Союз с Юлием Цезарем после битвы при Фарсале.', 'https://ru.wikipedia.org/wiki/Юлий_Цезарь', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-17', -31, 'Поражение при Акции и союз с Марком Антонием.', 'https://ru.wikipedia.org/wiki/Битва_при_Акции', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  -- Моцарт
  ('test-person-18', 1786, 'Премьера оперы «Свадьба Фигаро».', 'https://ru.wikipedia.org/wiki/Свадьба_Фигаро', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-18', 1791, 'Премьера «Волшебной флейты».', 'https://ru.wikipedia.org/wiki/Волшебная_флейта', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-18', 1787, 'Премьера «Дон Жуана».', 'https://ru.wikipedia.org/wiki/Дон_Жуан_(опера)', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  -- Ковалевская
  ('test-person-19', 1884, 'Первая женщина-профессор Северной Европы.', 'https://ru.wikipedia.org/wiki/Софья_Ковалевская', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-19', 1888, 'Премия Парижской академии наук за работу по вращению твёрдого тела.', 'https://ru.wikipedia.org/wiki/Софья_Ковалевская', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  -- Грейс Хоппер
  ('test-person-20', 1952, 'Создание первого компилятора A-0.', 'https://ru.wikipedia.org/wiki/Грейс_Хоппер', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-20', 1959, 'Участие в разработке COBOL.', 'https://ru.wikipedia.org/wiki/COBOL', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com'))
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
  ('test-person-2', 1867, 1891, 'life', 6, 'Детство и учеба в Польше.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-2', 1891, 1894, 'life', 5, 'Учеба в Сорбонне, Париж.', 'approved', (SELECT id FROM	test.users WHERE email = 'testadmin@test.com')),
  ('test-person-2', 1895, 1906, 'life', 5, 'Семейная жизнь и первые исследования.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-2', 1906, 1934, 'life', 5, 'Научная деятельность в Париже.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Черчилль
  ('test-person-3', 1874, 1895, 'life', 4, 'Детство и образование в Великобритании.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-3', 1895, 1900, 'life', 10, 'Военная служба в Индии.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-3', 1900, 1940, 'life', 4, 'Политическая карьера в Великобритании.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-3', 1940, 1945, 'life', 4, 'Руководство Великобританией во время войны.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-3', 1945, 1965, 'life', 4, 'Послевоенная деятельность.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Толстой
  ('test-person-4', 1828, 1841, 'life', 1, 'Детство в Ясной Поляне.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-4', 1841, 1847, 'life', 1, 'Обучение в Казани.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-4', 1847, 1861, 'life', 1, 'Военная служба на Кавказе.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-4', 1861, 1910, 'life', 1, 'Творчество и жизнь в Ясной Поляне.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Ньютон
  ('test-person-5', 1643, 1661, 'life', 4, 'Детство в Англии.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-5', 1661, 1665, 'life', 4, 'Учеба в Кембридже.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-5', 1665, 1666, 'life', 4, 'Годы великих открытий (чума).', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-5', 1669, 1701, 'life', 4, 'Профессор в Кембридже.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-5', 1701, 1727, 'life', 4, 'Президент Королевского общества.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Наполеон
  ('test-person-6', 1769, 1785, 'life', 5, 'Обучение в военных училищах Франции.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-6', 1785, 1799, 'life', 5, 'Военная карьера во время революции.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-6', 1799, 1815, 'life', 5, 'Императорская Франция.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-6', 1815, 1821, 'life', 4, 'Изгнание на острове Святой Елены.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Достоевский
  ('test-person-7', 1821, 1838, 'life', 1, 'Детство в Москве.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-7', 1838, 1844, 'life', 1, 'Учеба в Петербурге.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-7', 1844, 1859, 'life', 1, 'Литературная деятельность и ссылка.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-7', 1859, 1881, 'life', 1, 'Зрелое творчество в Петербурге.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Ганди
  ('test-person-8', 1869, 1888, 'life', 6, 'Детство и юность в Индии.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-8', 1888, 1891, 'life', 4, 'Учёба в Лондоне, подготовка к адвокатской практике.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-8', 1893, 1914, 'life', 2, 'Юридическая практика и борьба с апартеидом в Южной Африке.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-8', 1915, 1948, 'life', 6, 'Движение за независимость Индии.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Никола Тесла
  ('test-person-9', 1856, 1884, 'life', 3, 'Детство и учеба в Австро-Венгрии/Сербии.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-9', 1884, 1943, 'life', 2, 'Научная и изобретательская деятельность в США.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Ада Лавлейс
  ('test-person-10', 1815, 1852, 'life', 4, 'Жизнь и работа в Англии, сотрудничество с Бэббиджем.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Чарльз Дарвин
  ('test-person-11', 1809, 1882, 'life', 4, 'Жизнь в Великобритании и научные исследования.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-11', 1831, 1836, 'life', 7, 'Кругосветная экспедиция «Бигля» и наблюдения.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Жанна д\'Арк
  ('test-person-12', 1412, 1431, 'life', 5, 'Жизнь и подвиг во Франции.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Марко Поло
  ('test-person-13', 1254, 1324, 'life', 2, 'Путешествия и жизнь на Востоке (условно приписано к Италии/Венеции).', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Леонардо да Винчи
  ('test-person-14', 1452, 1519, 'life', 5, 'Жизнь и творчество в Италии (указано как Франция для разнообразия стран).', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Галилео Галилей
  ('test-person-15', 1564, 1642, 'life', 5, 'Италия (для тестов интерпретируем как Франция) — научная деятельность.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Нельсон Мандела
  ('test-person-16', 1918, 2013, 'life', 2, 'Южная Африка (условно используем США для расширения перечня).', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Клеопатра
  ('test-person-17', -69, -30, 'life', 9, 'Правление в Египте.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Моцарт
  ('test-person-18', 1756, 1791, 'life', 3, 'Австрия (представляем как Германия) — музыкальная карьера.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Софья Ковалевская
  ('test-person-19', 1850, 1891, 'life', 1, 'Россия — ранние годы и обучение.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  ('test-person-19', 1883, 1891, 'life', 2, 'Швеция (используем США) — профессорская деятельность.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com')),
  
  -- Грейс Хоппер
  ('test-person-20', 1906, 1992, 'life', 2, 'Вся жизнь и карьера в США.', 'approved', (SELECT id FROM test.users WHERE email = 'testadmin@test.com'))
ON CONFLICT DO NOTHING;


