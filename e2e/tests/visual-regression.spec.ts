import { test } from '../fixtures/auth-fixtures';
import type { Page } from '@playwright/test';
import {
  expectPageSnapshot,
  expectElementSnapshot,
  expectStableSnapshot,
  expectModalSnapshot,
  expectResponsiveSnapshots,
  preparePageForSnapshot,
  waitForImages,
  createBaselineSnapshot,
} from '../helpers/visual-regression';
import { TimelinePage } from '../pages/TimelinePage';
import { QuizPage } from '../pages/QuizPage';
import { ListsPage } from '../pages/ListsPage';
import { LoginPage } from '../pages/LoginPage';

const QUESTION_TYPE_LABELS = {
  birthYear: 'Угадай год рождения',
  deathYear: 'Угадай год смерти',
  profession: 'Угадай род деятельности',
  country: 'Угадай страну рождения',
  achievementsMatch: 'Сопоставь достижения',
  birthOrder: 'Расставь по году рождения',
  contemporaries: 'Раздели на группы современников',
  guessPerson: 'Угадай личность по характеристикам',
} as const;

const QUIZ_QUESTION_SCENARIOS = [
  { id: 'birth-year', label: QUESTION_TYPE_LABELS.birthYear },
  { id: 'death-year', label: QUESTION_TYPE_LABELS.deathYear },
  { id: 'profession', label: QUESTION_TYPE_LABELS.profession },
  { id: 'country', label: QUESTION_TYPE_LABELS.country },
  { id: 'achievements', label: QUESTION_TYPE_LABELS.achievementsMatch },
  { id: 'birth-order', label: QUESTION_TYPE_LABELS.birthOrder },
  { id: 'contemporaries', label: QUESTION_TYPE_LABELS.contemporaries },
  { id: 'guess-person', label: QUESTION_TYPE_LABELS.guessPerson },
] as const;

