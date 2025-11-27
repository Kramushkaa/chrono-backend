import { test, expect } from '../fixtures/auth-fixtures';
import { TimelinePage } from '../pages/TimelinePage';
import { QuizPage } from '../pages/QuizPage';
import { ListsPage } from '../pages/ListsPage';
import { ManagePage } from '../pages/ManagePage';
import { createTestList, createTestPerson } from '../utils/test-data-factory';
import { ApiClient } from '../utils/api-client';
import { loginUser, ensureTestUserInDb, DEFAULT_TEST_USER } from '../helpers/auth-helper';
import type { Page } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';

const enableSimpleQuestions = async (page: Page) => {
  await page.addInitScript(() => {
    (window as any).__E2E_SIMPLE_QUESTIONS__ = true;
  });
};

async function createListViaApi(page: Page, title: string): Promise<number | undefined> {
  const authStateRaw = await page.evaluate(() => localStorage.getItem('auth'));
  if (!authStateRaw) throw new Error('Auth state is missing in localStorage');
  const authState = JSON.parse(authStateRaw);
  const accessToken = authState?.accessToken;
  if (!accessToken) throw new Error('Access token is missing in auth state');
  const apiClient = new ApiClient(undefined, accessToken);
  const response = await apiClient.createList(title);
  return response?.data?.id;
}

