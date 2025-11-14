import { Page, Locator, expect } from '@playwright/test';

export class ListsPage {
  readonly page: Page;
  readonly createListButton: Locator;
  readonly listNameInput: Locator;
  readonly saveListButton: Locator;
  readonly desktopListsRegion: Locator;
  readonly mobileListSelectorButton: Locator;
  readonly mobileDropdown: Locator;
  readonly toastMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createListButton = page.getByRole('button', { name: /создать список/i });
    this.listNameInput = page.getByPlaceholder(/название списка/i);
    this.saveListButton = page.getByRole('button', { name: /создать|сохранить/i });
    this.desktopListsRegion = page.getByRole('region', { name: /меню списков/i });
    this.mobileListSelectorButton = page.locator('.lists-mobile-selector__button');
    this.mobileDropdown = page.locator('.lists-mobile-selector__dropdown');
    this.toastMessage = page.locator('.toast-message');
  }

  private async isMobileLayout(): Promise<boolean> {
    return (await this.mobileListSelectorButton.count()) > 0;
  }

  private getDesktopListLocator(title: string): Locator {
    return this.desktopListsRegion.locator('[role="button"]').filter({ hasText: title }).first();
  }

  private async openMobileDropdown(): Promise<void> {
    await this.mobileListSelectorButton.click();
    await this.mobileDropdown.waitFor({ state: 'visible' });
  }

  private async closeMobileDropdown(): Promise<void> {
    if ((await this.mobileDropdown.count()) === 0) {
      return;
    }
    if (await this.mobileDropdown.isVisible().catch(() => false)) {
      await this.mobileListSelectorButton.click();
      await this.mobileDropdown.waitFor({ state: 'hidden' }).catch(() => undefined);
    }
  }

  async goto(): Promise<void> {
    await this.page.goto('/lists');
    await this.page.waitForLoadState('networkidle').catch(async () => {
      await this.page.waitForLoadState('domcontentloaded');
    });
  }

  async createList(title: string): Promise<void> {
    await this.createListButton.click();
    const modal = this.page.locator('[role="dialog"]').filter({ hasText: 'Новый список' });
    await modal.waitFor({ state: 'visible' });
    await modal.getByPlaceholder(/название списка/i).fill(title);
    const postPromise = this.page.waitForResponse(response => {
      return (
        response.url().includes('/api/lists') &&
        response.request().method() === 'POST' &&
        response.status() < 400
      );
    });
    await modal.getByRole('button', { name: /создать/i }).click();
    await postPromise;
    await this.page.waitForResponse(response => {
      return (
        response.url().includes('/api/lists') &&
        response.request().method() === 'GET' &&
        response.status() < 400
      );
    });
    await this.expectListPresent(title);
  }

  async expectListPresent(title: string): Promise<void> {
    if (await this.isMobileLayout()) {
      await this.openMobileDropdown();
      const option = this.mobileDropdown
        .locator('.lists-mobile-selector__option')
        .filter({ hasText: title })
        .first();
      await expect(option).toBeVisible({ timeout: 15000 });
      await this.closeMobileDropdown();
      return;
    }

    await expect(this.getDesktopListLocator(title)).toBeVisible({ timeout: 15000 });
  }

  async selectList(title: string): Promise<void> {
    if (await this.isMobileLayout()) {
      await this.openMobileDropdown();
      const option = this.mobileDropdown
        .locator('.lists-mobile-selector__option')
        .filter({ hasText: title })
        .first();
      await expect(option).toBeVisible({ timeout: 15000 });
      await option.click();
      await this.mobileDropdown.waitFor({ state: 'hidden' }).catch(() => undefined);
      await expect(this.mobileListSelectorButton).toContainText(title, { timeout: 5000 });
      return;
    }

    const entry = this.getDesktopListLocator(title);
    await expect(entry).toBeVisible({ timeout: 15000 });
    await entry.click();
  }

  async clickShareButton(title: string, options?: { waitForResponse?: boolean }) {
    const shouldWaitForResponse = options?.waitForResponse ?? true;
    const shareResponsePromise = shouldWaitForResponse
      ? this.page.waitForResponse(response => {
          const url = response.url();
          return /\/api\/lists\/\d+\/share(?:\?.*)?$/.test(url) && response.request().method() === 'POST';
        })
      : null;

    if (await this.isMobileLayout()) {
      await this.selectList(title);
      const shareButton = this.page
        .locator('.lists-mobile-actions__action-button[title="Поделиться"]')
        .first();
      await expect(shareButton).toBeVisible({ timeout: 5000 });
      await shareButton.click();
    } else {
      const listEntry = this.getDesktopListLocator(title);
      await expect(listEntry).toBeVisible({ timeout: 15000 });
      const shareButton = listEntry.locator('button[title="Поделиться"]');
      await expect(shareButton).toBeVisible({ timeout: 5000 });
      await shareButton.click();
    }

    if (shouldWaitForResponse && shareResponsePromise) {
      return shareResponsePromise;
    }
    return null;
  }

  async expectToast(message: string | RegExp, timeout = 5000): Promise<void> {
    const toast = this.toastMessage.filter({ hasText: message });
    await expect(toast).toBeVisible({ timeout });
  }

  async addItemToList(listId: number, itemType: string, itemId: string | number): Promise<void> {
    const list = this.page.locator(`[data-list-id="${listId}"]`);
    await list.locator('button:has-text("Добавить"), button[aria-label*="add"]').click();
    // Логика добавления элемента зависит от UI
  }

  async requestPublication(listId: number, description?: string): Promise<void> {
    const list = this.page.locator(`[data-list-id="${listId}"]`);
    await list.locator('button:has-text("Опубликовать"), button:has-text("Publish")').click();
    
    if (description) {
      await this.page.locator('textarea[name="description"]').fill(description);
    }
    
    await this.page.locator('button:has-text("Отправить"), button:has-text("Submit")').click();
  }

  async expectListItems(listId: number, itemsCount: number): Promise<void> {
    const list = this.page.locator(`[data-list-id="${listId}"]`);
    const items = list.locator('.list-item-entry');
    await expect(items).toHaveCount(itemsCount);
  }
}


