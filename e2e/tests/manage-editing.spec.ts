import { test as base, expect } from '../fixtures/auth-fixtures';
import type { Route } from '@playwright/test';
import { ManagePage } from '../pages/ManagePage';
import { createTestPerson } from '../utils/test-data-factory';
import { loginUser, DEFAULT_TEST_USER, ensureTestUserInDb } from '../helpers/auth-helper';
import type { AuthTokens, TestPerson } from '../types';

const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const viewport = testInfo.project.use?.viewport as { width?: number } | undefined;
    if (viewport && typeof viewport.width === 'number' && viewport.width <= 768) {
      testInfo.skip('Manage editing не поддерживается в мобильной вёрстке');
      return;
    }
    await use(page);
  },
});

const API_BASE_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

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

type ContentVariant = 'draft' | 'approved';

interface CreatedAchievement {
  id: number;
  description: string;
  year: number;
}

interface CreatedPeriod {
  id: number;
  startYear: number;
  endYear: number;
  comment?: string | null;
}

let userTokens: AuthTokens | null = null;
let moderatorTokens: AuthTokens | null = null;
let seededPerson: TestPerson;

function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function fetchWithAuth(tokens: AuthTokens | null, path: string, init: RequestInit): Promise<Response> {
  if (!tokens?.accessToken) {
    throw new Error('API токен не инициализирован');
  }

  const extraHeaders = (init.headers as Record<string, string>) ?? {};
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokens.accessToken}`,
    ...extraHeaders,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Запрос ${path} завершился с ошибкой ${response.status}: ${text}`);
  }

  return response;
}

const userFetch = (path: string, init: RequestInit) => fetchWithAuth(userTokens, path, init);
const moderatorFetch = (path: string, init: RequestInit) =>
  fetchWithAuth(moderatorTokens, path, init);

async function createSeedPerson(): Promise<void> {
  const unique = Date.now();
  const person = createTestPerson({
    id: `manage-edit-${unique}`,
    name: `Manage Edit Person ${unique}`,
    category: 'scientists',
    bio: 'Seed person for manage editing e2e',
  });

  await userFetch('/api/persons/propose', {
    method: 'POST',
    body: JSON.stringify({
      id: person.id,
      name: person.name,
      birthYear: person.birth_year,
      deathYear: person.death_year,
      category: person.category,
      description: person.bio,
      imageUrl: null,
      wikiLink: person.wiki_link,
      saveAsDraft: true,
      lifePeriods: [],
    }),
  });

  seededPerson = person;
}

async function approveAchievement(id: number): Promise<void> {
  await moderatorFetch(`/api/admin/achievements/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ action: 'approve' }),
  });
}

async function createAchievementRecord(
  variant: ContentVariant,
  modifiers?: { description?: string; yearOffset?: number }
): Promise<CreatedAchievement> {
  const offset = modifiers?.yearOffset ?? (variant === 'draft' ? 5 : 15);
  const year = seededPerson.birth_year + offset;
  const description =
    modifiers?.description ?? `E2E ${variant} achievement ${Date.now()}`;

  const response = await userFetch(`/api/persons/${seededPerson.id}/achievements`, {
    method: 'POST',
    body: JSON.stringify({
      year,
      description,
      wikipedia_url: null,
      image_url: null,
      saveAsDraft: variant === 'draft',
    }),
  });

  const payload = await response.json();
  const created = payload?.data;
  if (!created?.id) {
    throw new Error('Не удалось создать достижение для теста');
  }
  if (variant === 'approved') {
    await approveAchievement(created.id);
  }
  return {
    id: created.id,
    description: created.description ?? description,
    year: created.year ?? year,
  };
}

async function approvePeriod(id: number): Promise<void> {
  await moderatorFetch(`/api/admin/periods/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ action: 'approve' }),
  });
}

