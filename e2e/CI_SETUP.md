# CI/CD Setup для E2E тестов Хронониндзя

Данный документ содержит детальную спецификацию для настройки GitHub Actions workflow для автоматического запуска E2E тестов.

## Обзор

E2E тесты должны запускаться автоматически при:
- Push в ветки `main` / `develop`
- Pull Requests
- Ручном запуске (workflow_dispatch)
- По расписанию (ночной full regression)

## Структура Workflow

### Файл: `.github/workflows/e2e.yml`

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  workflow_dispatch:
  schedule:
    # Ночной прогон в 3:00 UTC
    - cron: '0 3 * * *'

jobs:
  e2e-tests:
    name: E2E Tests - ${{ matrix.project }}
    runs-on: ubuntu-latest
    timeout-minutes: 60

    strategy:
      fail-fast: false
      matrix:
        project: [smoke-chromium, chromium, accessibility, visual]
        include:
          - project: smoke-chromium
            test-name: 'Smoke Tests'
          - project: chromium
            test-name: 'Full Regression'
          - project: accessibility
            test-name: 'Accessibility'
          - project: visual
            test-name: 'Visual Regression'

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: chrononinja
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout Backend
        uses: actions/checkout@v4
        with:
          path: backend

      - name: Checkout Frontend
        uses: actions/checkout@v4
        with:
          repository: [YOUR_ORG]/chronoline-frontend
          token: ${{ secrets.FRONTEND_ACCESS_TOKEN }}
          path: frontend

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json

      - name: Install Backend Dependencies
        working-directory: backend
        run: npm ci

      - name: Install Frontend Dependencies
        working-directory: frontend
        run: npm ci

      - name: Install Playwright Browsers
        working-directory: backend
        run: npx playwright install --with-deps chromium

      - name: Build Shared DTO
        working-directory: backend/shared-dto
        run: |
          npm ci
          npm run build

      - name: Copy DTO to Frontend
        working-directory: backend/shared-dto
        run: node copy-to-frontend.js

      - name: Check DTO Synchronization
        working-directory: backend
        run: node ../check-dto-sync.js

      - name: Init Test Database Schema
        working-directory: backend
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: chrononinja
          DB_USER: postgres
          DB_PASSWORD: postgres
          DB_SCHEMA: test
        run: npm run init-test-schema

      - name: Seed Test Data
        working-directory: backend
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: chrononinja
          DB_USER: postgres
          DB_PASSWORD: postgres
          DB_SCHEMA: test
        run: npm run seed:test

      - name: Start Backend
        working-directory: backend
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: chrononinja
          DB_USER: postgres
          DB_PASSWORD: postgres
          DB_SCHEMA: test
          PORT: 3001
        run: |
          npm run dev:test &
          echo $! > backend.pid
          # Ждём запуска
          for i in {1..30}; do
            if curl -s http://localhost:3001/api/health > /dev/null; then
              echo "Backend started successfully"
              break
            fi
            echo "Waiting for backend... ($i/30)"
            sleep 2
          done

      - name: Start Frontend
        working-directory: frontend
        env:
          VITE_API_URL: http://localhost:3001
        run: |
          npm run dev &
          echo $! > frontend.pid
          # Ждём запуска
          for i in {1..30}; do
            if curl -s http://localhost:3000 > /dev/null; then
              echo "Frontend started successfully"
              break
            fi
            echo "Waiting for frontend... ($i/30)"
            sleep 2
          done

      - name: Run E2E Tests
        working-directory: backend
        env:
          BACKEND_URL: http://localhost:3001
          FRONTEND_URL: http://localhost:3000
        run: npx playwright test --project=${{ matrix.project }}

      - name: Upload Test Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-report-${{ matrix.project }}
          path: backend/e2e-report/
          retention-days: 14

      - name: Upload Screenshots
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: screenshots-${{ matrix.project }}
          path: backend/test-results/**/*.png
          retention-days: 7

      - name: Upload Videos
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: videos-${{ matrix.project }}
          path: backend/test-results/**/*.webm
          retention-days: 7

      - name: Comment PR with Results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const resultsPath = 'backend/e2e-results.json';
            
            if (fs.existsSync(resultsPath)) {
              const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
              const body = `## E2E Test Results - ${{ matrix.test-name }}
              
              - ✅ Passed: ${results.stats.expected}
              - ❌ Failed: ${results.stats.unexpected}
              - ⏭️ Skipped: ${results.stats.skipped}
              - ⏱️ Duration: ${Math.round(results.stats.duration / 1000)}s
              
              [View Full Report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})`;
              
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: body
              });
            }

      - name: Send Telegram Notification on Failure
        if: failure() && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop')
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          curl -X POST \
            "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            -d text="❌ E2E Tests Failed - ${{ matrix.test-name }}%0A%0ABranch: ${{ github.ref_name }}%0ACommit: ${{ github.sha }}%0A%0A[View Details](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})"

      - name: Cleanup
        if: always()
        run: |
          if [ -f backend/backend.pid ]; then
            kill $(cat backend/backend.pid) || true
          fi
          if [ -f frontend/frontend.pid ]; then
            kill $(cat frontend/frontend.pid) || true
          fi
