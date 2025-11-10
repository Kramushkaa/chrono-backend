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
  readonly addButton: Locator;
  readonly itemsList: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    
    this.personsTab = page.locator('button:has-text("Личности"), [role="tab"]:has-text("Persons")');
    this.achievementsTab = page.locator('button:has-text("Достижения"), [role="tab"]:has-text("Achievements")');
    this.periodsTab = page.locator('button:has-text("Периоды"), [role="tab"]:has-text("Periods")');
    this.addButton = page.getByRole('button', { name: /Добавить/i });
    this.itemsList = page.locator('[data-testid="items-list"], .items-list');
    this.searchInput = page.locator('input[type="search"], input[placeholder*="Поиск"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/manage');
    await this.page.waitForLoadState('networkidle');
  }

  private async openCreateModal(): Promise<Locator> {
    await this.addButton.click();
    const modal = this.page.locator('[role="dialog"]').last();
    await expect(modal).toBeVisible();
    return modal;
  }

  private async selectFirstOption(dropdownButton: Locator, searchQuery?: string): Promise<void> {
    await dropdownButton.click();
    const listbox = this.page.locator('[role="listbox"]').last();
    await listbox.waitFor({ state: 'visible', timeout: 10000 });

    const searchInput = listbox.locator('input');
    if (await searchInput.count()) {
      await searchInput.fill('');
      if (searchQuery) {
        await searchInput.type(searchQuery);
        await this.page.waitForTimeout(300);
      }
    }

    const firstOption = listbox.locator('[role="option"]').first();
    try {
      await firstOption.waitFor({ state: 'visible', timeout: 10000 });
      await firstOption.click();
    } catch {
      await dropdownButton.evaluate((button: HTMLElement) => {
        const fiberKey = Object.keys(button).find((key) => key.startsWith('__reactFiber$')) as string | undefined;
        if (!fiberKey) return;
        let fiber: any = (button as any)[fiberKey];
        while (fiber) {
          const props = fiber?.memoizedProps;
          if (props && typeof props.onChange === 'function' && Array.isArray(props.options) && props.options.length > 0) {
            props.onChange(props.options[0].value);
            return;
          }
          fiber = fiber.return;
        }
      });
    }
  }

  async expectToast(message: RegExp): Promise<void> {
    const toast = this.page.locator('.toast-message').filter({ hasText: message });
    await expect(toast).toBeVisible({ timeout: 5000 });
    await toast.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
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
    await this.page.waitForTimeout(500);
    const modal = await this.openCreateModal();

    const birthYear = data.birth_year;
    const deathYear = data.death_year ?? birthYear + 10;

    await modal.locator('input[name="name"]').fill(data.name);
    await modal.locator('input[name="birthYear"]').fill(birthYear.toString());
    await modal.locator('input[name="deathYear"]').fill(deathYear.toString());

    const categoryButton = modal.getByRole('button', { name: /род деятельности/i });
    if (await categoryButton.count()) {
      await this.selectFirstOption(categoryButton);
    } else {
      const categoryInput = modal.locator('input[name="category"]');
      await categoryInput.fill(data.category || 'Учёный');
    }

    if (data.bio) {
      await modal.locator('textarea[name="description"]').fill(data.bio);
    }

    await modal.getByRole('button', { name: /Сохранить как черновик/i }).click();
    await expect(modal).toBeHidden({ timeout: 10000 });
  }

  async createAchievement(data: TestAchievement): Promise<void> {
    await this.switchTab('achievements');
    await this.page.waitForTimeout(500);
    const modal = await this.openCreateModal();

    const personSelect = modal.getByRole('button', { name: /Выбрать личность/i });
    if (await personSelect.count()) {
      const enabled = await personSelect.isEnabled().catch(() => false);
      if (enabled) {
        await this.selectFirstOption(personSelect, 'a');
      }
    }

    await modal.locator('input[name="year"]').fill(data.year.toString());
    await modal.locator('textarea[name="description"]').fill(data.description || data.title);

    await modal.getByRole('button', { name: /Сохранить как черновик/i }).click();
    const toast = this.page.locator('.toast-message').first();
    await expect(toast).toBeVisible({ timeout: 10000 });
    const toastText = (await toast.innerText()).trim();
    if (!/Черновик достижения сохранен/i.test(toastText)) {
      throw new Error(`Сохранение достижения завершилось сообщением: "${toastText}"`);
    }
    await toast.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await expect(modal).toBeHidden({ timeout: 10000 });
  }

  async createPeriod(data: TestPeriod): Promise<void> {
    await this.switchTab('periods');
    await this.page.waitForTimeout(500);
    const modal = await this.openCreateModal();

    const startYear = data.start_year;
    const endYear = data.end_year ?? startYear + 5;

    await modal.locator('input[name="name"]').fill(data.title);
    await modal.locator('input[name="startYear"]').fill(startYear.toString());
    await modal.locator('input[name="endYear"]').fill(endYear.toString());
    await modal.locator('textarea[name="description"]').fill(data.description || 'Тестовое описание периода');

    const personSelect = modal.getByRole('button', { name: /Выбрать личность/i });
    if (await personSelect.count()) {
      const enabled = await personSelect.isEnabled().catch(() => false);
      if (enabled) {
        await this.selectFirstOption(personSelect, 'a');
      }
    }

    await modal.getByRole('button', { name: /Сохранить как черновик/i }).click();
    const toast = this.page.locator('.toast-message').first();
    await expect(toast).toBeVisible({ timeout: 10000 });
    const toastText = (await toast.innerText()).trim();
    if (!/Черновик периода сохранен/i.test(toastText)) {
      throw new Error(`Сохранение периода завершилось сообщением: "${toastText}"`);
    }
    await toast.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await expect(modal).toBeHidden({ timeout: 10000 });
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

  async expectPersonCreated(): Promise<void> {
    await this.expectToast(/Черновик личности сохранен/i);
  }

  async expectModerationStatus(itemName: string, status: string): Promise<void> {
    const item = this.page.locator(`[data-testid="item"]:has-text("${itemName}")`);
    const statusBadge = item.locator(`[data-status="${status}"], text=${status}`);
    await expect(statusBadge).toBeVisible();
  }
}


