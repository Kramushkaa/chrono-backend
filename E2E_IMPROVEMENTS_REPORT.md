# E2E Тесты — Рекомендации по улучшению

## 📊 Текущее состояние

### ✅ Что уже есть (131 тест в 16 файлах):
- ✅ **Auth** - регистрация, логин, валидация, редиректы (12 тестов)
- ✅ **Timeline** - отображение, фильтры, поиск (10 тестов)
- ✅ **Quiz** - базовые и расширенные сценарии (15+ тестов)
- ✅ **Lists** - создание, sharing (5 тестов)
- ✅ **Manage** - создание и редактирование контента (10+ тестов)
- ✅ **Admin** - модерация (2 теста)
- ✅ **Mobile** - базовая проверка (2 теста)
- ✅ **Accessibility** - WCAG 2.1 AA проверки (18 тестов)
- ✅ **Visual Regression** - визуальные снапшоты (20+ тестов)
- ✅ **History/Leaderboard** - история и рейтинг (11+ тестов)
- ✅ **Обработка ошибок** - частично (401 refresh в quiz, error retry в leaderboard)

### ❌ Пробелы в покрытии:

## 🔴 Критичные улучшения (Приоритет 1)

### 1. Обработка сетевых ошибок и offline режим

**Проблема:** Нет тестов для:
- Потери соединения во время операций
- Offline режим браузера
- Таймауты API запросов
- Восстановление после сетевых ошибок

**Рекомендации:**

#### 1.1. Тесты для offline режима
```typescript
// e2e/tests/network-errors.spec.ts
test.describe('Сетевые ошибки и offline режим @regression', () => {
  test('отображение offline индикатора при потере соединения', async ({ page }) => {
    await page.context().setOffline(true);
    await page.goto('/');
    
    // Проверяем что показывается offline индикатор
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    
    // Восстанавливаем соединение
    await page.context().setOffline(false);
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeHidden();
  });

  test('кэширование данных работает в offline', async ({ authenticatedPage }) => {
    const timelinePage = new TimelinePage(authenticatedPage);
    
    // Загружаем данные онлайн
    await timelinePage.goto();
    await timelinePage.expectTimelineNotEmpty();
    
    // Переходим в offline
    await authenticatedPage.context().setOffline(true);
    
    // Обновляем страницу - данные должны быть в кэше
    await authenticatedPage.reload();
    await timelinePage.expectTimelineNotEmpty();
  });

  test('ошибка при сохранении квиза в offline показывает уведомление', async ({ authenticatedPage }) => {
    await enableSimpleQuestions(authenticatedPage);
    const quizPage = new QuizPage(authenticatedPage);
    
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);
    
    // Отключаем сеть перед сохранением
    await authenticatedPage.context().setOffline(true);
    
    // Пытаемся сохранить результат
    await quizPage.expectResults();
    
    // Должно показать ошибку или предложение повторить позже
    await expect(authenticatedPage.locator('.toast-error, [data-testid="save-error"]')).toBeVisible();
  });
});
```

#### 1.2. Тесты для таймаутов
```typescript
test('обработка таймаута при загрузке данных', async ({ page }) => {
  // Перехватываем запросы и добавляем задержку
  await page.route('**/api/persons**', async route => {
    await page.waitForTimeout(35000); // Больше чем navigation timeout
    await route.continue();
  });
  
  await page.goto('/');
  
  // Должна показаться ошибка таймаута
  await expect(page.locator('[data-testid="timeout-error"], .toast-error')).toBeVisible();
});

test('повтор запроса после таймаута работает', async ({ page }) => {
  let requestCount = 0;
  
  await page.route('**/api/persons**', async route => {
    requestCount++;
    if (requestCount === 1) {
      // Первый запрос таймаутит
      await page.waitForTimeout(35000);
    }
    await route.continue();
  });
  
  await page.goto('/');
  
  // Нажимаем "Повторить"
  await page.locator('button:has-text("Повторить"), [data-testid="retry-button"]').click();
  
  // Второй запрос должен пройти
  await expect(page.locator('.timeline-item')).toBeVisible();
});
```

