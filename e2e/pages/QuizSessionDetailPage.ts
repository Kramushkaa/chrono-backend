import { Page, Locator, expect } from '@playwright/test';

export class QuizSessionDetailPage {
  readonly page: Page;
  readonly title: Locator;
  readonly resultsSummary: Locator;
  readonly answerItems: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('.quiz-title');
    this.resultsSummary = page.locator('.quiz-results-summary');
    this.answerItems = page.locator('.quiz-answer-item');
    this.backButton = page.locator('button', { hasText: /вернуться к истории/i });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.resultsSummary).toBeVisible({ timeout: 10_000 });
  }

  async expectResultsSummary(params: { correct?: number; total?: number }): Promise<void> {
    await this.expectLoaded();
    if (params.correct !== undefined && params.total !== undefined) {
      await expect(this.resultsSummary).toContainText(
        `${params.correct} / ${params.total}`,
        { timeout: 5_000 }
      );
    }
  }

  async toggleAnswer(index: number): Promise<void> {
    const item = this.answerItems.nth(index);
    await expect(item).toBeVisible({ timeout: 5_000 });
    await item.locator('.quiz-answer-header').click();
  }

  async expectAnswerExpanded(index: number): Promise<void> {
    const item = this.answerItems.nth(index);
    await expect(item).toHaveClass(/expanded/, { timeout: 5_000 });
  }

  async goBackToHistory(): Promise<void> {
    await expect(this.backButton).toBeVisible({ timeout: 5_000 });
    await this.backButton.click();
  }
}


