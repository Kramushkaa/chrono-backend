import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object для страницы shared quiz
 */
export class SharedQuizPage {
  readonly page: Page;
  readonly startButton: Locator;
  readonly questionContainer: Locator;
  readonly questionText: Locator;
  readonly answerOptions: Locator;
  readonly nextButton: Locator;
  readonly submitButton: Locator;
  readonly scoreDisplay: Locator;
  readonly leaderboard: Locator;
  readonly leaderboardEntries: Locator;
  readonly resultsContainer: Locator;
  readonly progressText: Locator;

  constructor(page: Page) {
    this.page = page;
    
    this.startButton = page.locator(
      'button:has-text("Начать квиз"), button:has-text("Пройти квиз"), button:has-text("Начать игру"), button:has-text("Начать"), button:has-text("Start")'
    );
    this.questionContainer = page.locator('.quiz-question-container').first();
    this.questionText = page
      .locator('.quiz-question-content h2, .quiz-question-content h3, .quiz-question-content h4')
      .first();
    this.answerOptions = page.locator(
      '.quiz-question-options button, .quiz-options-grid button, .quiz-option, [data-testid="answer-option"]'
    );
    this.nextButton = page.locator(
      'button:has-text("Далее"), button:has-text("Next"), button:has-text("Проверить"), button:has-text("Завершить игру")'
    );
    this.submitButton = page.locator(
      'button:has-text("Завершить игру"), button:has-text("Завершить"), button:has-text("Submit")'
    );
    this.scoreDisplay = page.locator('[data-testid="score"], .score');
    this.leaderboard = page.locator('[data-testid="leaderboard"], .leaderboard');
    this.leaderboardEntries = page.locator('[data-testid="leaderboard-entry"], .leaderboard-entry');
    this.resultsContainer = page.locator('[data-testid="quiz-results"], .quiz-results');
    this.progressText = page.locator('.shared-quiz-progress p').first();
  }

  async goto(shareCode: string): Promise<void> {
    await this.page.goto(`/quiz/${shareCode}`);
  }

  async startSharedQuiz(): Promise<void> {
    const continueAsGuest = this.page.locator('button:has-text("Продолжить как гость")');
    const guestPromptVisible = await continueAsGuest
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (guestPromptVisible) {
      await continueAsGuest.click();
    }

    const startVisible = await this.startButton
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (startVisible) {
      await this.startButton.click();
      await expect(this.questionContainer).toBeVisible({ timeout: 5000 });
    } else {
      await expect(this.questionContainer).toBeVisible({ timeout: 5000 });
    }
  }

  async answerQuestion(answerIndex: number): Promise<void> {
    const options = await this.answerOptions.all();
    if (!options.length) return;
    const safeIndex = Math.min(answerIndex, options.length - 1);
    await options[safeIndex].click();
    
    const hasNext = await this.nextButton.isVisible();
    if (hasNext) {
      await this.nextButton.click();
    } else if (await this.submitButton.isVisible().catch(() => false)) {
      await this.submitButton.click();
    }
  }

  async completeQuiz(answersCount: number): Promise<void> {
    const feedbackLocator = this.page.locator('.shared-quiz-feedback');
    const maxIterations = Math.max(answersCount, 1) + 3;

    for (let i = 0; i < maxIterations; i += 1) {
      if (await this.resultsContainer.isVisible().catch(() => false)) {
        break;
      }

      const questionVisible = await this.questionContainer
        .waitFor({ state: 'visible', timeout: 10000 })
        .then(() => true)
        .catch(async () => {
          if (await this.resultsContainer.isVisible().catch(() => false)) {
            return false;
          }
          throw new Error('Не удалось дождаться отображения вопроса shared quiz');
        });

      if (!questionVisible) {
        break;
      }

      const progressBefore = await this.progressText.textContent().catch(() => null);

      await this.answerQuestion(0);

      await feedbackLocator.waitFor({ state: 'visible', timeout: 2000 }).catch(() => undefined);
      await feedbackLocator.waitFor({ state: 'hidden', timeout: 7000 }).catch(() => undefined);

      await this.page
        .waitForFunction(
          ([resultsSelector, progressSelector, previous]) => {
            if (document.querySelector(resultsSelector)) {
              return true;
            }
            const progressElement = document.querySelector(progressSelector);
            if (!progressElement) {
              return false;
            }
            const text = (progressElement.textContent || '').trim();
            if (!text) {
              return false;
            }
            return previous ? text !== previous.trim() : true;
          },
          ['.quiz-results', '.shared-quiz-progress p:first-of-type', progressBefore ?? ''],
          { timeout: 7000 }
        )
        .catch(() => undefined);

      if (await this.resultsContainer.isVisible().catch(() => false)) {
        break;
      }
    }
  }

  async completeSharedQuiz(answersCount: number): Promise<void> {
    await this.completeQuiz(answersCount);
    await expect(this.resultsContainer).toBeVisible({ timeout: 25000 });
  }

  async getQuestionsTotal(): Promise<number | null> {
    const progressText = await this.progressText.textContent().catch(() => null);
    if (!progressText) {
      return null;
    }
    const match = progressText.match(/из\s*(\d+)/i);
    if (!match) {
      return null;
    }
    const parsed = parseInt(match[1], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  async expectLeaderboard(): Promise<void> {
    await expect(this.leaderboard).toBeVisible({ timeout: 5000 });
  }

  async expectUserInLeaderboard(username: string): Promise<void> {
    const entry = this.page.locator(`[data-testid="leaderboard-entry"]:has-text("${username}")`);
    await expect(entry).toBeVisible();
  }

  async expectGuestResults(): Promise<void> {
    await expect(this.resultsContainer).toBeVisible({ timeout: 10000 });
  }

  async getLeaderboardEntries(): Promise<number> {
    return await this.leaderboardEntries.count();
  }
}






