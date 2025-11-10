import { test, expect } from '../fixtures/auth-fixtures';
import { LeaderboardPage } from '../pages/LeaderboardPage';
import { withLeaderboardData } from '../utils/leaderboard-fixtures';
import { DEFAULT_TEST_USER } from '../helpers/auth-helper';

const NOW = new Date();

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

test.describe('Глобальный лидерборд @regression', () => {
  test('отображает топ игроков и общее количество', async ({ authenticatedPage }) => {
    await withLeaderboardData({
      users: [
        { email: 'leaderboard-e2e-alpha@test.com', username: 'Игрок А' },
        { email: 'leaderboard-e2e-beta@test.com', username: 'Игрок Б' },
        { email: DEFAULT_TEST_USER.email, username: DEFAULT_TEST_USER.username },
      ],
      attempts: [
        {
          email: 'leaderboard-e2e-alpha@test.com',
          correctAnswers: 9,
          totalQuestions: 10,
          totalTimeMs: 55_000,
          ratingPoints: 5000,
          createdAt: daysAgo(1),
        },
        {
          email: 'leaderboard-e2e-beta@test.com',
          correctAnswers: 8,
          totalQuestions: 10,
          totalTimeMs: 65_000,
          ratingPoints: 4500,
          createdAt: daysAgo(2),
        },
        {
          email: DEFAULT_TEST_USER.email,
          correctAnswers: 6,
          totalQuestions: 10,
          totalTimeMs: 80_000,
          ratingPoints: 4000,
          createdAt: daysAgo(3),
        },
      ],
    }, async () => {
      const leaderboardPage = new LeaderboardPage(authenticatedPage);
      await leaderboardPage.goto();
      await leaderboardPage.waitForEntries();

      const usernames = await leaderboardPage.getDisplayedUsernames();
      expect(usernames.slice(0, 3)).toEqual([
        'Игрок А',
        'Игрок Б',
        DEFAULT_TEST_USER.username,
      ]);

      await leaderboardPage.expectSortedByRating();
      const totalPlayers = await leaderboardPage.getTotalPlayers();
      expect(totalPlayers).toBeGreaterThanOrEqual(3);
      await leaderboardPage.expectCurrentUserHighlighted();
      await leaderboardPage.expectUserEntryRank(3);
      await leaderboardPage.expectUserLabel();
    });
  });

  test('пагинация переключает страницы', async ({ authenticatedPage }) => {
    const suffix = Date.now();
    const players = Array.from({ length: 60 }, (_, index) => ({
      email: `leaderboard-e2e-page-${suffix}-${index}@test.com`,
      username: `Игрок ${index + 1} ${suffix}`,
      ratingPoints: 2000 - index * 10,
    }));

    await withLeaderboardData({
      users: [
        ...players.map(({ email, username }) => ({ email, username })),
        { email: DEFAULT_TEST_USER.email, username: DEFAULT_TEST_USER.username },
      ],
      attempts: [
        {
          email: DEFAULT_TEST_USER.email,
          correctAnswers: 10,
          totalQuestions: 10,
          totalTimeMs: 20_000,
          ratingPoints: 2600,
          createdAt: daysAgo(0),
        },
        ...players.map(({ email, ratingPoints }, index) => ({
          email,
          correctAnswers: 10,
          totalQuestions: 10,
          totalTimeMs: 30_000 + index * 200,
          ratingPoints,
          createdAt: daysAgo(index % 14),
        })),
      ],
    }, async () => {
      const leaderboardPage = new LeaderboardPage(authenticatedPage);
      await leaderboardPage.goto();
      await leaderboardPage.waitForEntries();

      await leaderboardPage.expectPageIndicator(1);
      await leaderboardPage.expectCurrentUserHighlighted();
      await leaderboardPage.expectUserEntryRank(1);
      await leaderboardPage.expectUserLabel();
      expect(await leaderboardPage.getEntryCount()).toBeLessThanOrEqual(30);

      await leaderboardPage.goToNextPage(30);
      await leaderboardPage.expectPageIndicator(2);
      await leaderboardPage.waitForEntries();
      const secondPageRanks = await leaderboardPage.getRanks();
      expect(secondPageRanks[0]).toBe(31);
      expect(secondPageRanks).toContain(1);
      await expect(leaderboardPage.divider).toBeVisible();

      await leaderboardPage.goToNextPage(60);
      await leaderboardPage.expectPageIndicator(3);
      await leaderboardPage.waitForEntries();
      const thirdPageRanks = await leaderboardPage.getRanks();
      expect(thirdPageRanks[0]).toBe(61);
      const thirdPageUsernames = await leaderboardPage.getDisplayedUsernames();
      expect(thirdPageRanks).toContain(1);
      expect(thirdPageUsernames.length).toBeGreaterThan(0);
    });
  });

  test('выносит текущего пользователя вне текущей страницы', async ({ authenticatedPage }) => {
    const suffix = Date.now();
    const players = Array.from({ length: 120 }, (_, index) => ({
      email: `leaderboard-e2e-overflow-${suffix}-${index}@test.com`,
      username: `Игрок ${index + 1} ${suffix}`,
      ratingPoints: 2500 - index * 5,
    }));

    await withLeaderboardData({
      users: [
        ...players.map(({ email, username }) => ({ email, username })),
        { email: DEFAULT_TEST_USER.email, username: DEFAULT_TEST_USER.username },
      ],
      attempts: [
        ...players.map(({ email, ratingPoints }, index) => ({
          email,
          correctAnswers: 10,
          totalQuestions: 10,
          totalTimeMs: 28_000 + index * 150,
          ratingPoints,
          createdAt: daysAgo(index % 10),
        })),
        {
          email: DEFAULT_TEST_USER.email,
          correctAnswers: 4,
          totalQuestions: 10,
          totalTimeMs: 120_000,
          ratingPoints: 100,
          createdAt: daysAgo(1),
        },
      ],
    }, async () => {
      const leaderboardPage = new LeaderboardPage(authenticatedPage);
      await leaderboardPage.goto();
      await leaderboardPage.waitForEntries();

      const entryCount = await leaderboardPage.getEntryCount();
      expect(entryCount).toBeGreaterThanOrEqual(31);
      await leaderboardPage.expectCurrentUserHighlighted();
      await leaderboardPage.expectUserEntryRank(121);
      await leaderboardPage.expectUserLabel();
      await expect(leaderboardPage.divider).toBeVisible();
    });
  });

  test('показывает пустое состояние при отсутствии данных', async ({ page }) => {
    await withLeaderboardData({ attempts: [] }, async () => {
      const leaderboardPage = new LeaderboardPage(page);
      await leaderboardPage.goto();
      await leaderboardPage.expectEmptyState();
    });
  });

  test('отображает ошибку загрузки и позволяет повторить запрос', async ({ page }) => {
    await withLeaderboardData({ attempts: [] }, async () => {
      await page.addInitScript(() => {
        const originalFetch = window.fetch.bind(window);
        (window as any).__E2E_FORCE_LEADERBOARD__ = 'error';

        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input.toString();

          if (url.includes('/api/quiz/leaderboard')) {
            const mode = (window as any).__E2E_FORCE_LEADERBOARD__;
            if (mode === 'error') {
              return new Response(JSON.stringify({ success: false, error: 'fail' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              });
            }

            if (mode === 'success') {
              return new Response(
                JSON.stringify({
                  success: true,
                  data: {
                    topPlayers: [],
                    userEntry: null,
                    totalPlayers: 0,
                    page: { limit: 30, offset: 0, hasMore: false },
                  },
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            }
          }

          return originalFetch(input, init);
        };
      });

      const leaderboardPage = new LeaderboardPage(page);
      await leaderboardPage.goto();
      await page.waitForTimeout(500);
      await expect(page.locator('.leaderboard-container')).toContainText('Ошибка загрузки', {
        timeout: 15000,
      });

      await page.evaluate(() => {
        (window as any).__E2E_FORCE_LEADERBOARD__ = 'success';
      });

      await page.getByTestId('leaderboard-error-retry').click();
      await leaderboardPage.expectEmptyState();
    });
  });
});


