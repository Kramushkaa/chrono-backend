import { Page, Locator, expect } from '@playwright/test';

export class ModerationPage {
  readonly page: Page;
  readonly moderationQueue: Locator;
  readonly pendingItems: Locator;
  readonly approveButton: Locator;
  readonly rejectButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.moderationQueue = page.locator('[data-testid="moderation-queue"], .moderation-queue');
    this.pendingItems = page.locator('[data-status="pending"]');
    this.approveButton = page.locator('button:has-text("Одобрить"), button:has-text("Approve")');
    this.rejectButton = page.locator('button:has-text("Отклонить"), button:has-text("Reject")');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/moderation');
  }

  async expectModerationQueue(status: string, minCount: number): Promise<void> {
    const items = this.page.locator(`[data-status="${status}"]`);
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  async approvePerson(id: string): Promise<void> {
    const item = this.page.locator(`[data-item-id="${id}"]`);
    await item.locator(this.approveButton).click();
  }

  async rejectPerson(id: string, reason?: string): Promise<void> {
    const item = this.page.locator(`[data-item-id="${id}"]`);
    await item.locator(this.rejectButton).click();
    
    if (reason) {
      await this.page.locator('textarea[name="reason"]').fill(reason);
      await this.page.locator('button:has-text("Отправить")').click();
    }
  }

  async approveList(id: number, slug: string): Promise<void> {
    const item = this.page.locator(`[data-list-id="${id}"]`);
    await item.locator(this.approveButton).click();
    await this.page.locator('input[name="slug"]').fill(slug);
    await this.page.locator('button:has-text("Подтвердить")').click();
  }

  async rejectList(id: number, reason: string): Promise<void> {
    const item = this.page.locator(`[data-list-id="${id}"]`);
    await item.locator(this.rejectButton).click();
    await this.page.locator('textarea[name="reason"]').fill(reason);
    await this.page.locator('button:has-text("Отправить")').click();
  }
}

