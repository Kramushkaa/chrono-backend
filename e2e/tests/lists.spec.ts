import { test, expect } from '../fixtures/auth-fixtures';
import { ListsPage } from '../pages/ListsPage';
import { PublicListsPage } from '../pages/PublicListsPage';
import { createTestList } from '../utils/test-data-factory';

test.describe('Пользовательские списки', () => {
  test('создание нового списка', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    const list = createTestList();
    
    await listsPage.goto();
    await listsPage.createList(list.title);
  });

  test('создание share code для списка', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    const list = createTestList();
    
    await listsPage.goto();
    await listsPage.createList(list.title);
    
    // Share code creation test
  });

  test('просмотр публичных списков', async ({ page }) => {
    const publicListsPage = new PublicListsPage(page);
    
    await publicListsPage.goto();
  });
});

