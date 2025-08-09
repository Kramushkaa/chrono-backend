# Установка PostgreSQL на Windows

## 1. Скачивание PostgreSQL

1. Перейдите на официальный сайт: https://www.postgresql.org/download/windows/
2. Скачайте установщик для Windows
3. Выберите последнюю стабильную версию (рекомендуется 15 или 16)

## 2. Установка

1. **Запустите установщик** от имени администратора
2. **Выберите компоненты** для установки:
   - PostgreSQL Server
   - pgAdmin 4 (графический интерфейс)
   - Command Line Tools
   - Stack Builder (опционально)

3. **Настройте директорию данных** (оставьте по умолчанию)

4. **Установите пароль для пользователя postgres**:
   - Запомните этот пароль!
   - Он понадобится для подключения к базе данных

5. **Настройте порт** (оставьте 5432 по умолчанию)

6. **Выберите локаль** (оставьте по умолчанию)

7. **Завершите установку**

## 3. Проверка установки

### Через командную строку:
```bash
# Проверка версии
psql --version

# Подключение к PostgreSQL
psql -U postgres -h localhost
```

### Через pgAdmin 4:
1. Запустите pgAdmin 4
2. Введите мастер-пароль (установите при первом запуске)
3. Подключитесь к серверу PostgreSQL

## 4. Создание базы данных

### Через командную строку:
```bash
# Подключение к PostgreSQL
psql -U postgres -h localhost

# Создание базы данных
CREATE DATABASE chrononinja;

# Проверка создания
\l

# Выход
\q
```

### Через pgAdmin 4:
1. Правый клик на "Databases"
2. "Create" → "Database"
3. Введите имя: `chrononinja`
4. Нажмите "Save"

## 5. Настройка проекта

1. **Скопируйте файл переменных окружения**:
   ```bash
   cd backend
   cp env.example .env
   ```

2. **Отредактируйте .env файл**:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=chrononinja
   DB_USER=postgres
   DB_PASSWORD=ваш_пароль_от_postgres
   ```

3. **Инициализируйте базу данных**:
   ```bash
   npm run setup
   ```

## 6. Возможные проблемы

### Ошибка подключения:
- Проверьте, что PostgreSQL запущен
- Проверьте правильность пароля
- Убедитесь, что порт 5432 не занят

### Ошибка "password authentication failed":
- Проверьте пароль в .env файле
- Убедитесь, что используете правильного пользователя (postgres)

### Ошибка "database does not exist":
- Создайте базу данных: `CREATE DATABASE chrononinja;`

## 7. Полезные команды

```bash
# Запуск PostgreSQL сервиса
net start postgresql-x64-15

# Остановка PostgreSQL сервиса
net stop postgresql-x64-15

# Подключение к конкретной базе данных
psql -U postgres -d chrononinja

# Список всех баз данных
\l

# Список всех таблиц
\dt

# Выход из psql
\q
```

## 8. Дополнительные ресурсы

- [Официальная документация PostgreSQL](https://www.postgresql.org/docs/)
- [pgAdmin документация](https://www.pgadmin.org/docs/)
- [PostgreSQL для Windows](https://www.postgresql.org/download/windows/)