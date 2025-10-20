import { AuthService } from '../../services/authService';
import { createMockPool, createQueryResult } from '../mocks';
import { hashPassword, generateRefreshToken, hashToken } from '../../utils/auth';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPool: any;

  beforeEach(() => {
    mockPool = createMockPool();
    authService = new AuthService(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // 1.1. User Registration (registerUser)
  // ============================================================================

  describe('registerUser', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      username: 'testuser',
      full_name: 'Test User',
    };

    it('should register user successfully', async () => {
      mockPool.query
        .mockResolvedValueOnce(createQueryResult([])) // getUserByEmail
        .mockResolvedValueOnce(createQueryResult([])) // getUserByUsername
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              email: 'test@example.com',
              username: 'testuser',
              full_name: 'Test User',
              role: 'user',
              email_verified: false,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ])
        );

      const user = await authService.registerUser(validRegisterData);

      expect(user.email).toBe('test@example.com');
      expect(user.username).toBe('testuser');
      expect(user.email_verified).toBe(false);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.any(Array)
      );
    });

    it('should throw error for invalid email', async () => {
      const invalidData = {
        ...validRegisterData,
        email: 'invalid-email',
      };

      await expect(authService.registerUser(invalidData)).rejects.toThrow('Validation error');
    });

    it('should throw error for weak password', async () => {
      const weakData = {
        ...validRegisterData,
        password: 'weak',
      };

      await expect(authService.registerUser(weakData)).rejects.toThrow('Validation error');
    });

    it('should throw error when email already exists', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 2,
            email: 'test@example.com',
          },
        ])
      );

      await expect(authService.registerUser(validRegisterData)).rejects.toThrow(
        'Пользователь с таким email уже существует'
      );
    });

    it('should throw error when username already exists', async () => {
      mockPool.query
        .mockResolvedValueOnce(createQueryResult([])) // email check
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 2,
              username: 'testuser',
            },
          ])
        ); // username check

      await expect(authService.registerUser(validRegisterData)).rejects.toThrow(
        'Пользователь с таким именем уже существует'
      );
    });

    it('should generate email verification token', async () => {
      mockPool.query
        .mockResolvedValueOnce(createQueryResult([]))
        .mockResolvedValueOnce(createQueryResult([]))
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              email: 'test@example.com',
              email_verified: false,
              email_verification_token: 'generated-token',
            },
          ])
        );

      const user = await authService.registerUser(validRegisterData);

      expect(user.email_verified).toBe(false);
    });
  });

  // ============================================================================
  // 1.2. User Login (loginUser)
  // ============================================================================

  describe('loginUser', () => {
    const validLoginData = {
      login: 'test@example.com',
      password: 'TestPassword123!',
    };

    it('should login user with email successfully', async () => {
      const passwordHash = await hashPassword('TestPassword123!');

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              email: 'test@example.com',
              password_hash: passwordHash,
              role: 'user',
              email_verified: true,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ])
        ) // getUserByEmail
        .mockResolvedValueOnce(createQueryResult([])); // saveRefreshToken

      const result = await authService.loginUser(validLoginData);

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('should login user with username successfully', async () => {
      const passwordHash = await hashPassword('TestPassword123!');

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              email: 'test@example.com',
              username: 'testuser',
              password_hash: passwordHash,
              role: 'user',
              email_verified: true,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ])
        ) // getUserByUsername
        .mockResolvedValueOnce(createQueryResult([])); // saveRefreshToken

      const result = await authService.loginUser({
        login: 'testuser',
        password: 'TestPassword123!',
      });

      expect(result.user.username).toBe('testuser');
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('should throw error when user not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(authService.loginUser(validLoginData)).rejects.toThrow(
        'Неверный email или пароль'
      );
    });

    it('should throw error for wrong password', async () => {
      const passwordHash = await hashPassword('CorrectPassword123!');

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            email: 'test@example.com',
            password_hash: passwordHash,
            is_active: true,
          },
        ])
      );

      await expect(authService.loginUser(validLoginData)).rejects.toThrow(
        'Неверный email или пароль'
      );
    });

    it('should throw error when account is blocked', async () => {
      const passwordHash = await hashPassword('TestPassword123!');

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            email: 'test@example.com',
            password_hash: passwordHash,
            is_active: false, // Blocked
          },
        ])
      );

      await expect(authService.loginUser(validLoginData)).rejects.toThrow('Аккаунт заблокирован');
    });

    it('should save refresh token to database', async () => {
      const passwordHash = await hashPassword('TestPassword123!');

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              email: 'test@example.com',
              password_hash: passwordHash,
              role: 'user',
              email_verified: true,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([]));

      await authService.loginUser(validLoginData);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_sessions'),
        expect.any(Array)
      );
    });
  });

  // ============================================================================
  // 1.3. Token Refresh (refreshAccessToken)
  // ============================================================================

  describe('refreshAccessToken', () => {
    it('should refresh access token with valid refresh token', async () => {
      const refreshToken = generateRefreshToken();
      const hashedToken = hashToken(refreshToken);

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              user_id: 1,
              token_hash: hashedToken,
              expires_at: new Date(Date.now() + 3600000),
            },
          ])
        ) // getSessionByToken
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              email: 'test@example.com',
              role: 'user',
              email_verified: true,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ])
        ); // getUserById

      const result = await authService.refreshAccessToken(refreshToken);

      expect(result.accessToken).toBeTruthy();
      expect(typeof result.accessToken).toBe('string');
    });

    it('should throw error for invalid refresh token', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(authService.refreshAccessToken('invalid-token')).rejects.toThrow(
        'Недействительный refresh токен'
      );
    });

    it('should throw error for expired refresh token', async () => {
      const refreshToken = generateRefreshToken();
      const hashedToken = hashToken(refreshToken);

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            user_id: 1,
            token_hash: hashedToken,
            expires_at: new Date(Date.now() - 3600000), // Expired
          },
        ])
      );

      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow(
        'Refresh токен истек'
      );
    });

    it('should throw error when user not found', async () => {
      const refreshToken = generateRefreshToken();
      const hashedToken = hashToken(refreshToken);

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              user_id: 999,
              token_hash: hashedToken,
              expires_at: new Date(Date.now() + 3600000),
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([])); // User not found

      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow(
        'Пользователь не найден'
      );
    });
  });

  // ============================================================================
  // 1.4. Logout (logoutUser)
  // ============================================================================

  describe('logoutUser', () => {
    it('should logout user successfully', async () => {
      const refreshToken = generateRefreshToken();

      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(authService.logoutUser(1, refreshToken)).resolves.not.toThrow();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_sessions'),
        expect.any(Array)
      );
    });
  });

  // ============================================================================
  // 1.5. Profile Management
  // ============================================================================

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            email: 'test@example.com',
            username: 'testuser',
            role: 'user',
            email_verified: true,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ])
      );

      const user = await authService.getUserProfile(1);

      expect(user.id).toBe(1);
      expect(user.email).toBe('test@example.com');
    });

    it('should throw error when user not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(authService.getUserProfile(999)).rejects.toThrow('Пользователь не найден');
    });
  });

  describe('updateUserProfile', () => {
    it('should update username successfully', async () => {
      mockPool.query
        .mockResolvedValueOnce(createQueryResult([])) // check username not exists
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              email: 'test@example.com',
              username: 'newuser',
              role: 'user',
              email_verified: true,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ])
        ); // UPDATE

      const user = await authService.updateUserProfile(1, { username: 'newuser' });

      expect(user.username).toBe('newuser');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.any(Array)
      );
    });

    it('should update full_name successfully', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            email: 'test@example.com',
            full_name: 'New Name',
            role: 'user',
            email_verified: true,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ])
      );

      const user = await authService.updateUserProfile(1, { full_name: 'New Name' });

      expect(user.full_name).toBe('New Name');
    });

    it('should throw error when username already taken', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 2,
            username: 'taken',
          },
        ])
      );

      await expect(authService.updateUserProfile(1, { username: 'taken' })).rejects.toThrow(
        'Пользователь с таким именем уже существует'
      );
    });

    it('should throw error when user not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(authService.updateUserProfile(999, { full_name: 'Test' })).rejects.toThrow(
        'Пользователь не найден'
      );
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const oldPasswordHash = await hashPassword('OldPassword123!');

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              password_hash: oldPasswordHash,
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([]));

      await expect(
        authService.changePassword(1, {
          current_password: 'OldPassword123!',
          new_password: 'NewPassword123!',
        })
      ).resolves.not.toThrow();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.any(Array)
      );
    });

    it('should throw error for wrong old password', async () => {
      const oldPasswordHash = await hashPassword('CorrectOldPassword123!');

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            password_hash: oldPasswordHash,
          },
        ])
      );

      await expect(
        authService.changePassword(1, {
          current_password: 'WrongOldPassword123!',
          new_password: 'NewPassword123!',
        })
      ).rejects.toThrow('Неверный текущий пароль');
    });

    it('should throw error when user not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(
        authService.changePassword(999, {
          current_password: 'OldPassword123!',
          new_password: 'NewPassword123!',
        })
      ).rejects.toThrow('Пользователь не найден');
    });
  });

  // ============================================================================
  // 1.6. Password Reset Flow
  // ============================================================================

  describe('forgotPassword', () => {
    it('should generate reset token for valid email', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              email: 'test@example.com',
              password_reset_token: null,
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([]));

      await expect(authService.forgotPassword('test@example.com')).resolves.not.toThrow();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.any(Array)
      );
    });

    it('should silently return when user not found (security)', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(authService.forgotPassword('nonexistent@example.com')).resolves.not.toThrow();

      // Should not call UPDATE when user not found
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              email: 'test@example.com',
              password_reset_token: 'valid-token',
              password_reset_expires: new Date(Date.now() + 3600000),
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([]));

      await expect(
        authService.resetPassword('valid-token', 'NewPassword123!')
      ).resolves.not.toThrow();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.any(Array)
      );
    });

    it('should throw error for invalid token', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(authService.resetPassword('invalid-token', 'NewPassword123!')).rejects.toThrow(
        'Недействительный токен сброса пароля'
      );
    });

    it('should throw error for expired token', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            password_reset_token: 'valid-token',
            password_reset_expires: new Date(Date.now() - 3600000), // Expired
          },
        ])
      );

      await expect(authService.resetPassword('valid-token', 'NewPassword123!')).rejects.toThrow(
        'Токен сброса пароля истек'
      );
    });
  });

  // ============================================================================
  // 1.7. Email Verification
  // ============================================================================

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              email: 'test@example.com',
              email_verified: false,
              email_verification_token: 'valid-token',
              email_verification_expires: new Date(Date.now() + 3600000),
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              email: 'test@example.com',
              email_verified: true,
              role: 'user',
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ])
        );

      const user = await authService.verifyEmail('valid-token');

      expect(user.email_verified).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.any(Array)
      );
    });

    it('should throw error for invalid token', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(authService.verifyEmail('invalid-token')).rejects.toThrow(
        'Недействительный токен подтверждения email'
      );
    });

    it('should throw error for expired token', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            email_verified: false,
            email_verification_token: 'valid-token',
            email_verification_expires: new Date(Date.now() - 3600000), // Expired
          },
        ])
      );

      await expect(authService.verifyEmail('valid-token')).rejects.toThrow(
        'Срок действия токена подтверждения истек'
      );
    });
  });

  describe('resendEmailVerification', () => {
    it('should resend verification email', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              email: 'test@example.com',
              email_verified: false,
              email_verification_token: null,
              email_verification_expires: null,
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([]));

      const result = await authService.resendEmailVerification(1);

      expect(result.email).toBe('test@example.com');
      expect(result.token).toBeTruthy();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.any(Array)
      );
    });

    it('should throw error when email already verified', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            email_verified: true,
          },
        ])
      );

      await expect(authService.resendEmailVerification(1)).rejects.toThrow('Email уже подтвержден');
    });

    it('should throw error when user not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(authService.resendEmailVerification(999)).rejects.toThrow(
        'Пользователь не найден'
      );
    });

    it('should allow resending after token expiration', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              email: 'test@example.com',
              email_verified: false,
              email_verification_token: 'old-token',
              email_verification_expires: new Date(Date.now() - 3600000), // Expired
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([]));

      const result = await authService.resendEmailVerification(1);

      expect(result.token).toBeTruthy();
      expect(result.token).not.toBe('old-token');
    });
  });
});