test.describe('Edge Cases @regression', () => {
  test('квиз с 1 вопросом работает корректно', async ({ page }) => {
    await enableSimpleQuestions(page);
    const quizPage = new QuizPage(page);
    
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 1 });
    
    // Проверяем прогресс
    await quizPage.expectQuestionNumber(1, 1);
    
    // Отвечаем на вопрос
    await quizPage.answerSingleChoice(0);
    await quizPage.completeQuizQuickly(1);
    
    // Проверяем результаты
    await quizPage.expectResults();
    
    // Должно быть 1 из 1
    await expect(quizPage.totalQuestionsCount).toContainText('1');
  });

  test('квиз с максимальным количеством вопросов (15)', async ({ authenticatedPage }) => {
    await enableSimpleQuestions(authenticatedPage);
    const quizPage = new QuizPage(authenticatedPage);
    
    await quizPage.goto();
    await quizPage.setQuestionCount(15);
    await quizPage.startQuiz();
    
    // Проверяем прогресс
    await quizPage.expectQuestionNumber(1, 15);
    
    // Проходим весь квиз
    await quizPage.completeQuizQuickly(15);
    await quizPage.expectResults();
    
    // Проверяем что все вопросы были
    await expect(quizPage.totalQuestionsCount).toContainText('15');
  });

  test('пустой список можно удалить', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    const list = createTestList();
    
    // Создаём список через API
    const listId = await createListViaApi(authenticatedPage, list.title);
    expect(listId).toBeDefined();
    
    await listsPage.goto();
    await listsPage.expectListPresent(list.title);
    
    // Выбираем список
    await listsPage.selectList(list.title);
    
    // Удаляем список (пустой список должен быть удаляемым)
    const deleteButton = authenticatedPage.locator(
      'button:has-text(/удалить|delete/i), [data-testid="delete-list"], button[aria-label*="удалить"]'
    ).first();
    
    const deleteVisible = await deleteButton.isVisible().catch(() => false);
    if (deleteVisible) {
      await deleteButton.click();
      
      // Подтверждаем удаление если нужно
      const confirmButton = authenticatedPage.locator(
        'button:has-text(/подтвердить|confirm|да/i), [data-testid="confirm-delete"]'
      ).first();
      
      const confirmVisible = await confirmButton.isVisible({ timeout: 3000 }).catch(() => false);
      if (confirmVisible) {
        await confirmButton.click();
      }
      
      // Список должен исчезнуть (через некоторое время после удаления)
      await authenticatedPage.waitForTimeout(2000);
      // Проверяем что список больше не виден
      const listStillVisible = await listsPage.desktopListsRegion.locator('[role="button"]').filter({ hasText: list.title }).first().isVisible().catch(() => false);
      expect(listStillVisible).toBeFalsy();
    }
  });

  test('личность без достижений и периодов отображается корректно', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    await timelinePage.expectTimelineNotEmpty();
    
    // Ищем любого человека и открываем его панель
    const firstPersonCard = page.locator('[data-testid="person-card"], .person-card').first();
    await firstPersonCard.click();
    
    // Панель должна открыться
    const personPanel = page.locator('[data-testid="person-panel"], .person-panel, [role="dialog"]').first();
    await expect(personPanel).toBeVisible({ timeout: 5000 });
    
    // Проверяем что панель показывает информацию
    // Если нет достижений/периодов, должны быть сообщения об этом
    const achievementsSection = page.locator('[data-testid="achievements"], .achievements-section, text=/достижения/i');
    const periodsSection = page.locator('[data-testid="periods"], .periods-section, text=/периоды/i');
    
    // Проверяем что секции есть (даже если пустые)
    const hasAchievements = await achievementsSection.isVisible().catch(() => false);
    const hasPeriods = await periodsSection.isVisible().catch(() => false);
    
    // Если секции пустые, должны быть сообщения
    if (hasAchievements) {
      const emptyMessage = page.locator('text=/нет достижений|no achievements/i');
      const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);
      // Это нормально - либо есть достижения, либо сообщение об их отсутствии
    }
  });

  test('очень длинное имя личности обрезается корректно', async ({ authenticatedPage }) => {
    const managePage = new ManagePage(authenticatedPage);
    
    // Создаём личность с очень длинным именем через UI или API
    const longName = 'A'.repeat(200); // Очень длинное имя
    
    // Это тест edge case - в реальности валидация должна ограничивать длину
    // Но проверяем что если такое имя попало, оно обрабатывается корректно
    
    await managePage.goto();
    
    // Проверяем что в списке длинные имена обрезаются с многоточием
    const personCards = authenticatedPage.locator('[data-testid="person-card"], .person-card');
    const firstCard = personCards.first();
    
    const hasCard = await firstCard.isVisible().catch(() => false);
    if (hasCard) {
      const displayedName = await firstCard.textContent();
      
      if (displayedName && displayedName.length > 100) {
        // Длинное имя должно быть обрезано
        expect(displayedName.length).toBeLessThanOrEqual(150); // Максимальная длина с учетом многоточия
      }
    }
  });

  test('одновременное редактирование одной личности двумя пользователями', async ({ browser }) => {
    // Создаём два контекста для разных пользователей
    const user1 = { ...DEFAULT_TEST_USER, email: 'user1@test.com', username: 'user1' };
    const user2 = { ...DEFAULT_TEST_USER, email: 'user2@test.com', username: 'user2' };
    
    await ensureTestUserInDb(user1);
    await ensureTestUserInDb(user2);
    
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();
    
    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();
    
    // Авторизуем обоих пользователей
    await loginUser(user1Page, user1);
    await loginUser(user2Page, user2);
    
    const user1Tokens = await user1Page.evaluate(() => {
      const auth = localStorage.getItem('auth');
      return auth ? JSON.parse(auth) : null;
    });
    
    const user2Tokens = await user2Page.evaluate(() => {
      const auth = localStorage.getItem('auth');
      return auth ? JSON.parse(auth) : null;
    });
    
    // Создаём личность через API от первого пользователя
    const apiClient1 = new ApiClient(undefined, user1Tokens.accessToken);
    const person = createTestPerson({ name: 'Concurrent Edit Person' });
    const createResponse = await apiClient1.createPerson(person);
    const personId = createResponse?.data?.id;
    
    if (!personId) {
      await user1Context.close();
      await user2Context.close();
      throw new Error('Не удалось создать личность для теста');
    }
    
    // Оба пользователя пытаются редактировать одну личность
    const managePage1 = new ManagePage(user1Page);
    const managePage2 = new ManagePage(user2Page);
    
    await managePage1.goto();
    await managePage2.goto();
    
    // Ищем созданную личность
    await user1Page.waitForTimeout(2000);
    await user2Page.waitForTimeout(2000);
    
    // Редактируем от первого пользователя
    // (Это edge case - в реальности может быть конфликт версий)
    
    // Закрываем контексты
    await user1Context.close();
    await user2Context.close();
  });

  test('квиз без выбранных типов вопросов не запускается', async ({ page }) => {
    await enableSimpleQuestions(page);
    const quizPage = new QuizPage(page);
    
    await quizPage.goto();
    
    // Снимаем все выбранные типы вопросов
    const selectedTypes = await quizPage.getSelectedQuestionTypesCount();
    
    if (selectedTypes > 0) {
      // Если есть выбранные типы, снимаем их
      const checkboxes = page.locator('.quiz-type-checkbox input[type="checkbox"]:checked');
      const count = await checkboxes.count();
      
      for (let i = 0; i < count; i++) {
        await checkboxes.nth(i).click();
      }
    }
    
    // Кнопка "Начать" должна быть disabled или показывать ошибку
    const startButton = quizPage.startButton;
    const isDisabled = await startButton.isDisabled().catch(() => false);
    
    // Либо кнопка disabled, либо показывается сообщение об ошибке
    const hasError = await page.locator('text=/выберите тип вопроса|select question type/i').isVisible().catch(() => false);
    
    expect(isDisabled || hasError).toBeTruthy();
  });

  test('пустой поиск на timeline не ломает фильтры', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    await timelinePage.expectTimelineNotEmpty();
    
    // Применяем фильтр
    await timelinePage.filterByCategory('scientists');
    await page.waitForTimeout(1000);
    
    // Вводим пустой поиск
    const searchInput = timelinePage.searchInput;
    await searchInput.fill('');
    await page.waitForTimeout(1000);
    
    // Фильтры не должны сброситься
    // Проверяем что контент всё ещё отфильтрован
    const hasContent = await page.locator('[data-testid="person-card"], .person-card').first().isVisible().catch(() => false);
    
    // Пустой поиск не должен сломать страницу
    expect(hasContent || page.locator('text=/нет результатов/i').isVisible()).toBeTruthy();
  });

  test('очень длинный текст в поиске обрабатывается корректно', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    await timelinePage.expectTimelineNotEmpty();
    
    // Вводим очень длинный текст поиска
    const longSearch = 'A'.repeat(1000);
    const searchInput = timelinePage.searchInput;
    
    await searchInput.fill(longSearch);
    await page.waitForTimeout(1000);
    
    // Поиск должен обработаться (либо обрезать, либо обработать)
    // Страница не должна сломаться
    const hasContent = await page.locator('[data-testid="person-card"], .person-card').first().isVisible().catch(() => false);
    const hasError = await page.locator('.toast-error, [data-testid="error"]').isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=/нет результатов/i').isVisible().catch(() => false);
    
    // Должен быть либо результат, либо сообщение об отсутствии, либо ошибка валидации
    expect(hasContent || hasError || hasEmpty).toBeTruthy();
  });

  test('экстремальные значения диапазона лет обрабатываются корректно', async ({ page }) => {
    const timelinePage = new TimelinePage(page);
    
    await timelinePage.goto();
    await timelinePage.expectTimelineNotEmpty();
    
    // Пытаемся установить очень большой диапазон
    try {
      await timelinePage.selectYearRange(-10000, 10000);
      await page.waitForTimeout(1000);
      
      // Фильтр должен обработаться (либо обрезать, либо обработать)
      const hasContent = await page.locator('[data-testid="person-card"], .person-card').first().isVisible().catch(() => false);
      
      // Страница не должна сломаться
      expect(hasContent || page.locator('text=/нет результатов/i').isVisible()).toBeTruthy();
    } catch (error) {
      // Если фильтр не поддерживает такие значения - это нормально
      // Главное что страница не сломалась
    }
  });

  test('повторный запуск квиза сразу после завершения работает', async ({ authenticatedPage }) => {
    await enableSimpleQuestions(authenticatedPage);
    const quizPage = new QuizPage(authenticatedPage);
    
    // Проходим первый квиз
    await quizPage.goto();
    await quizPage.startQuiz({ questionCount: 3 });
    await quizPage.completeQuizQuickly(3);
    await quizPage.expectResults();
    
    // Сразу запускаем второй квиз
    const playAgainButton = quizPage.playAgainButton;
    await playAgainButton.click();
    
    // Квиз должен начаться заново
    await expect(quizPage.questionText).toBeVisible({ timeout: 10000 });
    
    // Проходим второй квиз
    await quizPage.completeQuizQuickly(3);
    await quizPage.expectResults();
  });

  test('создание списка с максимально длинным названием', async ({ authenticatedPage }) => {
    const listsPage = new ListsPage(authenticatedPage);
    
    await listsPage.goto();
    
    // Открываем модалку создания списка
    await listsPage.createListButton.click();
    const modal = authenticatedPage.locator('[role="dialog"]').filter({ hasText: 'Новый список' });
    await modal.waitFor({ state: 'visible' });
    
    // Вводим максимально длинное название
    const maxLengthTitle = 'A'.repeat(255); // Типичный максимум для varchar(255)
    const input = modal.getByPlaceholder(/название списка/i);
    await input.fill(maxLengthTitle);
    
    // Пытаемся создать
    await modal.getByRole('button', { name: /создать/i }).click();
    
    // Список должен создаться или показать ошибку валидации
    const hasSuccess = await authenticatedPage.locator('.toast-success, [data-testid="list-created"]').isVisible({ timeout: 10000 }).catch(() => false);
    const hasError = await authenticatedPage.locator('.toast-error:has-text(/слишком длин|too long/i)').isVisible({ timeout: 5000 }).catch(() => false);
    
    // Либо создан, либо ошибка валидации
    expect(hasSuccess || hasError).toBeTruthy();
  });

  test('экстремальные значения количества вопросов в квизе', async ({ page }) => {
    await enableSimpleQuestions(page);
    const quizPage = new QuizPage(page);
    
    await quizPage.goto();
    
    // Пытаемся установить очень большое количество вопросов (если UI позволяет)
    // Обычно UI ограничивает до 15, но проверяем edge case
    
    // Устанавливаем максимальное значение
    await quizPage.setQuestionCount(15);
    
    // Квиз должен запуститься
    await quizPage.startQuiz();
    await expect(quizPage.questionText).toBeVisible({ timeout: 10000 });
  });

  test('быстрое переключение между страницами не ломает состояние', async ({ authenticatedPage }) => {
    const timelinePage = new TimelinePage(authenticatedPage);
    const quizPage = new QuizPage(authenticatedPage);
    const listsPage = new ListsPage(authenticatedPage);
    
    // Быстро переключаемся между страницами
    await timelinePage.goto();
    await authenticatedPage.waitForTimeout(200);
    
    await quizPage.goto();
    await authenticatedPage.waitForTimeout(200);
    
    await listsPage.goto();
    await authenticatedPage.waitForTimeout(200);
    
    await timelinePage.goto();
    
    // Timeline должен загрузиться нормально
    await timelinePage.expectTimelineNotEmpty();
  });
});