test.describe('Visual Regression @visual', () => {
  const quizPersons = Array.from({ length: 12 }).map((_, index) => ({
    id: `quiz-person-${index + 1}`,
    name: `Тестовая личность ${index + 1}`,
    birthYear: 1800 + index,
    deathYear: 1850 + index,
    category: index % 2 === 0 ? 'scientists' : 'politicians',
    country: index % 3 === 0 ? 'Россия' : 'Германия',
    description: 'E2E persona',
    imageUrl: null,
    achievements: ['Achievement'],
    achievements_wiki: [],
    status: 'approved',
  }));

  async function stubQuizData(page: Page) {
    await page.addInitScript(({ persons, categories, countries }) => {
      (window as any).__E2E_QUIZ_PERSONS__ = persons;
      (window as any).__E2E_QUIZ_CATEGORIES__ = categories;
      (window as any).__E2E_QUIZ_COUNTRIES__ = countries;

      const normalizeUrl = (input: RequestInfo | URL) => {
        if (typeof input === 'string') return input;
        if (input instanceof URL) return input.toString();
        if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
        return String(input);
      };

      const shouldMock = (url: string, path: string) => {
        try {
          const full = new URL(url, window.location.origin);
          return full.pathname.startsWith(path);
        } catch {
          return url.includes(path);
        }
      };

      const createResponse = (body: unknown) =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = normalizeUrl(input);
        if (shouldMock(url, '/api/persons')) {
          console.debug('[visual-stub] fetch persons', url);
          return createResponse(persons);
        }
        if (shouldMock(url, '/api/categories')) {
          console.debug('[visual-stub] fetch categories', url);
          return createResponse(categories);
        }
        if (shouldMock(url, '/api/countries')) {
          console.debug('[visual-stub] fetch countries', url);
          return createResponse(countries);
        }
        return originalFetch(input, init);
      };

    }, {
      persons: quizPersons,
      categories: ['scientists', 'politicians', 'writers'],
      countries: ['Россия', 'Германия', 'США', 'Франция', 'Великобритания', 'Польша'],
    });
  }

  test.beforeEach(async ({ page }) => {
    // Отключаем анимации для стабильных снапшотов
    await page.addInitScript(() => {
      document.documentElement.style.setProperty('--animation-duration', '0s');
      document.documentElement.style.setProperty('--transition-duration', '0s');
    });
  });

  test('Timeline - пустое состояние @smoke', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    // Ждём загрузку
    await page.waitForLoadState('networkidle');
    await waitForImages(page);

    await createBaselineSnapshot(page, {
      name: 'timeline-empty',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('Timeline - с данными', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    await page.waitForLoadState('networkidle');
    await waitForImages(page);

    // Маскируем динамические элементы (даты, счётчики)
    await expectStableSnapshot(page, {
      name: 'timeline-with-data',
      maskSelectors: ['[data-testid*="date"]', '[data-testid*="time"]'],
      maxDiffPixelRatio: 0.02,
    });
  });

  test('Timeline - с применёнными фильтрами', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    // Применяем фильтр
    const filterButton = page.locator('[data-testid="filter-button"]');
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(300);

      // Выбираем фильтр
      const firstFilter = page.locator('[data-testid="filter-option"]').first();
      if (await firstFilter.isVisible()) {
        await firstFilter.click();
        await page.waitForTimeout(500);
      }
    }

    await waitForImages(page);
    await expectStableSnapshot(page, {
      name: 'timeline-filtered',
      maxDiffPixelRatio: 0.03,
    });
  });

  test('PersonPanel - открытая панель', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    // Кликаем на первую карточку
    const personCard = page.locator('[data-testid="person-card"]').first();
    if (await personCard.isVisible()) {
      await personCard.click();
      await page.waitForTimeout(500);

      // Снапшот панели
      const panel = page.locator('[data-testid="person-panel"]');
      await waitForImages(page);

      await expectElementSnapshot(panel, {
        name: 'person-panel-open',
        maxDiffPixelRatio: 0.02,
      });
    }
  });

  test('Quiz - стартовый экран @smoke', async ({ page }) => {
    const quizPage = new QuizPage(page);
    await stubQuizData(page);
    await quizPage.goto();

    await page.waitForLoadState('networkidle');

    await createBaselineSnapshot(page, {
      name: 'quiz-start',
      maxDiffPixelRatio: 0.01,
    });
  });

  for (const scenario of QUIZ_QUESTION_SCENARIOS) {
    test(`Quiz - вопрос (${scenario.id})`, async ({ page }) => {
      const quizPage = new QuizPage(page);
      await stubQuizData(page);
      await quizPage.goto();

      await quizPage.startQuiz({
        questionCount: 5,
        questionTypes: [scenario.label],
      });
      await quizPage.questionContainer.waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(300);

      await expectStableSnapshot(page, {
        name: `quiz-question-${scenario.id}`,
        maskSelectors: ['[data-testid="timer"]', '[data-testid="question-counter"]'],
        maxDiffPixelRatio: 0.02,
      });
    });
  }

  test('Quiz - экран результатов', async ({ page }) => {
    const quizPage = new QuizPage(page);
    await stubQuizData(page);
    await quizPage.goto();

    // Быстро проходим квиз
    await quizPage.startQuiz({
      questionCount: 3,
      questionTypes: [QUESTION_TYPE_LABELS.birthYear],
    });
    await quizPage.completeQuizQuickly(3);
    await page.waitForTimeout(500);

    // Маскируем время и счёт (может меняться)
    await expectStableSnapshot(page, {
      name: 'quiz-results',
      maskSelectors: ['[data-testid="score"]', '[data-testid="completion-time"]'],
      maxDiffPixelRatio: 0.03,
    });
  });

  test('Lists - пустой список', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    await listsPage.goto();

    const originalViewport = authenticatedPage.viewportSize();
    await authenticatedPage.setViewportSize({ width: 1280, height: 775 });
    await authenticatedPage.waitForLoadState('networkidle');

    await createBaselineSnapshot(authenticatedPage, {
      name: 'lists-empty',
      fullPage: false,
      maxDiffPixelRatio: 0.01,
    });

    if (originalViewport) {
      await authenticatedPage.setViewportSize(originalViewport);
    }
  });

  test('Lists - список с элементами', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    await listsPage.goto();

    const originalViewport = authenticatedPage.viewportSize();
    await authenticatedPage.setViewportSize({ width: 1280, height: 775 });
    await authenticatedPage.waitForLoadState('networkidle');

    await expectStableSnapshot(authenticatedPage, {
      name: 'lists-with-items',
      maskSelectors: ['[data-testid*="date"]'],
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });

    if (originalViewport) {
      await authenticatedPage.setViewportSize(originalViewport);
    }
  });

  test('Login - форма входа', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await page.waitForLoadState('networkidle');

    await createBaselineSnapshot(page, {
      name: 'login-form',
      maxDiffPixelRatio: 0.01,
    });
  });

  test('Login - форма с ошибкой', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Вводим неправильные данные
    await loginPage.login('wrong@test.com', 'wrong');
    await page.waitForTimeout(500);

    await createBaselineSnapshot(page, {
      name: 'login-error',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('Responsive - Timeline Desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();
    await page.waitForLoadState('networkidle');
    await waitForImages(page);

    await expectStableSnapshot(page, {
      name: 'timeline-desktop',
      maskSelectors: ['.timeline-background', '.timeline-content'],
      maxDiffPixelRatio: 0.02,
    });
  });

  test('Responsive - Timeline Tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();
    await page.waitForLoadState('networkidle');
    await waitForImages(page);

    await expectStableSnapshot(page, {
      name: 'timeline-tablet',
      maxDiffPixelRatio: 0.03,
    });
  });

  test('Responsive - Timeline Mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();
    await page.waitForLoadState('networkidle');
    await waitForImages(page);

    await expectStableSnapshot(page, {
      name: 'timeline-mobile',
      maxDiffPixelRatio: 0.03,
    });
  });

  test('Responsive - Quiz Mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const quizPage = new QuizPage(page);
    await quizPage.goto();
    await page.waitForLoadState('networkidle');

    await createBaselineSnapshot(page, {
      name: 'quiz-mobile',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('Modal - создание списка', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    await listsPage.goto();

    // Открываем модалку
    const createButton = authenticatedPage.locator('[data-testid="create-list"]');
    if (await createButton.isVisible()) {
      await createButton.click();
      await authenticatedPage.waitForTimeout(300);

      const modal = authenticatedPage.locator('[data-testid="list-modal"]');
      await expectModalSnapshot(authenticatedPage, modal, {
        name: 'modal-create-list',
        maxDiffPixelRatio: 0.02,
      });
    }
  });

  test('Header - авторизованный пользователь', async ({ authenticatedPage }) => {
    const timelinePage = new TimelinePage(authenticatedPage);
    await timelinePage.goto();

    const header = authenticatedPage.locator('header, [data-testid="header"]');
    await waitForImages(authenticatedPage);

    await expectElementSnapshot(header, {
      name: 'header-authenticated',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('Header - гость', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    const header = page.locator('header, [data-testid="header"]');
    await waitForImages(page);

    await expectElementSnapshot(header, {
      name: 'header-guest',
      maxDiffPixelRatio: 0.01,
    });
  });

  test('PersonCard - hover состояние', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    const personCard = page.locator('[data-testid="person-card"]').first();
    if (await personCard.isVisible()) {
      await personCard.hover();
      await page.waitForTimeout(200);

      await expectElementSnapshot(personCard, {
        name: 'person-card-hover',
        maxDiffPixelRatio: 0.03,
      });
    }
  });

  test('Button - различные состояния', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Используем более гибкий локатор кнопки с fallback
    let button = page
      .locator(
        'button[type="submit"], button:has-text("Войти"), button:has-text("Login"), [data-testid="login-button"]'
      )
      .first();

    // Ждём появления кнопки или используем любую доступную кнопку
    try {
      await button.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      // Если кнопка не найдена, используем любую кнопку на странице
      button = page.locator('button').first();
      await button.waitFor({ state: 'visible', timeout: 5000 });
    }

    // Normal state
    await expectElementSnapshot(button, {
      name: 'button-normal',
      maxDiffPixelRatio: 0.01,
    });

    // Hover state
    await button.hover();
    await page.waitForTimeout(100);
    await expectElementSnapshot(button, {
      name: 'button-hover',
      maxDiffPixelRatio: 0.02,
    });

    // Focus state
    await button.focus();
    await page.waitForTimeout(100);
    await expectElementSnapshot(button, {
      name: 'button-focus',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('Dark mode - Timeline (если поддерживается)', async ({ page }) => {
    // Устанавливаем dark mode
    await page.emulateMedia({ colorScheme: 'dark' });

    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();
    await page.waitForLoadState('networkidle');
    await waitForImages(page);

    await expectStableSnapshot(page, {
      name: 'timeline-dark',
      maxDiffPixelRatio: 0.03,
    });
  });
});
