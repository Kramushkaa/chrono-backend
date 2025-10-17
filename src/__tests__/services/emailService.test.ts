import { EmailService } from '../../services/emailService';
import * as emailModule from '../../utils/email';

// Mock email utils
jest.mock('../../utils/email');

describe('EmailService', () => {
  let emailService: EmailService;
  let mockSendEmail: jest.MockedFunction<typeof emailModule.sendEmail>;

  beforeEach(() => {
    // Set up environment BEFORE creating service
    process.env.PUBLIC_APP_URL = 'https://chrono.ninja';
    
    emailService = new EmailService();
    mockSendEmail = emailModule.sendEmail as jest.MockedFunction<typeof emailModule.sendEmail>;
    mockSendEmail.mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.PUBLIC_APP_URL;
  });

  // ============================================================================
  // sendVerificationEmail() tests
  // ============================================================================

  describe('sendVerificationEmail', () => {
    it('should send verification email with correct URL', async () => {
      await emailService.sendVerificationEmail('user@example.com', 'token123', 'Test User');

      expect(mockSendEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Подтверждение email — Хронониндзя',
        expect.stringContaining('https://chrono.ninja/profile?verify_token=token123')
      );
    });

    it('should properly encode verification token in URL', async () => {
      const tokenWithSpecialChars = 'token+with/special=chars';
      await emailService.sendVerificationEmail('user@example.com', tokenWithSpecialChars);

      const htmlArg = mockSendEmail.mock.calls[0][2];
      expect(htmlArg).toContain(encodeURIComponent(tokenWithSpecialChars));
    });

    it('should use userName when provided', async () => {
      await emailService.sendVerificationEmail('user@example.com', 'token', 'John Doe');

      const htmlArg = mockSendEmail.mock.calls[0][2];
      expect(htmlArg).toContain('John Doe');
    });

    it('should fallback to email when userName not provided', async () => {
      await emailService.sendVerificationEmail('user@example.com', 'token');

      const htmlArg = mockSendEmail.mock.calls[0][2];
      expect(htmlArg).toContain('user@example.com');
    });

    it('should use default URL when PUBLIC_APP_URL not set', async () => {
      delete process.env.PUBLIC_APP_URL;
      const service = new EmailService();

      await service.sendVerificationEmail('user@example.com', 'token');

      const htmlArg = mockSendEmail.mock.calls[0][2];
      expect(htmlArg).toContain('http://localhost:3000/profile?verify_token=token');
    });
  });

  // ============================================================================
  // sendPasswordResetEmail() tests
  // ============================================================================

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with correct URL', async () => {
      await emailService.sendPasswordResetEmail('user@example.com', 'reset-token', 'Jane Doe');

      expect(mockSendEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Восстановление пароля — Хронониндзя',
        expect.stringContaining('https://chrono.ninja/reset-password?token=reset-token')
      );
    });

    it('should properly encode reset token in URL', async () => {
      const tokenWithSpecialChars = 'reset+token/special=chars';
      await emailService.sendPasswordResetEmail('user@example.com', tokenWithSpecialChars);

      const htmlArg = mockSendEmail.mock.calls[0][2];
      expect(htmlArg).toContain(encodeURIComponent(tokenWithSpecialChars));
    });

    it('should include security warning in email', async () => {
      await emailService.sendPasswordResetEmail('user@example.com', 'token');

      const htmlArg = mockSendEmail.mock.calls[0][2];
      expect(htmlArg).toContain('не запрашивали');
    });

    it('should use userName when provided', async () => {
      await emailService.sendPasswordResetEmail('user@example.com', 'token', 'Alice');

      const htmlArg = mockSendEmail.mock.calls[0][2];
      expect(htmlArg).toContain('Alice');
    });
  });

  // ============================================================================
  // sendWelcomeEmail() tests
  // ============================================================================

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with correct content', async () => {
      await emailService.sendWelcomeEmail('user@example.com', 'Bob');

      expect(mockSendEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Добро пожаловать — Хронониндзя',
        expect.stringContaining('Добро пожаловать')
      );
    });

    it('should include link to menu', async () => {
      await emailService.sendWelcomeEmail('user@example.com');

      const htmlArg = mockSendEmail.mock.calls[0][2];
      expect(htmlArg).toContain('https://chrono.ninja/menu');
    });

    it('should list application features', async () => {
      await emailService.sendWelcomeEmail('user@example.com');

      const htmlArg = mockSendEmail.mock.calls[0][2];
      expect(htmlArg).toContain('викторины');
      expect(htmlArg).toContain('рейтинг');
    });

    it('should use userName when provided', async () => {
      await emailService.sendWelcomeEmail('user@example.com', 'Charlie');

      const htmlArg = mockSendEmail.mock.calls[0][2];
      expect(htmlArg).toContain('Charlie');
    });
  });
});

