import { Page, Locator, expect } from '@playwright/test';

export class QuizAttemptDetailPage {
  readonly page: Page;
  readonly title: Locator;
  readonly resultsSummary: Locator;
  readonly answerItems: Locator;
  readonly shareButton: Locator;
  readonly shareModal: Locator;
  readonly shareLinkInput: Locator;
  readonly shareCloseButton: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('.quiz-title');
    this.resultsSummary = page.locator('.quiz-results-summary');
    this.answerItems = page.locator('.quiz-answer-item');
    this.shareButton = page.locator('.quiz-history-share-button');
    this.shareModal = page.locator('.quiz-modal');
    this.shareLinkInput = page.locator('.quiz-share-url input');
    this.shareCloseButton = page
      .locator('.quiz-modal-actions button')
      .filter({ hasText: /закрыть/i });
    this.backButton = page.locator('button', { hasText: /вернуться к истории/i });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.resultsSummary).toBeVisible({ timeout: 10_000 });
  }

  async expectResultsSummary(params: { correct?: number; total?: number; rating?: number }): Promise<void> {
    await this.expectLoaded();
    if (params.correct !== undefined && params.total !== undefined) {
      await expect(this.resultsSummary).toContainText(
        `${params.correct} / ${params.total}`,
        { timeout: 5_000 }
      );
    }
    if (params.rating !== undefined) {
      await expect(this.resultsSummary).toContainText(`${params.rating}`);
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

  async expectShareButtonVisible(): Promise<void> {
    await expect(this.shareButton).toBeVisible({ timeout: 5_000 });
  }

  async openShareModal(): Promise<void> {
    await this.expectShareButtonVisible();
    await this.shareButton.click();
    await expect(this.shareModal).toBeVisible({ timeout: 5_000 });
  }

  async getShareLink(): Promise<string | null> {
    if (!(await this.shareModal.isVisible())) {
      return null;
    }
    return this.shareLinkInput.inputValue().catch(() => null);
  }

  async closeShareModal(): Promise<void> {
    if (await this.shareCloseButton.isVisible().catch(() => false)) {
      await this.shareCloseButton.click();
    } else {
      const overlay = this.page.locator('.quiz-modal-overlay');
      if (await overlay.isVisible().catch(() => false)) {
        await overlay.click();
      }
    }
    await expect(this.shareModal).toBeHidden({ timeout: 5_000 });
  }

  async goBackToHistory(): Promise<void> {
    await expect(this.backButton).toBeVisible({ timeout: 5_000 });
    await this.backButton.click();
  }
}


