import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object для страницы регистрации
 */
export class RegisterPage {
  readonly page: Page;
  
  // Локаторы
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly registerButton: Locator;
  readonly loginLink: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    
    this.usernameInput = page.getByLabel(/username|имя пользователя/i);
    this.emailInput = page.getByLabel(/email|электронная почта/i);
    this.passwordInput = page.getByLabel(/^password|^пароль/i);
    this.confirmPasswordInput = page.getByLabel(/confirm|подтвердите пароль/i);
    this.registerButton = page.getByRole('button', { name: /зарегистрироваться|register|sign up/i });
    this.loginLink = page.getByRole('link', { name: /войти|login|sign in/i });
    this.successMessage = page.locator('.success-message, [role="status"]');
    this.errorMessage = page.locator('.error-message, [role="alert"]');
  }

  /**
   * Переход на страницу регистрации
   */
  async goto(): Promise<void> {
    await this.page.goto('/register');
  }

  /**
   * Заполнение формы регистрации
   */
  async register(data: {
    username: string;
    email: string;
    password: string;
    confirmPassword?: string;
  }): Promise<void> {
    await this.usernameInput.fill(data.username);
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
    
    if (this.confirmPasswordInput && data.confirmPassword !== undefined) {
      await this.confirmPasswordInput.fill(data.confirmPassword);
    }
    
    await this.registerButton.click();
  }

  /**
   * Проверка успешной регистрации
   */
  async expectSuccessfulRegistration(): Promise<void> {
    // Может быть успешное сообщение или редирект на главную
    const hasSuccessMessage = await this.successMessage.isVisible().catch(() => false);
    const hasUserMenu = await this.page
      .locator('[data-testid="user-menu"], .user-menu')
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    
    expect(hasSuccessMessage || hasUserMenu).toBeTruthy();
  }

  /**
   * Проверка ошибки с определённым текстом
   */
  async expectError(message?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  /**
   * Проверка валидационной ошибки для конкретного поля
   */
  async expectValidationError(
    field: 'username' | 'email' | 'password' | 'confirmPassword',
    message?: string
  ): Promise<void> {
    let input: Locator;
    
    switch (field) {
      case 'username':
        input = this.usernameInput;
        break;
      case 'email':
        input = this.emailInput;
        break;
      case 'password':
        input = this.passwordInput;
        break;
      case 'confirmPassword':
        input = this.confirmPasswordInput;
        break;
    }
    
    // Проверяем наличие индикатора ошибки
    const hasError = await input.evaluate((el) => {
      return (
        el.getAttribute('aria-invalid') === 'true' ||
        el.classList.contains('error') ||
        el.classList.contains('invalid')
      );
    });
    
    expect(hasError).toBeTruthy();
    
    if (message) {
      const errorText = this.page.locator(`text=${message}`);
      await expect(errorText).toBeVisible();
    }
  }

  /**
   * Клик по ссылке "Уже есть аккаунт? Войти"
   */
  async goToLogin(): Promise<void> {
    await this.loginLink.click();
  }

  /**
   * Проверка что кнопка регистрации отключена
   */
  async expectRegisterButtonDisabled(): Promise<void> {
    await expect(this.registerButton).toBeDisabled();
  }

  /**
   * Проверка что кнопка регистрации доступна
   */
  async expectRegisterButtonEnabled(): Promise<void> {
    await expect(this.registerButton).toBeEnabled();
  }
}






