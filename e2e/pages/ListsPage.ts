import { Page, Locator, expect } from '@playwright/test';

export class ListsPage {
  readonly page: Page;
  readonly createListButton: Locator;
  readonly listNameInput: Locator;
  readonly saveListButton: Locator;
  readonly lists: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createListButton = page.getByRole('button', { name: /создать список/i });
    this.listNameInput = page.getByPlaceholder(/название списка/i);
    this.saveListButton = page.getByRole('button', { name: /создать|сохранить/i });
    this.lists = page.getByRole('region', { name: /меню списков/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/lists');
  }

  async createList(title: string): Promise<{ locator: Locator }> {
    await this.createListButton.click();
    const modal = this.page.locator('[role="dialog"]').filter({ hasText: 'Новый список' });
    await modal.waitFor({ state: 'visible' });
    await modal.getByPlaceholder(/название списка/i).fill(title);
    const postPromise = this.page.waitForResponse((response) => {
      return response.url().includes('/api/lists') && response.request().method() === 'POST' && response.status() < 400;
    });
    await modal.getByRole('button', { name: /создать/i }).click();
    await postPromise;
    await this.page.waitForResponse((response) => {
      return response.url().includes('/api/lists') && response.request().method() === 'GET' && response.status() < 400;
    });
    const createdList = this.lists.locator('[role="button"]').filter({ hasText: title }).first();
    await expect(createdList).toBeVisible();

    return { locator: createdList };
  }

  async waitForList(title: string): Promise<Locator> {
    const listLocator = this.lists.locator('[role="button"]').filter({ hasText: title }).first();
    await expect(listLocator).toBeVisible({ timeout: 15000 });
    return listLocator;
  }

  async addItemToList(listId: number, itemType: string, itemId: string | number): Promise<void> {
    const list = this.page.locator(`[data-list-id="${listId}"]`);
    await list.locator('button:has-text("Добавить"), button[aria-label*="add"]').click();
    // Логика добавления элемента зависит от UI
  }

  async shareListByLocator(listLocator: Locator): Promise<string> {
    const shareButton = listLocator.locator('button[title*="Поделиться" i], button:has-text("🔗"), button[aria-label*="Поделиться" i], button[aria-label*="share" i]').first();
    const shareResponsePromise = this.page.waitForResponse((response) => {
      const url = response.url();
      return url.includes('/api/lists/') && url.endsWith('/share') && response.request().method() === 'POST';
    });
    await shareButton.click();
    await shareResponsePromise;
    const toast = this.page.locator('.toast-message').filter({ hasText: /Ссылка скопирована/i });
    await toast.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    return 'copied';
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


