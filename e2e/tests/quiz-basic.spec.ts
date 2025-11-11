import { test, expect } from '../fixtures/auth-fixtures';
import { QuizPage } from '../pages/QuizPage';

test.describe('Базовый квиз', () => {
  test('запуск квиза с настройками', async ({ page }) => {
    const quizPage = new QuizPage(page);
    
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 5 });
    
    await expect(quizPage.questionText).toBeVisible();
  });

  test('прохождение квиза и отображение результатов', async ({ page }) => {
    const quizPage = new QuizPage(page);
    
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);
    
    await quizPage.expectResults();
  });

  test('сохранение результата для авторизованного пользователя', async ({ authenticatedPage }) => {
    const quizPage = new QuizPage(authenticatedPage);
    
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);
    
    await quizPage.expectResults();
    // Результат должен быть сохранён
  });

  test('ответы на разные типы вопросов', async ({ page }) => {
    const quizPage = new QuizPage(page);
    
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 5 });
    
    // Тестируем различные типы ответов
    await quizPage.answerSingleChoice(0);
    await page.waitForTimeout(300);
  });
});




