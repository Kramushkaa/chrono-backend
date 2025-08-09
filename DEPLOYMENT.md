# Развертывание (общее)

## Обзор

Этот документ описывает общий процесс развертывания backend приложения Хронониндзя.

## Подготовка к развертыванию

### 1. Конфигурация

Проект может быть развернут через Docker/Compose или любую CI/CD систему:

- Основной сервер: `dist/server.js`
- Переменные окружения: задаются через секреты/конфиги окружения

### 2. Структура проекта

```
chronoline-backend-only/
├── Dockerfile           # Сборка контейнера
├── dist/server.js       # Скомпилированный сервер (после npm run build)
├── package.json         # Зависимости/скрипты
├── src/                 # Исходники TypeScript
├── src/db/              # Служебные скрипты БД
└── .dockerignore        # Исключения для сборки
```

## Переменные окружения

Основные переменные:

- `NODE_ENV` — `production` в продакшене
- `PORT` — порт приложения (по умолчанию 3001)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — доступ к БД
- `DB_SSL` — `true/false` (включить SSL, если требуется)
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`
- `CORS_ORIGINS` — список доменов (через запятую), для которых разрешён доступ

## Процесс развертывания

### 1. Сборка

```bash
npm ci
npm run build
```

### 2. Развертывание через Docker

```bash
docker build -t chrononinja-backend .
docker run --rm -p 3001:3001 --env-file .env chrononinja-backend
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

## Мониторинг

Логи/метрики зависят от платформы (Docker/Kubernetes/PAAS). На Docker-хосте:

```bash
docker logs <container_id> --follow
```

## Безопасность

- Ограничьте CORS через `CORS_ORIGINS`
- Храните пароли/секреты в секретах платформы
- Включайте `DB_SSL` при необходимости

## Обновление приложения

1. Внесите изменения в код
2. Сборка/публикация
3. Перезапуск сервиса/контейнера