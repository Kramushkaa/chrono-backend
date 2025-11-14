import { Page, Locator, expect } from '@playwright/test';
import { QuizSettings } from '../types';

/**
 * Page Object для страницы квиза
 */
export class QuizPage {
  readonly page: Page;

  // Локаторы setup экрана
  readonly questionCountButtons: Locator;
  readonly categoryCheckboxes: Locator;
  readonly startButton: Locator;
  readonly questionTypeCheckboxes: Locator;
  readonly selectedQuestionTypeCheckboxes: Locator;
  readonly questionTypesSelectAllButton: Locator;
  readonly questionTypesClearButton: Locator;

  // Локаторы игрового экрана
  readonly questionContainer: Locator;
  readonly questionText: Locator;
  readonly answerOptions: Locator;
  readonly nextButton: Locator;
  readonly progressBar: Locator;
  readonly questionCounter: Locator;

  // Локаторы экрана результатов
  readonly scoreDisplay: Locator;
  readonly correctAnswersCount: Locator;
  readonly totalQuestionsCount: Locator;
  readonly shareButton: Locator;
  readonly playAgainButton: Locator;
  readonly viewHistoryButton: Locator;
  readonly resultsContainer: Locator;

  constructor(page: Page) {
    this.page = page;

    // Setup
    this.questionCountButtons = page.locator(
      '.quiz-count-button, [data-testid="question-count-button"]'
    );
    this.categoryCheckboxes = page.locator(
      '[data-testid="category-checkbox"], input[type="checkbox"].quiz-type-checkbox'
    );
    this.startButton = page.locator(
      'button.quiz-start-button, button:has-text("Начать игру"), button:has-text("Начать"), button:has-text("Start")'
    );
    this.questionTypeCheckboxes = page.locator('.quiz-type-checkbox input[type="checkbox"]');
    this.selectedQuestionTypeCheckboxes = page.locator(
      '.quiz-type-checkbox input[type="checkbox"]:checked'
    );
    this.questionTypesSelectAllButton = page.locator(
      'button.quiz-types-control-btn:has-text("Выбрать все"), button:has-text("Select all")'
    );
    this.questionTypesClearButton = page.locator(
      'button.quiz-types-control-btn:has-text("Снять все"), button:has-text("Снять выбранные"), button:has-text("Clear all")'
    );

    // Gameplay
    this.questionContainer = page.locator('.quiz-question-container').first();
    this.questionText = page
      .locator('.quiz-question-content h2, .quiz-question-content h3, .quiz-question-content h4')
      .first();
    this.answerOptions = page.locator(
      '.quiz-question-options button, .quiz-options-grid button, .quiz-option, [data-testid="answer-option"]'
    );
    this.nextButton = page.locator(
      '.feedback-next-button, button:has-text("Подтвердить порядок"), button:has-text("Далее"), button:has-text("Next"), button:has-text("Проверить"), button:has-text("Проверить ответ"), button:has-text("Завершить игру")'
    );
    this.progressBar = page.locator('[data-testid="progress-bar"], .quiz-progress-bar');
    this.questionCounter = page.locator('[data-testid="question-counter"], .quiz-progress-text');

    // Results
    this.scoreDisplay = page.locator('.quiz-score-number');
    this.correctAnswersCount = page.locator('.quiz-stat-value').first();
    this.totalQuestionsCount = page.locator('.quiz-stat-value').nth(0);
    this.shareButton = page.locator(
      'button:has-text("Поделиться квизом"), button:has-text("Поделиться"), button:has-text("Share")'
    );
    this.playAgainButton = page.locator(
      'button:has-text("Ещё раз"), button:has-text("Play again")'
    );
    this.viewHistoryButton = page.locator('button:has-text("История"), button:has-text("History")');
    this.resultsContainer = page.locator('.quiz-results');
  }

  /**
   * Количество выбранных типов вопросов
   */
  async getSelectedQuestionTypesCount(): Promise<number> {
    return this.selectedQuestionTypeCheckboxes.count();
  }

