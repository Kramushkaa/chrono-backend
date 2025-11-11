import { test, expect } from '../fixtures/auth-fixtures';
import { ManagePage } from '../pages/ManagePage';
import {
  createTestPerson,
  createTestAchievement,
  createTestPeriod,
  createTestAchievementForPerson,
  createTestPeriodForPerson,
} from '../utils/test-data-factory';
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
  let seedPersonName: string = '';
  let seedPerson: any = null;
  let createAchievementCalls = 0;
  let createPeriodCalls = 0;

  test.beforeEach(async ({ moderatorPage }) => {
    const loginResult = await loginUser(DEFAULT_TEST_USER);
    if (!loginResult.success || !loginResult.tokens || !loginResult.user?.id) {
      throw new Error('Не удалось получить токены для manage-db');
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

    seedPersonName = personPayload.name;
    seedPerson = {
      id: personPayload.id,
      name: personPayload.name,
      birth_year: personPayload.birthYear,
      death_year: personPayload.deathYear,
      category: personPayload.category,
    };

    await moderatorPage.evaluate(
      async ({ payload }) => {
        const rawAuth = window.localStorage.getItem('auth');
        if (!rawAuth) {
          throw new Error('Не найден auth в localStorage');
        }
        const authState = JSON.parse(rawAuth);
        const token = authState?.accessToken;
        if (!token) {
          throw new Error('Не найден accessToken для модератора');
        }

        const response = await fetch('http://localhost:3001/api/persons/propose', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`Не удалось создать seed person: ${response.status} ${text}`);
        }
      },
      { payload: personPayload }
    );

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

    await moderatorPage.route('**/api/persons/*/achievements', async route => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const url = route.request().url();
      console.log('[stub] POST', url);
      const urlObj = new URL(url);
      if (urlObj.pathname.includes('/achievements')) {
        createAchievementCalls += 1;
        await fulfillJson(route, { success: true, data: { id: Date.now() } });
        return;
      }
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Not found' }),
      });
    });

    await moderatorPage.route('**/api/persons/*/periods', async route => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const url = route.request().url();
      console.log('[stub] POST', url);
      createPeriodCalls += 1;
      await fulfillJson(route, { success: true, data: { id: Date.now() } });
    });

    await moderatorPage.route('**/api/persons', async route => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/api/persons')) {
        const responseBody = {
          success: true,
          data: [{ id: personPayload.id, name: personPayload.name }],
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

    await moderatorPage.route('**/api/achievements/mine**', async route => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await fulfillJson(route, {
        success: true,
        data: [],
        meta: { limit: 10, offset: 0, hasMore: false, nextOffset: null },
      });
    });

    await moderatorPage.route('**/api/achievements/mine?count=true**', async route => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await fulfillJson(route, { success: true, data: { count: 0 } });
    });

    await moderatorPage.route('**/api/periods/mine**', async route => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await fulfillJson(route, {
        success: true,
        data: [],
        meta: { limit: 10, offset: 0, hasMore: false, nextOffset: null },
      });
    });

    await moderatorPage.route('**/api/periods/mine?count=true**', async route => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await fulfillJson(route, { success: true, data: { count: 0 } });
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

    // Используем полное имя для точного поиска личности
    const achievement = createTestAchievementForPerson(seedPerson);

    await managePage.goto();
    await managePage.createAchievement(achievement, { personSearch: seedPersonName });
    expect(createAchievementCalls).toBeGreaterThan(0);
  });

  test('создание периода жизни @regression @manage', async ({ moderatorPage }) => {
    const managePage = new ManagePage(moderatorPage);

    // Используем полное имя для точного поиска личности
    const period = createTestPeriodForPerson(seedPerson);

    await managePage.goto();
    await managePage.createPeriod(period, { personSearch: seedPersonName });
    expect(createPeriodCalls).toBeGreaterThan(0);
  });
});
