# Миграция с simple-server.js на src/server.ts

## ✅ Полная совместимость

Новый TypeScript сервер (`src/server.ts`) полностью совместим со старым `simple-server.js` и включает все его функции:

### 🔄 Перенесенные функции:

#### 1. **Конфигурация базы данных**
- ✅ Настройки для Amvera
- ✅ SSL конфигурация
- ✅ Пул соединений с таймаутами
- ✅ Проверка подключения при запуске

#### 2. **Все API маршруты**
- ✅ `GET /` - Корневой маршрут с описанием API
- ✅ `GET /api/persons` - Список исторических личностей с фильтрацией
- ✅ `GET /api/persons/:id` - Конкретная личность по ID
- ✅ `GET /api/categories` - Список категорий
- ✅ `GET /api/countries` - Список стран
- ✅ `GET /api/stats` - Статистика

#### 3. **Фильтрация и поиск**
- ✅ Фильтрация по категориям: `?category=Правитель,Ученый`
- ✅ Фильтрация по странам: `?country=США,Германия`
- ✅ Фильтрация по годам: `?startYear=1800&endYear=1900`

#### 4. **Расширенные поля данных**
- ✅ `reignStart`, `reignEnd` (для правителей)
- ✅ `achievementYear1`, `achievementYear2`, `achievementYear3`
- ✅ `imageUrl` вместо `image_url`

#### 5. **Совместимость с таблицами**
- ✅ Поддержка `unique_categories` и `unique_countries`
- ✅ Fallback на `DISTINCT` если таблицы не существуют

#### 6. **Обработка ошибок**
- ✅ Проверка ID в маршрутах
- ✅ Graceful shutdown
- ✅ Логирование запросов

### 🆕 Новые возможности:

#### 1. **Система аутентификации**
- ✅ Полная система регистрации/входа
- ✅ JWT токены
- ✅ Роли и разрешения
- ✅ Защищенные маршруты

#### 2. **Современная архитектура**
- ✅ TypeScript
- ✅ Express.js вместо нативного HTTP
- ✅ Middleware для безопасности
- ✅ Структурированные маршруты

#### 3. **Улучшенная безопасность**
- ✅ Rate limiting
- ✅ CORS настройки
- ✅ Валидация данных
- ✅ Хеширование паролей

## 🚀 Как переключиться:

### 1. **Обновите package.json**
```json
{
  "main": "src/server.ts",
  "scripts": {
    "start": "ts-node src/server.ts",
    "dev": "nodemon --exec ts-node src/server.ts"
  }
}
```

### 2. **Установите зависимости**
```bash
npm install
```

### 3. **Запустите новый сервер**
```bash
npm run dev
```

### 4. **Удалите старый файл**
```bash
rm simple-server.js
```

## 🔧 Переменные окружения

Новый сервер использует те же переменные окружения:

```env
# Настройки сервера
PORT=3001
NODE_ENV=development

# Настройки базы данных
DB_HOST=chronoline-kramushka.db-msk0.amvera.tech
DB_PORT=5432
DB_NAME=chronoline
DB_USER=Kramushka
DB_PASSWORD=1qwertyu

# Настройки JWT (новые)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# Настройки CORS
CORS_ORIGIN=*
```

## 📊 Тестирование совместимости

Все старые API запросы будут работать без изменений:

```bash
# Корневой маршрут
curl http://localhost:3001/

# Список личностей
curl http://localhost:3001/api/persons

# Фильтрация
curl "http://localhost:3001/api/persons?category=Правитель&country=Россия&startYear=1800&endYear=1900"

# Конкретная личность
curl http://localhost:3001/api/persons/1

# Категории
curl http://localhost:3001/api/categories

# Страны
curl http://localhost:3001/api/countries

# Статистика
curl http://localhost:3001/api/stats
```

## 🎯 Преимущества нового сервера:

1. **Полная совместимость** - все старые запросы работают
2. **Новые возможности** - аутентификация и авторизация
3. **Лучшая производительность** - Express.js оптимизации
4. **Типобезопасность** - TypeScript
5. **Современная архитектура** - модульная структура
6. **Улучшенная безопасность** - rate limiting, валидация
7. **Лучшее логирование** - структурированные логи

## ⚠️ Важные замечания:

1. **Старый файл удален** - `simple-server.js` больше не нужен
2. **Новые зависимости** - установлены дополнительные пакеты
3. **TypeScript** - код теперь типизирован
4. **Аутентификация** - новые маршруты `/api/auth/*`

Миграция завершена успешно! 🎉 