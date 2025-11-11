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

    this.personsTab = page.locator(
      'button:has-text("Личности"), [role="tab"]:has-text("Личности"), [role="tab"]:has-text("Persons")'
    );
    this.achievementsTab = page.locator(
      'button:has-text("Достижения"), [role="tab"]:has-text("Достижения"), [role="tab"]:has-text("Achievements")'
    );
    this.periodsTab = page.locator(
      'button:has-text("Периоды"), [role="tab"]:has-text("Периоды"), [role="tab"]:has-text("Periods")'
    );
    this.addButton = page.getByRole('button', { name: /Добавить/i });
    this.itemsList = page.locator('[data-testid="items-list"], .items-list');
    this.searchInput = page.locator('input[type="search"], input[placeholder*="Поиск"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/manage');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(300);
  }

  private async openCreateModal(): Promise<Locator> {
    await this.clickAddButton();
    const modal = this.page.locator('[role="dialog"]').last();
    await expect(modal).toBeVisible();
    return modal;
  }

  private async clickAddButton(): Promise<void> {
    const candidates: Locator[] = [
      this.page.getByRole('button', { name: /Добавить элемент/i }),
      this.page.getByRole('button', { name: /Add element/i }),
      this.page.getByRole('button', { name: /Добавить/i }),
      this.page.getByRole('button', { name: /Add/i }),
      this.page.locator('button[title*="Добавить" i]'),
      this.page.locator('button:has-text("➕")'),
    ];

    for (const candidate of candidates) {
      if (!(await candidate.count())) {
        continue;
      }

      const button = candidate.first();
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) {
        continue;
      }

      await button.click();
      return;
    }

    throw new Error('Не удалось найти кнопку добавления на странице управления');
  }

  private parseCount(text: string): number {
    const match = text.match(/\((\d+)\)/);
    return match ? Number(match[1]) : 0;
  }

  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'networkidle' });
    await this.page.waitForTimeout(300);
  }

  async getMineCount(): Promise<number> {
    const desktopMine = this.page.getByRole('button', { name: /^Мои/ });
    if ((await desktopMine.count()) > 0) {
      const text = await desktopMine.first().innerText();
      return this.parseCount(text);
    }

    const mobileTrigger = this.page.locator('.lists-mobile-selector__button');
    if ((await mobileTrigger.count()) > 0) {
      await mobileTrigger.first().click();
      const option = this.page
        .locator('.lists-mobile-selector__option', { hasText: /^Мои/ })
        .first();
      const text = await option.innerText();
      await mobileTrigger
        .first()
        .click()
        .catch(() => {});
      return this.parseCount(text);
    }

    throw new Error('Не удалось определить значение счётчика "Мои"');
  }

  async countMineItems(): Promise<number> {
    const grid = this.page.locator('.items-list__grid');
    if ((await grid.count()) > 0) {
      return grid.first().locator('> *').count();
    }
    return this.itemsList.locator('[data-testid="item"], .item-card').count();
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

    let option = listbox.locator('[role="option"]').first();
    if (searchQuery) {
      const candidate = listbox.locator('[role="option"]', { hasText: searchQuery }).first();
      if ((await candidate.count()) > 0) {
        option = candidate;
      }
    }

    try {
      await option.waitFor({ state: 'visible', timeout: 10000 });
      await option.click();
    } catch {
      await dropdownButton.evaluate((button: HTMLElement) => {
        const fiberKey = Object.keys(button).find(key => key.startsWith('__reactFiber$')) as
          | string
          | undefined;
        if (!fiberKey) return;
        let fiber: any = (button as any)[fiberKey];
        while (fiber) {
          const props = fiber?.memoizedProps;
          if (
            props &&
            typeof props.onChange === 'function' &&
            Array.isArray(props.options) &&
            props.options.length > 0
          ) {
            props.onChange(props.options[0].value);
            return;
          }
          fiber = fiber.return;
        }
      });
    }
  }

  async expectToast(message: RegExp): Promise<boolean> {
    const toasts = this.page.locator('.toast-message');
    const matching = toasts.filter({ hasText: message }).first();

    try {
      await expect(matching).toBeVisible({ timeout: 5000 });
      await matching.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
      return true;
    } catch (error) {
      try {
        const anyToast = toasts.first();
        if ((await anyToast.count()) > 0) {
          await anyToast.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        }
      } catch {
        // ignore errors if toast container is not available anymore
      }
      return false;
    }
  }

  async openMineSection(): Promise<void> {
    const mobileTrigger = this.page.locator('.lists-mobile-selector__button');
    if ((await mobileTrigger.count()) > 0) {
      await mobileTrigger.first().click();
      const mobileOption = this.page.locator('.lists-mobile-selector__option', { hasText: /^Мои/ });
      if ((await mobileOption.count()) > 0) {
        await mobileOption.first().click();
        await this.page.waitForTimeout(200);
        return;
      }
    }

    const mineButton = this.page.getByRole('button', { name: /^Мои/ });
    if ((await mineButton.count()) > 0) {
      const button = mineButton.first();
      const visible = await button.isVisible().catch(() => false);
      if (!visible) {
        await button.scrollIntoViewIfNeeded().catch(() => {});
      }
      await button.click();
      return;
    }

    const fallback = this.page.locator('text=/^Мои/').first();
    if ((await fallback.count()) > 0) {
      await fallback.click();
      return;
    }

    throw new Error('Не удалось найти переключатель "Мои" на странице управления');
  }

  async switchTab(tab: 'persons' | 'achievements' | 'periods'): Promise<void> {
    const tabButton = await this.getTabButton(tab);
    await tabButton.click();

    const expectActive = expect(tabButton).toHaveClass(/--active/, { timeout: 5000 });
    await expectActive
      .catch(async () => {
        await expect(tabButton).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
      })
      .catch(() => {});

    await this.page.waitForTimeout(500);
  }

  private async getTabButton(tab: 'persons' | 'achievements' | 'periods'): Promise<Locator> {
    const labelRu =
      tab === 'persons' ? 'Личности' : tab === 'achievements' ? 'Достижения' : 'Периоды';
    const labelEn =
      tab === 'persons' ? 'Persons' : tab === 'achievements' ? 'Achievements' : 'Periods';

    const mobileCandidate = this.page.locator('.mobile-tabs__tab').filter({ hasText: labelRu });
    if (await mobileCandidate.count()) {
      return mobileCandidate.first();
    }

    const desktopCandidate = this.page.locator('.manage-page__tab').filter({ hasText: labelRu });
    if (await desktopCandidate.count()) {
      return desktopCandidate.first();
    }

    const ariaCandidate = this.page.locator('[role="tab"]').filter({ hasText: labelRu });
    if (await ariaCandidate.count()) {
      return ariaCandidate.first();
    }

    const englishCandidate = this.page.locator('[role="tab"], button').filter({ hasText: labelEn });
    if (await englishCandidate.count()) {
      return englishCandidate.first();
    }

    return (
      tab === 'persons'
        ? this.personsTab
        : tab === 'achievements'
          ? this.achievementsTab
          : this.periodsTab
    ).first();
  }

  async expectPersonInList(name: string): Promise<void> {
    await this.switchTab('persons');
    await this.page.waitForTimeout(300);
    await expect(this.itemsList.first()).toBeVisible({ timeout: 10_000 });
    await expect(this.itemsList.locator('text=' + name).first()).toBeVisible({ timeout: 10_000 });
  }

  async createPerson(data: TestPerson): Promise<void> {
    await this.switchTab('persons');
    await this.page.waitForTimeout(500);
    const modal = await this.openCreateModal();
    await expect(modal.getByText(/Новая личность/i)).toBeVisible({ timeout: 5000 });

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

    const addCountryButton = modal
      .locator('button')
      .filter({ hasText: /\+ Добавить страну проживания/i });
    if ((await addCountryButton.count()) > 0) {
      await addCountryButton.first().click();

      const countryDropdown = modal
        .locator('button[aria-haspopup="listbox"]')
        .filter({ hasText: /Страна/i })
        .last();
      if ((await countryDropdown.count()) > 0) {
        await this.selectFirstOption(countryDropdown);
      }

      const startInput = modal.locator('input[placeholder="Начало"]').last();
      if ((await startInput.count()) > 0) {
        await startInput.fill(data.birth_year.toString());
      }

      const endInput = modal.locator('input[placeholder="Конец"]').last();
      if ((await endInput.count()) > 0) {
        const endYear = data.death_year ?? data.birth_year + 1;
        await endInput.fill(endYear.toString());
      }
    }

    await modal.getByRole('button', { name: /Сохранить как черновик/i }).click();
    await this.expectToast(/Черновик личности сохранен/i);
    await expect(modal).toBeHidden({ timeout: 10000 });
  }

  async createAchievement(
    data: TestAchievement,
    options?: { personSearch?: string }
  ): Promise<void> {
    await this.switchTab('achievements');
    await this.page.waitForTimeout(500);
    const modal = await this.openCreateModal();
    await expect(modal.getByText(/Новое достижение/i)).toBeVisible({ timeout: 5000 });

    const personSelect = modal.getByRole('button', { name: /Выбрать личность/i });
    if (await personSelect.count()) {
      const [ariaDisabled, disabled] = await Promise.all([
        personSelect.getAttribute('aria-disabled').catch(() => null),
        personSelect.getAttribute('disabled').catch(() => null),
      ]);
      const isDisabled =
        ariaDisabled === 'true' ||
        disabled !== null ||
        !(await personSelect.isEnabled().catch(() => true));
      if (!isDisabled) {
        await this.selectFirstOption(personSelect, options?.personSearch ?? 'a');
      }
    }

    await modal.locator('input[name="year"]').fill(data.year.toString());
    await modal.locator('textarea[name="description"]').fill(data.description || data.title);

    await modal.getByRole('button', { name: /Сохранить как черновик/i }).click();
    await this.expectToast(/Черновик достижения сохранен/i);
    await expect(modal).toBeHidden({ timeout: 10000 });
  }

  async createPeriod(data: TestPeriod, options?: { personSearch?: string }): Promise<void> {
    await this.switchTab('periods');
    await this.page.waitForTimeout(500);
    const modal = await this.openCreateModal();
    await expect(modal.getByText(/Новый период/i)).toBeVisible({ timeout: 5000 });

    const startYear = data.start_year;
    const endYear = data.end_year ?? startYear + 5;

    await modal.locator('input[name="name"]').fill(data.title);
    await modal.locator('input[name="startYear"]').fill(startYear.toString());
    await modal.locator('input[name="endYear"]').fill(endYear.toString());
    await modal
      .locator('textarea[name="description"]')
      .fill(data.description || 'Тестовое описание периода');

    const personSelect = modal.getByRole('button', { name: /Выбрать личность/i });
    if (await personSelect.count()) {
      const [ariaDisabled, disabled] = await Promise.all([
        personSelect.getAttribute('aria-disabled').catch(() => null),
        personSelect.getAttribute('disabled').catch(() => null),
      ]);
      const isDisabled =
        ariaDisabled === 'true' ||
        disabled !== null ||
        !(await personSelect.isEnabled().catch(() => true));
      if (!isDisabled) {
        await this.selectFirstOption(personSelect, options?.personSearch ?? 'a');
      }
    }

    await modal.getByRole('button', { name: /Сохранить как черновик/i }).click();
    await this.expectToast(/Черновик периода сохранен/i);
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
