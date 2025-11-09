import { test, expect } from '../fixtures/auth-fixtures';
import { QuizPage } from '../pages/QuizPage';
import { SharedQuizPage } from '../pages/SharedQuizPage';

/**
 * Расширенный набор E2E тестов для квизов.
 * Покрывает различные типы вопросов, фильтры, граничные случаи и сценарии с shared quiz.
 */

test.describe('Квизы — расширенное покрытие @regression', () => {
  test('разные типы вопросов: single, multiple, year input, drag-n-drop', async ({ authenticatedPage }) => {
    const quizPage = new QuizPage(authenticatedPage);

    await quizPage.goto();

    // Устанавливаем большее число вопросов, чтобы пройти больше типов
    await quizPage.startQuiz({ questionCount: 6 });

    // Проходим квиз, отслеживая типы вопросов
    for (let index = 0; index < 6; index += 1) {
      await expect(quizPage.questionText).toBeVisible();

      const questionText = await quizPage.getCurrentQuestionText();

      if (questionText.match(/год|в каком году/i)) {
        await quizPage.answerYearInput(1900 + index);
      } else if (questionText.match(/упорядоч/i)) {
        // Пытаемся перетаскивать элементы (если возможно)
        const draggable = await authenticatedPage.locator('[draggable="true"]').count();
        if (draggable >= 2) {
          await quizPage.answerDragAndDrop(0, 1);
        } else {
          await quizPage.answerSingleChoice(0);
        }
      } else {
        const optionsCount = await quizPage.answerOptions.count();
        if (optionsCount >= 3) {
          // Пытаемся выбрать два варианта
          await quizPage.answerMultipleChoice([0, 1]);
        } else {
          await quizPage.answerSingleChoice(0);
        }
      }

      await authenticatedPage.waitForTimeout(200);
    }

    await quizPage.expectResults();
  });

  test('применение фильтров по категориям и количеству вопросов', async ({ authenticatedPage }) => {
    const quizPage = new QuizPage(authenticatedPage);

    await quizPage.goto();

    await quizPage.questionCountInput.fill('10');

    const categoryCheckboxes = quizPage.categoryCheckboxes;
    if ((await categoryCheckboxes.count()) >= 2) {
      await categoryCheckboxes.first().check();
      await categoryCheckboxes.nth(1).check();
    }

    await quizPage.startButton.click();

    await expect(quizPage.questionText).toBeVisible();
    await quizPage.expectQuestionNumber(1, 10);
  });

  test('квиз сохраняет прогресс и отображает историю', async ({ authenticatedPage }) => {
    const quizPage = new QuizPage(authenticatedPage);

    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });

    // Отвечаем на все вопросы
    await quizPage.completeQuizQuickly(3);

    await quizPage.expectResults();

    // Открываем историю через кнопку
    await quizPage.viewHistory();

    await expect(authenticatedPage).toHaveURL(/\/quiz\/history/);
  });

  test('создание и прохождение shared quiz', async ({ authenticatedPage, page }) => {
    const quizPage = new QuizPage(authenticatedPage);

    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);
    await quizPage.expectResults();

    // Создаём shared quiz и копируем код
    const shareCode = await quizPage.shareQuiz();
    expect(shareCode).not.toEqual('');

    // Новый контекст для гостевого прохождения shared quiz
    const context = await page.context().browser()?.newContext();
    const guestPage = await context?.newPage();

    if (!guestPage) {
      throw new Error('Не удалось создать гостевую страницу для shared quiz');
    }

    const sharedQuizPage = new SharedQuizPage(guestPage);
    await sharedQuizPage.openShareLink(shareCode.trim());
    await sharedQuizPage.startSharedQuiz();
    await sharedQuizPage.completeSharedQuiz(3);
    await sharedQuizPage.expectGuestResults();

    await context.close();
  });

  test('edge case: слишком большое количество вопросов', async ({ authenticatedPage }) => {
    const quizPage = new QuizPage(authenticatedPage);

    await quizPage.goto();

    await quizPage.questionCountInput.fill('999');
    await quizPage.startButton.click();

    await expect(quizPage.questionText).toBeVisible();
    await quizPage.expectQuestionNumber(1, 999);
  });

  test('edge case: отсутствие доступных вопросов', async ({ authenticatedPage }) => {
    const quizPage = new QuizPage(authenticatedPage);

    await quizPage.goto();

    const allCheckboxes = await quizPage.categoryCheckboxes.all();
    for (const checkbox of allCheckboxes) {
      if (await checkbox.isChecked()) {
        await checkbox.uncheck();
      }
    }

    await quizPage.startButton.click();

    await expect(authenticatedPage.locator('text=/нет доступных вопросов|no questions/i')).toBeVisible({ timeout: 5000 });
  });
});
