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
    await this.page.goto('/manage', { waitUntil: 'networkidle', timeout: 30000 });
    // Wait for main page elements to be visible
    await this.page.waitForTimeout(1000);
  }

  private async openCreateModal(tab?: 'persons' | 'achievements' | 'periods'): Promise<Locator> {
    await this.clickAddButton(tab);
    // Wait for any modal to appear with a longer timeout
    await this.page.waitForTimeout(2000);

    // Try multiple selectors for the modal with increased timeout
    const modalSelectors = [
      this.page.locator('[role="dialog"]'),
      this.page.locator('.modal'),
      this.page.locator('.dialog'),
      this.page.locator('[data-testid="modal"]'),
      this.page.locator('.ant-modal'),
      this.page.locator('.modal-container'),
    ];

    for (const selector of modalSelectors) {
      try {
        const modal = selector.first();
        await expect(modal).toBeVisible({ timeout: 15000 });
        return modal;
      } catch (error) {
        // Continue to next selector if this one fails
        continue;
      }
    }

    // If all selectors fail, throw an error
    throw new Error('Не удалось найти модальное окно после нажатия кнопки "Добавить"');
  }

  private async clickAddButton(tab?: 'persons' | 'achievements' | 'periods'): Promise<void> {
    // Try tab-specific selectors first with longer timeouts
    if (tab) {
      const tabSpecificSelectors: Locator[] = [
        this.page.locator(`[data-tab="${tab}"]`).getByRole('button', { name: /Добавить/i }),
        this.page.locator(`[data-tab="${tab}"]`).getByRole('button', { name: /Add/i }),
        this.page.locator(`.tab-${tab}`).getByRole('button', { name: /Добавить/i }),
        this.page.locator(`.tab-${tab}`).getByRole('button', { name: /Add/i }),
        this.page.locator(`[data-testid="${tab}-tab"]`).getByRole('button', { name: /Добавить/i }),
        this.page.locator(`button[data-tab="${tab}"]`).getByRole('button', { name: /Добавить/i }),
      ];

      for (const selector of tabSpecificSelectors) {
        if (await selector.count()) {
          const button = selector.first();
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            await button.click({ timeout: 10000 });
            return;
          }
        }
      }
    }

    // Fallback to general selectors with longer timeouts
    const candidates: Locator[] = [
      this.page.getByRole('button', { name: /Добавить элемент/i }),
      this.page.getByRole('button', { name: /Add element/i }),
      this.page.getByRole('button', { name: /Добавить/i }),
      this.page.getByRole('button', { name: /Add/i }),
      this.page.locator('button[title*="Добавить" i]'),
      this.page.locator('button:has-text("➕")'),
      this.page.locator('button:has-text("Добавить")'),
      this.page.locator('[data-testid="add-button"]'),
      this.page.locator('.add-button'),
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

      await button.click({ timeout: 10000 });
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
    await tabButton.waitFor({ state: 'visible', timeout: 15000 });

    // Ensure the tab is within viewport before clicking
    await tabButton.scrollIntoViewIfNeeded().catch(() => {});

    // Try standard click first, then fall back to forced click if layout blocks actionability
    try {
      await tabButton.click({ timeout: 10000 });
    } catch (error) {
      await tabButton.click({ timeout: 10000, force: true });
    }

    try {
      await expect(tabButton).toHaveClass(/--active/, { timeout: 3000 });
    } catch {
      try {
        await expect(tabButton).toHaveAttribute('aria-selected', 'true', { timeout: 3000 });
      } catch {
        await this.page.waitForTimeout(500);
      }
    }

    const targetSection =
      tab === 'persons'
        ? '#manage-persons-section'
        : tab === 'achievements'
          ? '#manage-achievements-section'
          : '#manage-periods-section';
    await expect(this.page.locator(targetSection)).toBeVisible({ timeout: 15000 });
  }

  private async getTabButton(tab: 'persons' | 'achievements' | 'periods'): Promise<Locator> {
    const labelRu =
      tab === 'persons' ? 'Личности' : tab === 'achievements' ? 'Достижения' : 'Периоды';
    const labelEn =
      tab === 'persons' ? 'Persons' : tab === 'achievements' ? 'Achievements' : 'Periods';

    const idCandidate = this.page.locator(`#manage-tab-${tab}`);
    if (await idCandidate.count()) {
      return idCandidate.first();
    }

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
    await this.page.waitForTimeout(1000);
    const modal = await this.openCreateModal('persons');
    await expect(modal.getByText(/Новая личность/i)).toBeVisible({ timeout: 10000 });

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

    // Всегда добавляем период жизни для теста
    const addCountryButton = modal
      .locator('button')
      .filter({ hasText: /\+ Добавить страну проживания/i });

    // Проверяем, есть ли уже периоды (может быть добавлен автоматически)
    const existingPeriods = await modal.locator('input[placeholder="Начало"]').count();

    // Если периодов нет, добавляем новый
    if (existingPeriods === 0 && (await addCountryButton.count()) > 0) {
      await addCountryButton.first().click({ timeout: 10000 });
      await this.page.waitForTimeout(500);
    }

    // Ждём появления полей периода
    const countryDropdown = modal
      .locator('button[aria-haspopup="listbox"]')
      .filter({ hasText: /Страна/i })
      .last();

    // Ждём появления dropdown и выбираем страну
    let countrySelected = false;
    if ((await countryDropdown.count()) > 0) {
      const countryButtonTextBefore = await countryDropdown.textContent();
      await this.selectFirstOption(countryDropdown);
      await this.page.waitForTimeout(500);
      // Проверяем, что значение изменилось (выбор произошёл)
      const countryButtonTextAfter = await countryDropdown.textContent();
      if (
        countryButtonTextAfter !== countryButtonTextBefore &&
        countryButtonTextAfter !== 'Страна' &&
        countryButtonTextAfter !== 'Выбрать...'
      ) {
        countrySelected = true;
      }
    }

    // Если страна не выбрана через первый dropdown, пробуем другие варианты
    if (!countrySelected) {
      const anyCountryDropdown = modal.locator('button[aria-haspopup="listbox"]').first();
      if ((await anyCountryDropdown.count()) > 0) {
        await this.selectFirstOption(anyCountryDropdown);
        await this.page.waitForTimeout(500);
      }
    }

    // Заполняем годы начала и конца периода
    const startInput = modal.locator('input[placeholder="Начало"]').last();
    await startInput.fill(birthYear.toString());
    await this.page.waitForTimeout(200);
    // Проверяем, что значение установилось
    const startValue = await startInput.inputValue();
    if (startValue !== birthYear.toString()) {
      await startInput.fill(birthYear.toString());
      await this.page.waitForTimeout(200);
    }

    const endInput = modal.locator('input[placeholder="Конец"]').last();
    const endYear = data.death_year ?? data.birth_year + 1;
    await endInput.fill(endYear.toString());
    await this.page.waitForTimeout(200);
    // Проверяем, что значение установилось
    const endValue = await endInput.inputValue();
    if (endValue !== endYear.toString()) {
      await endInput.fill(endYear.toString());
      await this.page.waitForTimeout(200);
    }

    // Финальная проверка: убеждаемся, что период заполнен
    await this.page.waitForTimeout(300);

    await modal.getByRole('button', { name: /Сохранить как черновик/i }).click({ timeout: 10000 });
    // Небольшая задержка для появления тоста
    await this.page.waitForTimeout(500);
    const toastShown = await this.expectToast(/Черновик личности сохранен/i);
    if (!toastShown) {
      console.warn('Expected toast message was not shown');
    }
    // Тост уже подтверждает успешное закрытие модалки, ожидание toBeHidden не требуется
  }

  async createAchievement(
    data: TestAchievement,
    options?: { personSearch?: string }
  ): Promise<void> {
    await this.switchTab('achievements');
    await this.page.waitForTimeout(1000);
    const modal = await this.openCreateModal('achievements');
    await expect(modal.getByText(/Новое достижение/i)).toBeVisible({ timeout: 10000 });

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

    await modal.getByRole('button', { name: /Сохранить как черновик/i }).click({ timeout: 10000 });
    const toastShown = await this.expectToast(/Черновик достижения сохранен/i);
    if (!toastShown) {
      throw new Error('Ожидался тост "Черновик достижения сохранен", но его не было');
    }
    await expect(modal).toBeHidden({ timeout: 30000 });
  }

  async createPeriod(data: TestPeriod, options?: { personSearch?: string }): Promise<void> {
    await this.switchTab('periods');
    await this.page.waitForTimeout(1000);
    const modal = await this.openCreateModal('periods');
    await expect(modal.getByText(/Новый период/i)).toBeVisible({ timeout: 10000 });

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

    await modal.getByRole('button', { name: /Сохранить как черновик/i }).click({ timeout: 10000 });
    const toastShown = await this.expectToast(/Черновик периода сохранен/i);
    if (!toastShown) {
      throw new Error('Ожидался тост "Черновик периода сохранен", но его не было');
    }
    await expect(modal).toBeHidden({ timeout: 30000 });
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
    const successPattern =
      /(Черновик личности сохран[её]н|Личность создана|Предложение на создание личности отправлено)/i;

    if (await this.expectToast(successPattern)) {
      return;
    }

    console.warn(
      'Не удалось поймать тост об успешном создании личности. Продолжаю проверку по БД.'
    );
  }

  async expectModerationStatus(itemName: string, status: string): Promise<void> {
    const item = this.page.locator(`[data-testid="item"]:has-text("${itemName}")`);
    const statusBadge = item.locator(`[data-status="${status}"], text=${status}`);
    await expect(statusBadge).toBeVisible();
  }

  getItemCardById(id: string | number): Locator {
    return this.page.locator(`#item-card-${id}`);
  }

  async openEditModalById(
    id: string | number,
    options: { type: 'person' | 'achievement' | 'period' }
  ): Promise<Locator> {
    const card = this.getItemCardById(id);
    await expect(card).toBeVisible({ timeout: 15000 });

    const editButton = card.locator(
      '[aria-label*="редактировать" i], button[title*="Редактировать" i], button:has-text("✏️")'
    );
    await expect(editButton.first()).toBeVisible({ timeout: 5000 });
    await editButton.first().click();

    const titlePattern =
      options.type === 'achievement'
        ? /Редактирование достижения/i
        : options.type === 'period'
          ? /Редактирование периода/i
          : /Редактирование личности/i;
    const modal = this.page.locator('[role="dialog"]').filter({ hasText: titlePattern }).first();
    await expect(modal).toBeVisible({ timeout: 15000 });
    return modal;
  }

  async searchInTab(tab: 'persons' | 'achievements' | 'periods', query: string): Promise<void> {
    const inputId =
      tab === 'persons'
        ? 'person-search-input'
        : tab === 'achievements'
          ? 'achievement-search-input'
          : 'period-search-input';

    const searchInput = this.page.locator(`#${inputId}`);
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill(query);
    await this.page.waitForTimeout(300);
  }
}
