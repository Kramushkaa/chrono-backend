import { Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { createTestPool } from '../utils/db-reset';
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

export const DEFAULT_ADMIN_USER: TestUser = {
  username: 'admin',
  email: 'admin@chrononinja.test',
  password: 'admin123',
  role: 'admin',
};

const PASSWORD_HASH_CACHE = new Map<string, string>();

export async function ensureTestUserInDb(user: TestUser): Promise<void> {
  const pool = createTestPool();
  const client = await pool.connect();

  try {
    const password = user.password ?? DEFAULT_TEST_USER.password;
    let passwordHash = PASSWORD_HASH_CACHE.get(password);
    if (!passwordHash) {
      passwordHash = await bcrypt.hash(password, 10);
      PASSWORD_HASH_CACHE.set(password, passwordHash);
    }

    await client.query(
      `INSERT INTO test.users (email, password_hash, username, full_name, role, is_active, email_verified, created_at, updated_at,
                               email_verification_token, email_verification_expires, password_reset_token, password_reset_expires)
       VALUES ($1, $2, $3, $4, $5, true, true, NOW(), NOW(), NULL, NULL, NULL, NULL)
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           username = EXCLUDED.username,
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           is_active = true,
           email_verified = true,
           updated_at = NOW(),
           email_verification_token = NULL,
           email_verification_expires = NULL,
           password_reset_token = NULL,
           password_reset_expires = NULL`,
      [
        user.email,
        passwordHash,
        user.username ?? user.email,
        user.username ?? user.email,
        user.role ?? 'user',
      ]
    );
  } finally {
    client.release();
    await pool.end();
  }
}

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

  await ensureTestUserInDb(targetUser);

  const loginResult = await loginUser(targetUser, apiUrl);
  
  if (!loginResult.success || !loginResult.tokens) {
    return { success: false, error: loginResult.error || 'Login failed' };
  }

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


