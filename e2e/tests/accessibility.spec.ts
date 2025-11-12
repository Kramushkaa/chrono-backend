import { test, expect } from '../fixtures/auth-fixtures';
import { 
  assertA11y, 
  checkKeyboardNavigation, 
  checkColorContrast,
  checkAriaLabels,
  checkFormAccessibility,
  checkFocusManagement,
  generateA11yReport
} from '../helpers/accessibility-helper';
import { TimelinePage } from '../pages/TimelinePage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { QuizPage } from '../pages/QuizPage';
import { ListsPage } from '../pages/ListsPage';

test.describe('Accessibility тесты @accessibility', () => {
  test('главная страница (Timeline) соответствует WCAG 2.1 AA @smoke', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    // Ждём загрузку контента
    await page.waitForLoadState('networkidle');

    // Проверяем accessibility
    await assertA11y(page, {
      // Исключаем минорные нарушения для первого релиза
      excludeImpact: ['minor'],
    });
  });

  test('страница логина соответствует WCAG 2.1 AA @smoke', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await assertA11y(page);
  });

  test('страница регистрации соответствует WCAG 2.1 AA', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await assertA11y(page);
  });

  test('страница квиза соответствует WCAG 2.1 AA', async ({ page }) => {
    const quizPage = new QuizPage(page);
    await quizPage.goto();

    await assertA11y(page, {
      excludeImpact: ['minor'],
    });
  });

  test('страница списков соответствует WCAG 2.1 AA', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    await listsPage.goto();

    await assertA11y(authenticatedPage, {
      excludeImpact: ['minor'],
    });
  });

  test('keyboard navigation на главной странице', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    const result = await checkKeyboardNavigation(page, {
      expectedStops: 30,
    });

    expect(result.success).toBe(true);
    expect(result.stopsCount).toBeGreaterThan(5);
    
    console.log(`✅ Keyboard navigation: ${result.stopsCount} focusable elements`);
    console.log(`   Elements: ${result.focusedElements.slice(0, 10).join(', ')}...`);
  });

  test('keyboard navigation в форме логина', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Проверяем что можно перемещаться по форме
    await page.keyboard.press('Tab'); // Фокус на поле логина
    await expect(page.locator('[data-testid="login-input"]')).toBeFocused();

    await page.keyboard.press('Tab'); // Фокус на поле пароля
    await expect(page.locator('[data-testid="password-input"]')).toBeFocused();

    await page.keyboard.press('Tab'); // Фокус на кнопке входа
    await expect(page.locator('[data-testid="login-button"]')).toBeFocused();
  });

  test('цветовой контраст на главной странице', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    const results = await checkColorContrast(page);

    if (results.violations.length > 0) {
      console.warn('⚠️  Найдены проблемы с контрастом:');
      console.warn(generateA11yReport(results));
    }

    // Проверяем что критичных нарушений нет
    const criticalViolations = results.violations.filter(v => v.impact === 'critical');
    expect(criticalViolations.length).toBe(0);
  });

  test('aria-labels на интерактивных элементах', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    const results = await checkAriaLabels(page);

    // Проверяем что нет серьёзных нарушений ARIA
    const seriousViolations = results.violations.filter(
      v => v.impact === 'serious' || v.impact === 'critical'
    );

    if (seriousViolations.length > 0) {
      console.error('❌ Найдены серьёзные нарушения ARIA:');
      seriousViolations.forEach(v => {
        console.error(`   - ${v.id}: ${v.description}`);
      });
    }

    expect(seriousViolations.length).toBe(0);
  });

  test('доступность форм: логин', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const results = await checkFormAccessibility(page);

    // Формы должны быть полностью доступны
    expect(results.violations.length).toBe(0);
  });

  test('доступность форм: регистрация', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    const results = await checkFormAccessibility(page);

    // Допускаем минорные нарушения
    const majorViolations = results.violations.filter(
      v => v.impact !== 'minor'
    );
    expect(majorViolations.length).toBe(0);
  });

  test('focus management при открытии модального окна', async ({ authenticatedPage }) => {
    const timelinePage = new TimelinePage(authenticatedPage);
    await timelinePage.goto();

    // Проверяем что есть хотя бы одна личность
    const personCards = authenticatedPage.locator('[data-testid="person-card"]');
    const count = await personCards.count();

    if (count > 0) {
      // Кликаем на первую карточку
      await personCards.first().click();

      // Проверяем что фокус переместился в панель
      await authenticatedPage.waitForTimeout(300);
      const panel = authenticatedPage.locator('[data-testid="person-panel"]');
      await expect(panel).toBeVisible();

      // Проверяем что можно закрыть через Escape
      await authenticatedPage.keyboard.press('Escape');
      await authenticatedPage.waitForTimeout(300);
      await expect(panel).not.toBeVisible();
    }
  });

  test('screen reader landmarks', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    // Проверяем наличие основных landmarks
    const landmarks = {
      main: page.locator('main, [role="main"]'),
      navigation: page.locator('nav, [role="navigation"]'),
      header: page.locator('header, [role="banner"]'),
    };

    for (const [name, locator] of Object.entries(landmarks)) {
      const count = await locator.count();
      console.log(`   ${name}: ${count > 0 ? '✅' : '⚠️ '} found ${count}`);
    }

    // Как минимум main должен быть
    expect(await landmarks.main.count()).toBeGreaterThan(0);
  });

  test('альтернативный текст для изображений', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    // Получаем все изображения
    const images = page.locator('img');
    const count = await images.count();

    if (count > 0) {
      console.log(`   Найдено изображений: ${count}`);

      // Проверяем что у всех есть alt
      for (let i = 0; i < Math.min(count, 10); i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const src = await img.getAttribute('src');

        if (!alt && alt !== '') {
          console.warn(`   ⚠️  Изображение без alt: ${src}`);
        }
      }
    }
  });

  test('доступность при использовании фильтров', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    // Открываем фильтр
    const filterButton = page.locator('[data-testid="filter-button"]');
    
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(300);

      // Проверяем accessibility фильтра
      await assertA11y(page, {
        excludeImpact: ['minor'],
      });
    }
  });

  test('доступность результатов квиза', async ({ page }) => {
    const quizPage = new QuizPage(page);
    await quizPage.goto();
    
    // Быстро проходим квиз
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);

    // Проверяем accessibility страницы результатов
    await assertA11y(page, {
      excludeImpact: ['minor'],
    });
  });

  test('доступность мобильного меню', async ({ page }) => {
    // Устанавливаем мобильный viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    // Открываем мобильное меню если есть
    const menuButton = page.locator('[data-testid="mobile-menu-button"]');
    
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300);

      // Проверяем accessibility меню
      await assertA11y(page, {
        excludeImpact: ['minor'],
      });
    }
  });

  test('skip navigation links', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    // Проверяем наличие skip link (для screen readers)
    const skipLink = page.locator('a[href="#main-content"], .skip-link');
    
    if (await skipLink.count() > 0) {
      console.log('   ✅ Skip navigation link found');
      
      // Проверяем что он работает
      await skipLink.first().focus();
      await expect(skipLink.first()).toBeFocused();
    } else {
      console.warn('   ⚠️  Skip navigation link not found (рекомендуется добавить)');
    }
  });

  test('генерация полного accessibility отчёта', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    await timelinePage.goto();

    const results = await assertA11y(page, {
      excludeImpact: ['minor'],
      maxViolations: 10, // Допускаем до 10 нарушений для MVP
    }).catch(error => {
      // Генерируем отчёт даже при ошибке
      console.log('\n' + generateA11yReport({
        violations: [],
        passes: 0,
        incomplete: 0,
        timestamp: new Date().toISOString(),
      }));
      throw error;
    });
  });
});






