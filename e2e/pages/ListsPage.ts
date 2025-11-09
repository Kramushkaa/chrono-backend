import { Page, Locator, expect } from '@playwright/test';

export class ListsPage {
  readonly page: Page;
  readonly createListButton: Locator;
  readonly listNameInput: Locator;
  readonly saveListButton: Locator;
  readonly lists: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createListButton = page.locator('button:has-text("Создать список"), button:has-text("Create list")');
    this.listNameInput = page.locator('input[name="title"], input[placeholder*="название"]');
    this.saveListButton = page.locator('button:has-text("Сохранить"), button:has-text("Save")');
    this.lists = page.locator('[data-testid="list-item"], .list-item');
  }

  async goto(): Promise<void> {
    await this.page.goto('/lists');
  }

  async createList(title: string): Promise<void> {
    await this.createListButton.click();
    await this.listNameInput.fill(title);
    await this.saveListButton.click();
    await this.page.waitForTimeout(500);
  }

  async addItemToList(listId: number, itemType: string, itemId: string | number): Promise<void> {
    const list = this.page.locator(`[data-list-id="${listId}"]`);
    await list.locator('button:has-text("Добавить"), button[aria-label*="add"]').click();
    // Логика добавления элемента зависит от UI
  }

  async shareList(listId: number): Promise<string> {
    const list = this.page.locator(`[data-list-id="${listId}"]`);
    await list.locator('button:has-text("Поделиться"), button:has-text("Share")').click();
    
    const shareCode = await this.page.locator('[data-testid="share-code"]').textContent();
    return shareCode || '';
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

