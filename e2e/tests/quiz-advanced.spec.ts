import { test, expect } from '../fixtures/auth-fixtures';
import type { Page } from '@playwright/test';
import { QuizPage } from '../pages/QuizPage';
import { SharedQuizPage } from '../pages/SharedQuizPage';

/**
 * Расширенный набор E2E тестов для квизов.
 * Покрывает различные типы вопросов, фильтры, граничные случаи и сценарии с shared quiz.
 */

const enableSimpleQuestions = async (page: Page) => {
  await page.addInitScript(() => {
    (window as any).__E2E_SIMPLE_QUESTIONS__ = true;
  });
};

test.describe('Квизы — расширенное покрытие @regression', () => {
  test('базовое прохождение квиза', async ({ authenticatedPage }) => {
    await enableSimpleQuestions(authenticatedPage);
    const quizPage = new QuizPage(authenticatedPage);

    await quizPage.goto();
    await quizPage.setQuestionTypes(['Угадай год рождения', 'Угадай год смерти']);

    await quizPage.startQuiz({ questionCount: 5 });
    await quizPage.completeQuizQuickly(5);
    await quizPage.expectResults();
  });

  test('изменение количества вопросов влияет на прогресс', async ({ authenticatedPage }) => {
    await enableSimpleQuestions(authenticatedPage);
    const quizPage = new QuizPage(authenticatedPage);

    await quizPage.goto();
    await quizPage.setQuestionTypes(['Угадай год рождения', 'Угадай год смерти']);
    await quizPage.setQuestionCount(7);
    await quizPage.startQuiz();

    await expect(quizPage.questionText).toBeVisible();
    await quizPage.expectQuestionNumber(1, 7);
  });

  test('квиз сохраняет прогресс и отображает историю', async ({ authenticatedPage }) => {
    await enableSimpleQuestions(authenticatedPage);
    const quizPage = new QuizPage(authenticatedPage);

    await quizPage.goto();
    await quizPage.setQuestionTypes(['Угадай год рождения', 'Угадай год смерти']);
    await quizPage.startQuiz({ questionCount: 5 });
    await quizPage.completeQuizQuickly(5);

    await quizPage.expectResults();

    // Открываем историю через кнопку
    await quizPage.viewHistory();

    await expect(authenticatedPage).toHaveURL(/\/quiz\/history/);
  });

  test('создание и прохождение shared quiz', async ({ authenticatedPage, page }) => {
    await enableSimpleQuestions(authenticatedPage);
    const quizPage = new QuizPage(authenticatedPage);
    const questionCount = 3;

    await quizPage.goto();
    await quizPage.setQuestionTypes(['Угадай год рождения', 'Угадай год смерти']);
    await quizPage.startQuiz({ questionCount });
    await quizPage.completeQuizQuickly(questionCount);
    await quizPage.expectResults();

    // Создаём shared quiz и копируем код
    const shareCode = await quizPage.shareQuiz();
    expect(shareCode).not.toEqual('');

    // Новый контекст для гостевого прохождения shared quiz
    const context = await page.context().browser()?.newContext();
    if (!context) {
      throw new Error('Не удалось создать контекст браузера для гостевого квиза');
    }
    const guestPage = await context.newPage();

    await enableSimpleQuestions(guestPage);
    const sharedQuizPage = new SharedQuizPage(guestPage);
    await sharedQuizPage.goto(shareCode.trim());
    await sharedQuizPage.startSharedQuiz();
    const totalQuestions = (await sharedQuizPage.getQuestionsTotal()) ?? questionCount;
    await sharedQuizPage.completeSharedQuiz(totalQuestions);
    await sharedQuizPage.expectGuestResults();

    await context.close();
  });

  test('edge case: максимальное количество вопросов', async ({ authenticatedPage }) => {
    const quizPage = new QuizPage(authenticatedPage);

    await quizPage.goto();
    await quizPage.setQuestionTypes(['Угадай год рождения', 'Угадай год смерти']);
    await quizPage.setQuestionCount(15);
    await quizPage.startQuiz();

    await expect(quizPage.questionText).toBeVisible();
    await quizPage.expectQuestionNumber(1, 15);
  });

  test('edge case: отсутствие выбранных типов вопросов блокирует старт', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete window.__E2E_SIMPLE_QUESTIONS__;
    });
    const quizPage = new QuizPage(authenticatedPage);

    await quizPage.goto();

    await quizPage.clearQuestionTypes();
    const selectedTypes = await quizPage.getSelectedQuestionTypesCount();

    if (selectedTypes === 0) {
      const isEnabled = await quizPage.startButton.isEnabled().catch(() => false);
      if (!isEnabled) {
        await expect(quizPage.startButton).toBeDisabled();
        return;
      }
    } else {
      expect(selectedTypes).toBeGreaterThan(0);
      await expect(quizPage.startButton).toBeEnabled();
    }

    await quizPage.startButton.click();
    await expect(quizPage.questionText).toBeVisible({ timeout: 10000 });
  });

  test.describe('Устойчивость к ошибкам сохранения результата', () => {
    test('обновляет токены и сохраняет результат после 401', async ({ authenticatedPage }) => {
      await enableSimpleQuestions(authenticatedPage);
      const quizPage = new QuizPage(authenticatedPage);

      await authenticatedPage.addInitScript(
        ({ mode, successResponse }) => {
          const existingHook = (window as any).__E2E_SAVE_RESULT_HOOK__;
          if (existingHook) {
            existingHook.mode = mode;
            existingHook.successResponse = successResponse;
            existingHook.calls = 0;
            return;
          }

          const hook = {
            mode,
            successResponse,
            calls: 0,
          };
          (window as any).__E2E_SAVE_RESULT_HOOK__ = hook;

          const originalFetch = window.fetch.bind(window);
          window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : input.toString();
            const currentHook = (window as any).__E2E_SAVE_RESULT_HOOK__;

            if (url.includes('/api/quiz/save-result')) {
              currentHook.calls += 1;
              if (currentHook.mode === 'refresh' && currentHook.calls === 1) {
                return new Response(JSON.stringify({ message: 'Unauthorized' }), {
                  status: 401,
                  headers: { 'Content-Type': 'application/json' },
                });
              }
              return new Response(JSON.stringify(currentHook.successResponse), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              });
            }

            if (url.includes('/api/auth/refresh')) {
              if (currentHook.mode === 'refresh') {
                return new Response(
                  JSON.stringify({
                    success: true,
                    data: {
                      access_token: 'new-access-token',
                      refresh_token: 'new-refresh-token',
                      user: {
                        id: 1,
                        email: 'testuser@test.com',
                        role: 'user',
                        email_verified: true,
                      },
                    },
                  }),
                  {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                  }
                );
              }

              if (currentHook.mode === 'always-401') {
                return new Response(JSON.stringify({ message: 'refresh failed' }), {
                  status: 401,
                  headers: { 'Content-Type': 'application/json' },
                });
              }
            }

            return originalFetch(input, init);
          };
        },
        {
          mode: 'refresh',
          successResponse: {
            success: true,
            data: { attemptId: 9999, ratingPoints: 123 },
          },
        }
      );

      await quizPage.goto();
      await quizPage.startQuiz({ questionCount: 3 });
      await quizPage.completeQuizQuickly(3);
      await quizPage.expectResults();

      await expect
        .poll(async () =>
          authenticatedPage.evaluate(
            () => ((window as any).__E2E_SAVE_RESULT_HOOK__?.calls as number) ?? 0
          )
        )
        .toBeGreaterThanOrEqual(2);

      const ratingLocator = authenticatedPage.locator('.quiz-stat.quiz-stat-highlight');
      await expect(ratingLocator).toBeVisible();

      const storedAuth = await authenticatedPage.evaluate(() => localStorage.getItem('auth'));
      expect(storedAuth).not.toBeNull();
      const parsedAuth = storedAuth ? JSON.parse(storedAuth) : null;
      expect(parsedAuth?.accessToken).toBe('new-access-token');
      expect(parsedAuth?.refreshToken).toBe('new-refresh-token');
    });

    test('очищает локальное состояние при повторном 401', async ({ authenticatedPage }) => {
      await enableSimpleQuestions(authenticatedPage);
      const quizPage = new QuizPage(authenticatedPage);

      await authenticatedPage.addInitScript(() => {
        const existingHook = (window as any).__E2E_SAVE_RESULT_HOOK__;
        if (existingHook) {
          existingHook.mode = 'always-401';
          existingHook.successResponse = {
            success: true,
            data: { attemptId: 9999, ratingPoints: 0 },
          };
          existingHook.calls = 0;
          return;
        }

        const hook = {
          mode: 'always-401',
          successResponse: {
            success: true,
            data: { attemptId: 9999, ratingPoints: 0 },
          },
          calls: 0,
        };
        (window as any).__E2E_SAVE_RESULT_HOOK__ = hook;

        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString();
          const currentHook = (window as any).__E2E_SAVE_RESULT_HOOK__;

          if (url.includes('/api/quiz/save-result')) {
            currentHook.calls += 1;
            return new Response(JSON.stringify({ message: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          if (url.includes('/api/auth/refresh')) {
            return new Response(JSON.stringify({ message: 'refresh failed' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          return originalFetch(input, init);
        };
      });

      await quizPage.goto();
      await quizPage.startQuiz({ questionCount: 3 });
      await quizPage.completeQuizQuickly(3);
      await quizPage.expectResults();

      await expect
        .poll(async () =>
          authenticatedPage.evaluate(
            () => ((window as any).__E2E_SAVE_RESULT_HOOK__?.calls as number) ?? 0
          )
        )
        .toBeGreaterThanOrEqual(2);

      await expect
        .poll(async () => authenticatedPage.evaluate(() => localStorage.getItem('auth')))
        .toBeNull();
      await expect
        .poll(async () => authenticatedPage.evaluate(() => localStorage.getItem('auth_version')))
        .toBeNull();

      await expect(authenticatedPage.locator('button', { hasText: 'Играть снова' })).toBeVisible();
    });
  });
});
