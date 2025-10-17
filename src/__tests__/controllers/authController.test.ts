import { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../controllers/authController';
import { AuthService } from '../../services/authService';
import { TelegramService } from '../../services/telegramService';
import { User } from '../../types/auth';
import * as emailModule from '../../utils/email';

// Mock modules
jest.mock('../../services/authService');
jest.mock('../../services/telegramService');
jest.mock('../../utils/email');

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockTelegramService: jest.Mocked<TelegramService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
    full_name: 'Test User',
    role: 'user',
    is_active: true,
    email_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
    email_verification_token: 'test-token',
  };

  beforeEach(() => {
    // Create mock instances
    mockAuthService = {
      registerUser: jest.fn(),
      loginUser: jest.fn(),
      refreshAccessToken: jest.fn(),
      logoutUser: jest.fn(),
      getUserProfile: jest.fn(),
      updateUserProfile: jest.fn(),
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      verifyEmail: jest.fn(),
      resendEmailVerification: jest.fn(),
    } as any;

    mockTelegramService = {
      notifyNewRegistration: jest.fn().mockResolvedValue(undefined),
      notifyVerificationEmailSent: jest.fn().mockResolvedValue(undefined),
      notifyEmailVerified: jest.fn().mockResolvedValue(undefined),
    } as any;

    authController = new AuthController(mockAuthService, mockTelegramService);

    mockRequest = {
      body: {},
      query: {},
      user: undefined,
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Mock sendEmail
    (emailModule.sendEmail as jest.Mock) = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // register() tests
  // ============================================================================

  describe('register', () => {
    it('should successfully register a user with email and telegram notifications', async () => {
      const registerData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Password123!',
        full_name: 'Test User',
      };

      mockRequest.body = registerData;
      mockAuthService.registerUser.mockResolvedValue(mockUser);

      await authController.register(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.registerUser).toHaveBeenCalledWith(registerData);
      expect(mockTelegramService.notifyNewRegistration).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.username,
        mockUser.full_name
      );
      expect(emailModule.sendEmail).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Пользователь успешно зарегистрирован',
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: mockUser.id,
              email: mockUser.email,
              username: mockUser.username,
            }),
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle email send failure gracefully', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Password123!',
      };
      mockAuthService.registerUser.mockResolvedValue(mockUser);
      (emailModule.sendEmail as jest.Mock).mockRejectedValue(new Error('Email service down'));

      await authController.register(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle validation errors from auth service', async () => {
      mockRequest.body = { email: 'invalid' };
      mockAuthService.registerUser.mockRejectedValue(new Error('Invalid email format'));

      await authController.register(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid email format'),
        })
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return correct response format', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Password123!',
      };
      mockAuthService.registerUser.mockResolvedValue(mockUser);

      await authController.register(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('data');
      expect(response.data).toHaveProperty('user');
      expect(response.data.user).not.toHaveProperty('password');
      expect(response.data.user).not.toHaveProperty('password_hash');
    });
  });

  // ============================================================================
  // login() tests
  // ============================================================================

  describe('login', () => {
    const loginResult = {
      user: mockUser,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };

    it('should support legacy email login', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'Password123!',
      };
      mockAuthService.loginUser.mockResolvedValue(loginResult);

      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.loginUser).toHaveBeenCalledWith({
        login: 'test@example.com',
        password: 'Password123!',
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.any(Object),
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 24 * 60 * 60,
          }),
        })
      );
    });

    it('should support username login', async () => {
      mockRequest.body = {
        login: 'testuser',
        password: 'Password123!',
      };
      mockAuthService.loginUser.mockResolvedValue(loginResult);

      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.loginUser).toHaveBeenCalledWith({
        login: 'testuser',
        password: 'Password123!',
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle invalid credentials', async () => {
      mockRequest.body = {
        login: 'testuser',
        password: 'wrong',
      };
      mockAuthService.loginUser.mockRejectedValue(new Error('Invalid credentials'));

      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid credentials'),
        })
      );
    });
  });

  // ============================================================================
  // refreshToken() tests
  // ============================================================================

  describe('refreshToken', () => {
    const refreshResult = {
      user: mockUser,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    };

    it('should successfully refresh a valid token', async () => {
      mockRequest.body = { refresh_token: 'valid-refresh-token' };
      mockAuthService.refreshAccessToken.mockResolvedValue(refreshResult);

      await authController.refreshToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
          }),
        })
      );
    });

    it('should handle missing refresh token', async () => {
      mockRequest.body = {};

      await authController.refreshToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Refresh токен обязателен'),
        })
      );
      expect(mockAuthService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should handle invalid/expired token', async () => {
      mockRequest.body = { refresh_token: 'expired-token' };
      mockAuthService.refreshAccessToken.mockRejectedValue(
        new Error('Invalid or expired refresh token')
      );

      await authController.refreshToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid or expired'),
        })
      );
    });
  });

  // ============================================================================
  // logout() tests
  // ============================================================================

  describe('logout', () => {
    it('should successfully logout with refresh token', async () => {
      mockRequest.body = { refresh_token: 'refresh-token' };
      mockRequest.user = { sub: 1 } as any;
      mockAuthService.logoutUser.mockResolvedValue();

      await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.logoutUser).toHaveBeenCalledWith(1, 'refresh-token');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Успешный выход',
        })
      );
    });

    it('should handle logout without refresh token', async () => {
      mockRequest.body = {};
      mockRequest.user = { sub: 1 } as any;

      await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.logoutUser).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should require authentication', async () => {
      mockRequest.body = { refresh_token: 'token' };
      mockRequest.user = undefined;

      await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Требуется аутентификация'),
        })
      );
      expect(mockAuthService.logoutUser).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getProfile() tests
  // ============================================================================

  describe('getProfile', () => {
    it('should successfully get user profile', async () => {
      mockRequest.user = { sub: 1 } as any;
      mockAuthService.getUserProfile.mockResolvedValue(mockUser);

      await authController.getProfile(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.getUserProfile).toHaveBeenCalledWith(1);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: mockUser.id,
              email: mockUser.email,
            }),
          }),
        })
      );
    });

    it('should handle user not found', async () => {
      mockRequest.user = { sub: 999 } as any;
      mockAuthService.getUserProfile.mockRejectedValue(new Error('User not found'));

      await authController.getProfile(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('User not found'),
        })
      );
    });

    it('should require authentication', async () => {
      mockRequest.user = undefined;

      await authController.getProfile(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Требуется аутентификация'),
        })
      );
    });
  });

  // ============================================================================
  // updateProfile() tests
  // ============================================================================

  describe('updateProfile', () => {
    it('should successfully update user profile', async () => {
      mockRequest.user = { sub: 1 } as any;
      mockRequest.body = {
        full_name: 'Updated Name',
        avatar_url: 'https://example.com/avatar.jpg',
      };
      const updatedUser = { ...mockUser, full_name: 'Updated Name' };
      mockAuthService.updateUserProfile.mockResolvedValue(updatedUser);

      await authController.updateProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.updateUserProfile).toHaveBeenCalledWith(1, mockRequest.body);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Профиль успешно обновлен',
        })
      );
    });

    it('should handle validation errors', async () => {
      mockRequest.user = { sub: 1 } as any;
      mockRequest.body = { username: 'a' }; // Too short
      mockAuthService.updateUserProfile.mockRejectedValue(
        new Error('Username must be at least 3 characters')
      );

      await authController.updateProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Username must be'),
        })
      );
    });

    it('should require authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.body = { full_name: 'Test' };

      await authController.updateProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockAuthService.updateUserProfile).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // changePassword() tests
  // ============================================================================

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      mockRequest.user = { sub: 1 } as any;
      mockRequest.body = {
        old_password: 'OldPass123!',
        new_password: 'NewPass123!',
      };
      mockAuthService.changePassword.mockResolvedValue();

      await authController.changePassword(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(1, mockRequest.body);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Пароль успешно изменен',
        })
      );
    });

    it('should handle validation errors', async () => {
      mockRequest.user = { sub: 1 } as any;
      mockRequest.body = {
        old_password: 'wrong',
        new_password: 'NewPass123!',
      };
      mockAuthService.changePassword.mockRejectedValue(new Error('Old password is incorrect'));

      await authController.changePassword(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Old password'),
        })
      );
    });

    it('should require authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.body = { old_password: 'old', new_password: 'new' };

      await authController.changePassword(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockAuthService.changePassword).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // forgotPassword() tests
  // ============================================================================

  describe('forgotPassword', () => {
    it('should handle existing user', async () => {
      mockRequest.body = { email: 'test@example.com' };
      mockAuthService.forgotPassword.mockResolvedValue();

      await authController.forgotPassword(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('test@example.com');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('инструкции по восстановлению'),
        })
      );
    });

    it('should return same response for non-existing user (security)', async () => {
      mockRequest.body = { email: 'nonexistent@example.com' };
      mockAuthService.forgotPassword.mockResolvedValue();

      await authController.forgotPassword(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      // Same response regardless of user existence
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should handle missing email', async () => {
      mockRequest.body = {};

      await authController.forgotPassword(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Email обязателен'),
        })
      );
      expect(mockAuthService.forgotPassword).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // resetPassword() tests
  // ============================================================================

  describe('resetPassword', () => {
    it('should successfully reset password with valid token', async () => {
      mockRequest.body = {
        token: 'valid-reset-token',
        new_password: 'NewPassword123!',
      };
      mockAuthService.resetPassword.mockResolvedValue();

      await authController.resetPassword(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        'valid-reset-token',
        'NewPassword123!'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Пароль успешно сброшен',
        })
      );
    });

    it('should handle invalid/expired token', async () => {
      mockRequest.body = {
        token: 'expired-token',
        new_password: 'NewPassword123!',
      };
      mockAuthService.resetPassword.mockRejectedValue(new Error('Invalid or expired token'));

      await authController.resetPassword(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid or expired'),
        })
      );
    });

    it('should handle missing fields', async () => {
      mockRequest.body = { token: 'token' }; // Missing new_password

      await authController.resetPassword(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('обязательны'),
        })
      );
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // verifyEmail() tests
  // ============================================================================

  describe('verifyEmail', () => {
    it('should successfully verify email via POST', async () => {
      mockRequest.body = { token: 'verification-token' };
      mockAuthService.verifyEmail.mockResolvedValue(mockUser);

      await authController.verifyEmail(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('verification-token');
      expect(mockTelegramService.notifyEmailVerified).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.username
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Email успешно подтвержден',
        })
      );
    });

    it('should successfully verify email via GET query param', async () => {
      mockRequest.body = {};
      mockRequest.query = { token: 'verification-token' };
      mockAuthService.verifyEmail.mockResolvedValue(mockUser);

      await authController.verifyEmail(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('verification-token');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle invalid token', async () => {
      mockRequest.body = { token: 'invalid-token' };
      mockAuthService.verifyEmail.mockRejectedValue(new Error('Invalid verification token'));

      await authController.verifyEmail(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid verification'),
        })
      );
    });

    it('should handle missing token', async () => {
      mockRequest.body = {};
      mockRequest.query = {};

      await authController.verifyEmail(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Токен подтверждения обязателен'),
        })
      );
      expect(mockAuthService.verifyEmail).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // resendVerification() tests
  // ============================================================================

  describe('resendVerification', () => {
    it('should successfully resend verification email', async () => {
      mockRequest.user = { sub: 1 } as any;
      mockAuthService.resendEmailVerification.mockResolvedValue({
        email: 'test@example.com',
        token: 'new-verification-token',
      });

      await authController.resendVerification(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockAuthService.resendEmailVerification).toHaveBeenCalledWith(1);
      expect(emailModule.sendEmail).toHaveBeenCalled();
      expect(mockTelegramService.notifyVerificationEmailSent).toHaveBeenCalledWith(
        'test@example.com',
        true
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Письмо отправлено повторно',
        })
      );
    });

    it('should handle email send failure gracefully', async () => {
      mockRequest.user = { sub: 1 } as any;
      mockAuthService.resendEmailVerification.mockResolvedValue({
        email: 'test@example.com',
        token: 'token',
      });
      (emailModule.sendEmail as jest.Mock).mockRejectedValue(new Error('Email failed'));

      await authController.resendVerification(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      mockRequest.user = undefined;

      await authController.resendVerification(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Требуется аутентификация'),
        })
      );
      expect(mockAuthService.resendEmailVerification).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // checkAuth() tests
  // ============================================================================

  describe('checkAuth', () => {
    it('should return authenticated user', async () => {
      mockRequest.user = { sub: 1 } as any;
      mockAuthService.getUserProfile.mockResolvedValue(mockUser);

      await authController.checkAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.getUserProfile).toHaveBeenCalledWith(1);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          authenticated: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: mockUser.id,
              email: mockUser.email,
            }),
          }),
        })
      );
    });

    it('should handle unauthenticated request', async () => {
      mockRequest.user = undefined;

      await authController.checkAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('не аутентифицирован'),
        })
      );
      expect(mockAuthService.getUserProfile).not.toHaveBeenCalled();
    });

    it('should handle user not found', async () => {
      mockRequest.user = { sub: 999 } as any;
      mockAuthService.getUserProfile.mockRejectedValue(new Error('User not found'));

      await authController.checkAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('не аутентифицирован'),
        })
      );
    });
  });
});

