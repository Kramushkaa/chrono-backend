# Развертывание (общее)

## Обзор

Этот документ описывает общий процесс развертывания backend приложения Хронониндзя.

## Требования к окружению

- **Node.js 22+** — требуется для поддержки ES2024 (Promise.withResolvers, Iterator helpers, Set methods)
- **PostgreSQL** — база данных

## Подготовка к развертыванию

### 1. Конфигурация

Проект может быть развернут через Docker/Compose или любую CI/CD систему:

- Основной сервер: `dist/server.js`
- Переменные окружения: задаются через секреты/конфиги окружения

### 2. Структура проекта

```
chrononinja-backend/
├── Dockerfile           # Сборка контейнера
├── dist/server.js       # Скомпилированный сервер (после npm run build)
├── package.json         # Зависимости/скрипты
├── src/                 # Исходники TypeScript
├── src/db/              # Служебные скрипты БД
└── .dockerignore        # Исключения для сборки
```

## Переменные окружения

### Обязательные переменные

#### База данных
- `DB_HOST` — хост PostgreSQL
- `DB_PORT` — порт (по умолчанию 5432)
- `DB_NAME` — имя базы данных
- `DB_USER` — пользователь БД
- `DB_PASSWORD` — пароль БД (⚠️ хранить в секретах!)

#### Безопасность
- `JWT_SECRET` — секретный ключ для JWT (⚠️ ОБЯЗАТЕЛЬНО изменить в production!)
  - Генерация: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `JWT_EXPIRES_IN` — время жизни access token (по умолчанию 24h)
- `REFRESH_TOKEN_EXPIRES_IN` — время жизни refresh token (по умолчанию 7d)

#### CORS
- `CORS` или `CORS_ORIGINS` — список доменов через запятую
  - Поддерживаются шаблоны: `*.domain.com`, `.domain.com`
  - ⚠️ В production НЕ использовать `*`

### Опциональные переменные

- `NODE_ENV` — окружение (`production`, `development`)
- `PORT` — порт приложения (по умолчанию 3001)
- `DB_SSL` — включить SSL для БД (`true`/`false`)
- `DB_SSL_REJECT_UNAUTHORIZED` — проверка SSL сертификата (по умолчанию `true`)
- `DB_POOL_MAX` — максимум соединений в пуле (по умолчанию 20)
- `TELEGRAM_BOT_TOKEN` — токен Telegram бота для уведомлений
- `TELEGRAM_ADMIN_CHAT_ID` — ID чата для уведомлений
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — настройки email
- `BCRYPT_ROUNDS` — раунды хеширования паролей (по умолчанию 12)

### Чек-лист переменных окружения перед деплоем

- [ ] `JWT_SECRET` изменен и имеет длину 64+ символов
- [ ] `DB_PASSWORD` хранится в секретах платформы
- [ ] `CORS_ORIGINS` настроен на конкретные домены (не `*`)
- [ ] `NODE_ENV=production` установлен
- [ ] `DB_SSL=true` если требуется
- [ ] Telegram уведомления настроены (опционально)

## Процесс развертывания

### 1. Сборка

```bash
npm ci
npm run build
```

### 2. Развертывание через Docker

Образ основан на Node.js 22 Alpine:

```bash
docker build -t chrononinja-backend:node22 .
docker run --rm -p 3001:3001 --env-file .env chrononinja-backend:node22
```

**Откат:** если возникнут проблемы, вернитесь к предыдущему образу с Node 20:
```bash
# В Dockerfile замените node:22-alpine на node:20-alpine
docker build -t chrononinja-backend:node20-rollback .
```

## Проверка развертывания

### 1. Проверка API

Проверьте эндпоинты окружения вашего хостинга:

```bash
# Проверка статуса
curl http://<HOST>:3001/

# Получение данных
curl http://<HOST>:3001/api/persons
curl http://<HOST>:3001/api/categories
curl http://<HOST>:3001/api/countries
curl http://<HOST>:3001/api/stats
```

## Health Checks и мониторинг

### Health Check эндпоинты

- `GET /health` — полная проверка здоровья (БД, пул соединений, кэш)
- `GET /ready` — готовность к обработке запросов
- `GET /live` — проверка жизнеспособности (без зависимостей)

### Мониторинг логов

```bash
# Docker
docker logs <container_id> --follow

# Kubernetes
kubectl logs -f deployment/chrononinja-backend

# Фильтрация по уровню
docker logs <container_id> 2>&1 | grep ERROR
```

