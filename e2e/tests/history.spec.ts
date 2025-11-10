import { test, expect } from '../fixtures/auth-fixtures';
import { QuizHistoryPage } from '../pages/QuizHistoryPage';
import { withQuizHistoryData } from '../utils/quiz-history-fixtures';
import { DEFAULT_TEST_USER } from '../helpers/auth-helper';

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

test.describe('История квизов @regression', () => {
  test('отображение истории квизов @smoke', async ({ authenticatedPage }) => {
    await withQuizHistoryData(
      {
        user: {
          email: DEFAULT_TEST_USER.email,
          username: DEFAULT_TEST_USER.username,
        },
        attempts: [
          {
            correctAnswers: 3,
            totalQuestions: 5,
            totalTimeMs: 75_000,
            ratingPoints: 420,
            createdAt: minutesAgo(30),
          },
          {
            correctAnswers: 2,
            totalQuestions: 4,
            totalTimeMs: 65_000,
            ratingPoints: 360,
            createdAt: minutesAgo(120),
          },
        ],
      },
      async () => {
        const historyPage = new QuizHistoryPage(authenticatedPage);
        await historyPage.goto();

        await expect(historyPage.historyList).toBeVisible();
        await historyPage.expectMinimumEntries(2);
        await expect(authenticatedPage.locator('.quiz-history-item').first()).toContainText(
          /Обычный квиз/i
        );
        await expect(authenticatedPage.locator('.quiz-history-item').first()).toContainText('%');
      }
    );
  });

  test('просмотр деталей прошедшего квиза', async ({ authenticatedPage }) => {
    await withQuizHistoryData(
      {
        user: {
          email: DEFAULT_TEST_USER.email,
          username: DEFAULT_TEST_USER.username,
        },
        attempts: [
          {
            correctAnswers: 4,
            totalQuestions: 5,
            totalTimeMs: 85_000,
            ratingPoints: 480,
            createdAt: minutesAgo(45),
          },
        ],
      },
      async () => {
        const historyPage = new QuizHistoryPage(authenticatedPage);
        await historyPage.goto();

        const firstEntry = historyPage.historyEntries.first();
        await expect(firstEntry).toBeVisible({ timeout: 10_000 });
        await firstEntry.click();

        await expect(authenticatedPage.locator('.quiz-results-summary')).toBeVisible({
          timeout: 10_000,
        });
        await expect(authenticatedPage.locator('.quiz-title')).toContainText(/Обычный квиз/i);
      }
    );
  });

  test('отображение пустого состояния истории', async ({ authenticatedPage }) => {
    await withQuizHistoryData(
      {
        user: {
          email: DEFAULT_TEST_USER.email,
          username: DEFAULT_TEST_USER.username,
        },
        attempts: [],
      },
      async () => {
        const historyPage = new QuizHistoryPage(authenticatedPage);
        await historyPage.goto();
        await historyPage.waitForLoaded();
        await historyPage.expectEmptyState();
      }
    );
  });
});


