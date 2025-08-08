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
  -e CORS_ORIGINS=chrono.ninja,*.chrono.ninja,http://localhost:3000 \
  --name chrononinja-backend chrononinja-backend
```

# Хроно ниндзя Backend

Backend API для проекта Хроно ниндзя - интерактивной временной шкалы исторических личностей.

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
   CREATE DATABASE chronoline_db;
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
DB_NAME=chronoline_db
DB_USER=postgres
DB_PASSWORD=your_password

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

### 4. Инициализация базы данных

1. Выполните SQL скрипт для создания таблиц:
   ```bash
   psql -d chronoline_db -f src/db/init.sql
   ```

2. Заполните базу данных начальными данными:
   ```bash
   npm run seed
   ```

### 5. Запуск сервера

```bash
npm start
# или
npm run dev
# или
node simple-server.js
```

**Примечание:** `npm run dev` в корне проекта запускает фронтенд, а в папке `backend/` - бэкенд.

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
├── simple-server.js         # Основной сервер
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