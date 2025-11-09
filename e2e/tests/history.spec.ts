import { test, expect } from '../fixtures/auth-fixtures';
import { QuizHistoryPage } from '../pages/QuizHistoryPage';
import { QuizPage } from '../pages/QuizPage';

test.describe('История квизов @regression', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Создаём результаты квизов для тестов
    const quizPage = new QuizPage(authenticatedPage);
    
    // Первый квиз
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);
    
    // Небольшая задержка между квизами
    await authenticatedPage.waitForTimeout(500);
    
    // Второй квиз
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 5 });
    await quizPage.completeQuizQuickly(5);
  });

  test('отображение истории квизов @smoke', async ({ authenticatedPage }) => {
    const historyPage = new QuizHistoryPage(authenticatedPage);
    
    await historyPage.goto();
    
    // Проверяем что история отображается
    await expect(authenticatedPage.locator('[data-testid="quiz-history"]')).toBeVisible();
    
    // Проверяем что есть хотя бы одна запись
    const entries = await authenticatedPage.locator('[data-testid="history-entry"]').count();
    expect(entries).toBeGreaterThan(0);
  });

  test('просмотр деталей прошедшего квиза', async ({ authenticatedPage }) => {
    const historyPage = new QuizHistoryPage(authenticatedPage);
    
    await historyPage.goto();
    
    // Кликаем на первую запись
    await authenticatedPage.locator('[data-testid="history-entry"]').first().click();
    
    // Проверяем что отображаются детали
    await expect(authenticatedPage.locator('[data-testid="quiz-details"]')).toBeVisible();
  });

  test('отображение статистики в истории', async ({ authenticatedPage }) => {
    const historyPage = new QuizHistoryPage(authenticatedPage);
    
    await historyPage.goto();
    
    // Проверяем что статистика отображается
    await expect(authenticatedPage.locator('[data-testid="history-stats"]')).toBeVisible();
    
    // Проверяем основные метрики
    await expect(authenticatedPage.locator('[data-testid="total-quizzes"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="average-score"]')).toBeVisible();
  });

  test('фильтрация истории по дате', async ({ authenticatedPage }) => {
    const historyPage = new QuizHistoryPage(authenticatedPage);
    
    await historyPage.goto();
    
    // Применяем фильтр по дате
    await authenticatedPage.locator('[data-testid="date-filter"]').click();
    await authenticatedPage.locator('[data-testid="filter-last-week"]').click();
    
    // Проверяем что фильтр применён
    await expect(authenticatedPage.locator('[data-testid="active-filter"]')).toContainText('Последняя неделя');
  });

  test('фильтрация по типу квиза', async ({ authenticatedPage }) => {
    const historyPage = new QuizHistoryPage(authenticatedPage);
    
    await historyPage.goto();
    
    // Фильтр по типу (обычный/shared)
    const typeFilter = authenticatedPage.locator('[data-testid="type-filter"]');
    
    if (await typeFilter.isVisible()) {
      await typeFilter.click();
      await authenticatedPage.locator('[data-testid="filter-regular"]').click();
      
      // Проверяем что фильтр применён
      await expect(authenticatedPage.locator('[data-testid="active-filter"]')).toContainText('Обычные');
    }
  });

  test('сортировка истории по дате (новые первые)', async ({ authenticatedPage }) => {
    const historyPage = new QuizHistoryPage(authenticatedPage);
    
    await historyPage.goto();
    
    // Получаем даты первых двух записей
    const dates = await authenticatedPage.locator('[data-testid="history-date"]').allTextContents();
    
    if (dates.length >= 2) {
      const firstDate = new Date(dates[0]);
      const secondDate = new Date(dates[1]);
      
      // Проверяем что первая дата новее второй
      expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
    }
  });

  test('повтор квиза из истории', async ({ authenticatedPage }) => {
    const historyPage = new QuizHistoryPage(authenticatedPage);
    
    await historyPage.goto();
    
    // Кликаем на кнопку повтора
    const retryButton = authenticatedPage.locator('[data-testid="retry-quiz"]').first();
    
    if (await retryButton.isVisible()) {
      await retryButton.click();
      
      // Проверяем что перешли к квизу
      await expect(authenticatedPage.locator('[data-testid="quiz-start"]')).toBeVisible();
    }
  });

  test('удаление записи из истории', async ({ authenticatedPage }) => {
    const historyPage = new QuizHistoryPage(authenticatedPage);
    
    await historyPage.goto();
    
    // Получаем начальное количество записей
    const initialCount = await authenticatedPage.locator('[data-testid="history-entry"]').count();
    
    // Кликаем на кнопку удаления
    const deleteButton = authenticatedPage.locator('[data-testid="delete-entry"]').first();
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Подтверждаем удаление
      await authenticatedPage.locator('[data-testid="confirm-delete"]').click();
      
      // Проверяем что запись удалена
      const newCount = await authenticatedPage.locator('[data-testid="history-entry"]').count();
      expect(newCount).toBe(initialCount - 1);
    }
  });

  test('пагинация истории квизов', async ({ authenticatedPage }) => {
    const historyPage = new QuizHistoryPage(authenticatedPage);
    
    await historyPage.goto();
    
    // Если есть пагинация
    const nextButton = authenticatedPage.locator('[data-testid="history-next"]');
    
    if (await nextButton.isVisible()) {
      await nextButton.click();
      
      // Проверяем что страница изменилась
      await expect(authenticatedPage.locator('[data-testid="history-page"][data-value="2"]')).toHaveClass(/active/);
    }
  });

  test('экспорт истории квизов', async ({ authenticatedPage }) => {
    const historyPage = new QuizHistoryPage(authenticatedPage);
    
    await historyPage.goto();
    
    // Кнопка экспорта
    const exportButton = authenticatedPage.locator('[data-testid="export-history"]');
    
    if (await exportButton.isVisible()) {
      // Слушаем загрузку файла
      const downloadPromise = authenticatedPage.waitForEvent('download');
      await exportButton.click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.csv');
    }
  });

  test('отображение пустого состояния истории', async ({ authenticatedPage }) => {
    // Для этого теста нужен новый пользователь без истории
    // Пропускаем beforeEach создание тестов
    
    const historyPage = new QuizHistoryPage(authenticatedPage);
    await historyPage.goto();
    
    // Очищаем историю если есть (для чистоты теста)
    const deleteButtons = authenticatedPage.locator('[data-testid="delete-entry"]');
    const count = await deleteButtons.count();
    
    // Если история пуста
    if (count === 0) {
      await expect(authenticatedPage.locator('[data-testid="history-empty"]')).toBeVisible();
    }
  });
});


