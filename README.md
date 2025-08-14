## Docker

Build image:

```
docker build -t chrononinja-backend .
```

Run (with env):

```
docker run --rm -p 3001:3001 \
  -e DB_HOST=... -e DB_PORT=5432 -e DB_NAME=chrononinja -e DB_USER=postgres -e DB_PASSWORD=... \
  -e DB_SSL=false \
  -e JWT_SECRET=... -e JWT_EXPIRES_IN=24h -e REFRESH_TOKEN_EXPIRES_IN=7d \
  -e CORS="https://chrono.ninja,.chrono.ninja,http://localhost:3000" \
  --name chrononinja-backend chrononinja-backend
```

# Хронониндзя Backend

Backend API для проекта Хронониндзя — интерактивной временной шкалы исторических личностей.

## Технологии

- **Node.js** - среда выполнения
- **Express.js** - веб-фреймворк
- **PostgreSQL** - база данных
- **TypeScript** - типизированный JavaScript
- **pg** - драйвер PostgreSQL для Node.js

## Установка и настройка

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка PostgreSQL

1. Установите PostgreSQL на вашу систему
2. Создайте базу данных:
   ```sql
   CREATE DATABASE chrononinja;
   ```
3. Скопируйте файл `env.example` в `.env` и настройте параметры подключения:
   ```bash
   cp env.example .env
   ```

### 3. Настройка переменных окружения

Отредактируйте файл `.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chrononinja
DB_USER=postgres
DB_PASSWORD=your_password

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration (supports patterns like *.domain and .domain)
CORS=http://localhost:3000
```

### 4. Структура базы данных

- Фактическая схема описана в `DB_SCHEMA.md` (генерируется из текущей БД).
- Для регенерации файла используйте: `npm run db:schema`.

### 5. Запуск сервера

```bash
npm start
# или
npm run dev
# или
node dist/server.js
```

**Примечание:** `npm run dev` в корне проекта запускает фронтенд, а в папке `backend/` — бэкенд.

### Переменные окружения для миграций/тестов (опционально)

В дополнение к `DB_*` можно задавать отдельные параметры источника/цели:

```
SRC_DB_HOST=...
SRC_DB_PORT=5432
SRC_DB_NAME=...
SRC_DB_USER=...
SRC_DB_PASSWORD=...
SRC_DB_SSL=false
TGT_DB_HOST=...
TGT_DB_PORT=5432
TGT_DB_NAME=...
TGT_DB_USER=...
TGT_DB_PASSWORD=...
TGT_DB_SSL=false
```

## API Endpoints

### Основные маршруты

- `GET /` - Информация об API
- `GET /api/persons` - Получить всех исторических личностей
- `GET /api/persons/:id` - Получить личность по ID
- `GET /api/persons/categories/list` - Получить список категорий
- `GET /api/persons/countries/list` - Получить список стран
- `GET /api/persons/stats/overview` - Получить статистику

### Параметры запросов

#### Фильтрация по категории:
```
GET /api/persons?category=Философ
```

#### Фильтрация по стране:
```
GET /api/persons?country=Древняя Греция
```

#### Фильтрация по временному диапазону:
```
GET /api/persons?startYear=-500&endYear=1500
```

#### Комбинированная фильтрация:
```
GET /api/persons?category=Ученый&country=Англия&startYear=1600&endYear=1900
```

## Структура проекта

```
backend/
├── src/
│   ├── db/
│   │   ├── connection.ts    # Подключение к базе данных
│   │   ├── init.sql         # SQL скрипт инициализации
│   │   └── seed.ts          # Заполнение данными
│   ├── routes/
│   │   ├── persons.ts       # Маршруты API
│   │   ├── categories.ts    # Категории
│   │   ├── countries.ts     # Страны
│   │   └── stats.ts         # Статистика
│   └── types/
│       └── index.ts         # TypeScript типы
├── package.json
├── tsconfig.json
└── README.md
```

## Разработка

### Добавление новых маршрутов

1. Создайте новый файл в папке `src/routes/`
2. Импортируйте и используйте маршрут в `src/app.ts`

### Изменение структуры базы данных

1. Обновите `src/db/init.sql`
2. Обновите типы в `src/types/index.ts`
3. Обновите соответствующие маршруты

## Лицензия

ISC 