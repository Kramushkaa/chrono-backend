# Тестовая среда

Документация по настройке и использованию тестовой схемы базы данных для Хронониндзя Backend.

## Обзор

Проект использует отдельную схему PostgreSQL (`test`) в той же базе данных для изоляции тестовых данных от продакшн-данных. Это обеспечивает:

- ✅ Изоляцию данных между средами
- ✅ Экономию ресурсов (одна БД, один сервер)
- ✅ Простоту управления и переключения
- ✅ Возможность параллельной работы с prod и test

## Архитектура

```
База данных: chrononinja
├── Схема: public (продакшн)
│   ├── users
│   ├── persons
│   ├── achievements
│   └── ...
│
└── Схема: test (тестовая)
    ├── users
    ├── persons
    ├── achievements
    └── ...
```

## Первоначальная настройка

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка переменных окружения

Убедитесь, что в вашем `.env` файле установлена переменная `DB_SCHEMA`:

```bash
# .env
DB_SCHEMA=public  # Для продакшн
# или
DB_SCHEMA=test    # Для тестовой среды
```

### 3. Создание тестовой схемы

Запустите скрипт для создания тестовой схемы (копирует структуру из `public`):

```bash
npm run init-test-schema
```

Этот скрипт:
- Создаёт схему `test`
- Копирует структуру всех таблиц из `public`
- Создаёт индексы, constraints и foreign keys
- Настраивает sequences для автоинкрементных полей

### 4. Заполнение тестовыми данными

```bash
npm run seed:test
```

Это заполнит тестовую схему демо-данными (личности, достижения, периоды).

## Использование

### Запуск сервера с тестовой схемой

```bash
npm run dev:test
```

Сервер запустится на порту `3001` и будет работать с тестовой схемой.

### Переключение между схемами

#### Способ 1: Через переменную окружения в .env

```bash
# .env
DB_SCHEMA=test
```

Затем запускайте обычными командами:
```bash
npm run dev
```

#### Способ 2: Через npm скрипты

```bash
# Продакшн
npm run dev

# Тест
npm run dev:test
```

#### Способ 3: Inline переменная (Linux/Mac)

```bash
DB_SCHEMA=test npm run dev
```

#### Способ 4: Inline переменная (Windows PowerShell)

```powershell
$env:DB_SCHEMA="test"; npm run dev
```

## Миграции

### Применение миграций к тестовой схеме

Миграции применяются **вручную** к каждой схеме по мере необходимости.

```bash
# Применить к продакшн
npm run migrate

# Применить к тестовой схеме
DB_SCHEMA=test npm run migrate
```

> ⚠️ **Важно**: Не забывайте применять миграции к обеим схемам при изменении структуры БД!

### Пересоздание тестовой схемы

Если структура базы данных сильно изменилась, можно пересоздать тестовую схему:

```bash
# 1. Удалить старую схему (опционально, через psql)
psql -d chrononinja -c "DROP SCHEMA IF EXISTS test CASCADE"

# 2. Создать заново
npm run init-test-schema

# 3. Заполнить данными
npm run seed:test
```

## CI/CD

### GitHub Actions

CI/CD автоматически использует тестовую схему для всех тестов.

В файле `.github/workflows/ci.yml` установлена переменная:

```yaml
env:
  DB_SCHEMA: test
```

Это гарантирует, что все автоматические тесты выполняются в изолированной среде.

## Команды NPM

| Команда | Описание |
|---------|----------|
| `npm run init-test-schema` | Создать/пересоздать тестовую схему |
| `npm run seed:test` | Заполнить тестовую схему данными |
| `npm run dev:test` | Запустить dev сервер с test схемой |
| `DB_SCHEMA=test npm run migrate` | Применить миграции к test схеме |

## Управление данными

### Очистка тестовых данных

```bash
# Через psql
psql -d chrononinja -c "TRUNCATE test.persons, test.achievements, test.periods CASCADE"

# Или пересоздайте схему
npm run init-test-schema
npm run seed:test
```

### Копирование данных из продакшн в тест

```bash
# Через psql
psql -d chrononinja << EOF
TRUNCATE test.persons CASCADE;
INSERT INTO test.persons SELECT * FROM public.persons;
EOF
```

## Лучшие практики

### ✅ Рекомендуется

1. **Всегда проверяйте текущую схему** перед выполнением критичных операций
2. **Применяйте миграции к обеим схемам** при изменении структуры
3. **Используйте test схему для экспериментов** и отладки
4. **Регулярно обновляйте структуру test** из public при изменениях

### ❌ Не рекомендуется

1. **Не используйте prod схему для тестов** - только для реальных данных
2. **Не копируйте продакшн данные в тест** без анонимизации
3. **Не забывайте о схеме** при прямых SQL запросах
4. **Не храните важные данные в test** - они могут быть удалены

## Безопасность

### Разделение доступа

Для дополнительной безопасности можно настроить разные уровни доступа:

```sql
-- Ограничить права на продакшн схему
REVOKE CREATE ON SCHEMA public FROM developers;

-- Дать полные права на тест схему
GRANT ALL ON SCHEMA test TO developers;
GRANT ALL ON ALL TABLES IN SCHEMA test TO developers;
```

## Troubleshooting

### Проблема: Таблицы создаются в public вместо test

**Решение**: Убедитесь, что `DB_SCHEMA` установлена правильно и перезапустите сервер.

### Проблема: Foreign keys не работают

**Решение**: Убедитесь, что все связанные таблицы существуют в той же схеме. Пересоздайте схему:

```bash
npm run init-test-schema
```

### Проблема: Sequence не работают

**Решение**: Скрипт `init-test-schema` должен был настроить sequences. Если проблема осталась, проверьте через psql:

```sql
SELECT * FROM information_schema.sequences WHERE sequence_schema = 'test';
```

## Дополнительная информация

### Проверка текущей схемы

```sql
-- Через psql
SHOW search_path;

-- Или
SELECT current_schema();
```

### Список всех таблиц в схеме

```sql
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'test'
ORDER BY tablename;
```

### Размер схем

```sql
SELECT 
  schemaname,
  pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint) as size
FROM pg_tables
WHERE schemaname IN ('public', 'test')
GROUP BY schemaname;
```

## Поддержка

При возникновении проблем:
1. Проверьте переменную `DB_SCHEMA` в .env
2. Убедитесь, что схема создана: `npm run init-test-schema`
3. Проверьте логи сервера на наличие SQL ошибок
4. Проверьте документацию PostgreSQL по схемам: https://www.postgresql.org/docs/current/ddl-schemas.html