async function createPeriodRecord(
  variant: ContentVariant,
  modifiers?: { description?: string; offset?: number }
): Promise<CreatedPeriod> {
  const offset = modifiers?.offset ?? (variant === 'draft' ? 2 : 20);
  const startYear = seededPerson.birth_year + offset;
  const endYear = startYear + 4;
  const comment = modifiers?.description ?? `E2E ${variant} period ${Date.now()}`;

  const response = await userFetch(`/api/persons/${seededPerson.id}/periods`, {
    method: 'POST',
    body: JSON.stringify({
      start_year: startYear,
      end_year: endYear,
      period_type: 'life',
      comment,
      saveAsDraft: variant === 'draft',
    }),
  });

  const payload = await response.json();
  const created = payload?.data;
  if (!created?.id) {
    throw new Error('Не удалось создать период для теста');
  }
  if (variant === 'approved') {
    await approvePeriod(created.id);
  }
  return {
    id: created.id,
    startYear: created.start_year ?? startYear,
    endYear: created.end_year ?? endYear,
    comment: created.comment ?? comment,
  };
}

test.describe('Редактирование достижений и периодов @manage-editing', () => {
  test.beforeEach(async ({ authenticatedPage, moderatorCredentials }) => {
    userTokens = null;
    moderatorTokens = null;

    await ensureTestUserInDb(DEFAULT_TEST_USER);
    await ensureTestUserInDb(moderatorCredentials);

    const [userLogin, moderatorLogin] = await Promise.all([
      loginUser({ email: DEFAULT_TEST_USER.email, password: DEFAULT_TEST_USER.password }),
      loginUser({ email: moderatorCredentials.email, password: moderatorCredentials.password }),
    ]);

    if (!userLogin.success || !userLogin.tokens) {
      throw new Error('Не удалось выполнить вход для тестового пользователя');
    }
    if (!moderatorLogin.success || !moderatorLogin.tokens) {
      throw new Error('Не удалось выполнить вход для модератора');
    }

    userTokens = userLogin.tokens;
    moderatorTokens = moderatorLogin.tokens;

    await createSeedPerson();

    const option = { value: seededPerson.id!, label: seededPerson.name };
    await authenticatedPage.addInitScript(
      ({ option }) => {
        const globalWindow = window as Window & {
          __E2E_PERSON_OPTIONS__?: Array<{ value: string; label: string }>;
          __E2E_DEFAULT_PERSON__?: string;
        };
        globalWindow.__E2E_PERSON_OPTIONS__ = [option];
        globalWindow.__E2E_DEFAULT_PERSON__ = option.value;
      },
      { option }
    );

    await authenticatedPage.route('**/api/categories', route => fulfillJson(route, stubCategoriesResponse));
    await authenticatedPage.route('**/api/countries', route => fulfillJson(route, stubCountriesResponse));
    await authenticatedPage.route('**/api/countries/options', route =>
      fulfillJson(route, stubCountryOptionsResponse)
    );
  });

  test('черновик достижения можно отредактировать и сохранить @regression', async ({
    authenticatedPage,
  }) => {
    const draftAchievement = await createAchievementRecord('draft', {
      description: `Черновик достижения ${Date.now()}`,
      yearOffset: 5,
    });

    const managePage = new ManagePage(authenticatedPage);
    await managePage.goto();
    await managePage.switchTab('achievements');
    await managePage.openMineSection();

    await expect(managePage.getItemCardById(draftAchievement.id)).toBeVisible({ timeout: 20000 });
    const modal = await managePage.openEditModalById(draftAchievement.id, { type: 'achievement' });

    const updatedDescription = `${draftAchievement.description} (обновлено)`;
    await expect(modal.locator('#achievement-edit-is-global')).not.toBeChecked();
    await expect(
      modal
        .getByTestId('achievement-person-select')
        .getByRole('button', { name: seededPerson.name })
    ).toBeVisible();
    await modal.getByLabel(/Год/i).fill(String(draftAchievement.year + 1));
    await modal.getByLabel(/Описание/i).fill(updatedDescription);
    await modal.getByRole('button', { name: /Сохранить как черновик/i }).click();

    await managePage.expectToast(/Черновик сохранен/i);
    await expect(modal).toBeHidden({ timeout: 10000 });
    await managePage.reload();
    await managePage.switchTab('achievements');
    await managePage.openMineSection();
    await expect(managePage.getItemCardById(draftAchievement.id)).toContainText(updatedDescription);
  });

  test('опубликованное достижение отправляется на модерацию после правки @regression', async ({
    authenticatedPage,
  }) => {
    const approvedAchievement = await createAchievementRecord('approved', {
      description: `Опубликованное достижение ${Date.now()}`,
      yearOffset: 15,
    });

    const managePage = new ManagePage(authenticatedPage);
    await managePage.goto();
    await managePage.switchTab('achievements');
    await managePage.searchInTab('achievements', approvedAchievement.description);

    await expect(managePage.getItemCardById(approvedAchievement.id)).toBeVisible({ timeout: 20000 });
    const modal = await managePage.openEditModalById(approvedAchievement.id, { type: 'achievement' });
    const updatedDescription = `${approvedAchievement.description} → новая версия`;
    await modal.getByLabel(/Описание/i).fill(updatedDescription);
    await modal.getByRole('button', { name: /Отправить на модерацию/i }).click({ force: true });

    await managePage.expectToast(/Изменения отправлены на модерацию/i);
  });

  test('черновик периода можно обновить через модалку редактирования @regression', async ({
    authenticatedPage,
  }) => {
    const draftPeriod = await createPeriodRecord('draft', {
      description: `Черновой период ${Date.now()}`,
      offset: 3,
    });

    const managePage = new ManagePage(authenticatedPage);
    await managePage.goto();
    await managePage.switchTab('periods');
    await managePage.openMineSection();

    await expect(managePage.getItemCardById(draftPeriod.id)).toBeVisible({ timeout: 20000 });
    const modal = await managePage.openEditModalById(draftPeriod.id, { type: 'period' });

    await expect(
      modal.getByTestId('period-person-select').getByRole('button', { name: seededPerson.name })
    ).toBeVisible();
    const newName = `Название периода ${Date.now()}`;
    const newDescription = `${draftPeriod.comment ?? ''} — обновлено`;
    const newStartYear = draftPeriod.startYear + 1;
    const newEndYear = draftPeriod.endYear + 1;

    await modal.getByLabel(/Название периода/i).fill(newName);
    await modal.getByLabel(/Описание периода/i).fill(newDescription);
    await modal.getByLabel(/Год начала/i).fill(String(newStartYear));
    await modal.getByLabel(/Год окончания/i).fill(String(newEndYear));
    await modal.getByRole('button', { name: /Сохранить как черновик/i }).click();

    await managePage.expectToast(/Черновик сохранен/i);
    await expect(modal).toBeHidden({ timeout: 10000 });
  });

  test('опубликованный период можно отправить на модерацию после редактирования @regression', async ({
    authenticatedPage,
  }) => {
    const approvedPeriod = await createPeriodRecord('approved', {
      description: `Опубликованный период ${Date.now()}`,
      offset: 25,
    });

    const managePage = new ManagePage(authenticatedPage);
    await managePage.goto();
    await managePage.switchTab('periods');
    await managePage.openMineSection();
    await managePage.searchInTab('periods', seededPerson.name);

    await expect(managePage.getItemCardById(approvedPeriod.id)).toBeVisible({ timeout: 20000 });
    const modal = await managePage.openEditModalById(approvedPeriod.id, { type: 'period' });

    const newName = `Обновленный период ${Date.now()}`;
    const newDescription = `${approvedPeriod.comment ?? ''} → запрос правки`;
    await modal.getByLabel(/Название периода/i).fill(newName);
    await modal.getByLabel(/Описание периода/i).fill(newDescription);
    await modal.getByRole('button', { name: /Отправить на модерацию/i }).click({ force: true });

    await managePage.expectToast(/Изменения отправлены на модерацию/i);
  });
});

