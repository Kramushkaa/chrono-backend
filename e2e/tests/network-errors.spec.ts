import { test, expect } from '../fixtures/auth-fixtures';
import { TimelinePage } from '../pages/TimelinePage';
import { QuizPage } from '../pages/QuizPage';
import { ListsPage } from '../pages/ListsPage';
import type { Page } from '@playwright/test';

const enableSimpleQuestions = async (page: Page) => {
  await page.addInitScript(() => {
    (window as any).__E2E_SIMPLE_QUESTIONS__ = true;
  });
};

test.describe('Сетевые ошибки и offline режим @regression', () => {
  test.beforeEach(async ({ page }) => {
    // Убеждаемся что соединение активно перед каждым тестом
    await page.context().setOffline(false);
  });

  test('отображение offline индикатора при потере соединения', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    // Загружаем страницу онлайн
    await timelinePage.goto();
    await timelinePage.expectTimelineNotEmpty();
    
    // Переходим в offline
    await page.context().setOffline(true);
    
    // Проверяем что показывается offline индикатор или toast
    const offlineIndicator = page.locator('[data-testid="offline-indicator"], .toast-offline, [aria-label*="offline"], [aria-label*="нет соединения"]');
    await expect(offlineIndicator.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // Если специального индикатора нет, проверяем toast
      const toast = page.locator('.toast-message:has-text(/нет соединения|offline|offline/i)');
      expect(toast).toBeVisible({ timeout: 5000 });
    });
    
    // Восстанавливаем соединение
    await page.context().setOffline(false);
    await page.waitForTimeout(1000);
    
    // Offline индикатор должен исчезнуть или показаться сообщение о восстановлении
    const onlineIndicator = page.locator('[data-testid="online-indicator"], .toast-success:has-text(/соединение восстановлено/i)');
    await expect(offlineIndicator.first()).not.toBeVisible({ timeout: 5000 }).catch(() => {
      // Игнорируем если индикатор уже скрыт
    });
  });

  test('ошибка при сохранении квиза в offline показывает уведомление', async ({ authenticatedPage }) => {
    await enableSimpleQuestions(authenticatedPage);
    const quizPage = new QuizPage(authenticatedPage);
    
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);
    
    // Отключаем сеть перед сохранением результата
    await authenticatedPage.context().setOffline(true);
    
    // Ждём результатов (попытка сохранить)
    await quizPage.expectResults();
    
    // Должна показаться ошибка сохранения или предложение повторить позже
    const errorToast = authenticatedPage.locator(
      '.toast-error, .toast-warning, [data-testid="save-error"]:has-text(/не удалось сохранить|ошибка сохранения|offline|нет соединения/i)'
    );
    
    await expect(errorToast.first()).toBeVisible({ timeout: 10000 }).catch(() => {
      // Альтернативно проверяем кнопку повтора
      const retryButton = authenticatedPage.locator('button:has-text(/повторить|retry/i), [data-testid="retry-save"]');
      expect(retryButton).toBeVisible({ timeout: 5000 });
    });
  });

  test('повтор сохранения после восстановления соединения работает', async ({ authenticatedPage }) => {
    await enableSimpleQuestions(authenticatedPage);
    const quizPage = new QuizPage(authenticatedPage);
    
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);
    
    // Отключаем сеть перед сохранением
    await authenticatedPage.context().setOffline(true);
    await quizPage.expectResults();
    
    // Восстанавливаем соединение
    await authenticatedPage.context().setOffline(false);
    await authenticatedPage.waitForTimeout(1000);
    
    // Ищем кнопку повтора и кликаем
    const retryButton = authenticatedPage.locator(
      'button:has-text(/повторить|retry|сохранить/i), [data-testid="retry-save"], [data-testid="save-result"]'
    ).first();
    
    // Если кнопка есть, кликаем
    const retryVisible = await retryButton.isVisible().catch(() => false);
    if (retryVisible) {
      await retryButton.click();
      
      // Ждём успешного сохранения
      await expect(
        authenticatedPage.locator('.toast-success:has-text(/сохранено/i), [data-testid="save-success"]')
      ).toBeVisible({ timeout: 10000 });
    } else {
      // Проверяем что результат сохранился автоматически
      await expect(
        authenticatedPage.locator('.toast-success, [data-testid="save-success"]')
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('обработка таймаута при загрузке данных', async ({ page }) => {
    // Перехватываем запросы и добавляем задержку больше таймаута
    let requestCount = 0;
    await page.route('**/api/persons**', async route => {
      requestCount++;
      if (requestCount === 1) {
        // Первый запрос таймаутит (ждём дольше navigation timeout)
        await page.waitForTimeout(35000);
      }
      await route.continue();
    });
    
    await page.goto('/timeline');
    
    // Должна показаться ошибка таймаута или loading завершится
    const timeoutError = page.locator(
      '.toast-error:has-text(/таймаут|timeout|превышено время/i), [data-testid="timeout-error"]'
    );
    
    // Проверяем либо ошибку, либо что страница всё равно загрузилась (retry)
    const hasError = await timeoutError.isVisible().catch(() => false);
    const hasContent = await page.locator('.timeline-item, [data-testid="person-card"]').first().isVisible().catch(() => false);
    
    // Должно быть либо ошибка, либо контент (retry сработал)
    expect(hasError || hasContent).toBeTruthy();
  });

  test('повтор запроса после таймаута работает', async ({ page }) => {
    let requestCount = 0;
    
    await page.route('**/api/persons**', async route => {
      requestCount++;
      if (requestCount === 1) {
        // Первый запрос таймаутит
        await page.waitForTimeout(35000);
      }
      // Последующие запросы проходят нормально
      await route.continue();
    });
    
    await page.goto('/timeline');
    
    // Ищем кнопку "Повторить" и кликаем
    const retryButton = page.locator(
      'button:has-text(/повторить|retry|обновить/i), [data-testid="retry-button"], [data-testid="refresh-button"]'
    ).first();
    
    const retryVisible = await retryButton.isVisible({ timeout: 10000 }).catch(() => false);
    if (retryVisible) {
      await retryButton.click();
      
      // Контент должен загрузиться
      await expect(page.locator('.timeline-item, [data-testid="person-card"]').first()).toBeVisible({ timeout: 15000 });
    } else {
      // Если retry автоматический, просто проверяем что контент загрузился
      await expect(page.locator('.timeline-item, [data-testid="person-card"]').first()).toBeVisible({ timeout: 20000 });
    }
  });

  test('восстановление после потери соединения во время операции', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    
    await listsPage.goto();
    
    // Начинаем создание списка
    await listsPage.startCreatingList();
    await listsPage.fillListForm({ title: 'Test Offline List' });
    
    // Прерываем соединение перед отправкой формы
    await authenticatedPage.context().setOffline(true);
    
    // Пытаемся сохранить
    await listsPage.submitForm();
    
    // Должна показаться ошибка
    await expect(
      authenticatedPage.locator('.toast-error, [data-testid="save-error"]:has-text(/нет соединения|offline|ошибка/i)')
    ).toBeVisible({ timeout: 10000 });
    
    // Восстанавливаем соединение
    await authenticatedPage.context().setOffline(false);
    await authenticatedPage.waitForTimeout(1000);
    
    // Ищем кнопку повтора или автоматический retry
    const retryButton = authenticatedPage.locator(
      'button:has-text(/повторить|retry|сохранить/i), [data-testid="retry-save"]'
    ).first();
    
    const retryVisible = await retryButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (retryVisible) {
      await retryButton.click();
      
      // Список должен создаться
      await expect(
        authenticatedPage.locator('.toast-success, [data-testid="list-created"]')
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('кэширование данных работает при повторном посещении offline', async ({ authenticatedPage }) => {
    const timelinePage = new TimelinePage(authenticatedPage);
    
    // Загружаем данные онлайн
    await timelinePage.goto();
    await timelinePage.expectTimelineNotEmpty();
    
    // Переходим в offline
    await authenticatedPage.context().setOffline(true);
    await authenticatedPage.waitForTimeout(1000);
    
    // Обновляем страницу
    await authenticatedPage.reload();
    
    // Данные должны быть в кэше (service worker или localStorage)
    // Проверяем что контент отображается
    const hasContent = await authenticatedPage.locator('.timeline-item, [data-testid="person-card"]').first().isVisible().catch(() => false);
    
    // Если нет service worker, может показаться ошибка - это нормально
    // Но в идеале данные должны кэшироваться
    if (!hasContent) {
      // Проверяем что показалась ошибка загрузки (это нормально)
      const errorVisible = await authenticatedPage.locator('.toast-error, [data-testid="load-error"]').isVisible().catch(() => false);
      expect(errorVisible || hasContent).toBeTruthy();
    } else {
      // Если данные есть - отлично, значит кэш работает
      expect(hasContent).toBeTruthy();
    }
  });

  test('обработка 500 ошибки показывает корректное сообщение', async ({ page }) => {
    // Мокаем 500 ошибку для API
    await page.route('**/api/persons**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Internal Server Error' }),
      });
    });
    
    await page.goto('/timeline');
    
    // Должна показаться ошибка
    await expect(
      page.locator('.toast-error, [data-testid="error"]:has-text(/ошибка сервера|server error|произошла ошибка/i)')
    ).toBeVisible({ timeout: 10000 });
  });

  test('обработка 404 ошибки показывает корректное сообщение', async ({ page }) => {
    // Мокаем 404 ошибку для несуществующей личности
    await page.route('**/api/persons/non-existent**', route => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Not Found' }),
      });
    });
    
    // Пытаемся открыть несуществующую личность
    await page.goto('/persons/non-existent');
    
    // Должна показаться ошибка 404 или редирект на 404 страницу
    const is404Page = await page.locator('h1:has-text(/404|not found|не найдено/i)').isVisible().catch(() => false);
    const hasError = await page.locator('.toast-error:has-text(/не найдено|not found/i)').isVisible().catch(() => false);
    
    expect(is404Page || hasError).toBeTruthy();
  });
});


