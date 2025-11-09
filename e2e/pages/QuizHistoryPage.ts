import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object для страницы истории квизов
 */
export class QuizHistoryPage {
  readonly page: Page;
  readonly historyList: Locator;
  readonly historyEntries: Locator;
  readonly filterButtons: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    
    this.historyList = page.locator('[data-testid="history-list"], .history-list');
    this.historyEntries = page.locator('[data-testid="history-entry"], .history-entry');
    this.filterButtons = page.locator('[data-testid="filter-button"], .filter-button');
    this.emptyState = page.locator('text=/нет истории|no history|пусто|empty/i');
  }

  async goto(): Promise<void> {
    await this.page.goto('/quiz/history');
    await this.page.waitForLoadState('networkidle');
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
    const count = await this.historyEntries.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }

  async filterByType(type: 'regular' | 'shared'): Promise<void> {
    const filterButton = this.page.locator(`button:has-text("${type}")`);
    await filterButton.click();
    await this.page.waitForTimeout(500);
  }

  async getHistoryCount(): Promise<number> {
    return await this.historyEntries.count();
  }
}

