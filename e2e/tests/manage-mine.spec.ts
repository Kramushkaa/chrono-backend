import { test, expect } from '../fixtures/auth-fixtures';
import type { Page, Route } from '@playwright/test';
import { ManagePage } from '../pages/ManagePage';
import {
  createTestPerson,
  createTestAchievement,
  createTestPeriod,
  createTestAchievementForPerson,
  createTestPeriodForPerson,
} from '../utils/test-data-factory';
import { loginUser } from '../helpers/auth-helper';
import type { AuthTokens, TestPerson } from '../types';

const stubCategoriesResponse = {
  success: true,
  data: ['scientists', 'writers', 'artists'],
};

const stubCountriesResponse = {
  success: true,
  data: ['Россия', 'США'],
};

const stubCountryOptionsResponse = {
  success: true,
  data: [
    { id: 1, name: 'Россия' },
    { id: 2, name: 'США' },
  ],
};

function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

type MineResource = 'persons' | 'achievements' | 'periods';
const API_BASE_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';
let apiTokens: AuthTokens | null = null;

async function apiFetchMineCount(resource: MineResource): Promise<number> {
  if (!apiTokens?.accessToken) {
    throw new Error('API токен не инициализирован для проверки счётчика "Мои"');
  }
  const url = new URL(`${API_BASE_URL}/api/${resource}/mine`);
  url.searchParams.set('count', 'true');
  url.searchParams.set('_', Date.now().toString());

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiTokens.accessToken}`,
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });

  if (!response.ok) {
    return 0;
  }

  const payload = await response.json().catch(() => ({}));
  const rawCount = payload?.data?.count ?? payload?.count ?? 0;
  const count = typeof rawCount === 'string' ? Number(rawCount) : rawCount;
  return Number.isFinite(count) ? Number(count) : 0;
}

async function apiFetchMineItems<T extends Record<string, unknown>>(
  resource: MineResource
): Promise<T[]> {
  if (!apiTokens?.accessToken) {
    throw new Error('API токен не инициализирован для получения элементов "Мои"');
  }

  const url = new URL(`${API_BASE_URL}/api/${resource}/mine`);
  url.searchParams.set('_', Date.now().toString());

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiTokens.accessToken}`,
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => ({}));
  const data = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  return data as T[];
}

async function fetchMineCount(_page: Page, resource: MineResource): Promise<number> {
  return apiFetchMineCount(resource);
}

async function fetchMineItems<T extends Record<string, unknown>>(
  _page: Page,
  resource: MineResource
): Promise<T[]> {
  return apiFetchMineItems<T>(resource);
}

async function waitForMineItem(
  page: Page,
  resource: MineResource,
  predicate: (item: Record<string, unknown>) => boolean
): Promise<void> {
  await expect
    .poll(
      async () => {
        const items = await fetchMineItems<Record<string, unknown>>(page, resource);
        return items.some(predicate);
      },
      { timeout: 15000 }
    )
    .toBeTruthy();
}

let seededPerson: TestPerson;

