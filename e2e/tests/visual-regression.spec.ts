import { test } from '../fixtures/auth-fixtures';
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

test.describe('Visual Regression @visual', () => {
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
    await quizPage.goto();

    await page.waitForLoadState('networkidle');

    await createBaselineSnapshot(page, {
      name: 'quiz-start',
      maxDiffPixelRatio: 0.01,
    });
  });

  test('Quiz - экран вопроса', async ({ page }) => {
    const quizPage = new QuizPage(page);
    await quizPage.goto();

    // Отладочная информация
    console.log('🔍 Проверяем состояние страницы квиза...');

    // Проверяем, есть ли элементы настройки
    const questionCountButtons = page.locator(
      '.quiz-count-button, [data-testid="question-count-button"]'
    );
    const categoryCheckboxes = page.locator(
      '[data-testid="category-checkbox"], input[type="checkbox"]'
    );
    const startButton = page.locator('button:has-text("Начать"), button:has-text("Start")');

    console.log(`📊 Количество кнопок выбора вопросов: ${await questionCountButtons.count()}`);
    console.log(`📊 Количество чекбоксов категорий: ${await categoryCheckboxes.count()}`);
    console.log(`📊 Кнопка "Начать" найдена: ${(await startButton.count()) > 0}`);
    console.log(`📊 Кнопка "Начать" disabled: ${await startButton.evaluate(btn => btn.disabled)}`);

    // Делаем скриншот для отладки
    await page.screenshot({ path: 'debug-quiz-page.png' });
    console.log('📸 Скриншот сохранен как debug-quiz-page.png');

    // Запускаем квиз со всеми категориями и странами
    await quizPage.startQuiz({
      questionCount: 5,
      categories: ['politicians', 'scientists', 'writers'],
      countries: ['Россия', 'Германия', 'США', 'Франция', 'Великобритания', 'Польша'],
    });
    await page.waitForTimeout(500);

    // Маскируем таймер и счётчики
    await expectStableSnapshot(page, {
      name: 'quiz-question',
      maskSelectors: ['[data-testid="timer"]', '[data-testid="question-counter"]'],
      maxDiffPixelRatio: 0.02,
    });
  });

  test('Quiz - экран результатов', async ({ page }) => {
    const quizPage = new QuizPage(page);
    await quizPage.goto();

    // Быстро проходим квиз
    await quizPage.startQuiz({ questionCount: 3 });
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

    await authenticatedPage.waitForLoadState('networkidle');

    await createBaselineSnapshot(authenticatedPage, {
      name: 'lists-empty',
      maxDiffPixelRatio: 0.01,
    });
  });

  test('Lists - список с элементами', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    await listsPage.goto();

    // Создаём тестовый список
    const createButton = authenticatedPage.locator('[data-testid="create-list"]');
    if (await createButton.isVisible()) {
      await createButton.click();
      await authenticatedPage.waitForTimeout(300);

      // Заполняем форму
      await authenticatedPage.fill('[data-testid="list-name"]', 'Тестовый список');
      await authenticatedPage.click('[data-testid="submit-list"]');
      await authenticatedPage.waitForTimeout(500);
    }

    await expectStableSnapshot(authenticatedPage, {
      name: 'lists-with-items',
      maskSelectors: ['[data-testid*="date"]'],
      maxDiffPixelRatio: 0.02,
    });
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
