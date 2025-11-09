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
    
    // Инициализация локаторов
    this.emailInput = page.getByLabel(/email|логин/i);
    this.passwordInput = page.getByLabel(/password|пароль/i);
    this.loginButton = page.getByRole('button', { name: /войти|login|sign in/i });
    this.registerLink = page.getByRole('link', { name: /регистрация|register|sign up/i });
    this.errorMessage = page.locator('.error-message, [role="alert"]');
    this.forgotPasswordLink = page.getByRole('link', { name: /забыли пароль|forgot password/i });
  }

  /**
   * Переход на страницу логина
   */
  async goto(): Promise<void> {
    await this.page.goto('/menu');
    // Клик по кнопке "Войти" в меню
    await this.page.getByRole('button', { name: /войти|login/i }).first().click();
  }

  /**
   * Заполнение формы логина и вход
   */
  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
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
    const hasError = await input.evaluate((el) => {
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


