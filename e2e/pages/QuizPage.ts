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

  // Локаторы игрового экрана
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

  constructor(page: Page) {
    this.page = page;

    // Setup
    this.questionCountButtons = page.locator(
      '.quiz-count-button, [data-testid="question-count-button"]'
    );
    this.categoryCheckboxes = page.locator(
      '[data-testid="category-checkbox"], input[type="checkbox"]'
    );
    this.startButton = page.locator('button:has-text("Начать"), button:has-text("Start")');

    // Gameplay
    this.questionText = page.locator('.quiz-question-container');
    this.answerOptions = page.locator('.quiz-question-options button, .quiz-option');
    this.nextButton = page.locator(
      'button:has-text("Далее"), button:has-text("Next"), button:has-text("Проверить")'
    );
    this.progressBar = page.locator('[data-testid="progress-bar"], .progress-bar');
    this.questionCounter = page.locator('[data-testid="question-counter"], .question-counter');

    // Results
    this.scoreDisplay = page.locator('[data-testid="score"], .score');
    this.correctAnswersCount = page.locator('[data-testid="correct-answers"], .correct-answers');
    this.totalQuestionsCount = page.locator('[data-testid="total-questions"], .total-questions');
    this.shareButton = page.locator('button:has-text("Поделиться"), button:has-text("Share")');
    this.playAgainButton = page.locator(
      'button:has-text("Ещё раз"), button:has-text("Play again")'
    );
    this.viewHistoryButton = page.locator('button:has-text("История"), button:has-text("History")');
  }

  /**
   * Переход на страницу квиза
   */
  async goto(): Promise<void> {
    await this.page.goto('/quiz');
  }

  /**
   * Настройка и запуск квиза
   */
  async startQuiz(settings?: QuizSettings): Promise<void> {
    // Ждём загрузки элементов настройки
    await this.page.waitForTimeout(1000);

    if (settings?.questionCount) {
      const countButton = this.page.getByRole('button', {
        name: new RegExp(`^${settings.questionCount}$`),
      });
      if (await countButton.count()) {
        await countButton.click();
        await this.page.waitForTimeout(300);
      } else if (await this.questionCountButtons.count()) {
        const fallbackButton = this.questionCountButtons
          .filter({ hasText: `${settings.questionCount}` })
          .first();
        if (await fallbackButton.count()) {
          await fallbackButton.click();
          await this.page.waitForTimeout(300);
        }
      }
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

    // Ждём появления кнопки и проверяем, что она не disabled
    await this.startButton.waitFor({ state: 'visible', timeout: 10000 });

    // Проверяем, что кнопка не disabled, иначе ждём
    for (let i = 0; i < 50; i++) {
      const isDisabled = await this.startButton.evaluate(button => button.disabled);
      if (!isDisabled) break;
      await this.page.waitForTimeout(100);
    }

    await this.startButton.click();

    // Ждём загрузки первого вопроса
    await expect(this.questionText).toBeVisible({ timeout: 5000 });
  }

  /**
   * Ответ на вопрос с одним правильным ответом (single choice)
   */
  async answerSingleChoice(answerIndex: number): Promise<void> {
    const options = await this.answerOptions.all();
    await options[answerIndex].click();
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

    for (const index of answerIndices) {
      await options[index].click();
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
    for (let i = 0; i < questionsCount; i++) {
      // Ждём появления вопроса
      await expect(this.questionText).toBeVisible();

      // Определяем тип вопроса и отвечаем
      const hasOptions = await this.answerOptions
        .first()
        .isVisible()
        .catch(() => false);
      const hasYearInput = await this.page
        .locator('input[type="number"]')
        .isVisible()
        .catch(() => false);

      if (hasYearInput) {
        await this.answerYearInput(1900);
      } else if (hasOptions) {
        await this.answerSingleChoice(0);
      } else {
        // Если не можем определить тип, просто кликаем Next
        await this.nextButton.click();
      }

      // Небольшая задержка между вопросами
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Проверка отображения результатов
   */
  async expectResults(expectedScore?: number): Promise<void> {
    await expect(this.scoreDisplay).toBeVisible({ timeout: 5000 });

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

    // Ждём появления share кода
    const shareCodeElement = this.page.locator('[data-testid="share-code"], .share-code');
    await expect(shareCodeElement).toBeVisible();

    const shareCode = await shareCodeElement.textContent();
    return shareCode || '';
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
    return (await this.questionText.textContent()) || '';
  }

  /**
   * Проверка прогресса квиза
   */
  async expectQuestionNumber(current: number, total: number): Promise<void> {
    const counterText = await this.questionCounter.textContent();
    expect(counterText).toContain(`${current}`);
    expect(counterText).toContain(`${total}`);
  }
}
