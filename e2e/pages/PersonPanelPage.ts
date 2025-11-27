import { Page, Locator, expect } from '@playwright/test';
import { TestPerson, TestAchievement, TestPeriod } from '../types';

/**
 * Page Object для панели личности (детальная информация)
 */
export class PersonPanelPage {
  readonly page: Page;
  
  // Локаторы
  readonly panel: Locator;
  readonly closeButton: Locator;
  readonly personName: Locator;
  readonly personBio: Locator;
  readonly birthYear: Locator;
  readonly deathYear: Locator;
  readonly category: Locator;
  readonly country: Locator;
  readonly occupation: Locator;
  readonly achievementsList: Locator;
  readonly periodsList: Locator;
  readonly wikiLink: Locator;
  readonly addToListButton: Locator;

  constructor(page: Page) {
    this.page = page;
    
    this.panel = page.locator('[data-testid="person-panel"], .person-panel, [role="dialog"]');
    this.closeButton = page.locator('[data-testid="close-panel"], button[aria-label*="закрыть"], button[aria-label*="close"]');
    this.personName = page.locator('[data-testid="person-name"], .person-name, h1, h2');
    this.personBio = page.locator('[data-testid="person-bio"], .person-bio');
    this.birthYear = page.locator('[data-testid="birth-year"], .birth-year');
    this.deathYear = page.locator('[data-testid="death-year"], .death-year');
    this.category = page.locator('[data-testid="person-category"], .person-category');
    this.country = page.locator('[data-testid="person-country"], .person-country');
    this.occupation = page.locator('[data-testid="person-occupation"], .person-occupation');
    this.achievementsList = page.locator('[data-testid="achievements-list"], .achievements-list');
    this.periodsList = page.locator('[data-testid="periods-list"], .periods-list');
    this.wikiLink = page.locator('a[href*="wikipedia"]');
    this.addToListButton = page.locator('button:has-text("Добавить в список"), button:has-text("Add to list")');
  }

  /**
   * Ожидание открытия панели
   */
  async waitForOpen(): Promise<void> {
    await expect(this.panel).toBeVisible({ timeout: 5000 });
  }

  /**
   * Закрытие панели
   */
  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.panel).not.toBeVisible();
  }

  /**
   * Закрытие панели через Escape
   */
  async closeWithEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.panel).not.toBeVisible();
  }

  /**
   * Проверка основных деталей личности
   */
  async expectPersonDetails(person: Partial<TestPerson>): Promise<void> {
    await this.waitForOpen();
    
    if (person.name) {
      await expect(this.personName).toContainText(person.name);
    }
    
    if (person.birth_year) {
      const birthYearText = await this.birthYear.textContent();
      expect(birthYearText).toContain(person.birth_year.toString());
    }
    
    if (person.death_year) {
      const deathYearText = await this.deathYear.textContent();
      expect(deathYearText).toContain(person.death_year.toString());
    }
    
    if (person.bio) {
      await expect(this.personBio).toContainText(person.bio);
    }
    
    if (person.country) {
      await expect(this.country).toContainText(person.country);
    }
    
    if (person.occupation) {
      await expect(this.occupation).toContainText(person.occupation);
    }
  }

  /**
   * Проверка списка достижений
   */
  async expectAchievements(achievements: string[]): Promise<void> {
    for (const achievement of achievements) {
      const achievementItem = this.achievementsList.locator(`text=${achievement}`);
      await expect(achievementItem).toBeVisible();
    }
  }

  /**
   * Проверка количества достижений
   */
  async expectAchievementsCount(count: number): Promise<void> {
    const items = this.achievementsList.locator('.achievement-item, [data-testid="achievement-item"]');
    await expect(items).toHaveCount(count);
  }

  /**
   * Проверка списка периодов жизни
   */
  async expectPeriods(periods: string[]): Promise<void> {
    for (const period of periods) {
      const periodItem = this.periodsList.locator(`text=${period}`);
      await expect(periodItem).toBeVisible();
    }
  }

  /**
   * Проверка количества периодов
   */
  async expectPeriodsCount(count: number): Promise<void> {
    const items = this.periodsList.locator('.period-item, [data-testid="period-item"]');
    await expect(items).toHaveCount(count);
  }

  /**
   * Проверка наличия ссылки на Wikipedia
   */
  async expectWikiLink(): Promise<void> {
    await expect(this.wikiLink).toBeVisible();
    const href = await this.wikiLink.getAttribute('href');
    expect(href).toContain('wikipedia');
  }

  /**
   * Клик по ссылке Wikipedia
   */
  async clickWikiLink(): Promise<void> {
    await this.wikiLink.click();
  }

  /**
   * Добавление личности в список (для авторизованных пользователей)
   */
  async addToList(listName?: string): Promise<void> {
    await this.addToListButton.click();
    
    // Если указано имя списка, выбираем его
    if (listName) {
      const listOption = this.page.locator(`text=${listName}`);
      await listOption.click();
    }
    
    // Подтверждаем добавление
    const confirmButton = this.page.locator('button:has-text("Добавить"), button:has-text("Add")');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
  }

  /**
   * Проверка что кнопка "Добавить в список" видна
   */
  async expectAddToListButtonVisible(): Promise<void> {
    await expect(this.addToListButton).toBeVisible();
  }

  /**
   * Проверка что кнопка "Добавить в список" не видна (для неавторизованных)
   */
  async expectAddToListButtonNotVisible(): Promise<void> {
    await expect(this.addToListButton).not.toBeVisible();
  }

  /**
   * Получение всего текстового содержимого панели
   */
  async getFullText(): Promise<string> {
    return (await this.panel.textContent()) || '';
  }

  /**
   * Проверка что панель содержит определённый текст
   */
  async expectToContainText(text: string): Promise<void> {
    await expect(this.panel).toContainText(text);
  }
}


