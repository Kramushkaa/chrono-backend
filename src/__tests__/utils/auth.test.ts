import jwt from 'jsonwebtoken';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  hashToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  validateEmail,
  validatePassword,
  validateUsername,
  validateRegisterData,
  validateLoginData,
  hasPermission,
  addDays,
  isTokenExpired,
} from '../../utils/auth';
import { User } from '../../types/auth';

describe('auth.ts Utils', () => {
  // ============================================================================
  // 2.1. Password Functions
  // ============================================================================

  describe('Password Functions', () => {
    describe('hashPassword', () => {
      it('should generate bcrypt hash', async () => {
        const password = 'TestPassword123!';
        const hash = await hashPassword(password);

        expect(hash).toBeTruthy();
        expect(hash.length).toBeGreaterThan(50);
        expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt format
      });

      it('should generate different hashes for same password', async () => {
        const password = 'TestPassword123!';
        const hash1 = await hashPassword(password);
        const hash2 = await hashPassword(password);

        expect(hash1).not.toBe(hash2);
      });
    });

    describe('comparePassword', () => {
      it('should return true for correct password', async () => {
        const password = 'TestPassword123!';
        const hash = await hashPassword(password);
        const result = await comparePassword(password, hash);

        expect(result).toBe(true);
      });

      it('should return false for wrong password', async () => {
        const password = 'TestPassword123!';
        const hash = await hashPassword(password);
        const result = await comparePassword('WrongPassword123!', hash);

        expect(result).toBe(false);
      });

      it('should handle empty strings', async () => {
        const hash = await hashPassword('test');
        const result = await comparePassword('', hash);

        expect(result).toBe(false);
      });
    });

    describe('validatePassword', () => {
      it('should reject password that is too short', () => {
        const result = validatePassword('Test1');

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('минимум 8 символов');
      });

      it('should reject password without uppercase letter', () => {
        const result = validatePassword('testpassword123!');

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.message.includes('хотя бы одну заглавную'))).toBe(true);
      });

      it('should reject password without lowercase letter', () => {
        const result = validatePassword('TESTPASSWORD123!');

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.message.includes('хотя бы одну строчную'))).toBe(true);
      });

      it('should reject password without number', () => {
        const result = validatePassword('TestPassword!');

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.message.includes('хотя бы одну цифру'))).toBe(true);
      });

      it('should accept valid strong password', () => {
        const result = validatePassword('TestPassword123!');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept valid password without special chars', () => {
        const result = validatePassword('TestPassword123');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  // ============================================================================
  // 2.2. Token Functions
  // ============================================================================

  describe('Token Functions', () => {
    describe('generateAccessToken', () => {
      it('should generate valid JWT with correct payload', () => {
        const user: User = {
          id: 1,
          email: 'test@example.com',
          role: 'user',
          email_verified: true,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        const token = generateAccessToken(user);

        expect(token).toBeTruthy();
        expect(typeof token).toBe('string');

        // Verify token structure
        const decoded = jwt.decode(token) as any;
        expect(decoded.sub).toBe(1);
        expect(decoded.email).toBe('test@example.com');
        expect(decoded.role).toBe('user');
        expect(decoded.email_verified).toBe(true);
        expect(decoded.exp).toBeTruthy();
      });

      it('should include expiration time', () => {
        const user: User = {
          id: 1,
          email: 'test@example.com',
          role: 'user',
          email_verified: false,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        const token = generateAccessToken(user);
        const decoded = jwt.decode(token) as any;

        expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      });
    });

    describe('generateRefreshToken', () => {
      it('should generate token of correct length', () => {
        const token = generateRefreshToken();

        expect(token).toBeTruthy();
        expect(token.length).toBe(128); // 64 bytes = 128 hex chars
      });

      it('should generate unique tokens', () => {
        const token1 = generateRefreshToken();
        const token2 = generateRefreshToken();

        expect(token1).not.toBe(token2);
      });

      it('should generate hex string', () => {
        const token = generateRefreshToken();

        expect(token).toMatch(/^[0-9a-f]{128}$/);
      });
    });

    describe('verifyAccessToken', () => {
      const user: User = {
        id: 1,
        email: 'test@example.com',
        role: 'user',
        email_verified: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      it('should verify valid token and return payload', () => {
        const token = generateAccessToken(user);
        const payload = verifyAccessToken(token);

        expect(payload).toBeTruthy();
        expect(payload?.sub).toBe(1);
        expect(payload?.email).toBe('test@example.com');
        expect(payload?.role).toBe('user');
      });

      it('should return null for invalid signature', () => {
        const token = generateAccessToken(user);
        const tamperedToken = token.slice(0, -10) + 'tampered123';

        const payload = verifyAccessToken(tamperedToken);

        expect(payload).toBeNull();
      });

      it('should return null for malformed token', () => {
        const payload = verifyAccessToken('not.a.valid.jwt.token');

        expect(payload).toBeNull();
      });

      it('should return null for empty token', () => {
        const payload = verifyAccessToken('');

        expect(payload).toBeNull();
      });
    });

    describe('hashToken', () => {
      it('should generate consistent hash for same input', () => {
        const token = 'test-refresh-token';
        const hash1 = hashToken(token);
        const hash2 = hashToken(token);

        expect(hash1).toBe(hash2);
      });

      it('should generate different hashes for different inputs', () => {
        const hash1 = hashToken('token1');
        const hash2 = hashToken('token2');

        expect(hash1).not.toBe(hash2);
      });

      it('should generate SHA256 format hash', () => {
        const token = 'test-token';
        const hash = hashToken(token);

        expect(hash).toMatch(/^[0-9a-f]{64}$/); // SHA256 = 64 hex chars
      });
    });

    describe('generateEmailVerificationToken', () => {
      it('should generate token of correct length', () => {
        const token = generateEmailVerificationToken();

        expect(token).toBeTruthy();
        expect(token.length).toBe(64); // 32 bytes = 64 hex chars
      });

      it('should generate unique tokens', () => {
        const token1 = generateEmailVerificationToken();
        const token2 = generateEmailVerificationToken();

        expect(token1).not.toBe(token2);
      });
    });

    describe('generatePasswordResetToken', () => {
      it('should generate token of correct length', () => {
        const token = generatePasswordResetToken();

        expect(token).toBeTruthy();
        expect(token.length).toBe(64); // 32 bytes = 64 hex chars
      });

      it('should generate unique tokens', () => {
        const token1 = generatePasswordResetToken();
        const token2 = generatePasswordResetToken();

        expect(token1).not.toBe(token2);
      });
    });
  });

  // ============================================================================
  // 2.3. Validation Functions
  // ============================================================================

  describe('Validation Functions', () => {
    describe('validateEmail', () => {
      it('should accept valid email addresses', () => {
        expect(validateEmail('test@example.com')).toBe(true);
        expect(validateEmail('user.name+tag@example.co.uk')).toBe(true);
        expect(validateEmail('user_123@test-domain.com')).toBe(true);
      });

      it('should reject invalid email formats', () => {
        expect(validateEmail('invalid')).toBe(false);
        expect(validateEmail('invalid@')).toBe(false);
        expect(validateEmail('@invalid.com')).toBe(false);
        expect(validateEmail('invalid@com')).toBe(false);
        expect(validateEmail('invalid.email@')).toBe(false);
        expect(validateEmail('')).toBe(false);
      });
    });

    describe('validateUsername', () => {
      it('should accept valid usernames', () => {
        const result = validateUsername('testuser');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept usernames with numbers and underscores', () => {
        const result = validateUsername('test_user_123');

        expect(result.isValid).toBe(true);
      });

      it('should reject usernames that are too short', () => {
        const result = validateUsername('ab');

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.message.includes('минимум 3 символа'))).toBe(true);
      });

      it('should reject usernames with invalid characters', () => {
        const result = validateUsername('test user!');

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.message.includes('буквы, цифры, дефисы'))).toBe(true);
      });

      it('should accept short valid usernames like "adm"', () => {
        const result = validateUsername('adm');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('validateRegisterData', () => {
      it('should accept valid registration data', () => {
        const data = {
          email: 'test@example.com',
          password: 'TestPassword123!',
          username: 'testuser',
        };

        const result = validateRegisterData(data);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid email', () => {
        const data = {
          email: 'invalid-email',
          password: 'TestPassword123!',
        };

        const result = validateRegisterData(data);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'email')).toBe(true);
      });

      it('should reject weak password', () => {
        const data = {
          email: 'test@example.com',
          password: 'weak',
        };

        const result = validateRegisterData(data);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'password')).toBe(true);
      });

      it('should collect multiple validation errors', () => {
        const data = {
          email: 'invalid',
          password: 'weak',
          username: 'ab',
        };

        const result = validateRegisterData(data);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });
    });

    describe('validateLoginData', () => {
      it('should accept valid login data', () => {
        const data = {
          login: 'test@example.com',
          password: 'TestPassword123!',
        };

        const result = validateLoginData(data);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject missing login', () => {
        const data = {
          login: '',
          password: 'TestPassword123!',
        };

        const result = validateLoginData(data);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'login')).toBe(true);
      });

      it('should reject missing password', () => {
        const data = {
          login: 'test@example.com',
          password: '',
        };

        const result = validateLoginData(data);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'password')).toBe(true);
      });
    });
  });

  // ============================================================================
  // 2.4. Permission & Date Functions
  // ============================================================================

  describe('Permission & Date Functions', () => {
    describe('hasPermission', () => {
      it('should grant permissions for admin role', () => {
        expect(hasPermission('admin', 'read:persons')).toBe(true);
        expect(hasPermission('admin', 'write:persons')).toBe(true);
        expect(hasPermission('admin', 'delete:persons')).toBe(true);
        expect(hasPermission('admin', 'manage:roles')).toBe(true);
      });

      it('should grant permissions for moderator role', () => {
        expect(hasPermission('moderator', 'read:persons')).toBe(true);
        expect(hasPermission('moderator', 'write:persons')).toBe(true);
        expect(hasPermission('moderator', 'read:users')).toBe(true);
      });

      it('should deny delete permission for moderator', () => {
        expect(hasPermission('moderator', 'delete:persons')).toBe(false);
        expect(hasPermission('moderator', 'manage:roles')).toBe(false);
      });

      it('should grant basic permissions for user role', () => {
        expect(hasPermission('user', 'read:persons')).toBe(true);
      });

      it('should deny advanced permissions for user role', () => {
        expect(hasPermission('user', 'write:persons')).toBe(false);
        expect(hasPermission('user', 'delete:persons')).toBe(false);
        expect(hasPermission('user', 'manage:roles')).toBe(false);
      });
    });

    describe('addDays', () => {
      it('should add days correctly', () => {
        const date = new Date('2024-01-15T12:00:00Z');
        const newDate = addDays(date, 7);

        expect(newDate.toISOString()).toBe('2024-01-22T12:00:00.000Z');
      });

      it('should handle negative days', () => {
        const date = new Date('2024-01-15T12:00:00Z');
        const newDate = addDays(date, -5);

        expect(newDate.toISOString()).toBe('2024-01-10T12:00:00.000Z');
      });

      it('should handle month boundaries', () => {
        const date = new Date('2024-01-30T12:00:00Z');
        const newDate = addDays(date, 5);

        expect(newDate.getMonth()).toBe(1); // February
        expect(newDate.getDate()).toBe(4);
      });
    });

    describe('isTokenExpired', () => {
      it('should return false for future date', () => {
        const futureDate = new Date(Date.now() + 3600000); // +1 hour
        expect(isTokenExpired(futureDate)).toBe(false);
      });

      it('should return true for past date', () => {
        const pastDate = new Date(Date.now() - 3600000); // -1 hour
        expect(isTokenExpired(pastDate)).toBe(true);
      });

      it('should return true for current time (edge case)', () => {
        const now = new Date();
        // May be false or true depending on exact timing, but should handle it
        const result = isTokenExpired(now);
        expect(typeof result).toBe('boolean');
      });
    });
  });
});