#### 1.3. Тесты для прерывания соединения
```typescript
test('восстановление после потери соединения во время операции', async ({ authenticatedPage }) => {
  const managePage = new ManagePage(authenticatedPage);
  
  await managePage.goto();
  await managePage.startCreatingPerson();
  
  // Заполняем форму
  await managePage.fillPersonForm({
    name: 'Test Person',
    category: 'scientists',
  });
  
  // Прерываем соединение во время сохранения
  await authenticatedPage.context().setOffline(true);
  await managePage.submitForm();
  
  // Восстанавливаем соединение
  await authenticatedPage.context().setOffline(false);
  
  // Приложение должно автоматически повторить запрос или показать кнопку повтора
  await expect(
    authenticatedPage.locator('[data-testid="auto-retry"], button:has-text("Повторить")')
  ).toBeVisible();
});
```

### 2. Rate Limiting и защита от спама

**Проблема:** Нет тестов для проверки rate limiting на API endpoints.

**Рекомендации:**

```typescript
// e2e/tests/rate-limiting.spec.ts
test.describe('Rate Limiting @regression', () => {
  test('rate limit блокирует слишком частые запросы', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    // Делаем множество быстрых запросов
    await loginPage.goto();
    
    for (let i = 0; i < 50; i++) {
      await loginPage.login('test@test.com', 'WrongPassword123!');
    }
    
    // Должно появиться сообщение о rate limit
    await expect(page.locator('.toast-error, [data-testid="rate-limit-error"]')).toContainText(/слишком много запросов|rate limit/i);
  });

  test('rate limit сбрасывается через время', async ({ page }) => {
    // Этот тест может быть @slow и требует специальной настройки окружения
    // с уменьшенным rate limit для тестов
  });
});
```

### 3. Performance тесты и метрики

**Проблема:** Нет проверки производительности критичных операций.

**Рекомендации:**

```typescript
// e2e/tests/performance.spec.ts
test.describe('Performance метрики @performance', () => {
  test('время загрузки главной страницы < 2s', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(2000);
  });

  test('First Contentful Paint < 1s', async ({ page }) => {
    const performanceMetrics = await page.evaluate(() => {
      const perfData = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        fcp: perfData.responseStart - perfData.fetchStart,
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.fetchStart,
        load: perfData.loadEventEnd - perfData.fetchStart,
      };
    });
    
    expect(performanceMetrics.fcp).toBeLessThan(1000);
    expect(performanceMetrics.domContentLoaded).toBeLessThan(2000);
  });

  test('время ответа на вопрос квиза < 500ms', async ({ authenticatedPage }) => {
    await enableSimpleQuestions(authenticatedPage);
    const quizPage = new QuizPage(authenticatedPage);
    
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 5 });
    
    const startTime = Date.now();
    await quizPage.answerSingleChoice(0);
    await quizPage.waitForNextQuestion();
    const responseTime = Date.now() - startTime;
    
    expect(responseTime).toBeLessThan(500);
  });

  test('memory leak проверка - повторное использование страниц', async ({ authenticatedPage }) => {
    const quizPage = new QuizPage(authenticatedPage);
    
    // Проходим квиз несколько раз
    for (let i = 0; i < 5; i++) {
      await quizPage.goto();
      await quizPage.startQuiz({ questionCount: 3 });
      await quizPage.completeQuizQuickly(3);
      await quizPage.expectResults();
    }
    
    // Проверяем что нет утечек памяти
    const memoryUsage = await authenticatedPage.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return null;
    });
    
    if (memoryUsage) {
      // Ограничение ~50MB для 5 квизов
      expect(memoryUsage).toBeLessThan(50 * 1024 * 1024);
    }
  });
});
```

## 🟡 Важные улучшения (Приоритет 2)

### 4. Расширенное мобильное покрытие

**Проблема:** Только 2 базовых мобильных теста.

**Рекомендации:**

