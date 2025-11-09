# E2E тесты для Хронониндзя

Комплексные end-to-end тесты с использованием Playwright для покрытия всего функционала сайта.

## Типы тестов

- **Functional** - основные пользовательские сценарии
- **Accessibility** - проверка доступности (WCAG 2.1 AA)
- **Visual Regression** - защита от визуальных регрессий
- **Mobile** - тестирование на мобильных устройствах

## Требования

- Node.js 18+
- PostgreSQL с тестовой схемой (`DB_SCHEMA=test`)
- Запущенный backend на порту 3001
- Запущенный frontend на порту 3000

## Установка

```bash
# Установка зависимостей
npm install

# Установка браузеров Playwright
npx playwright install
```

## Подготовка тестовой БД

```bash
# Создание тестовой схемы
npm run init-test-schema

# Заполнение seed данными
npm run seed:test
```

## Запуск тестов

### Локально

Запускайте каждую команду в отдельном терминале (не используйте `&&` для соединения команд).

1. Запустите backend в тестовом режиме:
```bash
npm run dev:test
```

2. В отдельном терминале запустите frontend:
```bash
cd ../chronoline-frontend
npm run dev
```

3. В третьем терминале запустите тесты:
```bash
# Все тесты
npx playwright test

# Быстрые smoke тесты
npm run test:e2e:smoke

# Accessibility тесты
npm run test:e2e:a11y

# Visual regression тесты
npm run test:e2e:visual
```

### С UI Mode (для отладки)

```bash
npx playwright test --ui
```

### Запуск конкретного теста

```bash
npx playwright test auth.spec.ts
```

### Запуск только в одном браузере

```bash
npx playwright test --project=chromium
```

## Структура

```
e2e/
├── fixtures/           # Playwright fixtures (auth, data)
│   ├── auth-fixtures.ts
│   └── seed-data.sql
├── helpers/            # Вспомогательные функции
│   ├── auth-helper.ts
│   ├── accessibility-helper.ts
│   └── visual-regression.ts
├── pages/              # Page Object Models
│   ├── LoginPage.ts
│   ├── TimelinePage.ts
│   ├── QuizPage.ts
│   └── ... (13 страниц)
├── screenshots/        # Visual regression
│   └── baseline/       # Baseline снапшоты
├── tests/              # Тестовые сценарии
│   ├── auth.spec.ts
│   ├── timeline.spec.ts
│   ├── quiz-basic.spec.ts
│   ├── shared-quiz.spec.ts
│   ├── leaderboard.spec.ts
│   ├── history.spec.ts
│   ├── accessibility.spec.ts
│   ├── visual-regression.spec.ts
│   └── ... (12 файлов)
├── utils/              # Утилиты
│   ├── db-reset.ts
│   ├── test-data-factory.ts
│   └── api-client.ts
├── global-setup.ts     # Настройка перед всеми тестами
├── types.ts            # TypeScript типы
└── CI_SETUP.md         # Документация CI/CD
```

## Page Objects

Все страницы представлены через Page Object Model для переиспользования кода:

- `LoginPage` - страница логина
- `RegisterPage` - страница регистрации
- `TimelinePage` - главная страница таймлайна
- `PersonPanelPage` - панель деталей личности
- `QuizPage` - страница квиза
- `SharedQuizPage` - shared quiz
- `LeaderboardPage` - таблица лидеров
- `QuizHistoryPage` - история квизов
- `ManagePage` - управление контентом
- `ListsPage` - пользовательские списки
- `PublicListsPage` - публичные списки
- `ProfilePage` - профиль пользователя
- `ModerationPage` - модерация (админ)

## Fixtures

### Аутентифицированные пользователи

```typescript
import { test } from '../fixtures/auth-fixtures';

test('test with auth', async ({ authenticatedPage }) => {
  // authenticatedPage уже содержит авторизованного пользователя
});

test('test with admin', async ({ adminPage }) => {
  // adminPage содержит админа
});

test('test with moderator', async ({ moderatorPage }) => {
  // moderatorPage содержит модератора
});
```

## Отчёты

После запуска тестов:

```bash
# Открыть HTML отчёт
npx playwright show-report

# Открыть трейс конкретного теста
npx playwright show-trace test-results/..../trace.zip
```

## CI/CD

Тесты автоматически запускаются в GitHub Actions при:
- Push в main/develop
- Pull Request
- Ручном запуске workflow

Результаты тестов и артефакты (screenshots, videos) доступны в Actions.

## Troubleshooting

### Тесты падают с timeout

