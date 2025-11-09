import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object для страницы shared quiz
 */
export class SharedQuizPage {
  readonly page: Page;
  readonly startButton: Locator;
  readonly questionText: Locator;
  readonly answerOptions: Locator;
  readonly nextButton: Locator;
  readonly submitButton: Locator;
  readonly scoreDisplay: Locator;
  readonly leaderboard: Locator;
  readonly leaderboardEntries: Locator;

  constructor(page: Page) {
    this.page = page;
    
    this.startButton = page.locator('button:has-text("Начать"), button:has-text("Start")');
    this.questionText = page.locator('[data-testid="question-text"], .question-text');
    this.answerOptions = page.locator('[data-testid="answer-option"], .answer-option');
    this.nextButton = page.locator('button:has-text("Далее"), button:has-text("Next")');
    this.submitButton = page.locator('button:has-text("Завершить"), button:has-text("Submit")');
    this.scoreDisplay = page.locator('[data-testid="score"], .score');
    this.leaderboard = page.locator('[data-testid="leaderboard"], .leaderboard');
    this.leaderboardEntries = page.locator('[data-testid="leaderboard-entry"], .leaderboard-entry');
  }

  async goto(shareCode: string): Promise<void> {
    await this.page.goto(`/quiz/${shareCode}`);
  }

  async startSharedQuiz(): Promise<void> {
    await this.startButton.click();
    await expect(this.questionText).toBeVisible({ timeout: 5000 });
  }

  async answerQuestion(answerIndex: number): Promise<void> {
    const options = await this.answerOptions.all();
    await options[answerIndex].click();
    
    const hasNext = await this.nextButton.isVisible();
    if (hasNext) {
      await this.nextButton.click();
    } else {
      await this.submitButton.click();
    }
  }

  async completeQuiz(answersCount: number): Promise<void> {
    for (let i = 0; i < answersCount; i++) {
      await expect(this.questionText).toBeVisible();
      await this.answerQuestion(0);
      await this.page.waitForTimeout(300);
    }
  }

  async expectLeaderboard(): Promise<void> {
    await expect(this.leaderboard).toBeVisible({ timeout: 5000 });
  }

  async expectUserInLeaderboard(username: string): Promise<void> {
    const entry = this.page.locator(`[data-testid="leaderboard-entry"]:has-text("${username}")`);
    await expect(entry).toBeVisible();
  }

  async getLeaderboardEntries(): Promise<number> {
    return await this.leaderboardEntries.count();
  }
}