```typescript
// e2e/tests/mobile-comprehensive.spec.ts
test.describe('Мобильная версия — расширенное покрытие @regression', () => {
  test.use(devices['iPhone 12']);
  
  test('мобильное меню открывается и закрывается', async ({ page }) => {
    const menuButton = page.locator('[aria-label="Меню"], button:has-text("☰")');
    const mobileMenu = page.locator('[role="navigation"], nav[aria-label="Главное меню"]');
    
    await page.goto('/');
    
    // Меню скрыто по умолчанию
    await expect(mobileMenu).not.toBeVisible();
    
    // Открываем меню
    await menuButton.click();
    await expect(mobileMenu).toBeVisible();
    
    // Закрываем через Escape или клик вне меню
    await page.keyboard.press('Escape');
    await expect(mobileMenu).not.toBeVisible();
  });

  test('swipe жесты на мобильном timeline', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    
    // Swipe влево/вправо для навигации по годам
    const slider = page.locator('.timeline-slider, [role="slider"]');
    const initialPosition = await slider.boundingBox();
    
    // Swipe вправо
    await page.touchscreen.tap(initialPosition!.x + initialPosition!.width / 2, initialPosition!.y);
    await page.mouse.move(initialPosition!.x + initialPosition!.width, initialPosition!.y);
    
    // Проверяем что timeline изменился
  });

  test('мобильная форма создания списка работает корректно', async ({ authenticatedPage }) => {
    test.use(devices['Pixel 5']);
    
    const listsPage = new ListsPage(authenticatedPage);
    
    await listsPage.goto();
    await listsPage.startCreatingList();
    
    // Проверяем что клавиатура не закрывает важные элементы
    const input = authenticatedPage.locator('input[name="title"], input[placeholder*="название"]');
    await input.click();
    
    // Ждём появления клавиатуры
    await authenticatedPage.waitForTimeout(500);
    
    // Кнопка "Создать" должна быть видна
    const submitButton = authenticatedPage.locator('button[type="submit"], button:has-text("Создать")');
    await expect(submitButton).toBeVisible();
  });

  test('мобильные фильтры работают корректно', async ({ page }) => {
    test.use(devices['iPhone 12']);
    
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    
    // Открываем фильтры на мобильном
    const filterButton = page.locator('[aria-label*="фильтр"], button:has-text("Фильтры")');
    await filterButton.click();
    
    // Модальное окно с фильтрами должно открыться
    const filterModal = page.locator('[role="dialog"]:has-text("Фильтры")');
    await expect(filterModal).toBeVisible();
    
    // Применяем фильтр
    await page.locator('[role="checkbox"]:has-text("Учёные")').click();
    await page.locator('button:has-text("Применить")').click();
    
    // Модальное окно должно закрыться
    await expect(filterModal).toBeHidden();
    
    // Фильтры должны примениться
    await timelinePage.expectFilteredByCategory('scientists');
  });
});
```

### 5. Edge cases для существующих функций

**Проблема:** Многие edge cases не покрыты.

**Рекомендации:**

```typescript
// e2e/tests/edge-cases.spec.ts
test.describe('Edge Cases @regression', () => {
  test('квиз с 1 вопросом работает корректно', async ({ page }) => {
    await enableSimpleQuestions(page);
    const quizPage = new QuizPage(page);
    
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 1 });
    await quizPage.completeQuizQuickly(1);
    await quizPage.expectResults();
  });

  test('квиз с максимальным количеством вопросов (15)', async ({ authenticatedPage }) => {
    await enableSimpleQuestions(authenticatedPage);
    const quizPage = new QuizPage(authenticatedPage);
    
    await quizPage.goto();
    await quizPage.setQuestionCount(15);
    await quizPage.startQuiz();
    
    // Проверяем прогресс
    await quizPage.expectQuestionNumber(1, 15);
    
    // Проходим весь квиз
    await quizPage.completeQuizQuickly(15);
    await quizPage.expectResults();
  });

  test('пустой список можно удалить', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    const list = createTestList();
    
    const listId = await createListViaApi(authenticatedPage, list.title);
    
    await listsPage.goto();
    await listsPage.selectList(list.title);
    
    // Удаляем все элементы из списка
    // ...
    
    // Удаляем сам список
    await listsPage.deleteList(list.title);
    await expect(listsPage.listItem(list.title)).not.toBeVisible();
  });

  test('личность без достижений и периодов отображается корректно', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    
    // Ищем личность без связанных данных
    // ...
    
    await timelinePage.openPersonPanel('minimal-person-id');
    
    // Панель должна показать что данных нет
    await expect(page.locator('text=/нет достижений/i, text=/нет периодов/i')).toBeVisible();
  });

  test('очень длинное имя личности обрезается корректно', async ({ page }) => {
    // Создаём личность с очень длинным именем через API
    // ...
    
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();
    
    // Имя должно быть обрезано с многоточием
    const personCard = page.locator(`[data-person-id="${longNamePersonId}"]`);
    const displayedName = await personCard.textContent();
    
    expect(displayedName?.length).toBeLessThanOrEqual(100); // Максимальная длина
    expect(displayedName).toContain('...');
  });

  test('одновременное редактирование одной личности двумя пользователями', async ({ browser }) => {
    // Создаём два контекста для разных пользователей
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();
    
    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();
    
    // Авторизуем обоих пользователей
    await loginUser(user1Page, testUser1);
    await loginUser(user2Page, testUser2);
    
    // Оба пользователя редактируют одну личность
    // ...
    
    // При сохранении должны показать конфликт версий или последний сохранённый вариант
  });
});
```