- Убедитесь что backend и frontend запущены
- Проверьте что порты 3000 и 3001 свободны
- Увеличьте timeout в `playwright.config.ts`

### База данных в неправильном состоянии

```bash
# Пересоздать тестовую схему
npm run init-test-schema
npm run seed:test
```

### Браузеры не установлены

```bash
npx playwright install
```

## Новые типы тестов

### Shared Quiz тесты (`shared-quiz.spec.ts`)

Тесты для функциональности shared quiz:
- Создание shared quiz авторизованным пользователем
- Прохождение shared quiz гостем
- Передача ссылки и просмотр результатов
- Результаты гостей в shared quiz

### Leaderboard тесты (`leaderboard.spec.ts`)

Тесты таблицы лидеров:
- Отображение таблицы с результатами
- Фильтрация по периодам (неделя, месяц, всё время)
- Сортировка по очкам
- Отображение позиции текущего пользователя
- Пагинация

### History тесты (`history.spec.ts`)

Тесты истории квизов:
- Отображение истории пройденных квизов
- Просмотр деталей прошедшего квиза
- Статистика (общее количество, средний балл)
- Фильтрация по дате и типу
- Повтор квиза из истории
- Экспорт истории

### Accessibility тесты (`accessibility.spec.ts`)

Проверка доступности согласно WCAG 2.1 AA:
- Соответствие стандартам для всех основных страниц
- Keyboard navigation (Tab, Enter, Escape)
- Screen reader labels (ARIA)
- Цветовой контраст
- Focus management в модальных окнах
- Альтернативный текст для изображений

**Используемые инструменты:**
- `@axe-core/playwright` для автоматических проверок
- Кастомные хелперы для keyboard navigation

### Visual Regression тесты (`visual-regression.spec.ts`)

Защита от визуальных регрессий:
- Baseline снапшоты ключевых страниц
- Responsive тестирование (desktop, tablet, mobile)
- Различные состояния компонентов (hover, focus)
- Модальные окна и панели
- Dark mode (если поддерживается)

**Best Practices для Visual Regression:**
- Маскируйте динамический контент (даты, счётчики)
- Отключайте анимации для стабильности
- Используйте `maxDiffPixelRatio` для допустимых различий
- Храните baseline в репозитории

## Теги для группировки тестов

Используйте теги для запуска определённых групп тестов:

- `@smoke` - быстрые критичные тесты (auth, timeline basic, quiz start)
- `@regression` - полный прогон всех функциональных тестов
- `@accessibility` - тесты доступности
- `@visual` - визуальные снапшоты
- `@slow` - длинные тесты (можно пропускать в dev)

Примеры запуска:
```bash
# Только smoke тесты
npx playwright test --grep @smoke

# Исключить slow тесты
npx playwright test --grep-invert @slow

# Только accessibility
npm run test:e2e:a11y
```

## Best Practices

### Общие

1. **Изоляция тестов** - каждый тест должен быть независимым
2. **Используйте Page Objects** - не дублируйте селекторы
3. **API для setup** - создавайте тестовые данные через API, не через UI
4. **Явные ожидания** - используйте `waitFor`, избегайте `waitForTimeout`
5. **Очистка** - используйте `beforeEach` для сброса состояния

### Accessibility

1. **Проверяйте критичные страницы** - формы, навигация, интерактивные элементы
2. **Тестируйте keyboard navigation** - Tab, Enter, Escape должны работать
3. **Используйте semantic HTML** - правильные landmarks (main, nav, header)
4. **ARIA labels** - для кнопок иконок и интерактивных элементов
5. **Контраст** - минимум 4.5:1 для текста, 3:1 для UI элементов

### Visual Regression

1. **Стабилизируйте страницу** - отключите анимации, дождитесь загрузки
2. **Маскируйте динамику** - даты, время, счётчики, loading состояния
3. **Consistent viewport** - используйте фиксированные размеры
4. **Update baselines** - через отдельный workflow или команду
5. **Review diffs** - всегда проверяйте различия перед обновлением baseline

## Полезные команды

```bash
# Запустить все тесты
npx playwright test

# Запустить с headed mode (видно браузер)
npx playwright test --headed

# Запустить в debug mode
npx playwright test --debug

# Запустить конкретный файл
npx playwright test auth.spec.ts

# Запустить конкретный тест
npx playwright test -g "успешная регистрация"

# Обновить скриншоты
npx playwright test --update-snapshots

# Сгенерировать тесты (codegen)
npx playwright codegen http://localhost:3000
```

