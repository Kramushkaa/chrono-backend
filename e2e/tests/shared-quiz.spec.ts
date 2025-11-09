import { test, expect } from '../fixtures/auth-fixtures';
import { QuizPage } from '../pages/QuizPage';
import { SharedQuizPage } from '../pages/SharedQuizPage';

test.describe('Shared Quiz @regression', () => {
  test('создание shared quiz авторизованным пользователем @smoke', async ({ authenticatedPage }) => {
    const quizPage = new QuizPage(authenticatedPage);
    
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);
    
    const shareCode = await quizPage.shareQuiz();
    expect(shareCode).toBeTruthy();
    expect(shareCode).toMatch(/^[a-zA-Z0-9]{6,12}$/);
  });

  test('прохождение shared quiz гостем', async ({ page }) => {
    const sharedQuizPage = new SharedQuizPage(page);
    
    // Используем тестовый share code
    await sharedQuizPage.goto('test-share-code');
    await sharedQuizPage.startSharedQuiz();
    
    // Проверяем что квиз загрузился
    await expect(page.locator('[data-testid="quiz-question"]')).toBeVisible();
  });

  test('передача ссылки на shared quiz', async ({ authenticatedPage }) => {
    const quizPage = new QuizPage(authenticatedPage);
    
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);
    
    const shareCode = await quizPage.shareQuiz();
    const shareUrl = await quizPage.getShareUrl();
    
    expect(shareUrl).toContain(shareCode);
    expect(shareUrl).toContain('/shared-quiz/');
  });

  test('просмотр результатов shared quiz создателем', async ({ authenticatedPage }) => {
    const quizPage = new QuizPage(authenticatedPage);
    
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);
    
    const shareCode = await quizPage.shareQuiz();
    
    // Переходим к просмотру результатов shared quiz
    await authenticatedPage.goto(`/shared-quiz/${shareCode}/results`);
    
    // Проверяем что страница результатов отображается
    await expect(authenticatedPage.locator('[data-testid="shared-quiz-results"]')).toBeVisible();
  });

  test('прохождение shared quiz авторизованным пользователем', async ({ authenticatedPage, page }) => {
    // Создаём shared quiz от первого пользователя
    const quizPage = new QuizPage(page);
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);
    const shareCode = await quizPage.shareQuiz();
    
    // Проходим shared quiz от авторизованного пользователя
    const sharedQuizPage = new SharedQuizPage(authenticatedPage);
    await sharedQuizPage.goto(shareCode);
    await sharedQuizPage.startSharedQuiz();
    
    // Результаты должны быть сохранены
    await expect(authenticatedPage.locator('[data-testid="quiz-results"]')).toBeVisible();
  });

  test('результаты гостей в shared quiz', async ({ page, authenticatedPage }) => {
    // Создаём shared quiz
    const quizPage = new QuizPage(authenticatedPage);
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);
    const shareCode = await quizPage.shareQuiz();
    
    // Гость проходит shared quiz
    const sharedQuizPage = new SharedQuizPage(page);
    await sharedQuizPage.goto(shareCode);
    await sharedQuizPage.startSharedQuiz();
    await sharedQuizPage.completeQuizQuickly(3);
    
    // Проверяем что результаты отображаются для гостя
    await expect(page.locator('[data-testid="quiz-results"]')).toBeVisible();
  });
});


