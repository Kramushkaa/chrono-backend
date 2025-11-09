import { test, expect } from '../fixtures/auth-fixtures';
import { ListsPage } from '../pages/ListsPage';
import { PublicListsPage } from '../pages/PublicListsPage';
import { createTestList } from '../utils/test-data-factory';
import { ApiClient } from '../utils/api-client';
import type { Page } from '@playwright/test';

async function createListViaApi(page: Page, title: string): Promise<number | undefined> {
  const authStateRaw = await page.evaluate(() => localStorage.getItem('auth'));
  if (!authStateRaw) throw new Error('Auth state is missing in localStorage');
  const authState = JSON.parse(authStateRaw);
  const accessToken = authState?.accessToken;
  if (!accessToken) throw new Error('Access token is missing in auth state');
  const apiClient = new ApiClient(undefined, accessToken);
  const response = await apiClient.createList(title);
  return response?.data?.id;
}

test.describe('Пользовательские списки', () => {
  test('создание нового списка @regression @lists', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    const list = createTestList();

    await createListViaApi(authenticatedPage, list.title);
    await listsPage.goto();
    const locator = await listsPage.waitForList(list.title);
    await expect(locator).toContainText(list.title);
  });

  test('создание share code для списка @regression @lists', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    const list = createTestList();

    await createListViaApi(authenticatedPage, list.title);
    await listsPage.goto();
    const locator = await listsPage.waitForList(list.title);
    await listsPage.shareListByLocator(locator);
  });

  test('просмотр публичных списков @regression @lists', async ({ page }) => {
    const publicListsPage = new PublicListsPage(page);

    await publicListsPage.goto();
    await publicListsPage.waitForLoaded();
    await expect(page.locator('main')).toContainText(/списков/i);
  });
});


