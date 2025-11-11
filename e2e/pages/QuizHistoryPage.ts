import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object для страницы истории квизов
 */
export class QuizHistoryPage {
  readonly page: Page;
  readonly historyList: Locator;
  readonly historyEntries: Locator;
  readonly emptyState: Locator;
  readonly loadingState: Locator;

  constructor(page: Page) {
    this.page = page;
    
    this.historyList = page.locator('.quiz-history-list');
    this.historyEntries = page.locator('.quiz-history-item');
    this.emptyState = page.locator('.quiz-empty');
    this.loadingState = page.locator('.quiz-loading');
  }

  async goto(): Promise<void> {
    await this.page.goto('/quiz/history');
    await this.waitForLoaded();
  }

  async waitForLoaded(): Promise<void> {
    const loading = this.loadingState.first();
    if (await loading.isVisible().catch(() => false)) {
      await loading.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    }
    await this.page.waitForTimeout(200);
  }

  async expectAttemptInHistory(attemptData: { score?: number; date?: string }): Promise<void> {
    await expect(this.historyList).toBeVisible();
    
    if (attemptData.score !== undefined) {
      const entry = this.page.locator(`text=${attemptData.score}`);
      await expect(entry).toBeVisible();
    }
  }

  async openAttemptDetails(index: number = 0): Promise<void> {
    const entries = await this.historyEntries.all();
    await entries[index].click();
    
    // Ждём загрузки детальной страницы
    await this.page.waitForURL('**/quiz/history/**');
  }

  async expectAttemptDetails(details: { correctAnswers?: number; totalQuestions?: number }): Promise<void> {
    if (details.correctAnswers !== undefined) {
      const correctText = this.page.locator(`text=/правильных|correct/i`);
      await expect(correctText).toBeVisible();
    }
    
    if (details.totalQuestions !== undefined) {
      const totalText = this.page.locator(`text=/всего|total/i`);
      await expect(totalText).toBeVisible();
    }
  }

  async expectMinimumEntries(minCount: number): Promise<void> {
    await expect
      .poll(async () => await this.historyEntries.count(), {
        timeout: 10_000,
        message: `Ожидалось минимум ${minCount} записей в истории`,
      })
      .toBeGreaterThanOrEqual(minCount);
  }

  async getHistoryCount(): Promise<number> {
    return this.historyEntries.count();
  }

  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }
}


