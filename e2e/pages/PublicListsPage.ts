import { Page, Locator, expect } from '@playwright/test';

export class PublicListsPage {
  readonly page: Page;
  readonly publicLists: Locator;
  readonly copyButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.publicLists = page.locator('[data-testid="public-list"], .public-list');
    this.copyButton = page.locator('button:has-text("Копировать"), button:has-text("Copy")');
  }

  async goto(): Promise<void> {
    await this.page.goto('/lists/public');
  }

  async expectPublicList(slug: string): Promise<void> {
    await this.page.goto(`/lists/public/${slug}`);
    await expect(this.page.locator('h1, h2')).toBeVisible();
  }

  async copyList(slug: string): Promise<void> {
    await this.expectPublicList(slug);
    await this.copyButton.click();
    await this.page.waitForTimeout(500);
  }
}

