import { test, expect } from '../fixtures/auth-fixtures';
import { QuizHistoryPage } from '../pages/QuizHistoryPage';
import { QuizAttemptDetailPage } from '../pages/QuizAttemptDetailPage';
import { QuizSessionDetailPage } from '../pages/QuizSessionDetailPage';
import {
  withQuizHistoryData,
  QuizHistoryAttemptSeed,
  QuizHistoryQuestionSeed,
  QuizHistoryAnswerSeed,
} from '../utils/quiz-history-fixtures';
import { DEFAULT_TEST_USER } from '../helpers/auth-helper';

function createQuestionSet(): QuizHistoryQuestionSeed[] {
  return [
    {
      id: 'q-history-1',
      type: 'birthYear',
      question: 'В каком году родился Леонардо да Винчи?',
      correctAnswer: '1452',
      explanation: 'Леонардо да Винчи родился в 1452 году во Флоренции.',
      data: {
        person: {
          id: 'person-leonardo',
          name: 'Леонардо да Винчи',
          birthYear: 1452,
          deathYear: 1519,
          category: 'artists',
          country: 'Италия',
          description: 'Художник, ученый и изобретатель эпохи Возрождения.',
        },
      },
    },
    {
      id: 'q-history-2',
      type: 'profession',
      question: 'Кем был Никола Тесла?',
      correctAnswer: 'Инженер и изобретатель',
      explanation: 'Тесла прославился работами в области электричества и радиотехники.',
      data: {
        person: {
          id: 'person-tesla',
          name: 'Никола Тесла',
          birthYear: 1856,
          deathYear: 1943,
          category: 'scientists',
          country: 'Сербия / США',
          description: 'Изобретатель и инженер в области электротехники.',
        },
      },
    },
  ];
}

function createAnswerSet(questions: QuizHistoryQuestionSeed[]): QuizHistoryAnswerSeed[] {
  return questions.map((question, index) => ({
    questionId: question.id,
    answer: question.correctAnswer,
    isCorrect: true,
    timeSpent: 8_000 + index * 2_000,
  }));
}

const seedUser = {
  email: DEFAULT_TEST_USER.email,
  username: DEFAULT_TEST_USER.username,
  password: DEFAULT_TEST_USER.password,
};

test.describe('Детали истории квизов @regression', () => {
  test('детальная страница попытки отображает ответы и возврат в историю', async ({ authenticatedPage }) => {
    const questions = createQuestionSet();
    const answers = createAnswerSet(questions);

    const attempt: QuizHistoryAttemptSeed = {
      correctAnswers: questions.length,
      totalQuestions: questions.length,
      totalTimeMs: 95_000,
      ratingPoints: 540,
      createdAt: new Date(),
      config: { questionCount: questions.length, questionTypes: ['birthYear', 'profession'] },
      questions,
      answers,
    };

    await withQuizHistoryData(
      {
        user: seedUser,
        attempts: [attempt],
      },
      async () => {
        const historyPage = new QuizHistoryPage(authenticatedPage);
        await historyPage.goto();

        const firstEntry = historyPage.historyEntries.first();
        await expect(firstEntry).toBeVisible({ timeout: 10_000 });
        await firstEntry.click();

        const detailPage = new QuizAttemptDetailPage(authenticatedPage);
        await detailPage.expectResultsSummary({ correct: 2, total: 2 });
        await detailPage.toggleAnswer(0);
        await detailPage.expectAnswerExpanded(0);

        await detailPage.goBackToHistory();
        await historyPage.waitForLoaded();
      }
    );
  });

  test('shared-попытка показывает модалку шаринга', async ({ authenticatedPage }) => {
    const questions = createQuestionSet();
    const answers = createAnswerSet(questions);
    const shareCode = 'E2E-HISTORY-SHARE';

    const attempt: QuizHistoryAttemptSeed = {
      correctAnswers: questions.length,
      totalQuestions: questions.length,
      totalTimeMs: 82_000,
      ratingPoints: 512,
      createdAt: new Date(),
      config: { questionCount: questions.length, questionTypes: ['birthYear', 'profession'] },
      questions,
      answers,
      sharedQuiz: {
        shareCode,
        title: 'E2E Shared History Quiz',
        config: { questionCount: questions.length },
        questions,
      },
    };

    await withQuizHistoryData(
      {
        user: seedUser,
        attempts: [attempt],
      },
      async () => {
        const historyPage = new QuizHistoryPage(authenticatedPage);
        await historyPage.goto();

        await historyPage.historyEntries.first().click();

        const detailPage = new QuizAttemptDetailPage(authenticatedPage);
        await detailPage.expectResultsSummary({ correct: 2, total: 2 });
        await detailPage.expectShareButtonVisible();
        await detailPage.openShareModal();

        const shareLink = await detailPage.getShareLink();
        await expect(shareLink ?? '').toContain(shareCode);

        await detailPage.closeShareModal();
        await detailPage.goBackToHistory();
        await historyPage.waitForLoaded();
      }
    );
  });

  test('детальная страница shared-сессии доступна по токену', async ({ page }) => {
    const questions = createQuestionSet();
    const answers = createAnswerSet(questions);
    const shareCode = 'E2E-SHARE-SESSION';
    const sessionToken = 'session-token-e2e';

    const attempt: QuizHistoryAttemptSeed = {
      correctAnswers: questions.length,
      totalQuestions: questions.length,
      totalTimeMs: 77_000,
      ratingPoints: 498,
      createdAt: new Date(),
      config: { questionCount: questions.length, questionTypes: ['birthYear', 'profession'] },
      questions,
      answers,
      sharedQuiz: {
        shareCode,
        title: 'E2E Shared Session Quiz',
        config: { questionCount: questions.length },
        questions,
        session: {
          sessionToken,
          answers,
          startedAt: new Date(),
          finishedAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    };

    await withQuizHistoryData(
      {
        user: seedUser,
        attempts: [attempt],
      },
      async () => {
        const sessionPage = new QuizSessionDetailPage(page);
        await page.goto(`/quiz/history/${sessionToken}`);
        await sessionPage.expectResultsSummary({ correct: 2, total: 2 });
        await sessionPage.toggleAnswer(0);
        await sessionPage.expectAnswerExpanded(0);
      }
    );
  });
});