### 6. Тесты для медленного соединения

**Проблема:** Нет тестов для медленного/нестабильного соединения.

**Рекомендации:**

```typescript
// e2e/tests/slow-network.spec.ts
test.describe('Медленное соединение @regression @slow', () => {
  test.beforeEach(async ({ page }) => {
    // Эмулируем медленное соединение (3G)
    await page.context().route('**', async route => {
      await page.waitForTimeout(100); // 100ms задержка на каждый запрос
      await route.continue();
    });
  });

  test('показ loading состояний при медленном соединении', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await page.goto('/');
    
    // Должен показаться skeleton или spinner
    await expect(page.locator('.skeleton, .loading-spinner, [role="status"]')).toBeVisible();
    
    // После загрузки контент должен появиться
    await expect(page.locator('.timeline-item')).toBeVisible();
    await expect(page.locator('.skeleton, .loading-spinner')).not.toBeVisible();
  });

  test('оптимистичные обновления UI работают при медленном соединении', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    
    await listsPage.goto();
    
    // Создаём список - UI должен обновиться сразу (оптимистично)
    await listsPage.startCreatingList();
    await listsPage.fillListForm({ title: 'Test List' });
    await listsPage.submitForm();
    
    // Список должен появиться сразу, даже если запрос ещё не завершился
    await expect(listsPage.listItem('Test List')).toBeVisible();
    
    // Ждём завершения запроса
    await authenticatedPage.waitForResponse(response => 
      response.url().includes('/api/lists') && response.request().method() === 'POST'
    );
  });
});
```

## 🟢 Дополнительные улучшения (Приоритет 3)

### 7. Интеграция с Lighthouse CI

**Рекомендации:**

```typescript
// e2e/tests/lighthouse.spec.ts
import { playAudit } from 'playwright-lighthouse';

test.describe('Lighthouse аудит @performance', () => {
  test('главная страница соответствует критериям производительности', async ({ page }) => {
    await page.goto('/');
    
    await playAudit({
      page,
      thresholds: {
        performance: 90,
        accessibility: 95,
        'best-practices': 90,
        seo: 90,
      },
      port: 9222, // Chrome debugging port
    });
  });
});
```

### 8. Accessibility расширения

**Рекомендации:**

```typescript
// Добавить в accessibility.spec.ts
test('screen reader озвучивает изменения состояния', async ({ page }) => {
  // Используем реальный screen reader через NVDA API или подобное
  // Проверяем что aria-live регионы работают корректно
});

test('фокус не теряется при динамическом обновлении контента', async ({ page }) => {
  const timelinePage = new TimelinePage(page);
  
  await timelinePage.goto();
  
  // Фокусируемся на элементе
  const firstItem = page.locator('.timeline-item').first();
  await firstItem.focus();
  
  // Применяем фильтр (динамическое обновление)
  await timelinePage.filterByCategory('scientists');
  
  // Фокус не должен потеряться или должен переместиться логично
  const activeElement = await page.evaluate(() => document.activeElement?.tagName);
  expect(activeElement).toBeTruthy();
});
```

### 9. API Mocking для стабильности

**Рекомендации:**