```

## Переменные окружения

### Обязательные переменные

| Переменная | Описание | Пример |
|------------|----------|--------|
| `DB_HOST` | Хост PostgreSQL | `localhost` |
| `DB_PORT` | Порт PostgreSQL | `5432` |
| `DB_NAME` | Имя базы данных | `chrononinja` |
| `DB_USER` | Пользователь БД | `postgres` |
| `DB_PASSWORD` | Пароль БД | `postgres` |
| `DB_SCHEMA` | Схема для тестов | `test` |
| `BACKEND_URL` | URL бэкенда | `http://localhost:3001` |
| `FRONTEND_URL` | URL фронтенда | `http://localhost:3000` |

### Secrets в GitHub

Необходимо настроить следующие secrets в репозитории:

1. **FRONTEND_ACCESS_TOKEN**
   - Personal Access Token с доступом к frontend репозиторию
   - Settings → Developer settings → Personal access tokens → Fine-grained tokens
   - Scope: `repo` (full control of private repositories)

2. **TELEGRAM_BOT_TOKEN**
   - Токен Telegram бота для уведомлений
   - Получить у @BotFather

3. **TELEGRAM_CHAT_ID**
   - ID чата для отправки уведомлений
   - Можно получить через @userinfobot

## Матрица браузеров и OS

### Минимальная конфигурация (для PR)

```yaml
strategy:
  matrix:
    project: [smoke-chromium]
```

### Полная конфигурация (для merge в main)

```yaml
strategy:
  matrix:
    project: [chromium, firefox, webkit, mobile-chrome, accessibility, visual]
    os: [ubuntu-latest]
```

### Расширенная конфигурация (опционально)

```yaml
strategy:
  matrix:
    include:
      - os: ubuntu-latest
        project: chromium
      - os: windows-latest
        project: chromium
      - os: macos-latest
        project: webkit
```

## Кэширование

### NPM кэш

```yaml
- name: Cache NPM Dependencies
  uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      backend/node_modules
      frontend/node_modules
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-npm-
```

### Playwright browsers кэш

```yaml
- name: Cache Playwright Browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('backend/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-playwright-
```

## Оптимизации производительности

### 1. Conditional execution

Запускать полный regression только для определённых путей:

```yaml
on:
  pull_request:
    paths:
      - 'src/**'
      - 'e2e/**'
      - 'package.json'
      - '.github/workflows/e2e.yml'
```

### 2. Параллельное выполнение

Увеличить количество workers для CI:

```typescript
// playwright.config.ts
workers: process.env.CI ? 6 : 2,
```

### 3. Sharding

Разделить тесты на несколько job'ов:

```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/4
```

## Группы тестов

