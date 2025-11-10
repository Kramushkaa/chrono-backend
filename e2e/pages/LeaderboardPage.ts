import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object для страницы таблицы лидеров
 */
export class LeaderboardPage {
  readonly page: Page;
  readonly container: Locator;
  readonly leaderboardEntries: Locator;
  readonly listEntries: Locator;
  readonly currentUserEntry: Locator;
  readonly emptyState: Locator;
  readonly totalPlayersLabel: Locator;
  readonly paginationPrev: Locator;
  readonly paginationNext: Locator;
  readonly pageIndicator: Locator;
  readonly divider: Locator;
  readonly userLabel: Locator;

  constructor(page: Page) {
    this.page = page;

    this.container = page.locator('.leaderboard-container');
    this.leaderboardEntries = page.locator('.leaderboard-entry');
    this.listEntries = page.locator('.leaderboard-list .leaderboard-entry');
    this.currentUserEntry = page.locator('.leaderboard-entry-current');
    this.emptyState = page.locator('.leaderboard-empty');
    this.totalPlayersLabel = page.locator('.leaderboard-subtitle');
    this.paginationPrev = page.locator('[data-testid="leaderboard-pagination-prev"]');
    this.paginationNext = page.locator('[data-testid="leaderboard-pagination-next"]');
    this.pageIndicator = page.locator('[data-testid="leaderboard-page-indicator"]');
    this.divider = page.locator('.leaderboard-entry-divider');
    this.userLabel = page.locator('.leaderboard-entry-label');
  }

  async goto(): Promise<void> {
    await this.page.goto('/quiz/leaderboard');
    await this.container.first().waitFor({ state: 'visible' });
  }

  async getDisplayedUsernames(): Promise<string[]> {
    return await this.listEntries.evaluateAll((elements) =>
      elements.map((element) => {
        const usernameContainer = element.querySelector('.leaderboard-username');
        if (!usernameContainer) {
          return '';
        }
        const parts: string[] = [];
        usernameContainer.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim() ?? '';
            if (text) {
              parts.push(text);
            }
          }
        });
        return parts.join(' ').trim();
      })
    );
  }

  async getEntryCount(): Promise<number> {
    return this.listEntries.count();
  }

  async getRanks(): Promise<number[]> {
    const texts = await this.listEntries.locator('.leaderboard-rank').allTextContents();
    return texts
      .map((text) => text.trim())
      .map((value) => parseInt(value, 10))
      .filter((num) => !Number.isNaN(num));
  }

  async getTotalPlayers(): Promise<number | null> {
    const text = await this.totalPlayersLabel.textContent();
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }

  async expectUserPresent(username: string): Promise<void> {
    const entry = this.leaderboardEntries.filter({ hasText: username }).first();
    await expect(entry).toBeVisible();
  }

  async expectSortedByRating(): Promise<void> {
    const ratings = await this.listEntries
      .locator('.leaderboard-rating')
      .allTextContents();

    const numbers = ratings
      .map((text) => text.match(/\d+/)?.[0])
      .filter(Boolean)
      .map((value) => parseInt(value!, 10));

    for (let i = 0; i < numbers.length - 1; i++) {
      expect(numbers[i]).toBeGreaterThanOrEqual(numbers[i + 1]);
    }
  }

  async expectCurrentUserHighlighted(): Promise<void> {
    if (await this.currentUserEntry.count()) {
      await expect(this.currentUserEntry.first()).toBeVisible();
      return;
    }
    throw new Error('Current user entry not found in leaderboard');
  }

  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }

  async expectUserEntryRank(rank: number): Promise<void> {
    await expect(this.currentUserEntry).toBeVisible();
    const rankText = await this.currentUserEntry.locator('.leaderboard-rank').first().textContent();
    expect(rankText?.trim()).toBe(String(rank));
  }

  async expectUserLabel(text: string = 'Ваше место'): Promise<void> {
    await expect(this.userLabel.first()).toHaveText(text);
  }

  async goToNextPage(expectedOffset?: number): Promise<void> {
    const offsetParam = expectedOffset !== undefined ? `offset=${expectedOffset}` : undefined;
    const waitForResponse = this.page.waitForResponse((response) => {
      if (!response.url().includes('/api/quiz/leaderboard')) {
        return false;
      }
      if (offsetParam && !response.url().includes(offsetParam)) {
        return false;
      }
      return response.request().method() === 'GET';
    });
    await Promise.all([waitForResponse, this.paginationNext.click()]);
  }

  async goToPrevPage(expectedOffset?: number): Promise<void> {
    const offsetParam = expectedOffset !== undefined ? `offset=${expectedOffset}` : undefined;
    const waitForResponse = this.page.waitForResponse((response) => {
      if (!response.url().includes('/api/quiz/leaderboard')) {
        return false;
      }
      if (offsetParam && !response.url().includes(offsetParam)) {
        return false;
      }
      return response.request().method() === 'GET';
    });
    await Promise.all([waitForResponse, this.paginationPrev.click()]);
  }

  async expectPageIndicator(pageNumber: number): Promise<void> {
    await expect(this.pageIndicator).toContainText(`Страница ${pageNumber}`);
  }

  async waitForEntries(): Promise<void> {
    await this.listEntries.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  }
}


