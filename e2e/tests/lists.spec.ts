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

  test('гость видит read-only shared список и получает запрос авторизации при копировании @regression', async ({
    authenticatedPage,
    browser,
  }) => {
    const listsPage = new ListsPage(authenticatedPage);
    const list = createTestList();

    const listId = await createListViaApi(authenticatedPage, list.title);
    expect(listId).toBeDefined();

    await listsPage.goto();
    await listsPage.waitForList(list.title);

    const authState = await authenticatedPage.evaluate(() => localStorage.getItem('auth'));
    expect(authState).not.toBeNull();
    const { accessToken } = JSON.parse(authState ?? '{}');
    expect(accessToken).toBeTruthy();

    const apiClient = new ApiClient(undefined, accessToken);
    const shareResponse = await apiClient.shareList(Number(listId));
    const shareCode =
      shareResponse?.code ||
      shareResponse?.data?.code ||
      shareResponse?.data?.shareCode ||
      shareResponse?.data?.share_code;
    expect(shareCode).toBeTruthy();

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/lists?share=${encodeURIComponent(shareCode)}`);
    await guestPage.waitForLoadState('networkidle');

    const sharedListButton = guestPage
      .getByRole('button', { name: new RegExp(`🔒\\s*${list.title}`) })
      .first();
    await expect(sharedListButton).toBeVisible({ timeout: 15000 });

    await expect(sharedListButton.locator('button[title="Поделиться"]')).toHaveCount(0);
    const copyButton = sharedListButton.locator('button[title="Скопировать себе"]');
    await expect(copyButton).toBeVisible();

    await copyButton.click();
    const toast = guestPage.locator('.toast-message', { hasText: /нужно войти/i });
    await expect(toast).toBeVisible({ timeout: 5000 });

    await guestContext.close();
  });

  test('ошибка создания ссылки отображает уведомление @regression', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    const list = createTestList();

    await createListViaApi(authenticatedPage, list.title);
    await listsPage.goto();
    const listEntry = await listsPage.waitForList(list.title);

    await authenticatedPage.route(
      '**/api/lists/**/share',
      async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'fail' }),
        });
      },
      { times: 1 }
    );

    await listEntry.locator('button[title="Поделиться"]').click();
    const toast = authenticatedPage.locator('.toast-message', { hasText: /ошибка создания ссылки/i });
    await expect(toast).toBeVisible({ timeout: 5000 });
  });
});