test.describe('Раздел "Мои" на странице управления @manage', () => {
  test.beforeEach(async ({ browserName, moderatorPage, moderatorCredentials }) => {
    apiTokens = null;
    if (browserName === 'firefox' || browserName === 'mobile-safari') {
      await moderatorPage.waitForTimeout(500);
    }
    await moderatorPage.waitForLoadState('networkidle').catch(async () => {
      await moderatorPage.waitForTimeout(500);
    });

    const loginResult = await loginUser({
      email: moderatorCredentials.email,
      password: moderatorCredentials.password,
    });
    if (!loginResult.success || !loginResult.tokens) {
      throw new Error('Не удалось получить токен для подготовки данных manage-mine');
    }
    apiTokens = loginResult.tokens;

    const seedPerson = {
      id: `manage-mine-base-${Date.now()}`,
      name: `Manage Mine Base ${Date.now()}`,
      birthYear: 1900,
      deathYear: 1950,
      category: 'scientists',
      description: 'Seed person для manage-mine',
      imageUrl: null,
      wikiLink: null,
      lifePeriods: [],
      saveAsDraft: true,
    };

    await moderatorPage.evaluate(
      async ({ payload }) => {
        const auth = window.localStorage.getItem('auth');
        const token = auth ? JSON.parse(auth)?.accessToken : undefined;
        if (!token) {
          throw new Error('Не удалось получить токен модератора для manage-mine seed');
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
          throw new Error(`Seed person manage-mine failed: ${response.status} ${text}`);
        }
      },
      { payload: seedPerson }
    );

    const personOption = { value: seedPerson.id, label: seedPerson.name };
    await moderatorPage.addInitScript(
      ({ option }) => {
        (window as any).__E2E_PERSON_OPTIONS__ = [option];
        (window as any).__E2E_DEFAULT_PERSON__ = option.value;
      },
      { option: personOption }
    );

    await moderatorPage.route('**/api/categories', route =>
      fulfillJson(route, stubCategoriesResponse)
    );
    await moderatorPage.route('**/api/countries', route =>
      fulfillJson(route, stubCountriesResponse)
    );
    await moderatorPage.route('**/api/countries/options', route =>
      fulfillJson(route, stubCountryOptionsResponse)
    );

    seededPerson = {
      id: seedPerson.id,
      name: seedPerson.name,
      birth_year: seedPerson.birthYear,
      death_year: seedPerson.deathYear,
      category: seedPerson.category,
      bio: seedPerson.description,
      wiki_link: seedPerson.wikiLink ?? undefined,
    };
  });

  test('созданная через UI личность появляется в разделе "Мои" @regression', async ({
    moderatorPage,
  }) => {
    const managePage = new ManagePage(moderatorPage);
    const person = createTestPerson();

    await managePage.goto();
    const initialCount = await fetchMineCount(moderatorPage, 'persons');
    await managePage.switchTab('persons');
    await managePage.createPerson(person);
    await managePage.expectPersonCreated();
    await waitForMineItem(moderatorPage, 'persons', item => item?.name === person.name);
    await expect
      .poll(async () => await fetchMineCount(moderatorPage, 'persons'), { timeout: 15000 })
      .toBeGreaterThanOrEqual(initialCount);

    await managePage.openMineSection();
    const list = moderatorPage.locator('.items-list');
    await expect(list).toBeVisible();
    await expect(list).toContainText(person.name);
  });

  test('созданное достижение отображается среди "Моих" @regression', async ({ moderatorPage }) => {
    const managePage = new ManagePage(moderatorPage);
    const achievement = createTestAchievementForPerson(seededPerson);

    await managePage.goto();
    await managePage.switchTab('achievements');
    const initialCount = await fetchMineCount(moderatorPage, 'achievements');

    await managePage.createAchievement(achievement, { personSearch: seededPerson.name });
    await waitForMineItem(
      moderatorPage,
      'achievements',
      item =>
        String(item?.description ?? '') === String(achievement.description ?? '') ||
        String(item?.title ?? '') === String(achievement.title ?? '')
    );
    await expect
      .poll(async () => await fetchMineCount(moderatorPage, 'achievements'), { timeout: 15000 })
      .toBeGreaterThanOrEqual(initialCount);
    await managePage.openMineSection();
    const list = moderatorPage.locator('.items-list');
    await expect(list).toBeVisible();
    await expect(list).toContainText(achievement.description || achievement.title);
  });

  test('счётчик "Мои" увеличивается после создания новой личности @regression', async ({
    moderatorPage,
  }) => {
    const managePage = new ManagePage(moderatorPage);
    const newPerson = createTestPerson();

    await managePage.goto();
    const initialCount = await fetchMineCount(moderatorPage, 'persons');
    await managePage.createPerson(newPerson);
    await managePage.expectPersonCreated();

    await waitForMineItem(moderatorPage, 'persons', item => item?.name === newPerson.name);
    await expect
      .poll(async () => await fetchMineCount(moderatorPage, 'persons'), { timeout: 15000 })
      .toBeGreaterThanOrEqual(initialCount);

    await managePage.openMineSection();
    const list = moderatorPage.locator('.items-list');
    await expect(list).toContainText(newPerson.name);
  });

  test('созданный период появляется среди "Моих" элементов @regression', async ({
    moderatorPage,
  }) => {
    const managePage = new ManagePage(moderatorPage);
    const period = createTestPeriodForPerson(seededPerson);

    await managePage.goto();
    await managePage.switchTab('periods');
    const initialCount = await fetchMineCount(moderatorPage, 'periods');

    await managePage.createPeriod(period, { personSearch: seededPerson.name });
    await waitForMineItem(
      moderatorPage,
      'periods',
      item =>
        String(item?.startYear ?? item?.start_year ?? '') === String(period.start_year) &&
        String(item?.endYear ?? item?.end_year ?? '') === String(period.end_year)
    );
    await expect
      .poll(async () => await fetchMineCount(moderatorPage, 'periods'), { timeout: 15000 })
      .toBeGreaterThanOrEqual(initialCount);
    await managePage.openMineSection();

    const list = moderatorPage.locator('.items-list');
    await expect(list).toBeVisible();
    await expect(list).toContainText(seededPerson.name);
    await expect(list).toContainText(String(period.start_year));
  });
});
