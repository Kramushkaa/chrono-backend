import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { createTestUser } from '../utils/test-data-factory';
import { registerUser, loginUser, clearAuthState } from '../helpers/auth-helper';

/**
 * E2E тесты для аутентификации
 */

test.describe('Аутентификация', () => {
  test.beforeEach(async ({ page }) => {
    // Очищаем состояние авторизации перед каждым тестом
    await clearAuthState(page);
  });

  test('успешная регистрация нового пользователя', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const user = createTestUser();

    await registerPage.goto();
    await registerPage.register({
      username: user.username!,
      email: user.email,
      password: user.password,
      confirmPassword: user.password,
    });

    await registerPage.expectSuccessfulRegistration();
  });

  test('вход существующего пользователя', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const user = createTestUser();

    // Сначала регистрируем пользователя через API
    await registerUser(user);

    // Затем логинимся через UI
    await loginPage.goto();
    await loginPage.login(user.email, user.password);
    await loginPage.expectSuccessfulLogin();
  });

  test('ошибка при неверном пароле', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const user = createTestUser();

    // Регистрируем пользователя
    await registerUser(user);

    // Пытаемся войти с неверным паролем
    await loginPage.goto();
    await loginPage.login(user.email, 'WrongPassword123!');
    await loginPage.expectError();
  });

  test('валидация email при регистрации', async ({ page }) => {
    const registerPage = new RegisterPage(page);

    await registerPage.goto();
    await registerPage.register({
      username: 'testuser',
      email: 'invalid-email',
      password: 'Test123!',
      confirmPassword: 'Test123!',
    });

    await registerPage.expectValidationError('email');
  });

  test('валидация короткого пароля', async ({ page }) => {
    const registerPage = new RegisterPage(page);

    await registerPage.goto();
    await registerPage.register({
      username: 'testuser',
      email: 'test@test.com',
      password: '123',
      confirmPassword: '123',
    });

    await registerPage.expectValidationError('password');
  });

  test('ошибка при несовпадении паролей', async ({ page }) => {
    const registerPage = new RegisterPage(page);

    await registerPage.goto();
    await registerPage.register({
      username: 'testuser',
      email: 'test@test.com',
      password: 'Test123!',
      confirmPassword: 'DifferentPassword123!',
    });

    await registerPage.expectValidationError('confirmPassword');
  });

  test('выход из системы', async ({ page }) => {
    const user = createTestUser();

    // Регистрируем и логинимся через API
    await registerUser(user);
    const loginResult = await loginUser(user);

    // Внедряем токены
    await page.addInitScript((tokens) => {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }, loginResult.tokens!);

    await page.goto('/');

    // Кликаем выход
    const logoutButton = page.locator('button:has-text("Выйти"), button:has-text("Logout")');
    await logoutButton.click();

    // Проверяем что токены удалены
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken).toBeNull();
  });

  test('редирект на главную при доступе к защищённой странице без авторизации', async ({ page }) => {
    // Пытаемся зайти на защищённую страницу
    await page.goto('/profile');

    // Должны быть перенаправлены или увидеть предложение войти
    await page.waitForTimeout(1000);
    
    const currentUrl = page.url();
    const hasLoginPrompt = await page.locator('text=/войти|login/i').isVisible().catch(() => false);
    
    expect(currentUrl.includes('/profile') === false || hasLoginPrompt).toBeTruthy();
  });

  test('сохранение сессии после перезагрузки страницы', async ({ page }) => {
    const user = createTestUser();

    // Регистрируем и логинимся
    await registerUser(user);
    const loginResult = await loginUser(user);

    await page.addInitScript((tokens) => {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }, loginResult.tokens!);

    await page.goto('/');

    // Проверяем что пользователь авторизован
    const userMenu = page.locator('[data-testid="user-menu"], .user-menu');
    await expect(userMenu).toBeVisible();

    // Перезагружаем страницу
    await page.reload();

    // Пользователь всё ещё должен быть авторизован
    await expect(userMenu).toBeVisible();
  });

  test('ошибка при попытке регистрации с существующим email', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const user = createTestUser();

    // Регистрируем пользователя через API
    await registerUser(user);

    // Пытаемся зарегистрироваться снова через UI
    await registerPage.goto();
    await registerPage.register({
      username: user.username!,
      email: user.email,
      password: user.password,
      confirmPassword: user.password,
    });

    await registerPage.expectError();
  });

  // Advanced auth tests - forgot password, reset, email verification, profile editing
  
  test('забыли пароль - запрос ссылки для сброса', async ({ page }) => {
    const user = createTestUser();
    await registerUser(user);

    await page.goto('/login');
    await page.click('text=/забыли пароль|forgot password/i');
    
    await page.fill('input[type="email"]', user.email);
    await page.click('button:has-text("Отправить")');
    
    // Ожидаем сообщение об успехе
    await expect(page.locator('text=/письмо отправлено|email sent/i')).toBeVisible();
  });

  test('сброс пароля по валидной ссылке', async ({ page }) => {
    // Note: этот тест требует получения токена сброса из БД или мока email
    // Для демонстрации используем placeholder подход
    const resetToken = 'test-reset-token-123';
    const newPassword = 'NewPassword123!';

    await page.goto(`/reset-password?token=${resetToken}`);
    await page.fill('input[name="password"]', newPassword);
    await page.fill('input[name="confirmPassword"]', newPassword);
    await page.click('button:has-text("Сбросить пароль")');

    await expect(page.locator('text=/пароль успешно изменен|password reset/i')).toBeVisible();
  });

  test('сброс пароля с невалидным токеном', async ({ page }) => {
    await page.goto('/reset-password?token=invalid-token-123');
    
    await page.fill('input[name="password"]', 'NewPassword123!');
    await page.fill('input[name="confirmPassword"]', 'NewPassword123!');
    await page.click('button:has-text("Сбросить пароль")');

    await expect(page.locator('text=/недействительная ссылка|invalid token/i')).toBeVisible();
  });

  test('подтверждение email по валидной ссылке', async ({ page }) => {
    // Note: аналогично reset password, требует токена
    const verificationToken = 'test-verification-token-123';
    
    await page.goto(`/verify-email?token=${verificationToken}`);
    
    await expect(page.locator('text=/email подтвержден|email verified/i')).toBeVisible();
  });

  test('повторная отправка письма подтверждения', async ({ page }) => {
    const user = createTestUser();
    await registerUser(user);
    const loginResult = await loginUser(user);

    await page.addInitScript((tokens) => {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }, loginResult.tokens!);

    await page.goto('/profile');
    
    // Ищем кнопку повторной отправки
    const resendButton = page.locator('button:has-text("Отправить письмо повторно")');
    await resendButton.click();
    
    await expect(page.locator('text=/письмо отправлено|email sent/i')).toBeVisible();
  });

  test('смена пароля в профиле', async ({ page }) => {
    const user = createTestUser();
    await registerUser(user);
    const loginResult = await loginUser(user);

    await page.addInitScript((tokens) => {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }, loginResult.tokens!);

    await page.goto('/profile');
    
    await page.click('button:has-text("Сменить пароль")');
    
    await page.fill('input[name="currentPassword"]', user.password);
    await page.fill('input[name="newPassword"]', 'NewPassword456!');
    await page.fill('input[name="confirmNewPassword"]', 'NewPassword456!');
    await page.click('button:has-text("Сохранить")');
    
    await expect(page.locator('text=/пароль изменен|password changed/i')).toBeVisible();
  });

  test('редактирование профиля - изменение username', async ({ page }) => {
    const user = createTestUser();
    await registerUser(user);
    const loginResult = await loginUser(user);

    await page.addInitScript((tokens) => {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }, loginResult.tokens!);

    await page.goto('/profile');
    
    await page.click('button:has-text("Редактировать")');
    
    const newUsername = `updated_${user.username}`;
    await page.fill('input[name="username"]', newUsername);
    await page.click('button:has-text("Сохранить")');
    
    await expect(page.locator(`text=${newUsername}`)).toBeVisible();
  });

  test('редактирование профиля - изменение full_name', async ({ page }) => {
    const user = createTestUser();
    await registerUser(user);
    const loginResult = await loginUser(user);

    await page.addInitScript((tokens) => {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }, loginResult.tokens!);

    await page.goto('/profile');
    
    await page.click('button:has-text("Редактировать")');
    
    const newFullName = 'Updated Full Name';
    await page.fill('input[name="fullName"]', newFullName);
    await page.click('button:has-text("Сохранить")');
    
    await expect(page.locator(`text=${newFullName}`)).toBeVisible();
  });

  test('попытка смены username на уже занятый', async ({ page }) => {
    const user1 = createTestUser();
    const user2 = createTestUser();
    await registerUser(user1);
    await registerUser(user2);
    
    const loginResult = await loginUser(user2);

    await page.addInitScript((tokens) => {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }, loginResult.tokens!);

    await page.goto('/profile');
    
    await page.click('button:has-text("Редактировать")');
    await page.fill('input[name="username"]', user1.username!);
    await page.click('button:has-text("Сохранить")');
    
    await expect(page.locator('text=/username уже занят|username taken/i')).toBeVisible();
  });
});

