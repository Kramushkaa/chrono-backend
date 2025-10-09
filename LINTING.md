# Линтинг и форматирование кода

## 🛠️ Установленные инструменты

### ESLint v9
Линтер для TypeScript с правилами:
- ✅ TypeScript строгая типизация
- ✅ Обнаружение `any` типов
- ✅ Обнаружение небезопасных операций
- ✅ Проверка неиспользуемых переменных
- ✅ Проверка промисов (no-floating-promises)

### Prettier
Автоматическое форматирование кода:
- ✅ Единый стиль кода
- ✅ Автоматическое исправление отступов
- ✅ Управление точками с запятой
- ✅ Управление кавычками

## 📝 Доступные команды

```bash
# Проверка кода на ошибки
npm run lint

# Автоматическое исправление ошибок ESLint
npm run lint:fix

# Форматирование всех файлов Prettier
npm run format

# Проверка форматирования (без изменений)
npm run format:check

# Проверка типов TypeScript без компиляции
npm run type-check
```

## 🎯 Рабочий процесс

### Перед коммитом
```bash
npm run lint:fix  # Исправить автоматически исправляемые ошибки
npm run format    # Отформатировать код
npm run type-check # Проверить типы
```

### В редакторе (VS Code)
Настройки уже сконфигурированы в `.vscode/settings.json`:
- Автоформатирование при сохранении
- Автоисправление ESLint при сохранении
- Prettier как форматтер по умолчанию

Рекомендуемые расширения (в `.vscode/extensions.json`):
- ESLint
- Prettier
- TypeScript

## 📊 Текущее состояние

### Результаты первого запуска
- **До настройки**: множество проблем с форматированием
- **После автоисправления**: исправлено **4437 проблем** автоматически
- **Осталось**: ~1200 проблем (в основном требуют ручного исправления)

### Оставшиеся проблемы

#### 1. TypeScript типизация (приоритет: высокий)
```typescript
// ❌ Плохо
function process(data: any) { ... }

// ✅ Хорошо
interface Data {
  id: number;
  name: string;
}
function process(data: Data) { ... }
```

#### 2. Небезопасные операции (приоритет: средний)
```typescript
// ❌ Плохо
const id = row.id; // Unsafe member access

// ✅ Хорошо
const id = (row as { id: number }).id;
// или
interface Row {
  id: number;
}
const id = (row as Row).id;
```

#### 3. Необработанные промисы (приоритет: высокий)
```typescript
// ❌ Плохо
someAsyncFunction();

// ✅ Хорошо
await someAsyncFunction();
// или
void someAsyncFunction();
// или
someAsyncFunction().catch(console.error);
```

## 🔧 Конфигурация

### `eslint.config.js`
Новый flat config для ESLint v9:
- Поддержка TypeScript
- Интеграция с Prettier
- Кастомные правила для проекта

### `.prettierrc`
Настройки форматирования:
- Одинарные кавычки
- Точки с запятой
- 100 символов на строку
- 2 пробела для отступов

### `.vscode/settings.json`
Настройки редактора:
- Форматирование при сохранении
- ESLint исправление при сохранении

## 📚 Дальнейшие улучшения

1. ✅ Настроить ESLint и Prettier
2. ✅ Автоисправление форматирования
3. ⏳ Исправить оставшиеся проблемы типизации
4. ⏳ Добавить pre-commit хуки (husky)
5. ⏳ Добавить CI/CD проверки
6. ⏳ Довести до 0 ошибок линтера

## 💡 Советы

- Используйте `_` префикс для неиспользуемых переменных: `const _unused = ...`
- Избегайте `any` - используйте `unknown` или конкретные типы
- Всегда обрабатывайте промисы: `await`, `.catch()` или `void`
- Запускайте `npm run lint:fix` перед коммитом

## 🎓 Ресурсы

- [ESLint Documentation](https://eslint.org/)
- [Prettier Documentation](https://prettier.io/)
- [TypeScript ESLint](https://typescript-eslint.io/)

