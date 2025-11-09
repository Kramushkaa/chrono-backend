import { test, expect, devices } from '@playwright/test';
import { TimelinePage } from '../pages/TimelinePage';

test.use(devices['iPhone 12']);

test.describe('Мобильная версия', () => {
  test('timeline на мобильном', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    await timelinePage.expectTimelineNotEmpty();
  });

  test('фильтры на мобильном', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    await timelinePage.filterByCategory('scientists');
  });
});

