import { Pool } from 'pg';
import { 
  User, 
  UserSession, 
  RegisterRequest, 
  LoginRequest, 
  UpdateProfileRequest,
  ChangePasswordRequest 
} from '../types/auth';
import { 
  hashPassword, 
  comparePassword, 
  generateAccessToken, 
  generateRefreshToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  validateRegisterData,
  validateLoginData,
  addDays,
  isTokenExpired
} from '../utils/auth';

export class AuthService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Регистрация пользователя
  async registerUser(data: RegisterRequest): Promise<User> {
    // Валидация данных
    const validation = validateRegisterData(data);
    if (!validation.isValid) {
      throw new Error(`Validation error: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Проверка существования пользователя
    const existingUser = await this.getUserByEmail(data.email);
    if (existingUser) {
      throw new Error('Пользователь с таким email уже существует');
    }

    const desiredUsername = (data.login || data.username || undefined)?.trim();
    if (desiredUsername) {
      const existingUsername = await this.getUserByUsername(desiredUsername);
      if (existingUsername) {
        throw new Error('Пользователь с таким именем уже существует');
      }
    }

    // Хеширование пароля
    const passwordHash = await hashPassword(data.password);
    
    // Генерация токена для подтверждения email
    const emailVerificationToken = generateEmailVerificationToken();
    const emailVerificationExpires = addDays(new Date(), 2);

    const query = `
      INSERT INTO users (email, password_hash, username, full_name, email_verification_token, email_verification_expires)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [data.email.toLowerCase(), passwordHash, desiredUsername, data.full_name, emailVerificationToken, emailVerificationExpires];
    
    try {
      const result = await this.pool.query(query, values);
      const created = result.rows[0];
      // Пробрасываем токен наружу для отправки письма
      (created as any).email_verification_token = emailVerificationToken;
      return this.mapUserFromDb(created);
    } catch (error) {
      throw new Error(`Ошибка при создании пользователя: ${error}`);
    }
  }

  // Аутентификация пользователя
  async loginUser(data: LoginRequest): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    // Валидация данных
    const validation = validateLoginData(data);
    if (!validation.isValid) {
      throw new Error(`Validation error: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Поиск пользователя по email или username
    const loginIdentifier = data.login.trim();
    const isEmail = /@/.test(loginIdentifier);
    const user = isEmail
      ? await this.getUserByEmail(loginIdentifier.toLowerCase())
      : await this.getUserByUsername(loginIdentifier);
    if (!user) {
      throw new Error('Неверный email или пароль');
    }

    // Проверка активности пользователя
    if (!user.is_active) {
      throw new Error('Аккаунт заблокирован');
    }

    // Проверка пароля
    const isValidPassword = await comparePassword(data.password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Неверный email или пароль');
    }

    // Генерация токенов
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    // Сохранение refresh токена в базе (хеш)
    await this.saveRefreshToken(user.id, refreshToken);

    return {
      user: this.mapUserFromDb(user),
      accessToken,
      refreshToken
    };
  }

  // Обновление токена доступа
  async refreshAccessToken(refreshToken: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const session = await this.getSessionByToken(refreshToken);
    if (!session) {
      throw new Error('Недействительный refresh токен');
    }

    if (isTokenExpired(session.expires_at)) {
      await this.deleteSession(session.id);
      throw new Error('Refresh токен истек');
    }

    const user = await this.getUserById(session.user_id);
    if (!user || !user.is_active) {
      throw new Error('Пользователь не найден или заблокирован');
    }

    const accessToken = generateAccessToken(user);
    // Ротация refresh-токена: удаляем старый, создаем новый
    await this.deleteSession(session.id);
    const newRefreshToken = generateRefreshToken();
    await this.saveRefreshToken(user.id, newRefreshToken);

    return {
      user: this.mapUserFromDb(user),
      accessToken,
      refreshToken: newRefreshToken
    };
  }

  // Выход пользователя
  async logoutUser(userId: number, refreshToken: string): Promise<void> {
    await this.deleteSessionByToken(refreshToken);
  }

  // Получение профиля пользователя
  async getUserProfile(userId: number): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    return this.mapUserFromDb(user);
  }

  // Обновление профиля пользователя
  async updateUserProfile(userId: number, data: UpdateProfileRequest): Promise<User> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const desiredLogin = (data.login !== undefined) ? (data.login ?? '') : (data.username !== undefined ? data.username ?? '' : undefined);
    if (desiredLogin !== undefined) {
      // Проверка уникальности username
      if (desiredLogin) {
        const existingUser = await this.getUserByUsername(desiredLogin);
        if (existingUser && existingUser.id !== userId) {
          throw new Error('Пользователь с таким именем уже существует');
        }
      }
      updateFields.push(`username = $${paramIndex++}`);
      values.push(desiredLogin);
    }

    if (data.full_name !== undefined) {
      updateFields.push(`full_name = $${paramIndex++}`);
      values.push(data.full_name);
    }

    if (data.avatar_url !== undefined) {
      updateFields.push(`avatar_url = $${paramIndex++}`);
      values.push(data.avatar_url);
    }

    if (updateFields.length === 0) {
      throw new Error('Нет данных для обновления');
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, values);
      if (result.rows.length === 0) {
        throw new Error('Пользователь не найден');
      }

      return this.mapUserFromDb(result.rows[0]);
    } catch (error) {
      throw new Error(`Ошибка при обновлении профиля: ${error}`);
    }
  }

  // Изменение пароля
  async changePassword(userId: number, data: ChangePasswordRequest): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Проверка текущего пароля
    const isValidPassword = await comparePassword(data.current_password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Неверный текущий пароль');
    }

    // Хеширование нового пароля
    const newPasswordHash = await hashPassword(data.new_password);

    const query = `
      UPDATE users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    try {
      await this.pool.query(query, [newPasswordHash, userId]);
    } catch (error) {
      throw new Error(`Ошибка при изменении пароля: ${error}`);
    }
  }

  // Восстановление пароля
  async forgotPassword(email: string): Promise<void> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      // Не сообщаем, что пользователь не найден (безопасность)
      return;
    }

    const resetToken = generatePasswordResetToken();
    const expiresAt = addDays(new Date(), 1); // Токен действителен 24 часа

    const query = `
      UPDATE users 
      SET password_reset_token = $1, password_reset_expires = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `;

    try {
      await this.pool.query(query, [resetToken, expiresAt, user.id]);
      // Здесь должна быть отправка email с токеном
      console.log(`Password reset token for ${email}: ${resetToken}`);
    } catch (error) {
      throw new Error(`Ошибка при создании токена сброса пароля: ${error}`);
    }
  }

  // Сброс пароля
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.getUserByResetToken(token);
    if (!user) {
      throw new Error('Недействительный токен сброса пароля');
    }

    if (isTokenExpired(user.password_reset_expires)) {
      throw new Error('Токен сброса пароля истек');
    }

    const passwordHash = await hashPassword(newPassword);

    const query = `
      UPDATE users 
      SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    try {
      await this.pool.query(query, [passwordHash, user.id]);
    } catch (error) {
      throw new Error(`Ошибка при сбросе пароля: ${error}`);
    }
  }

  // Повторная отправка письма подтверждения email (генерация нового токена)
  async resendEmailVerification(userId: number): Promise<{ email: string; token: string }> {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('Пользователь не найден');
    if (user.email_verified) throw new Error('Email уже подтвержден');

    const token = generateEmailVerificationToken();
    const expires = addDays(new Date(), 2);
    await this.pool.query(
      'UPDATE users SET email_verification_token = $1, email_verification_expires = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [token, expires, userId]
    );
    return { email: user.email, token };
  }

  // Подтверждение email
  async verifyEmail(token: string): Promise<void> {
    const user = await this.getUserByVerificationToken(token);
    if (!user) {
      throw new Error('Недействительный токен подтверждения email');
    }
    if (user.email_verification_expires && new Date() > new Date(user.email_verification_expires)) {
      throw new Error('Срок действия токена подтверждения истек');
    }

    const query = `
      UPDATE users 
      SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    try {
      await this.pool.query(query, [user.id]);
    } catch (error) {
      throw new Error(`Ошибка при подтверждении email: ${error}`);
    }
  }

  // Получение пользователя по email
  private async getUserByEmail(email: string): Promise<any> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.pool.query(query, [email]);
    return result.rows[0] || null;
  }

  // Получение пользователя по username
  private async getUserByUsername(username: string): Promise<any> {
    const query = 'SELECT * FROM users WHERE username = $1';
    const result = await this.pool.query(query, [username]);
    return result.rows[0] || null;
  }

  // Получение пользователя по ID
  private async getUserById(id: number): Promise<any> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // Получение пользователя по токену сброса пароля
  private async getUserByResetToken(token: string): Promise<any> {
    const query = 'SELECT * FROM users WHERE password_reset_token = $1';
    const result = await this.pool.query(query, [token]);
    return result.rows[0] || null;
  }

  // Получение пользователя по токену подтверждения email
  private async getUserByVerificationToken(token: string): Promise<any> {
    const query = 'SELECT * FROM users WHERE email_verification_token = $1';
    const result = await this.pool.query(query, [token]);
    return result.rows[0] || null;
  }

  // Сохранение refresh токена
  private async saveRefreshToken(userId: number, token: string): Promise<void> {
    const expiresAt = addDays(new Date(), 7); // 7 дней
    const tokenHash = require('../utils/auth').hashToken(token);

    const query = `
      INSERT INTO user_sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `;

    await this.pool.query(query, [userId, tokenHash, expiresAt]);
  }

  // Получение сессии по токену
  private async getSessionByToken(token: string): Promise<any> {
    const tokenHash = require('../utils/auth').hashToken(token);
    const query = 'SELECT * FROM user_sessions WHERE token_hash = $1';
    const result = await this.pool.query(query, [tokenHash]);
    return result.rows[0] || null;
  }

  // Удаление сессии
  private async deleteSession(sessionId: number): Promise<void> {
    const query = 'DELETE FROM user_sessions WHERE id = $1';
    await this.pool.query(query, [sessionId]);
  }

  // Удаление сессии по токену
  private async deleteSessionByToken(token: string): Promise<void> {
    const tokenHash = require('../utils/auth').hashToken(token);
    const query = 'DELETE FROM user_sessions WHERE token_hash = $1';
    await this.pool.query(query, [tokenHash]);
  }

  // Маппинг пользователя из базы данных
  private mapUserFromDb(dbUser: any): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      full_name: dbUser.full_name,
      avatar_url: dbUser.avatar_url,
      role: dbUser.role,
      is_active: dbUser.is_active,
      email_verified: dbUser.email_verified,
      email_verification_token: dbUser.email_verification_token,
      created_at: new Date(dbUser.created_at),
      updated_at: new Date(dbUser.updated_at)
    };
  }
} 