import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object для страницы логина
 */
export class LoginPage {
  readonly page: Page;

  // Локаторы
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerLink: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;

    // Инициализация локаторов с fallback вариантами
    this.emailInput = page
      .locator(
        'input[type="email"], input[name="email"], input[placeholder*="email"], input[placeholder*="логин"], [data-testid="email-input"]'
      )
      .first();
    this.passwordInput = page
      .locator(
        'input[type="password"], input[name="password"], input[placeholder*="password"], input[placeholder*="пароль"], [data-testid="password-input"]'
      )
      .first();
    this.loginButton = page
      .locator(
        'button[type="submit"], button:has-text("Войти"), button:has-text("Login"), [data-testid="login-button"]'
      )
      .first();
    this.registerLink = page
      .locator('a:has-text("Регистрация"), a:has-text("Register"), [data-testid="register-link"]')
      .first();
    this.errorMessage = page.locator(
      '.error-message, [role="alert"], [data-testid="error-message"]'
    );
    this.forgotPasswordLink = page
      .locator(
        'a:has-text("Забыли пароль"), a:has-text("Forgot password"), [data-testid="forgot-password-link"]'
      )
      .first();
  }

  /**
   * Переход на страницу логина
   */
  async goto(): Promise<void> {
    // Логин происходит на странице /profile для неавторизованных пользователей
    await this.page.goto('/profile');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Заполнение формы логина и вход
   */
  async login(email: string, password: string): Promise<void> {
    // Ждём появления любого из полей формы с fallback
    try {
      await this.emailInput.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      // Если email поле не найдено, пробуем другие селекторы
      const alternativeEmailInput = this.page
        .locator(
          'input[type="email"], input[name="email"], input[placeholder*="email"], input[placeholder*="логин"]'
        )
        .first();
      await alternativeEmailInput.waitFor({ state: 'visible', timeout: 5000 });
      await alternativeEmailInput.fill(email);
    }

    // Заполняем поля
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);

    // Кликаем кнопку
    await this.loginButton.click();
  }

  /**
   * Проверка наличия ошибки с определённым текстом
   */
  async expectError(message?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  /**
   * Проверка успешного входа (редирект или появление элементов после логина)
   */
  async expectSuccessfulLogin(): Promise<void> {
    // Ждём исчезновения формы логина
    await expect(this.loginButton).not.toBeVisible({ timeout: 5000 });

    // Проверяем, что появилось меню пользователя
    await expect(this.page.locator('[data-testid="user-menu"], .user-menu')).toBeVisible({
      timeout: 5000,
    });
  }

  /**
   * Клик по ссылке "Регистрация"
   */
  async goToRegister(): Promise<void> {
    await this.registerLink.click();
  }

  /**
   * Клик по ссылке "Забыли пароль"
   */
  async goToForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
  }

  /**
   * Проверка валидационных ошибок в полях
   */
  async expectFieldError(field: 'email' | 'password', message?: string): Promise<void> {
    const input = field === 'email' ? this.emailInput : this.passwordInput;

    // Проверяем атрибут aria-invalid или наличие класса ошибки
    const hasError = await input.evaluate(el => {
      return (
        el.getAttribute('aria-invalid') === 'true' ||
        el.classList.contains('error') ||
        el.classList.contains('invalid')
      );
    });

    expect(hasError).toBeTruthy();

    if (message) {
      // Проверяем текст ошибки рядом с полем
      const errorText = this.page.locator(`text=${message}`);
      await expect(errorText).toBeVisible();
    }
  }
}

