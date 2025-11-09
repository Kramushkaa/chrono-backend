import { Page, Locator, expect } from '@playwright/test';
import { TestPerson, TestAchievement, TestPeriod } from '../types';

/**
 * Page Object для страницы управления (Manage)
 */
export class ManagePage {
  readonly page: Page;
  readonly personsTab: Locator;
  readonly achievementsTab: Locator;
  readonly periodsTab: Locator;
  readonly createButton: Locator;
  readonly itemsList: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    
    this.personsTab = page.locator('button:has-text("Личности"), [role="tab"]:has-text("Persons")');
    this.achievementsTab = page.locator('button:has-text("Достижения"), [role="tab"]:has-text("Achievements")');
    this.periodsTab = page.locator('button:has-text("Периоды"), [role="tab"]:has-text("Periods")');
    this.createButton = page.locator('button:has-text("Создать"), button:has-text("Create")');
    this.itemsList = page.locator('[data-testid="items-list"], .items-list');
    this.searchInput = page.locator('input[type="search"], input[placeholder*="Поиск"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/lists');
    await this.page.waitForLoadState('networkidle');
  }

  async switchTab(tab: 'persons' | 'achievements' | 'periods'): Promise<void> {
    const tabButton = tab === 'persons' ? this.personsTab : 
                      tab === 'achievements' ? this.achievementsTab : 
                      this.periodsTab;
    await tabButton.click();
    await this.page.waitForTimeout(500);
  }

  async createPerson(data: TestPerson): Promise<void> {
    await this.switchTab('persons');
    await this.createButton.click();
    
    await this.page.locator('input[name="name"]').fill(data.name);
    await this.page.locator('input[name="birth_year"]').fill(data.birth_year.toString());
    if (data.death_year) {
      await this.page.locator('input[name="death_year"]').fill(data.death_year.toString());
    }
    if (data.bio) {
      await this.page.locator('textarea[name="bio"]').fill(data.bio);
    }
    
    await this.page.locator('button:has-text("Сохранить"), button:has-text("Save")').click();
  }

  async createAchievement(data: TestAchievement): Promise<void> {
    await this.switchTab('achievements');
    await this.createButton.click();
    
    await this.page.locator('input[name="title"]').fill(data.title);
    await this.page.locator('input[name="year"]').fill(data.year.toString());
    if (data.description) {
      await this.page.locator('textarea[name="description"]').fill(data.description);
    }
    
    await this.page.locator('button:has-text("Сохранить"), button:has-text("Save")').click();
  }

  async createPeriod(data: TestPeriod): Promise<void> {
    await this.switchTab('periods');
    await this.createButton.click();
    
    await this.page.locator('input[name="title"]').fill(data.title);
    await this.page.locator('input[name="start_year"]').fill(data.start_year.toString());
    if (data.end_year) {
      await this.page.locator('input[name="end_year"]').fill(data.end_year.toString());
    }
    
    await this.page.locator('button:has-text("Сохранить"), button:has-text("Save")').click();
  }

  async editPerson(id: string, updates: Partial<TestPerson>): Promise<void> {
    const itemCard = this.page.locator(`[data-item-id="${id}"]`);
    await itemCard.locator('button:has-text("Редактировать"), button[aria-label*="edit"]').click();
    
    if (updates.name) {
      await this.page.locator('input[name="name"]').fill(updates.name);
    }
    
    await this.page.locator('button:has-text("Сохранить"), button:has-text("Save")').click();
  }

  async deletePerson(id: string): Promise<void> {
    const itemCard = this.page.locator(`[data-item-id="${id}"]`);
    await itemCard.locator('button:has-text("Удалить"), button[aria-label*="delete"]').click();
    
    await this.page.locator('button:has-text("Подтвердить"), button:has-text("Confirm")').click();
  }

  async expectPersonInList(name: string): Promise<void> {
    const item = this.itemsList.locator(`text=${name}`);
    await expect(item).toBeVisible();
  }

  async expectModerationStatus(itemName: string, status: string): Promise<void> {
    const item = this.page.locator(`[data-testid="item"]:has-text("${itemName}")`);
    const statusBadge = item.locator(`[data-status="${status}"], text=${status}`);
    await expect(statusBadge).toBeVisible();
  }
}


