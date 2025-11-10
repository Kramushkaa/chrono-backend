import { test, expect } from '../fixtures/auth-fixtures';
import type { Route } from '@playwright/test';
import { ManagePage } from '../pages/ManagePage';
import { createTestPerson, createTestAchievement, createTestPeriod } from '../utils/test-data-factory';
import { loginUser, DEFAULT_TEST_USER } from '../helpers/auth-helper';
import { createTestPool } from '../utils/db-reset';
import type { AuthTokens } from '../types';

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

interface SeededPerson {
  id: string;
  name: string;
}

type LifePeriodRow = {
  start_year: number;
  end_year: number;
  country_id: number | null;
};

let seededPerson: SeededPerson;
let apiTokens: AuthTokens;
let currentUserId: number;
let countriesSeedPromise: Promise<void> | null = null;

async function ensureCountriesSeeded(): Promise<void> {
  if (!countriesSeedPromise) {
    countriesSeedPromise = (async () => {
      const pool = createTestPool();
      try {
        await pool.query(
          `INSERT INTO countries (id, name)
           VALUES 
             (1, 'Россия'),
             (2, 'США'),
             (3, 'Германия'),
             (4, 'Великобритания'),
             (5, 'Франция'),
             (6, 'Польша'),
             (7, 'Мексика'),
             (8, 'Сербия'),
             (9, 'Египет'),
             (10, 'Индия')
           ON CONFLICT (id) DO NOTHING`
        );
        await pool.query(
          `DO $$
          DECLARE seq text;
          BEGIN
            SELECT pg_get_serial_sequence('test.countries', 'id') INTO seq;
            IF seq IS NOT NULL THEN
              EXECUTE format(
                'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(id) FROM test.countries), 1), 1))',
                seq
              );
            END IF;
          END;
          $$;`
        );
      } finally {
        await pool.end();
      }
    })().catch(error => {
      countriesSeedPromise = null;
      throw error;
    });
  }
  await countriesSeedPromise;
}