```typescript
// e2e/helpers/api-mock-helper.ts
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  response: unknown,
  status = 200
) {
  await page.route(urlPattern, route => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

export async function mockApiError(
  page: Page,
  urlPattern: string | RegExp,
  status = 500,
  message = 'Internal Server Error'
) {
  await page.route(urlPattern, route => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message }),
    });
  });
}

// Использование:
test('отображение ошибки API', async ({ page }) => {
  await mockApiError(page, '**/api/persons**', 500);
  
  await page.goto('/');
  
  await expect(page.locator('.toast-error, [data-testid="api-error"]')).toBeVisible();
});
```

## 📈 Метрики и отчёты

### Рекомендации:

1. **Добавить метрики в Playwright config:**
```typescript
// playwright.config.ts
export default defineConfig({
  // ...
  use: {
    // ...
    trace: 'on', // Включаем trace для всех тестов
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  reporter: [
    ['html', { outputFolder: 'e2e-report' }],
    ['json', { outputFile: 'e2e-results.json' }],
    ['junit', { outputFile: 'e2e-results.xml' }], // Для CI
    ['github'], // Автоматические комментарии в PR
  ],
});
```

2. **Трекинг покрытия:**
```typescript
// Добавить скрипт для анализа покрытия
// scripts/e2e-coverage.js
// Анализирует e2e-results.json и показывает:
// - Какие страницы покрыты
// - Какие user flows покрыты
// - Процент покрытия по функциональности
```

## 🎯 Приоритетный план действий

### Неделя 1: Критичные улучшения
1. ✅ Добавить тесты для offline режима (4-6 тестов)
2. ✅ Добавить тесты для таймаутов (3-4 теста)
3. ✅ Добавить тесты для прерывания соединения (2-3 теста)
4. ✅ Добавить базовые performance тесты (3-4 теста)

**Оценка:** ~2-3 дня работы

### Неделя 2: Важные улучшения
1. ✅ Расширить мобильное покрытие (8-10 тестов)
2. ✅ Добавить edge cases (10-15 тестов)
3. ✅ Добавить тесты для медленного соединения (3-4 теста)

**Оценка:** ~3-4 дня работы

### Неделя 3: Дополнительные улучшения
1. ✅ Интеграция с Lighthouse CI (2-3 теста)
2. ✅ Расширить accessibility тесты (3-4 теста)
3. ✅ API mocking helpers
4. ✅ Метрики и отчёты

**Оценка:** ~2-3 дня работы

## 📊 Ожидаемый результат

**После внедрения всех улучшений:**
- **Общее количество тестов:** ~200+ (сейчас ~131)
- **Покрытие критичных сценариев:** ~95% (сейчас ~70%)
- **Покрытие edge cases:** ~80% (сейчас ~40%)
- **Мобильное покрытие:** ~90% (сейчас ~30%)
- **Performance метрики:** Добавлены
- **Offline/Network error handling:** Полностью покрыто

## 🔧 Технические детали

### Необходимые изменения в коде:

1. **Добавить data-testid для критичных элементов:**
   - `[data-testid="offline-indicator"]`
   - `[data-testid="timeout-error"]`
   - `[data-testid="retry-button"]`
   - `[data-testid="rate-limit-error"]`

2. **Добавить обработку offline режима в приложение:**
   ```typescript
   // Добавить в App.tsx или подобное
   useEffect(() => {
     const handleOnline = () => {
       // Показать уведомление о восстановлении соединения
     };
     const handleOffline = () => {
       // Показать offline индикатор
     };
     
     window.addEventListener('online', handleOnline);
     window.addEventListener('offline', handleOffline);
     
     return () => {
       window.removeEventListener('online', handleOnline);
       window.removeEventListener('offline', handleOffline);
     };
   }, []);
   ```

3. **Добавить retry логику для failed запросов:**
   ```typescript
   // В API client добавить автоматический retry для network errors
   ```

## 📝 Заключение

Текущее E2E покрытие хорошее, но есть значительные пробелы в:
- **Обработке сетевых ошибок** (критично)
- **Мобильном покрытии** (важно)
- **Edge cases** (важно)
- **Performance метриках** (желательно)

Приоритет на первые три области для повышения надёжности и стабильности приложения.


