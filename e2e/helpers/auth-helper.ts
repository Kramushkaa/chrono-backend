import { Page } from '@playwright/test';
import { UserCredentials, AuthTokens, TestUser } from '../types';

/**
 * Хелперы для работы с авторизацией в E2E тестах
 */

const DEFAULT_API_URL = process.env.BACKEND_URL || 'http://localhost:3001';
export const DEFAULT_TEST_USER: TestUser = {
  username: 'testuser',
  email: 'testuser@test.com',
  password: 'Test123!'
};

/**
 * Регистрация нового пользователя через API
 */
export async function registerUser(
  credentials: TestUser,
  apiUrl: string = DEFAULT_API_URL
): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const response = await fetch(`${apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: credentials.username,
        email: credentials.email,
        password: credentials.password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Registration failed' };
    }

    return { success: true, user: data.data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Вход пользователя через API
 */
export async function loginUser(
  credentials: UserCredentials,
  apiUrl: string = DEFAULT_API_URL
): Promise<{ success: boolean; tokens?: AuthTokens; user?: any; error?: string }> {
  try {
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login: credentials.email,
        password: credentials.password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Login failed' };
    }

    return {
      success: true,
      tokens: {
        accessToken: data.data.access_token,
        refreshToken: data.data.refresh_token,
      },
      user: data.data.user,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Получение заголовков с токеном авторизации
 */
export function getAuthHeaders(accessToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

/**
 * Внедрение токенов авторизации в браузер (localStorage)
 * Это позволяет обойти UI логин и сразу начать с авторизованного состояния
 */
export async function injectAuthState(page: Page, tokens: AuthTokens, user?: any): Promise<void> {
  await page.addInitScript((payload) => {
    const authState = {
      user: payload.user ?? null,
      accessToken: payload.tokens.accessToken,
      refreshToken: payload.tokens.refreshToken,
    };
    localStorage.setItem('auth', JSON.stringify(authState));
    localStorage.setItem('auth_version', 'v2-vite');
    localStorage.setItem('accessToken', payload.tokens.accessToken);
    localStorage.setItem('refreshToken', payload.tokens.refreshToken);
  }, { tokens, user });
}

/**
 * Очистка состояния авторизации
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('auth');
    localStorage.removeItem('auth_version');
  });
}

/**
 * Комбинированная функция: регистрация + логин + внедрение токенов
 * Удобно для быстрой подготовки авторизованного пользователя
 */
export async function setupAuthenticatedUser(
  page: Page,
  user: TestUser,
  apiUrl: string = DEFAULT_API_URL
): Promise<{ success: boolean; user?: any; error?: string }> {
  const targetUser = user ?? DEFAULT_TEST_USER;

  // Пытаемся залогиниться сразу, если пользователь уже существует
  const initialLoginAttempt = await loginUser(targetUser, apiUrl);
  if (initialLoginAttempt.success && initialLoginAttempt.tokens) {
    await injectAuthState(page, initialLoginAttempt.tokens, initialLoginAttempt.user);
    return { success: true, user: initialLoginAttempt.user };
  }

  // 1. Регистрируем пользователя
  const registerResult = await registerUser(targetUser, apiUrl);
  
  if (!registerResult.success) {
    const errorMessage = registerResult.error || '';
    const isAlreadyExists = errorMessage.includes('already exists') || errorMessage.includes('уже существует');
    const isRateLimited = errorMessage.includes('Too many requests') || errorMessage.includes('Слишком много запросов');

    if (!isAlreadyExists && !isRateLimited) {
      return registerResult;
    }
  }

  // 2. Логинимся
  const loginResult = await loginUser(targetUser, apiUrl);
  
  if (!loginResult.success || !loginResult.tokens) {
    return { success: false, error: loginResult.error || 'Login failed' };
  }

  // 3. Внедряем токены в браузер
  await injectAuthState(page, loginResult.tokens, loginResult.user);

  return { success: true, user: loginResult.user };
}

/**
 * Проверка текущего статуса авторизации через API
 */
export async function checkAuthStatus(
  accessToken: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<{ isAuthenticated: boolean; user?: any }> {
  try {
    const response = await fetch(`${apiUrl}/api/auth/check`, {
      headers: getAuthHeaders(accessToken),
    });

    if (!response.ok) {
      return { isAuthenticated: false };
    }

    const data = await response.json();
    return { isAuthenticated: true, user: data.data };
  } catch (error) {
    return { isAuthenticated: false };
  }
}

/**
 * Обновление access token через refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<{ success: boolean; tokens?: AuthTokens; error?: string }> {
  try {
    const response = await fetch(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Token refresh failed' };
    }

    return {
      success: true,
      tokens: {
        accessToken: data.data.access_token,
        refreshToken: data.data.refresh_token,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Выход пользователя через API
 */
export async function logoutUser(
  accessToken: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${apiUrl}/api/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(accessToken),
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.message || 'Logout failed' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}