test.describe('Проверка записей в БД при управлении контентом @regression @db', () => {
  test.beforeEach(async ({ moderatorPage }) => {
    await ensureCountriesSeeded();

    const loginResult = await loginUser(DEFAULT_TEST_USER);
    if (!loginResult.success || !loginResult.tokens || !loginResult.user?.id) {
      throw new Error('Не удалось получить токены для manage-db');
    }

    apiTokens = loginResult.tokens;
    currentUserId = Number(loginResult.user.id);

    const basePerson = {
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
        Authorization: `Bearer ${apiTokens.accessToken}`,
      },
      body: JSON.stringify(basePerson),
    });

    const option = { value: basePerson.id, label: basePerson.name };
    await moderatorPage.addInitScript(
      ({ o }) => {
        (window as any).__E2E_PERSON_OPTIONS__ = [o];
        (window as any).__E2E_DEFAULT_PERSON__ = o.value;
      },
      { o: option }
    );

    await moderatorPage.route('**/api/categories', route => fulfillJson(route, stubCategoriesResponse));
    await moderatorPage.route('**/api/countries', route => fulfillJson(route, stubCountriesResponse));
    await moderatorPage.route('**/api/countries/options', route => fulfillJson(route, stubCountryOptionsResponse));

    seededPerson = { id: basePerson.id, name: basePerson.name };
  });

  test('создание личности сохраняет запись и периоды жизни в БД @regression @db', async ({
    moderatorPage,
  }) => {
    const managePage = new ManagePage(moderatorPage);
    const person = createTestPerson();

    await managePage.goto();
    await managePage.switchTab('persons');
    await managePage.createPerson(person);
    await managePage.expectPersonCreated();

    const pool = createTestPool();
    try {
      const personRow = await pool.query(
        `SELECT id, name, birth_year, death_year, created_by
         FROM persons
         WHERE created_by = $1 AND name = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [currentUserId, person.name]
      );

      expect(personRow.rowCount).toBe(1);
      const dbPerson = personRow.rows[0];
      expect(dbPerson.created_by).toBe(currentUserId);
      expect(dbPerson.name).toBe(person.name);

      const periodsRes = await pool.query<LifePeriodRow>(
        `SELECT start_year, end_year, country_id
         FROM periods
         WHERE person_id = $1 AND period_type = 'life'
         ORDER BY start_year`,
        [dbPerson.id]
      );

      expect(periodsRes.rowCount).toBeGreaterThan(0);

      const birthYear: number = Number(dbPerson.birth_year);
      const deathYear: number = Number(dbPerson.death_year);
      const periods = periodsRes.rows;

      // Каждый период должен иметь страну
      for (const p of periods) {
        expect(p.country_id).not.toBeNull();
        expect(p.end_year).toBeGreaterThanOrEqual(p.start_year);
      }

      // Периоды должны покрывать весь промежуток жизни без существенных разрывов
      const firstPeriod = periods[0];
      const lastPeriod = periods[periods.length - 1];

      expect(firstPeriod.start_year).toBeLessThanOrEqual(birthYear);
      expect(lastPeriod.end_year).toBeGreaterThanOrEqual(deathYear);

      let coverageEnd = firstPeriod.end_year;
      for (let i = 1; i < periods.length; i++) {
        const current = periods[i];
        expect(current.start_year).toBeLessThanOrEqual(coverageEnd + 1);
        coverageEnd = Math.max(coverageEnd, current.end_year);
      }

      expect(coverageEnd).toBeGreaterThanOrEqual(deathYear);
    } finally {
      await pool.end();
    }
  });

  test('создание достижения фиксируется в таблице achievements @regression @db', async ({
    moderatorPage,
  }) => {
    const managePage = new ManagePage(moderatorPage);
    const achievement = createTestAchievement();

    await managePage.goto();
    await managePage.switchTab('achievements');
    await managePage.createAchievement(achievement, { personSearch: seededPerson.name });

    const pool = createTestPool();
    try {
      const expectedDescription = achievement.description ?? achievement.title;
      const achievementRow = await pool.query(
        `SELECT description, created_by, person_id
         FROM achievements
         WHERE created_by = $1 AND person_id = $2 AND description = $3
         ORDER BY created_at DESC
         LIMIT 1`,
        [currentUserId, seededPerson.id, expectedDescription]
      );

      expect(achievementRow.rowCount).toBe(1);
      const dbAchievement = achievementRow.rows[0];
      expect(dbAchievement.created_by).toBe(currentUserId);
      expect(dbAchievement.person_id).toBe(seededPerson.id);
      expect(dbAchievement.description).toBe(expectedDescription);
    } finally {
      await pool.end();
    }
  });

  test('создание периода добавляет запись о периоде в БД @regression @db', async ({
    moderatorPage,
  }) => {
    const managePage = new ManagePage(moderatorPage);
    const period = createTestPeriod();

    await managePage.goto();
    await managePage.switchTab('periods');
    await managePage.createPeriod(period, { personSearch: seededPerson.name });

    const pool = createTestPool();
    try {
      const periodRow = await pool.query(
        `SELECT start_year, end_year, created_by, person_id
         FROM periods
         WHERE created_by = $1 AND person_id = $2 AND start_year = $3
         ORDER BY created_at DESC
         LIMIT 1`,
        [currentUserId, seededPerson.id, period.start_year]
      );

      expect(periodRow.rowCount).toBe(1);
      const dbPeriod = periodRow.rows[0];
      expect(dbPeriod.created_by).toBe(currentUserId);
      expect(dbPeriod.person_id).toBe(seededPerson.id);
      expect(Number(dbPeriod.start_year)).toBe(period.start_year);
      expect(Number(dbPeriod.end_year)).toBe(period.end_year ?? period.start_year + 5);
    } finally {
      await pool.end();
    }
  });
});
