import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object для страницы Timeline
 */
export class TimelinePage {
  readonly page: Page;
  
  // Локаторы
  readonly categoryFilter: Locator;
  readonly countryFilter: Locator;
  readonly occupationFilter: Locator;
  readonly yearRangeSlider: Locator;
  readonly personCards: Locator;
  readonly searchInput: Locator;
  readonly resetFiltersButton: Locator;

  constructor(page: Page) {
    this.page = page;
    
    this.categoryFilter = page.locator('[data-testid="category-filter"], .category-filter');
    this.countryFilter = page.locator('[data-testid="country-filter"], .country-filter');
    this.occupationFilter = page.locator('[data-testid="occupation-filter"], .occupation-filter');
    this.yearRangeSlider = page.locator('[data-testid="year-range-slider"], .year-range-slider');
    this.personCards = page.locator('[data-testid="person-card"], .person-card');
    this.searchInput = page.locator('[data-testid="search-input"], input[type="search"]');
    this.resetFiltersButton = page.locator('button:has-text("Сбросить"), button:has-text("Reset")');
  }

  /**
   * Переход на страницу Timeline
   */
  async goto(): Promise<void> {
    await this.page.goto('/timeline');
    // Ждём загрузки данных
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Фильтрация по категории
   */
  async filterByCategory(category: string): Promise<void> {
    // Клик по фильтру категорий (может быть dropdown)
    await this.categoryFilter.click();
    
    // Выбор категории из списка
    await this.page.locator(`text=${category}`).click();
    
    // Ждём применения фильтра
    await this.page.waitForTimeout(500);
  }

  /**
   * Фильтрация по стране
   */
  async filterByCountry(country: string): Promise<void> {
    await this.countryFilter.click();
    await this.page.locator(`text=${country}`).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Фильтрация по профессии
   */
  async filterByOccupation(occupation: string): Promise<void> {
    await this.occupationFilter.click();
    await this.page.locator(`text=${occupation}`).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Выбор диапазона лет через слайдер
   */
  async selectYearRange(from: number, to: number): Promise<void> {
    // Это зависит от реализации слайдера
    // Пример для input type="range"
    const fromInput = this.page.locator('input[name="year-from"], input[aria-label*="от"]');
    const toInput = this.page.locator('input[name="year-to"], input[aria-label*="до"]');
    
    if (await fromInput.isVisible()) {
      await fromInput.fill(from.toString());
    }
    
    if (await toInput.isVisible()) {
      await toInput.fill(to.toString());
    }
    
    await this.page.waitForTimeout(500);
  }

  /**
   * Клик по личности для открытия панели
   */
  async clickPerson(personName: string): Promise<void> {
    const personCard = this.page.locator(`[data-testid="person-card"]:has-text("${personName}")`);
    await personCard.click();
  }

  /**
   * Поиск личности по имени
   */
  async searchPerson(name: string): Promise<void> {
    await this.searchInput.fill(name);
    await this.page.waitForTimeout(500);
  }

  /**
   * Проверка количества отображаемых личностей
   */
  async expectPersonsCount(count: number): Promise<void> {
    await expect(this.personCards).toHaveCount(count);
  }

  /**
   * Проверка минимального количества личностей
   */
  async expectMinPersonsCount(minCount: number): Promise<void> {
    const count = await this.personCards.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  /**
   * Проверка видимости конкретной личности
   */
  async expectPersonVisible(name: string): Promise<void> {
    const personCard = this.page.locator(`[data-testid="person-card"]:has-text("${personName}")`, {
      hasText: name,
    });
    await expect(personCard).toBeVisible();
  }

  /**
   * Проверка что личность не отображается
   */
  async expectPersonNotVisible(name: string): Promise<void> {
    const personCard = this.page.locator(`[data-testid="person-card"]:has-text("${name}")`);
    await expect(personCard).not.toBeVisible();
  }

  /**
   * Сброс всех фильтров
   */
  async resetFilters(): Promise<void> {
    if (await this.resetFiltersButton.isVisible()) {
      await this.resetFiltersButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Получение списка всех отображаемых имён личностей
   */
  async getVisiblePersonNames(): Promise<string[]> {
    const cards = await this.personCards.all();
    const names: string[] = [];
    
    for (const card of cards) {
      const name = await card.textContent();
      if (name) {
        names.push(name.trim());
      }
    }
    
    return names;
  }

  /**
   * Проверка что timeline не пустой
   */
  async expectTimelineNotEmpty(): Promise<void> {
    const count = await this.personCards.count();
    expect(count).toBeGreaterThan(0);
  }

  /**
   * Проверка что показано сообщение "Ничего не найдено"
   */
  async expectEmptyState(): Promise<void> {
    const emptyMessage = this.page.locator('text=/ничего не найдено|no results/i');
    await expect(emptyMessage).toBeVisible();
  }
}
