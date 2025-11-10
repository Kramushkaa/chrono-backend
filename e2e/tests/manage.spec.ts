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
  test.beforeEach(async ({ moderatorPage }) => {
    const loginResult = await loginUser(DEFAULT_TEST_USER);
    if (!loginResult.success || !loginResult.tokens) {
      throw new Error('Не удалось получить токен для подготовительного запроса');
    }

    const personPayload = {
      id: `manage-db-base-${Date.now()}`,
      name: `Manage DB Base ${Date.now()}`,
      birthYear: 1900,
      deathYear: 1950,
      category: 'scientists',
      description: 'Seed person для manage-db',
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

    await moderatorPage.addInitScript(() => {
      const personOptions = (window as any).__E2E_PERSON_OPTIONS__ ?? [];
      const defaultOption = (window as any).__E2E_DEFAULT_PERSON__ ?? null;

      if (!personOptions.some((item: any) => item.value === personPayload.id)) {
        personOptions.push({ value: personPayload.id, label: personPayload.name });
      }

      (window as any).__E2E_PERSON_OPTIONS__ = personOptions;
      (window as any).__E2E_DEFAULT_PERSON__ = defaultOption ?? personPayload.id;
    });

    await moderatorPage.route('**/api/categories', async route => {
      await fulfillJson(route, stubCategoriesResponse);
    });

    await moderatorPage.route('**/api/countries**', async route => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/api/countries/options')) {
        await fulfillJson(route, stubCountryOptionsResponse);
        return;
      }

      await fulfillJson(route, stubCountriesResponse);
    });

    await moderatorPage.route('**/api/persons**', async (route) => {
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

  test('создание новой личности @regression @manage', async ({ moderatorPage }) => {
    const managePage = new ManagePage(moderatorPage);
    const person = createTestPerson();

    await managePage.goto();
    await managePage.createPerson(person);
    await managePage.expectPersonCreated();
  });

  test('создание достижения @regression @manage', async ({ moderatorPage }) => {
    const managePage = new ManagePage(moderatorPage);
    const achievement = createTestAchievement();

    await managePage.goto();
    await managePage.createAchievement(achievement);
  });

  test('создание периода жизни @regression @manage', async ({ moderatorPage }) => {
    const managePage = new ManagePage(moderatorPage);
    const period = createTestPeriod();

    await managePage.goto();
    await managePage.createPeriod(period);
  });
});


