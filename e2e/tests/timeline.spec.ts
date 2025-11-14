import { test, expect } from '../fixtures/auth-fixtures';
import { TimelinePage } from '../pages/TimelinePage';
import { PersonPanelPage } from '../pages/PersonPanelPage';

/**
 * E2E тесты для Timeline
 */

test.describe('Timeline', () => {
  test('отображение личностей на таймлайне', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    await timelinePage.expectTimelineNotEmpty();
  });

  test('фильтрация по категории', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    const initialCount = await timelinePage.personCards.count();
    
    await timelinePage.filterByCategory('scientists');
    await page.waitForTimeout(500);
    
    // После фильтрации должно быть меньше или столько же элементов
    const filteredCount = await timelinePage.personCards.count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('фильтрация по стране', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    await timelinePage.filterByCountry('Россия');
    await timelinePage.expectMinPersonsCount(1);
  });

  test('комбинированные фильтры', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    await timelinePage.filterByCategory('scientists');
    await timelinePage.filterByCountry('Германия');
    
    // Должны остаться только немецкие учёные
    await page.waitForTimeout(500);
  });

  test('открытие панели личности', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    const personPanel = new PersonPanelPage(page);
    
    await timelinePage.goto();
    await timelinePage.clickPerson('Альберт Эйнштейн');
    
    await personPanel.waitForOpen();
    await personPanel.expectPersonDetails({ name: 'Эйнштейн' });
  });

  test('закрытие панели личности через Escape', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    const personPanel = new PersonPanelPage(page);
    
    await timelinePage.goto();
    await timelinePage.clickPerson('Альберт Эйнштейн');
    await personPanel.waitForOpen();
    
    await personPanel.closeWithEscape();
  });

  test('добавление личности в список для авторизованного пользователя', async ({ authenticatedPage }) => {
    const timelinePage = new TimelinePage(authenticatedPage);
    const personPanel = new PersonPanelPage(authenticatedPage);
    
    await timelinePage.goto();
    await timelinePage.clickPerson('Альберт Эйнштейн');
    await personPanel.waitForOpen();
    
    await personPanel.expectAddToListButtonVisible();
  });

  test('кнопка добавления в список не видна для неавторизованного', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    const personPanel = new PersonPanelPage(page);
    
    await timelinePage.goto();
    await timelinePage.clickPerson('Альберт Эйнштейн');
    await personPanel.waitForOpen();
    
    await personPanel.expectAddToListButtonNotVisible();
  });

  test('поиск личности по имени', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    await timelinePage.searchPerson('Эйнштейн');
    
    await page.waitForTimeout(500);
    await timelinePage.expectMinPersonsCount(1);
  });

  test('сброс фильтров', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    const initialCount = await timelinePage.personCards.count();
    
    await timelinePage.filterByCategory('scientists');
    await page.waitForTimeout(500);
    
    await timelinePage.resetFilters();
    await page.waitForTimeout(500);
    
    const afterResetCount = await timelinePage.personCards.count();
    expect(afterResetCount).toBe(initialCount);
  });
});
