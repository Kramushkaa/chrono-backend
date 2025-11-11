import { test, expect } from '../fixtures/auth-fixtures';
import { ProfilePage } from '../pages/ProfilePage';
import { QuizHistoryPage } from '../pages/QuizHistoryPage';
import { withQuizHistoryData } from '../utils/quiz-history-fixtures';
import { DEFAULT_TEST_USER } from '../helpers/auth-helper';

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

/**
 * Расширенные сценарии для пользовательского профиля
 * Фокус: история квизов, достижения, статистика
 */

test.describe('Профиль пользователя — расширенные сценарии @regression', () => {
  test('профиль отображает основную информацию и ведёт к истории квизов', async ({ authenticatedPage }) => {
    await withQuizHistoryData(
      {
        user: {
          email: DEFAULT_TEST_USER.email,
          username: DEFAULT_TEST_USER.username,
        },
        attempts: [],
      },
      async () => {
        const profilePage = new ProfilePage(authenticatedPage);
        await profilePage.goto();

        await expect(authenticatedPage.locator('text=/История квизов/')).toBeVisible();
        await expect(
          authenticatedPage.locator('button:has-text("✏️ Редактировать"), button:has-text("Редактировать")')
        ).toBeVisible();

        await authenticatedPage.locator('button:has-text("Посмотреть историю")').click();
        await expect(authenticatedPage).toHaveURL(/\/quiz\/history/);

        const historyPage = new QuizHistoryPage(authenticatedPage);
        await historyPage.waitForLoaded();
        await historyPage.expectEmptyState();
      }
    );
  });

  test('история квизов отображает результаты последних игр', async ({ authenticatedPage }) => {
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
            totalTimeMs: 95_000,
            ratingPoints: 520,
            createdAt: minutesAgo(15),
          },
          {
            correctAnswers: 3,
            totalQuestions: 6,
            totalTimeMs: 120_000,
            ratingPoints: 410,
            createdAt: minutesAgo(45),
          },
        ],
      },
      async () => {
        const profilePage = new ProfilePage(authenticatedPage);
        await profilePage.goto();
        await authenticatedPage.locator('button:has-text("Посмотреть историю")').click();
        await expect(authenticatedPage).toHaveURL(/\/quiz\/history/);

        const historyPage = new QuizHistoryPage(authenticatedPage);
        await historyPage.waitForLoaded();
        await historyPage.expectMinimumEntries(2);

        const firstEntry = historyPage.historyEntries.first();
        await expect(firstEntry).toContainText('4 / 5');
        await expect(firstEntry).toContainText(/очков/i);
        await expect(firstEntry).toContainText(/Время:/i);
      }
    );
  });

});
