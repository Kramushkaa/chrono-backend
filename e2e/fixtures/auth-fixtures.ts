import { test as base, Page } from '@playwright/test';
import { setupAuthenticatedUser, DEFAULT_TEST_USER } from '../helpers/auth-helper';
import { createTestUser, createTestAdmin, createTestModerator } from '../utils/test-data-factory';
import { TestUser } from '../types';

/**
 * Playwright fixtures для аутентифицированных пользователей
 * 
 * Использование:
 * test('my test', async ({ authenticatedPage }) => {
 *   // authenticatedPage уже содержит авторизованного пользователя
 * })
 */

type AuthFixtures = {
  // Страница с авторизованным обычным пользователем
  authenticatedPage: Page;
  
  // Страница с авторизованным модератором
  moderatorPage: Page;
  
  // Страница с авторизованным администратором
  adminPage: Page;
  
  // Создание пользовательской авторизованной страницы
  createAuthenticatedPage: (user: TestUser) => Promise<Page>;

  // Данные текущего модератора (для использования в тестах)
  moderatorCredentials: TestUser;
  // Данные текущего администратора (при необходимости)
  adminCredentials: TestUser;
};

export const test = base.extend<AuthFixtures>({
  /**
   * Fixture для обычного авторизованного пользователя
   */
  authenticatedPage: async ({ page }, use) => {
    const user = DEFAULT_TEST_USER;
    const apiUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    const result = await setupAuthenticatedUser(page, user, apiUrl);
    
    if (!result.success) {
      throw new Error(`Failed to setup authenticated user: ${result.error}`);
    }
    
    // Переходим на главную страницу чтобы токены применились
    await page.goto('/');
    
    await use(page);
    
    // Cleanup не требуется - каждый тест получает свежий page
  },

  /**
   * Fixture для авторизованного модератора
   */
  moderatorCredentials: async ({}, use) => {
    const moderator = createTestModerator();
    await use(moderator);
  },

  moderatorPage: async ({ browser, moderatorCredentials }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const apiUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    const result = await setupAuthenticatedUser(page, moderatorCredentials, apiUrl);
    
    if (!result.success) {
      throw new Error(`Failed to setup moderator: ${result.error}`);
    }
    
    await page.goto('/');
    
    await use(page);
    
    await context.close();
  },

  /**
   * Fixture для авторизованного администратора
   */
  adminCredentials: async ({}, use) => {
    const admin = createTestAdmin();
    await use(admin);
  },

  adminPage: async ({ browser, adminCredentials }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const apiUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    const result = await setupAuthenticatedUser(page, adminCredentials, apiUrl);
    
    if (!result.success) {
      throw new Error(`Failed to setup admin: ${result.error}`);
    }
    
    await page.goto('/');
    
    await use(page);
    
    await context.close();
  },

  /**
   * Фабрика для создания кастомной авторизованной страницы
   */
  createAuthenticatedPage: async ({ browser }, use) => {
    const pages: Page[] = [];
    
    const createPage = async (user: TestUser): Promise<Page> => {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      const apiUrl = process.env.BACKEND_URL || 'http://localhost:3001';
      const result = await setupAuthenticatedUser(page, user, apiUrl);
      
      if (!result.success) {
        throw new Error(`Failed to setup custom user: ${result.error}`);
      }
      
      await page.goto('/');
      
      pages.push(page);
      return page;
    };
    
    await use(createPage);
    
    // Cleanup: закрываем все созданные страницы
    for (const page of pages) {
      await page.context().close();
    }
  },
});

export { expect } from '@playwright/test';


