import { test, expect } from '../fixtures/auth-fixtures';
import { LeaderboardPage } from '../pages/LeaderboardPage';
import { QuizPage } from '../pages/QuizPage';

test.describe('Таблица лидеров @regression', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Создаём результат квиза для тестов
    const quizPage = new QuizPage(authenticatedPage);
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 5 });
    await quizPage.completeQuizQuickly(5);
  });

  test('отображение таблицы лидеров @smoke', async ({ authenticatedPage }) => {
    const leaderboardPage = new LeaderboardPage(authenticatedPage);
    
    await leaderboardPage.goto();
    await leaderboardPage.expectMinimumEntries(0);
    
    // Проверяем что таблица отображается
    await expect(authenticatedPage.locator('[data-testid="leaderboard-table"]')).toBeVisible();
  });

  test('фильтрация по периоду: неделя', async ({ authenticatedPage }) => {
    const leaderboardPage = new LeaderboardPage(authenticatedPage);
    
    await leaderboardPage.goto();
    await leaderboardPage.filterByPeriod('week');
    
    // Проверяем что фильтр применён
    await expect(authenticatedPage.locator('[data-testid="period-filter"][data-value="week"]')).toHaveClass(/active/);
    await leaderboardPage.expectMinimumEntries(0);
  });

  test('фильтрация по периоду: месяц', async ({ authenticatedPage }) => {
    const leaderboardPage = new LeaderboardPage(authenticatedPage);
    
    await leaderboardPage.goto();
    await leaderboardPage.filterByPeriod('month');
    
    await expect(authenticatedPage.locator('[data-testid="period-filter"][data-value="month"]')).toHaveClass(/active/);
    await leaderboardPage.expectMinimumEntries(0);
  });

  test('фильтрация по периоду: всё время', async ({ authenticatedPage }) => {
    const leaderboardPage = new LeaderboardPage(authenticatedPage);
    
    await leaderboardPage.goto();
    await leaderboardPage.filterByPeriod('all-time');
    
    await expect(authenticatedPage.locator('[data-testid="period-filter"][data-value="all-time"]')).toHaveClass(/active/);
    await leaderboardPage.expectMinimumEntries(0);
  });

  test('отображение топ-10 игроков', async ({ authenticatedPage }) => {
    const leaderboardPage = new LeaderboardPage(authenticatedPage);
    
    await leaderboardPage.goto();
    
    // Проверяем что отображается не более 10 записей
    const entries = await authenticatedPage.locator('[data-testid="leaderboard-entry"]').count();
    expect(entries).toBeLessThanOrEqual(10);
  });

  test('сортировка по очкам (по убыванию)', async ({ authenticatedPage }) => {
    const leaderboardPage = new LeaderboardPage(authenticatedPage);
    
    await leaderboardPage.goto();
    await leaderboardPage.expectMinimumEntries(1);
    
    // Получаем очки первых двух записей
    const scores = await authenticatedPage.locator('[data-testid="leaderboard-score"]').allTextContents();
    
    if (scores.length >= 2) {
      const firstScore = parseInt(scores[0]);
      const secondScore = parseInt(scores[1]);
      
      // Проверяем что сортировка по убыванию
      expect(firstScore).toBeGreaterThanOrEqual(secondScore);
    }
  });

  test('отображение позиции текущего пользователя', async ({ authenticatedPage }) => {
    const leaderboardPage = new LeaderboardPage(authenticatedPage);
    
    await leaderboardPage.goto();
    
    // Проверяем что текущий пользователь выделен
    const currentUserEntry = authenticatedPage.locator('[data-testid="leaderboard-entry"][data-current="true"]');
    await expect(currentUserEntry).toBeVisible();
  });

  test('пагинация таблицы лидеров', async ({ authenticatedPage }) => {
    const leaderboardPage = new LeaderboardPage(authenticatedPage);
    
    await leaderboardPage.goto();
    
    // Если есть пагинация, проверяем что она работает
    const nextButton = authenticatedPage.locator('[data-testid="leaderboard-next"]');
    
    if (await nextButton.isVisible()) {
      await nextButton.click();
      
      // Проверяем что страница изменилась
      await expect(authenticatedPage.locator('[data-testid="leaderboard-page"][data-value="2"]')).toHaveClass(/active/);
    }
  });

  test('отображение пустого состояния', async ({ page }) => {
    const leaderboardPage = new LeaderboardPage(page);
    
    await leaderboardPage.goto();
    
    // Для неавторизованного пользователя может быть пустое состояние
    const emptyState = page.locator('[data-testid="leaderboard-empty"]');
    const hasEntries = await page.locator('[data-testid="leaderboard-entry"]').count() > 0;
    
    if (!hasEntries) {
      await expect(emptyState).toBeVisible();
    }
  });
});