### Smoke (быстрые, на каждый PR)

```yaml
- name: Run Smoke Tests
  run: npm run test:e2e:smoke
```

### Full Regression (на merge в main)

```yaml
- name: Run Full Regression
  if: github.ref == 'refs/heads/main'
  run: npm run test:e2e
```

### Accessibility (по требованию)

```yaml
- name: Run Accessibility Tests
  run: npm run test:e2e:a11y
```

### Visual Regression (стабильная среда)

```yaml
- name: Run Visual Regression
  run: npm run test:e2e:visual
```

## Артефакты

### Retention policy

- **HTML Reports**: 14 дней
- **Screenshots**: 7 дней (только при падении)
- **Videos**: 7 дней (только при падении)
- **Test Results JSON**: 30 дней

### Структура артефактов

```
artifacts/
├── e2e-report-chromium/
│   ├── index.html
│   └── data/
├── screenshots-chromium/
│   └── test-results/
└── videos-chromium/
    └── test-results/
```

## Troubleshooting

### Backend не запускается

```bash
# Проверить логи PostgreSQL
docker logs postgres

# Проверить health endpoint
curl http://localhost:3001/api/health
```

### Frontend не запускается

```bash
# Проверить переменные окружения
echo $VITE_API_URL

# Проверить процесс
ps aux | grep vite
```

### Тесты падают с timeout

- Увеличить timeout в `playwright.config.ts`
- Проверить что БД инициализирована
- Добавить больше retries для flaky тестов

### DTO не синхронизирован

```bash
# Пересобрать shared-dto
cd shared-dto
npm run build
node copy-to-frontend.js
```

## Best Practices

1. **Используйте matrix для параллельного запуска**
   - Экономит время выполнения
   - Изолирует падения разных типов тестов

2. **Кэшируйте зависимости**
   - NPM packages
   - Playwright browsers
   - Build артефакты

3. **Настройте уведомления**
   - Telegram для критичных падений
   - Email для scheduled runs
   - PR comments для быстрого feedback

4. **Используйте conditional execution**
   - Smoke для PR
   - Full для merge
   - Visual только для стабильных веток

5. **Храните baseline снапшоты в репозитории**
   - Коммитите visual regression baseline
   - Обновляйте через отдельный workflow

## Дополнительные workflow

### Update Visual Baselines

```yaml
name: Update Visual Baselines

on:
  workflow_dispatch:

jobs:
  update-baselines:
    runs-on: ubuntu-latest
    steps:
      # ... setup steps ...
      
      - name: Update Baselines
        run: npm run test:e2e:visual -- --update-snapshots
      
      - name: Commit Baselines
        run: |
          git config user.name "github-actions"
          git config user.email "github-actions@github.com"
          git add e2e/screenshots/baseline/
          git commit -m "chore: update visual regression baselines"
          git push
```

### Scheduled Full Regression

```yaml
name: Nightly E2E Tests

on:
  schedule:
    - cron: '0 3 * * *'

jobs:
  full-regression:
    strategy:
      matrix:
        project: [chromium, firefox, webkit, mobile-chrome, mobile-safari]
    # ... остальные шаги ...
```

## Мониторинг и метрики

### Playwright HTML Report

Автоматически генерируется и загружается как артефакт.

### Custom metrics

Можно добавить отправку метрик в monitoring систему:

```yaml
- name: Send Metrics
  run: |
    curl -X POST ${{ secrets.METRICS_ENDPOINT }} \
      -d "test_duration=$DURATION" \
      -d "test_status=$STATUS"
```

## Заключение

Данная конфигурация обеспечивает:
- ✅ Автоматический запуск E2E тестов
- ✅ Поддержку multiple browsers
- ✅ Accessibility и Visual regression
- ✅ Артефакты и отчёты
- ✅ Уведомления при падении
- ✅ Оптимизацию через кэширование

Для внедрения скопируйте workflow файл в `.github/workflows/e2e.yml` и настройте secrets.




