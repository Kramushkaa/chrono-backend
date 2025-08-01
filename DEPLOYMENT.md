# Развертывание на Amvera

## Обзор

Этот документ описывает процесс развертывания backend приложения Chronoline на платформе Amvera.

## Подготовка к развертыванию

### 1. Конфигурация

Проект уже настроен для развертывания на Amvera:

- **Файл конфигурации**: `amvera.yml`
- **Основной сервер**: `simple-server.js`
- **Переменные окружения**: настроены в `amvera.yml`

### 2. Структура проекта

```
chronoline-backend-only/
├── amvera.yml          # Конфигурация Amvera
├── simple-server.js    # Основной сервер
├── package.json        # Зависимости
├── src/db/
│   ├── connection.ts   # Подключение к БД
│   └── seed.ts         # Заполнение данными
└── .dockerignore       # Исключения для сборки
```

## Конфигурация Amvera

### amvera.yml

```yaml
meta:
  environment: node
  toolchain:
    name: npm
    version: "18"

build:
  skip: false
  additionalCommands:
    - npm install
  artifacts:
    "*": /

run:
  scriptName: simple-server.js
  command: npm run start
  containerPort: "3001"
  servicePort: "80"

env:
  NODE_ENV: production
  PORT: 3001
  DB_HOST: amvera-kramushka-cnpg-chronoline-rw
  DB_PORT: 5432
  DB_NAME: chronoline
  DB_USER: Kramushka
  DB_PASSWORD: 1qwertyu
```

### Ключевые настройки:

- **Порт контейнера**: 3001 (внутренний порт приложения)
- **Порт сервиса**: 80 (внешний порт)
- **База данных**: продакшен хост `amvera-kramushka-cnpg-chronoline-rw`
- **Окружение**: `NODE_ENV=production`

## Процесс развертывания

### 1. Подготовка репозитория

Убедитесь, что все файлы закоммичены:

```bash
git add .
git commit -m "Подготовка к развертыванию на Amvera"
git push origin main
```

### 2. Развертывание через Amvera CLI

```bash
# Установка Amvera CLI (если не установлен)
npm install -g @amvera/cli

# Авторизация
amvera login

# Развертывание
amvera deploy
```

### 3. Развертывание через веб-интерфейс

1. Зайдите в [Amvera Console](https://console.amvera.io)
2. Создайте новый проект или выберите существующий
3. Подключите Git репозиторий
4. Настройте переменные окружения (если нужно)
5. Запустите развертывание

## Проверка развертывания

### 1. Проверка логов

```bash
amvera logs
```

### 2. Проверка API

После развертывания API будет доступен по адресу:
`https://your-app-name.amvera.app`

Тестовые запросы:

```bash
# Проверка статуса
curl https://your-app-name.amvera.app/

# Получение данных
curl https://your-app-name.amvera.app/api/persons
curl https://your-app-name.amvera.app/api/categories
curl https://your-app-name.amvera.app/api/countries
curl https://your-app-name.amvera.app/api/stats
```

## Мониторинг

### Логи приложения

```bash
amvera logs --follow
```

### Метрики

- **CPU**: мониторинг использования процессора
- **Memory**: использование памяти
- **Network**: сетевой трафик
- **Database**: подключения к БД

## Переменные окружения

### Продакшен (автоматически настроены)

- `NODE_ENV=production`
- `PORT=3001`
- `DB_HOST=amvera-kramushka-cnpg-chronoline-rw`
- `DB_PORT=5432`
- `DB_NAME=chronoline`
- `DB_USER=Kramushka`
- `DB_PASSWORD=1qwertyu`

### Дополнительные настройки

При необходимости можно добавить дополнительные переменные окружения через Amvera Console:

- `CORS_ORIGIN` - для ограничения CORS
- `LOG_LEVEL` - уровень логирования
- `RATE_LIMIT` - ограничения запросов

## Безопасность

### CORS

В продакшене CORS настроен на `*` (все домены). Для ограничения доступа:

1. Установите переменную окружения `CORS_ORIGIN`
2. Обновите код в `simple-server.js`

### База данных

- SSL соединение включено
- Используется продакшен хост Amvera
- Пароли хранятся в переменных окружения

## Troubleshooting

### Частые проблемы

1. **Ошибка подключения к БД**
   - Проверьте переменные окружения
   - Убедитесь, что БД доступна

2. **Ошибка порта**
   - Проверьте `containerPort` в `amvera.yml`
   - Убедитесь, что приложение слушает правильный порт

3. **CORS ошибки**
   - Проверьте настройки CORS в коде
   - Убедитесь, что frontend использует правильный URL

### Полезные команды

```bash
# Перезапуск приложения
amvera restart

# Просмотр переменных окружения
amvera env

# SSH доступ к контейнеру
amvera ssh

# Масштабирование
amvera scale 2
```

## Обновление приложения

Для обновления приложения:

1. Внесите изменения в код
2. Закоммитьте и запушьте изменения
3. Amvera автоматически пересоберет и развернет приложение

```bash
git add .
git commit -m "Обновление приложения"
git push origin main
``` 