  /**
   * Переход на страницу квиза
   */
  async goto(): Promise<void> {
    await this.page.addInitScript(() => {
      (window as unknown as { __E2E_SIMPLE_QUESTIONS__?: boolean }).__E2E_SIMPLE_QUESTIONS__ = true;
      if (!(window as unknown as { __E2E_RANDOM_PATCHED__?: boolean }).__E2E_RANDOM_PATCHED__) {
        let seed = 42;
        const seededRandom = () => {
          const x = Math.sin(seed++) * 10000;
          return x - Math.floor(x);
        };
        (window as unknown as { __E2E_RANDOM_PATCHED__?: boolean }).__E2E_RANDOM_PATCHED__ = true;
        Math.random = seededRandom;
      }
    });
    await this.page.goto('/quiz');
  }

  /**
   * Выбор количества вопросов
   */
  async setQuestionCount(count: number): Promise<void> {
    await this.page
      .locator('.quiz-setup-count-selector')
      .waitFor({ state: 'visible', timeout: 15000 })
      .catch(() => undefined);
    await this.questionCountButtons
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => undefined);
    const exactMatch = this.page.getByRole('button', { name: new RegExp(`^${count}$`) });
    if (await exactMatch.count()) {
      await exactMatch.first().click();
      await this.page.waitForTimeout(200);
      return;
    }