### Метрики для мониторинга

- Response time БД (должен быть < 1000ms)
- Использование connection pool (< 90% capacity)
- Размер кэша (доступно в `/health`)
- Rate limit violations (логируются как security events)
- Failed login attempts (security events)

### Telegram уведомления

Если настроены `TELEGRAM_BOT_TOKEN` и `TELEGRAM_ADMIN_CHAT_ID`:
- Security events (high/critical severity)
- Новые регистрации
- Модерация контента
- Критические ошибки

## Backup и восстановление БД

### Создание backup

```bash
# Полный backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f backup_$(date +%Y%m%d).dump

# Только схема
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME --schema-only -f schema.sql

# Только данные
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME --data-only -f data.sql
```

### Восстановление

```bash
# Из custom format
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME backup.dump

# Из SQL файла
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f backup.sql
```

### Рекомендации

- Автоматические backup каждые 24 часа
- Хранить backup минимум 7 дней
- Тестировать восстановление регулярно
- Хранить backup в отдельном регионе/зоне

## Rollback стратегия

### Откат приложения

1. **Откат Docker образа:**
   ```bash
   docker tag chrononinja-backend:previous chrononinja-backend:latest
   docker-compose up -d
   ```

2. **Откат через Git:**
   ```bash
   git revert <commit-hash>
   npm run build
   docker build -t chrononinja-backend:rollback .
   ```

3. **Откат Node.js версии** (если проблемы с Node 22):
   - В `Dockerfile` изменить `FROM node:22-alpine` на `FROM node:20-alpine`
   - Пересобрать образ

### Откат миграций БД

```bash
# Восстановить из backup
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME --clean backup_before_migration.dump
```

## Security checklist перед деплоем

### Обязательно

- [ ] `JWT_SECRET` уникальный и криптографически стойкий (64+ символов)
- [ ] Все пароли/токены в секретах платформы (не в коде/env файлах)
- [ ] `CORS_ORIGINS` ограничен конкретными доменами
- [ ] `NODE_ENV=production`
- [ ] SSL для БД включен (`DB_SSL=true`)
- [ ] Rate limiting настроен на всех эндпоинтах
- [ ] Helmet middleware активен (защита заголовков)

### Рекомендуется

- [ ] Telegram уведомления для security events
- [ ] Мониторинг логов настроен
- [ ] Backup БД автоматизирован
- [ ] Health checks интегрированы с load balancer
- [ ] npm audit проверен (нет high/critical уязвимостей)
- [ ] TypeScript компиляция без ошибок
- [ ] Все тесты проходят

## Обновление приложения

### Процесс обновления

1. **Подготовка:**
   ```bash
   # Создать backup БД
   pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f backup_before_update.dump
   
   # Проверить тесты локально
   npm test
   npm run type-check
   ```

2. **Сборка:**
   ```bash
   npm ci
   npm run build
   docker build -t chrononinja-backend:v$(date +%Y%m%d) .
   ```

3. **Деплой:**
   ```bash
   # Остановить старый контейнер
   docker stop chrononinja-backend
   
   # Запустить новый
   docker run -d --name chrononinja-backend \
     --env-file .env \
     -p 3001:3001 \
     chrononinja-backend:v$(date +%Y%m%d)
   ```

4. **Проверка:**
   ```bash
   # Health check
   curl http://localhost:3001/health
   
   # Проверка логов
   docker logs chrononinja-backend --tail 100
   ```

5. **Rollback при проблемах:**
   ```bash
   docker stop chrononinja-backend
   docker start chrononinja-backend-previous
   ```

### Zero-downtime deployment

Для production рекомендуется использовать:
- Blue-green deployment
- Rolling updates (Kubernetes)
- Load balancer с health checks

## Troubleshooting

### Проблемы с подключением к БД

```bash
# Проверить доступность БД
pg_isready -h $DB_HOST -p $DB_PORT

# Проверить логи контейнера
docker logs chrononinja-backend | grep "Database"
```

### Высокое использование памяти

- Проверить размер connection pool (`DB_POOL_MAX`)
- Проверить размер кэша в `/health`
- Мониторить медленные запросы (> 1000ms)

### Rate limit ошибки

- Проверить логи security events
- Увеличить лимиты если легитимный трафик
- Заблокировать IP если атака