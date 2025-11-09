import { test, expect } from '../fixtures/auth-fixtures';
import { ProfilePage } from '../pages/ProfilePage';
import { QuizPage } from '../pages/QuizPage';
import { QuizHistoryPage } from '../pages/QuizHistoryPage';
import { ManagePage } from '../pages/ManagePage';
import { createTestPerson, createTestAchievement } from '../utils/test-data-factory';

/**
 * Расширенные сценарии для пользовательского профиля
 * Фокус: история квизов, достижения, статистика
 */

test.describe('Профиль пользователя — расширенные сценарии @regression', () => {
  test('профиль отображает основную информацию и ведёт к истории квизов', async ({ authenticatedPage }) => {
    const profilePage = new ProfilePage(authenticatedPage);

    await profilePage.goto();

    // Проверяем, что карточка профиля и секция истории отображаются
    await expect(authenticatedPage.locator('text=/История квизов/')).toBeVisible();
    await expect(authenticatedPage.locator('button:has-text("✏️ Редактировать"), button:has-text("Редактировать")')).toBeVisible();

    // Переходим к истории квизов из профиля
    await authenticatedPage.locator('button:has-text("Посмотреть историю")').click();
    await expect(authenticatedPage).toHaveURL(/\/quiz\/history/);

    // Убеждаемся, что страница истории загружена
    const historyPage = new QuizHistoryPage(authenticatedPage);
    await expect(historyPage.historyList).toBeVisible();
  });

  test('статистика истории квизов обновляется после прохождения игр', async ({ authenticatedPage }) => {
    const quizPage = new QuizPage(authenticatedPage);

    // Проходим два квиза для генерации истории
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);

    await authenticatedPage.waitForTimeout(500);

    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 5 });
    await quizPage.completeQuizQuickly(5);

    // Открываем историю через профиль
    const profilePage = new ProfilePage(authenticatedPage);
    await profilePage.goto();
    await authenticatedPage.locator('button:has-text("Посмотреть историю")').click();
    await expect(authenticatedPage).toHaveURL(/\/quiz\/history/);

    const historyPage = new QuizHistoryPage(authenticatedPage);
    await expect(historyPage.historyList).toBeVisible();

    // Проверяем, что элементы истории появились
    await expect(authenticatedPage.locator('[data-testid="history-entry"]').first()).toBeVisible();

    // Проверяем агрегированную статистику (количество попыток >= 2)
    const totalText = await authenticatedPage.locator('[data-testid="total-quizzes"]').textContent();
    const totalAttempts = parseInt(totalText?.replace(/[^0-9]/g, '') ?? '0', 10);
    expect(totalAttempts).toBeGreaterThanOrEqual(2);

    // Проверяем наличие средних показателей и рейтинга
    await expect(authenticatedPage.locator('[data-testid="average-score"]').first()).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="best-score"]').first()).toBeVisible();
  });

  test('пользователь может управлять своими достижениями через раздел "Мои"', async ({ authenticatedPage }) => {
    const managePage = new ManagePage(authenticatedPage);
    const person = createTestPerson();
    const achievement = createTestAchievement();

    await managePage.goto();

    // Создаём тестовую личность (используется в связанных сценариях)
    await managePage.createPerson(person);
    await managePage.expectPersonInList(person.name);

    // Создаём новое достижение и убеждаемся, что оно отображается в списке
    await managePage.createAchievement(achievement);
    await managePage.switchTab('achievements');
    await expect(authenticatedPage.locator('[data-testid="items-list"]').first()).toContainText(achievement.title);

    // Переключаемся на раздел "Мои" и проверяем наличие достижения там
    await authenticatedPage.getByRole('button', { name: /^Мои/ }).click();
    await authenticatedPage.waitForTimeout(500);
    await expect(authenticatedPage.locator('[data-testid="items-list"]').first()).toContainText(achievement.title);
  });
});
