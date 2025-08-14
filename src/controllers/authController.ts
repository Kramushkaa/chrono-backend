import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { 
  RegisterRequest, 
  LoginRequest, 
  UpdateProfileRequest, 
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest
} from '../types/auth';
import { errors } from '../utils/errors';

export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  // Регистрация пользователя
  async register(req: Request, res: Response, next: any): Promise<void> {
    try {
      const userData: RegisterRequest = req.body;
      const user = await this.authService.registerUser(userData);

      // Отправка письма с подтверждением email (best-effort)
      try {
        const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
        const verifyToken = (user as any).email_verification_token as string; // заполнено в сервисе
        const verifyUrl = `${baseUrl}/profile?verify_token=${encodeURIComponent(verifyToken)}`;
        const html = `
          <div style="font-family: Arial, sans-serif;">
            <h2>Подтверждение email</h2>
            <p>Здравствуйте, ${user.full_name || user.username || user.email}!</p>
            <p>Для завершения регистрации подтвердите вашу почту, нажав на кнопку ниже.</p>
            <p>
              <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#2d7; color:#fff; text-decoration:none; border-radius:6px;">Подтвердить email</a>
            </p>
            <p>Если кнопка не работает, перейдите по ссылке: <br/> ${verifyUrl}</p>
          </div>
        `;
        const { sendEmail } = await import('../utils/email');
        await sendEmail(user.email, 'Подтверждение email — Хронониндзя', html);
      } catch (err) {
        console.warn('Email verification send failed:', err);
      }

      res.status(201).json({
        success: true,
        message: 'Пользователь успешно зарегистрирован',
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            email_verified: user.email_verified
          }
        }
      });
    } catch (error) {
      next(errors.badRequest(error instanceof Error ? error.message : 'Ошибка при регистрации'));
    }
  }

  // Вход пользователя
  async login(req: Request, res: Response, next: any): Promise<void> {
    try {
      console.log('🔐 Login attempt:', { login: (req.body && (req.body.login || req.body.email)) || 'no-body', bodyType: typeof req.body });
      // Support legacy { email, password } and new { login, password }
      const loginData: LoginRequest = {
        login: (req.body && (req.body.login || req.body.email)) || '',
        password: (req.body && req.body.password) || ''
      };
      const result = await this.authService.loginUser(loginData);

      res.status(200).json({
        success: true,
        message: 'Успешный вход',
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            username: result.user.username,
            full_name: result.user.full_name,
            role: result.user.role,
            email_verified: result.user.email_verified
          },
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
          expires_in: 24 * 60 * 60 // 24 часа в секундах
        }
      });
    } catch (error) {
      console.error('🔐 Login error:', error);
      next(errors.unauthorized(error instanceof Error ? error.message : 'Ошибка при входе'));
    }
  }

  // Обновление токена доступа
  async refreshToken(req: Request, res: Response, next: any): Promise<void> {
    try {
      const { refresh_token } = req.body;
      
      if (!refresh_token) {
        return next(errors.badRequest('Refresh токен обязателен', 'missing_refresh_token'));
      }

      const result = await this.authService.refreshAccessToken(refresh_token);

      res.status(200).json({
        success: true,
        message: 'Токен успешно обновлен',
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            username: result.user.username,
            full_name: result.user.full_name,
            role: result.user.role,
            email_verified: result.user.email_verified
          },
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
          expires_in: 24 * 60 * 60 // 24 часа в секундах
        }
      });
    } catch (error) {
      next(errors.unauthorized(error instanceof Error ? error.message : 'Ошибка при обновлении токена'));
    }
  }

  // Выход пользователя
  async logout(req: Request, res: Response, next: any): Promise<void> {
    try {
      const { refresh_token } = req.body;
      const userId = req.user?.sub;

      if (!userId) {
        return next(errors.unauthorized('Требуется аутентификация'));
      }

      if (refresh_token) {
        await this.authService.logoutUser(userId, refresh_token);
      }

      res.status(200).json({
        success: true,
        message: 'Успешный выход'
      });
    } catch (error) {
      next(errors.server(error instanceof Error ? error.message : 'Ошибка при выходе'));
    }
  }

  // Получение профиля пользователя
  async getProfile(req: Request, res: Response, next: any): Promise<void> {
    try {
      const userId = req.user?.sub;
      
      if (!userId) {
        return next(errors.unauthorized('Требуется аутентификация'));
      }

      const user = await this.authService.getUserProfile(userId);

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
            role: user.role,
            email_verified: user.email_verified,
            created_at: user.created_at,
            updated_at: user.updated_at
          }
        }
      });
    } catch (error) {
      next(errors.notFound(error instanceof Error ? error.message : 'Профиль не найден'));
    }
  }

  // Обновление профиля пользователя
  async updateProfile(req: Request, res: Response, next: any): Promise<void> {
    try {
      const userId = req.user?.sub;
      const updateData: UpdateProfileRequest = req.body;

      if (!userId) {
        return next(errors.unauthorized('Требуется аутентификация'));
      }

      const user = await this.authService.updateUserProfile(userId, updateData);

      res.status(200).json({
        success: true,
        message: 'Профиль успешно обновлен',
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
            role: user.role,
            email_verified: user.email_verified,
            updated_at: user.updated_at
          }
        }
      });
    } catch (error) {
      next(errors.badRequest(error instanceof Error ? error.message : 'Ошибка при обновлении профиля'));
    }
  }

  // Изменение пароля
  async changePassword(req: Request, res: Response, next: any): Promise<void> {
    try {
      const userId = req.user?.sub;
      const passwordData: ChangePasswordRequest = req.body;

      if (!userId) {
        return next(errors.unauthorized('Требуется аутентификация'));
      }

      await this.authService.changePassword(userId, passwordData);

      res.status(200).json({
        success: true,
        message: 'Пароль успешно изменен'
      });
    } catch (error) {
      next(errors.badRequest(error instanceof Error ? error.message : 'Ошибка при изменении пароля'));
    }
  }

  // Запрос на восстановление пароля
  async forgotPassword(req: Request, res: Response, next: any): Promise<void> {
    try {
      const { email }: ForgotPasswordRequest = req.body;

      if (!email) {
        return next(errors.badRequest('Email обязателен', 'missing_email'));
      }

      await this.authService.forgotPassword(email);

      res.status(200).json({
        success: true,
        message: 'Если пользователь с таким email существует, инструкции по восстановлению пароля будут отправлены'
      });
    } catch (error) {
      next(errors.server(error instanceof Error ? error.message : 'Ошибка при запросе восстановления пароля'));
    }
  }

  // Сброс пароля
  async resetPassword(req: Request, res: Response, next: any): Promise<void> {
    try {
      const { token, new_password }: ResetPasswordRequest = req.body;

      if (!token || !new_password) {
        return next(errors.badRequest('Токен и новый пароль обязательны', 'missing_fields'));
      }

      await this.authService.resetPassword(token, new_password);

      res.status(200).json({
        success: true,
        message: 'Пароль успешно сброшен'
      });
    } catch (error) {
      next(errors.badRequest(error instanceof Error ? error.message : 'Ошибка при сбросе пароля'));
    }
  }

  // Подтверждение email
  async verifyEmail(req: Request, res: Response, next: any): Promise<void> {
    try {
      const token = (req.body && (req.body as any).token) || (req.query && (req.query as any).token);

      if (!token) {
        return next(errors.badRequest('Токен подтверждения обязателен', 'missing_token'));
      }

      await this.authService.verifyEmail(token);

      res.status(200).json({
        success: true,
        message: 'Email успешно подтвержден'
      });
    } catch (error) {
      next(errors.badRequest(error instanceof Error ? error.message : 'Ошибка при подтверждении email'));
    }
  }

  // Повторная отправка письма с подтверждением
  async resendVerification(req: Request, res: Response, next: any): Promise<void> {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        return next(errors.unauthorized('Требуется аутентификация'));
      }
      const { email, token } = await this.authService.resendEmailVerification(userId);

      try {
        const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
        const verifyUrl = `${baseUrl}/profile?verify_token=${encodeURIComponent(token)}`;
        const html = `
          <div style="font-family: Arial, sans-serif;">
            <h2>Подтверждение email</h2>
            <p>Здравствуйте!</p>
            <p>Для подтверждения почты нажмите на кнопку:</p>
            <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#2d7; color:#fff; text-decoration:none; border-radius:6px;">Подтвердить email</a></p>
            <p>Или перейдите по ссылке: ${verifyUrl}</p>
          </div>`;
        const { sendEmail } = await import('../utils/email');
        await sendEmail(email, 'Подтверждение email — Хронониндзя', html);
      } catch (err) {
        console.warn('Resend verification send failed:', err);
      }

      res.status(200).json({ success: true, message: 'Письмо отправлено повторно' });
    } catch (error) {
      next(errors.badRequest(error instanceof Error ? error.message : 'Ошибка'));
    }
  }

  // Проверка статуса аутентификации
  async checkAuth(req: Request, res: Response, next: any): Promise<void> {
    try {
      const userId = req.user?.sub;
      
      if (!userId) {
        return next(errors.unauthorized('Пользователь не аутентифицирован'));
      }

      const user = await this.authService.getUserProfile(userId);

      res.status(200).json({
        success: true,
        authenticated: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            email_verified: user.email_verified
          }
        }
      });
    } catch (error) {
      next(errors.unauthorized('Пользователь не аутентифицирован'));
    }
  }
} 