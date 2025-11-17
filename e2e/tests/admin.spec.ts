import { test, expect } from '../fixtures/auth-fixtures';
import { ModerationPage } from '../pages/ModerationPage';

test.describe('Админ функции', () => {
  test('просмотр очереди модерации', async ({ adminPage }) => {
    const moderationPage = new ModerationPage(adminPage);
    
    await moderationPage.goto();
    await moderationPage.expectModerationQueue('pending', 0);
  });

  test('одобрение личности', async ({ adminPage }) => {
    const moderationPage = new ModerationPage(adminPage);
    
    await moderationPage.goto();
    // Approve person test
  });
});

