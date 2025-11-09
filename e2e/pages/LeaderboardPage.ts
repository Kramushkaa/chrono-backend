import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object для страницы таблицы лидеров
 */
export class LeaderboardPage {
  readonly page: Page;
  readonly leaderboardTable: Locator;
  readonly leaderboardEntries: Locator;
  readonly currentUserEntry: Locator;
  readonly topScoreEntry: Locator;

  constructor(page: Page) {
    this.page = page;
    
    this.leaderboardTable = page.locator('[data-testid="leaderboard"], .leaderboard-table');
    this.leaderboardEntries = page.locator('[data-testid="leaderboard-entry"], .leaderboard-entry, tbody tr');
    this.currentUserEntry = page.locator('[data-testid="current-user-entry"], .current-user, .highlighted');
    this.topScoreEntry = this.leaderboardEntries.first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/quiz/leaderboard');
    await this.page.waitForLoadState('networkidle');
  }

  async expectUserInLeaderboard(username: string, position?: number): Promise<void> {
    const entry = this.page.locator(`text=${username}`).first();
    await expect(entry).toBeVisible();
    
    if (position !== undefined) {
      const positionText = await entry.locator('..').textContent();
      expect(positionText).toContain(position.toString());
    }
  }

  async expectScore(username: string, minScore: number): Promise<void> {
    const entry = this.page.locator(`[data-testid="leaderboard-entry"]:has-text("${username}")`);
    const scoreText = await entry.textContent();
    const scoreMatch = scoreText?.match(/\d+/);
    const score = scoreMatch ? parseInt(scoreMatch[0]) : 0;
    
    expect(score).toBeGreaterThanOrEqual(minScore);
  }

  async expectCurrentUserHighlighted(): Promise<void> {
    await expect(this.currentUserEntry).toBeVisible();
  }

  async getLeaderboardCount(): Promise<number> {
    return await this.leaderboardEntries.count();
  }

  async expectMinimumEntries(minCount: number): Promise<void> {
    const count = await this.getLeaderboardCount();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  async expectSortedByScore(): Promise<void> {
    const entries = await this.leaderboardEntries.all();
    const scores: number[] = [];
    
    for (const entry of entries) {
      const text = await entry.textContent();
      const match = text?.match(/\d+/);
      if (match) {
        scores.push(parseInt(match[0]));
      }
    }
    
    // Проверяем что массив отсортирован по убыванию
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }
  }
}