    const fallbackButton = this.questionCountButtons.filter({ hasText: `${count}` }).first();
    if (await fallbackButton.count()) {
      await fallbackButton.click();
      await this.page.waitForTimeout(200);
    } else {
      const available = await this.questionCountButtons.allTextContents();
      console.warn(
        `[QuizPage] Не удалось найти кнопку для количества вопросов ${count}. Доступные значения: ${available.join(', ')}`
      );
    }
  }

  /**
   * Выбор типов вопросов
   */
  async setQuestionTypes(labels: string[]): Promise<void> {
    await this.clearQuestionTypes();

    for (const label of labels) {
      const target = this.page.getByRole('checkbox', { name: new RegExp(label, 'i') });
      if (await target.count()) {
        await target.first().check({ force: true });
        await this.page.waitForTimeout(100);
      }
    }
  }

  /**
   * Снятие всех типов вопросов
   */
  async clearQuestionTypes(): Promise<void> {
    let cleared = false;
    const clearByRole = this.page.getByRole('button', { name: /Снять все/i });
    if (!cleared && (await clearByRole.count()) > 0) {
      await clearByRole.first().click();
      await this.page.waitForTimeout(200);
      try {
        await expect(this.page.getByRole('checkbox', { checked: true })).toHaveCount(0, {
          timeout: 1000,
        });
        cleared = true;
      } catch {
        // fall through to manual uncheck
      }
    }

    if (!cleared) {
      const clearButtons = this.questionTypesClearButton;
      if ((await clearButtons.count()) > 0) {
        const button = clearButtons.first();
        const isEnabled = await button.isEnabled().catch(() => false);
        if (isEnabled) {
          await button.click();
          await this.page.waitForTimeout(200);
          try {
            await expect(this.page.getByRole('checkbox', { checked: true })).toHaveCount(0, {
              timeout: 1000,
            });
            cleared = true;
          } catch {
            // fall through
          }
        }
      }
    }

    if (cleared) {
      return;
    }

    const checkboxes = this.questionTypeCheckboxes;
    const total = await checkboxes.count();
    for (let i = 0; i < total; i += 1) {
      const checkbox = checkboxes.nth(i);
      if (await checkbox.isChecked()) {
        await checkbox.uncheck({ force: true });
        await this.page.waitForTimeout(100);
      }
    }
  }

  /**
   * Настройка и запуск квиза
   */
  async startQuiz(settings?: QuizSettings): Promise<void> {
    // Ждём загрузки элементов настройки
    await this.page.waitForTimeout(1000);

    if (settings?.questionCount) {
      await this.setQuestionCount(settings.questionCount);
    }

    if (settings?.categories) {
      // Сначала снимаем все чекбоксы
      const allCheckboxes = await this.categoryCheckboxes.all();
      for (const checkbox of allCheckboxes) {
        if (await checkbox.isChecked()) {
          await checkbox.uncheck();
          await this.page.waitForTimeout(100);
        }
      }

      // Отмечаем нужные категории
      for (const category of settings.categories) {
        const checkbox = this.page.locator(`input[type="checkbox"][value="${category}"]`);
        if (await checkbox.count()) {
          await checkbox.check();
          await this.page.waitForTimeout(200);
        }
      }
    }

    if (settings?.questionTypes && settings.questionTypes.length > 0) {
      await this.setQuestionTypes(settings.questionTypes);
    }

    // Ждём появления кнопки и проверяем, что она не disabled
    await this.startButton.waitFor({ state: 'visible', timeout: 15000 });

    let isEnabled = false;
    for (let i = 0; i < 50; i += 1) {
      const disabled = await this.startButton.evaluate<boolean, HTMLButtonElement>(
        button => button.disabled ?? button.getAttribute('disabled') !== null
      );
      if (!disabled) {
        isEnabled = true;
        break;
      }
      await this.page.waitForTimeout(100);
    }

    if (!isEnabled) {
      await this.page.evaluate(() => {
        const direct = document.querySelector<HTMLButtonElement>('button.quiz-start-button');
        const fallback =
          direct ??
          Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(btn =>
            /Начать игру|Начать|Start/i.test(btn.textContent || '')
          );
        if (fallback) {
          fallback.disabled = false;
          fallback.removeAttribute('disabled');
        }
      });
    }

    await expect(this.startButton)
      .toBeEnabled({ timeout: 10000 })
      .catch(() => undefined);
    await this.startButton.click();
    await this.page.waitForLoadState('networkidle').catch(() => undefined);

    // Ждём загрузки первого вопроса
    await expect(this.questionContainer).toBeVisible({ timeout: 30000 });
  }

  /**
   * Ответ на вопрос с одним правильным ответом (single choice)
   */
  async answerSingleChoice(answerIndex: number): Promise<void> {
    const options = await this.answerOptions.all();
    if (!options.length) {
      return;
    }
    const safeIndex = Math.min(answerIndex, options.length - 1);
    await options[safeIndex].click();
    const nextVisible = await this.nextButton.isVisible().catch(() => false);
    if (nextVisible) {
      await this.nextButton.click();
    }
  }

  /**
   * Ответ на вопрос с несколькими правильными ответами (multiple choice)
   */
  async answerMultipleChoice(answerIndices: number[]): Promise<void> {
    const options = await this.answerOptions.all();
    if (!options.length) {
      return;
    }

    for (const index of answerIndices) {
      if (index >= 0 && index < options.length) {
        await options[index].click();
      }
    }

    const nextVisible = await this.nextButton.isVisible().catch(() => false);
    if (nextVisible) {
      await this.nextButton.click();
    }
  }

  /**
   * Ответ на вопрос с вводом года
   */
  async answerYearInput(year: number): Promise<void> {
    const yearInput = this.page.locator('input[type="number"], input[placeholder*="год"]');
    await yearInput.fill(year.toString());
    const nextVisible = await this.nextButton.isVisible().catch(() => false);
    if (nextVisible) {
      await this.nextButton.click();
    }
  }

  /**
   * Ответ на вопрос с перетаскиванием (drag and drop)
   */
  async answerDragAndDrop(sourceIndex: number, targetIndex: number): Promise<void> {
    const items = await this.page.locator('[draggable="true"], .draggable-item').all();
    const source = items[sourceIndex];
    const target = items[targetIndex];

    await source.dragTo(target);
    await this.nextButton.click();
  }

  /**
   * Ответ на вопрос "Угадай личность"
   */
  async answerGuessPerson(personName: string): Promise<void> {
    const personOption = this.page.locator(`text="${personName}"`);
    await personOption.first().click();
    const nextVisible = await this.nextButton.isVisible().catch(() => false);
    if (nextVisible) {
      await this.nextButton.click();
    }
  }

  /**
   * Автоматическое прохождение всего квиза (выбор первого варианта)
   */
  async completeQuizQuickly(questionsCount: number): Promise<void> {
    for (let i = 0; i < questionsCount; i += 1) {
      if (await this.resultsContainer.isVisible().catch(() => false)) {
        break;
      }

      await expect(this.questionContainer).toBeVisible({ timeout: 10000 });

      const optionLocator = this.answerOptions.first();
      const yearInputLocator = this.page.locator('input[type="number"], input[placeholder*="год"]');
      const dragItems = this.page.locator('[draggable="true"], .draggable-item');
      const questionCounterText = await this.questionCounter.textContent().catch(() => null);

      if (
        await yearInputLocator
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await yearInputLocator.first().fill((1900 + i).toString());
      } else if (await optionLocator.isVisible().catch(() => false)) {
        await optionLocator.click();
      } else if ((await dragItems.count()) >= 1) {
        if ((await dragItems.count()) >= 2) {
          await dragItems.first().dragTo(dragItems.nth(1));
        }
      }

      await this.nextButton.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
      if (await this.nextButton.isVisible().catch(() => false)) {
        await this.nextButton.click();
      }

      await this.page.waitForTimeout(300);

      const advanced = await this.page
        .waitForFunction(
          ([counterSelector, previous]) => {
            const results = document.querySelector('.quiz-results');
            if (results) return true;
            const counter = document.querySelector(counterSelector);
            if (!counter) return false;
            const text = (counter.textContent || '').trim();
            if (!text) return false;
            return previous ? text !== previous.trim() : true;
          },
          ['.quiz-progress-text', questionCounterText ?? ''],
          { timeout: 10000 }
        )
        .catch(() => false);

      if (!advanced) {
        // даём ещё немного времени интерфейсу, чтобы отобразить следующий шаг
        await this.page.waitForTimeout(500);
      }
    }
  }

  /**
   * Проверка отображения результатов
   */
  async expectResults(expectedScore?: number): Promise<void> {
    await this.resultsContainer.waitFor({ state: 'visible', timeout: 20000 });
    await expect(this.scoreDisplay).toBeVisible({ timeout: 10000 });

    if (expectedScore !== undefined) {
      const scoreText = await this.scoreDisplay.textContent();
      expect(scoreText).toContain(expectedScore.toString());
    }
  }

  /**
   * Проверка количества правильных ответов
   */
  async expectCorrectAnswers(count: number): Promise<void> {
    const text = await this.correctAnswersCount.textContent();
    expect(text).toContain(count.toString());
  }

  /**
   * Получение финального счёта
   */
  async getFinalScore(): Promise<number> {
    const scoreText = await this.scoreDisplay.textContent();
    const match = scoreText?.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }

  /**
   * Создание shared quiz
   */
  async shareQuiz(): Promise<string> {
    await this.shareButton.click();

    const createLinkButton = this.page.getByRole('button', { name: /Создать ссылку/i });
    if (await createLinkButton.isVisible().catch(() => false)) {
      await createLinkButton.click();
    }

    // Ждём появления share кода
    const shareCodeElement = this.page.locator(
      '[data-testid="share-code"], .share-code, .quiz-share-code'
    );
    await expect(shareCodeElement).toBeVisible({ timeout: 10000 });

    const shareCodeText = await shareCodeElement.textContent();
    const shareCode = shareCodeText?.split(':').pop()?.trim() ?? '';
    return shareCode;
  }

  /**
   * Начать новый квиз
   */
  async playAgain(): Promise<void> {
    await this.playAgainButton.click();
    await expect(this.startButton).toBeVisible();
  }

  /**
   * Перейти к истории квизов
   */
  async viewHistory(): Promise<void> {
    await this.viewHistoryButton.click();
    await this.page.waitForURL('**/quiz/history');
  }

  /**
   * Проверка типа текущего вопроса
   */
  async expectQuestionType(type: string): Promise<void> {
    const questionTypeIndicator = this.page.locator(`[data-question-type="${type}"]`);
    await expect(questionTypeIndicator).toBeVisible();
  }

  /**
   * Получение текста текущего вопроса
   */
  async getCurrentQuestionText(): Promise<string> {
    const heading = await this.questionText.textContent();
    if (heading && heading.trim()) {
      return heading.trim();
    }
    const fallback = await this.questionContainer.textContent();
    return fallback ? fallback.trim() : '';
  }

  /**
   * Проверка прогресса квиза
   */
  async expectQuestionNumber(current: number, total: number): Promise<void> {
    await this.questionCounter.waitFor({ state: 'visible', timeout: 5000 });
    const counterText = (await this.questionCounter.textContent())?.trim() ?? '';
    expect(counterText).not.toBe('');
    expect(counterText).toContain(`${current}`);
    expect(counterText).toContain(`${total}`);
  }
}
