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
    await listsPage.expectListPresent(list.title);
  });

  test('создание share code для списка @regression @lists', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    const list = createTestList();

    await createListViaApi(authenticatedPage, list.title);
    await listsPage.goto();
    await listsPage.expectListPresent(list.title);
    const shareResponse = await listsPage.clickShareButton(list.title);
    expect(shareResponse).not.toBeNull();
    expect(shareResponse!.ok()).toBeTruthy();
    const sharePayload = await shareResponse!.json().catch(() => ({}));
    const shareCode =
      sharePayload?.code ||
      sharePayload?.data?.code ||
      sharePayload?.data?.shareCode ||
      sharePayload?.data?.share_code;
    expect(shareCode).toBeTruthy();
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
    await listsPage.expectListPresent(list.title);

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
    const guestListsPage = new ListsPage(guestPage);
    await guestPage.goto(`/lists?share=${encodeURIComponent(shareCode)}`);
    await guestPage.waitForLoadState('networkidle');

    await guestListsPage.expectListPresent(list.title);
    await guestListsPage.selectList(list.title);
    const copyButton = guestPage.locator('button[title="Скопировать себе"]').first();
    await expect(copyButton).toBeVisible({ timeout: 15000 });

    await copyButton.click();
    const toast = guestPage.locator('.toast-message', { hasText: /нужно войти/i });
    await expect(toast).toBeVisible({ timeout: 5000 });

    await guestContext.close();
  });

  test('ошибка создания ссылки отображает уведомление @regression', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    const list = createTestList();

    const listId = await createListViaApi(authenticatedPage, list.title);
    expect(listId).toBeDefined();
    await listsPage.goto();
    await listsPage.expectListPresent(list.title);

    await authenticatedPage.evaluate(activeListId => {
      const originalFetch = window.fetch.bind(window);
      (window as unknown as { __e2eOriginalFetch__?: typeof window.fetch }).__e2eOriginalFetch__ = originalFetch;
      window.fetch = ((input: unknown, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
            ? input.toString()
            : (input as { url?: string })?.url ?? '';
        if (url.includes(`/api/lists/${activeListId}/share`)) {
          return Promise.resolve(
            new Response(JSON.stringify({ message: 'fail' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        return originalFetch(input, init);
      }) as typeof window.fetch;
    }, listId);

    await listsPage.clickShareButton(list.title, { waitForResponse: false });
    await listsPage.expectToast(/ошибка создания ссылки/i);

    await authenticatedPage.evaluate(() => {
      const win = window as unknown as { __e2eOriginalFetch__?: typeof window.fetch };
      if (win.__e2eOriginalFetch__) {
        window.fetch = win.__e2eOriginalFetch__;
        delete win.__e2eOriginalFetch__;
      }
    });
  });
});


