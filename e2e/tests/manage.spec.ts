import { test, expect } from '../fixtures/auth-fixtures';
import { ManagePage } from '../pages/ManagePage';
import { createTestPerson, createTestAchievement, createTestPeriod } from '../utils/test-data-factory';
import { loginUser, DEFAULT_TEST_USER } from '../helpers/auth-helper';

const stubCategoriesResponse = {
  success: true,
  data: ['scientists', 'politicians', 'writers', 'artists'],
};

const stubCountriesResponse = {
  success: true,
  data: ['Россия', 'США', 'Германия'],
};

const stubCountryOptionsResponse = {
  success: true,
  data: [
    { id: 1, name: 'Россия' },
    { id: 2, name: 'США' },
    { id: 3, name: 'Германия' },
  ],
};

const stubPersonSearchResponse = {
  success: true,
  data: [
    { id: 'ada-lovelace', name: 'Ада Лавлейс' },
    { id: 'albert-einstein', name: 'Альберт Эйнштейн' },
  ],
  meta: { limit: 10, offset: 0, hasMore: false, nextOffset: null },
};

test.describe('Управление контентом', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const loginResult = await loginUser(DEFAULT_TEST_USER);
    if (!loginResult.success || !loginResult.tokens) {
      throw new Error('Не удалось получить токен для подготовительного запроса');
    }

    const personPayload = {
      id: `e2e-person-${Date.now()}`,
      name: `E2E Личность ${Date.now()}`,
      birthYear: 1900,
      deathYear: 1950,
      category: 'scientists',
      description: 'E2E описание',
      imageUrl: null,
      wikiLink: null,
      lifePeriods: [],
      saveAsDraft: true,
    };

    await fetch('http://localhost:3001/api/persons/propose', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginResult.tokens.accessToken}`,
      },
      body: JSON.stringify(personPayload),
    });

    const personOption = { value: personPayload.id, label: personPayload.name };

    await authenticatedPage.addInitScript(({ option }) => {
      (window as any).__E2E_PERSON_OPTIONS__ = [option];
      (window as any).__E2E_DEFAULT_PERSON__ = option.value;
    }, { option: personOption });

    await authenticatedPage.route('**/api/categories', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stubCategoriesResponse),
      });
    });

    await authenticatedPage.route('**/api/countries', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stubCountriesResponse),
      });
    });

    await authenticatedPage.route('**/api/countries/options', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stubCountryOptionsResponse),
      });
    });

    await authenticatedPage.route('**/api/persons**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/api/persons')) {
        const responseBody = {
          success: true,
          data: [
            { id: personPayload.id, name: personPayload.name },
          ],
          meta: { limit: 10, offset: 0, hasMore: false, nextOffset: null },
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(responseBody),
        });
        return;
      }
      await route.continue();
    });
  });

  test('создание новой личности @regression @manage', async ({ authenticatedPage }) => {
    const managePage = new ManagePage(authenticatedPage);
    const person = createTestPerson();
    
    await managePage.goto();
    await managePage.createPerson(person);
    await managePage.expectPersonCreated();
  });

  test('создание достижения @regression @manage', async ({ authenticatedPage }) => {
    const managePage = new ManagePage(authenticatedPage);
    const achievement = createTestAchievement();
    
    await managePage.goto();
    await managePage.createAchievement(achievement);
  });

  test('создание периода жизни @regression @manage', async ({ authenticatedPage }) => {
    const managePage = new ManagePage(authenticatedPage);
    const period = createTestPeriod();
    
    await managePage.goto();
    await managePage.createPeriod(period);
  });
});


