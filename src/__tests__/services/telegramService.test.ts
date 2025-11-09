import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TelegramService } from '../../services/telegramService';
import { logger } from '../../utils/logger';
import { Telegraf } from 'telegraf';

// Mock Telegraf
jest.mock('telegraf', () => ({
  Telegraf: jest.fn(),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('TelegramService', () => {
  let mockTelegram: any;
  let mockTelegrafInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock Telegram instance
    mockTelegram = {
      sendMessage: (jest.fn() as any).mockResolvedValue({ ok: true }),
    };
    mockTelegrafInstance = {
      telegram: mockTelegram,
    };

    (Telegraf as any).mockImplementation(() => mockTelegrafInstance);
  });

  describe('Constructor', () => {
    it('should initialize service when token and chatId are provided', () => {
      new TelegramService('test-token', 'test-chat-id');

      expect(Telegraf).toHaveBeenCalledWith('test-token');
      expect(logger.info).toHaveBeenCalledWith('Telegram notifications service initialized (Telegraf)');
    });

    it('should not initialize when token is missing', () => {
      new TelegramService(undefined, 'test-chat-id');

      expect(Telegraf).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Telegram notifications disabled: missing token or chat ID');
    });

    it('should not initialize when chatId is missing', () => {
      new TelegramService('test-token', undefined);

      expect(Telegraf).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Telegram notifications disabled: missing token or chat ID');
    });

    it('should handle initialization errors', () => {
      const error = new Error('Invalid token');
      (Telegraf as any).mockImplementation(() => {
        throw error;
      });

      new TelegramService('invalid-token', 'test-chat-id');

      expect(logger.error).toHaveBeenCalledWith('Telegram service initialization failed', {
        error,
      });
    });
  });

  describe('notifyNewRegistration', () => {
    it('should send notification with all user info', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyNewRegistration('user@test.com', 'testuser', 'Test User');

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('🎉 <b>Новая регистрация!</b>'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('user@test.com'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('testuser'),
        { parse_mode: 'HTML' }
      );
      expect(logger.info).toHaveBeenCalledWith('Telegram notification sent: new registration', {
        userEmail: 'user@test.com',
      });
    });

    it('should send notification with only email', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyNewRegistration('user@test.com');

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('user@test.com'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.not.stringContaining('Username:'),
        { parse_mode: 'HTML' }
      );
    });

    it('should not send notification when service is disabled', async () => {
      const service = new TelegramService(); // No token/chatId
      await service.notifyNewRegistration('user@test.com');

      expect(mockTelegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle sendMessage errors', async () => {
      mockTelegram.sendMessage.mockRejectedValue(new Error('Network error'));
      const service = new TelegramService('test-token', 'chat-123');
      
      await service.notifyNewRegistration('user@test.com');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send Telegram notification (registration)',
        expect.objectContaining({
          userEmail: 'user@test.com',
        })
      );
    });
  });

  describe('notifyVerificationEmailSent', () => {
    it('should send initial verification notification', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyVerificationEmailSent('user@test.com', false);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('📨 <b>Отправка письма подтверждения</b>'),
        { parse_mode: 'HTML' }
      );
      expect(logger.info).toHaveBeenCalledWith('Telegram notification sent: verification email', {
        userEmail: 'user@test.com',
        isResend: false,
      });
    });

    it('should send resend verification notification', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyVerificationEmailSent('user@test.com', true);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('🔄 <b>Повторная отправка письма подтверждения</b>'),
        { parse_mode: 'HTML' }
      );
    });

    it('should handle errors', async () => {
      mockTelegram.sendMessage.mockRejectedValue(new Error('Send error'));
      const service = new TelegramService('test-token', 'chat-123');
      
      await service.notifyVerificationEmailSent('user@test.com');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send Telegram notification (verification email)',
        expect.any(Object)
      );
    });
  });

  describe('notifyEmailVerified', () => {
    it('should send email verified notification', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyEmailVerified('user@test.com', 'testuser');

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('✅ <b>Email подтверждён!</b>'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('testuser'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('notifyPersonCreated', () => {
    it('should send approved person notification', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyPersonCreated('Napoleon', 'creator@test.com', 'approved', '1');

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('✅'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('создана и одобрена'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('Napoleon'),
        { parse_mode: 'HTML' }
      );
    });

    it('should send pending person notification', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyPersonCreated('Napoleon', 'creator@test.com', 'pending', '1');

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('⏳'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('отправлена на модерацию'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('notifyPersonEditProposed', () => {
    it('should send person edit notification', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyPersonEditProposed('Napoleon', 'editor@test.com', '1');

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('✏️ <b>Предложены изменения в личности</b>'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('notifyPersonReviewed', () => {
    it('should send approve notification', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyPersonReviewed('Napoleon', 'approve', 'moderator@test.com', '1');

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('✅'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('одобрена'),
        { parse_mode: 'HTML' }
      );
    });

    it('should send reject notification', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyPersonReviewed('Napoleon', 'reject', 'moderator@test.com', '1');

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('❌'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('отклонена'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('notifyAchievementCreated', () => {
    it('should send achievement notification with person', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyAchievementCreated(
        'Won battle',
        1805,
        'creator@test.com',
        'approved',
        'Napoleon',
        undefined
      );

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('Won battle'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('1805'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('Napoleon'),
        { parse_mode: 'HTML' }
      );
    });

    it('should send achievement notification with country', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyAchievementCreated(
        'Revolution',
        1789,
        'creator@test.com',
        'pending',
        undefined,
        'France'
      );

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('France'),
        { parse_mode: 'HTML' }
      );
    });

    it('should truncate long descriptions', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      const longDescription = 'A'.repeat(150);
      
      await service.notifyAchievementCreated(
        longDescription,
        2000,
        'creator@test.com',
        'approved'
      );

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('...'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('notifyAchievementReviewed', () => {
    it('should send achievement reviewed notification', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyAchievementReviewed('Achievement', 2000, 'approve', 'mod@test.com');

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('✅'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('одобрено'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('notifyPeriodCreated', () => {
    it('should send period created notification', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyPeriodCreated(
        'Rule',
        1804,
        1815,
        'creator@test.com',
        'approved',
        'Napoleon'
      );

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('Rule'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('1804–1815'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('notifyPeriodReviewed', () => {
    it('should send period reviewed notification', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyPeriodReviewed('Rule', 1804, 1815, 'approve', 'mod@test.com');

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('✅'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('notifyListPublicationRequested', () => {
    it('should send list publication request notification', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyListPublicationRequested('My List', 'owner@test.com', 1, 10);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('⏳ <b>Список отправлен на модерацию</b>'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('My List'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('10'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('notifyListReviewed', () => {
    it('should send list approval notification with slug', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyListReviewed('My List', 'approve', 'mod@test.com', 1, 'my-list');

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('✅'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('my-list'),
        { parse_mode: 'HTML' }
      );
    });

    it('should send list rejection notification without slug', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.notifyListReviewed('My List', 'reject', 'mod@test.com', 1);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('❌'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.not.stringContaining('Slug:'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('sendSecurityAlert', () => {
    it('should send security alert with correct severity', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.sendSecurityAlert(
        'Failed login attempt',
        { ip: '1.2.3.4', attempts: 5 },
        'high'
      );

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('🟠 <b>Security Alert [HIGH]</b>'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('Failed login attempt'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('1.2.3.4'),
        { parse_mode: 'HTML' }
      );
    });

    it('should use correct emoji for each severity', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      
      await service.sendSecurityAlert('test', {}, 'low');
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('🔵'),
        { parse_mode: 'HTML' }
      );

      await service.sendSecurityAlert('test', {}, 'critical');
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('🔴'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('sendErrorAlert', () => {
    it('should send error alert with stack trace', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n  at line1\n  at line2\n  at line3\n  at line4';
      
      await service.sendErrorAlert(error, { userId: '123', action: 'test' });

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('🔴 <b>Error Alert</b>'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('Test error'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('userId'),
        { parse_mode: 'HTML' }
      );
    });

    it('should handle long error messages', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      const longMessage = 'A'.repeat(300);
      const error = new Error(longMessage);
      
      await service.sendErrorAlert(error, {});

      // Should truncate to 200 chars
      const calls = mockTelegram.sendMessage.mock.calls;
      const message = calls[0][1] as string;
      expect(message.length).toBeLessThan(700); // Whole message should be reasonable
    });

    it('should handle error when sending alert fails', async () => {
      mockTelegram.sendMessage.mockRejectedValue(new Error('Send failed'));
      const service = new TelegramService('test-token', 'chat-123');
      const error = new Error('Test error');
      
      await service.sendErrorAlert(error, {});

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send Telegram error alert',
        expect.any(Object)
      );
    });
  });

  describe('sendPerformanceAlert', () => {
    it('should send performance alert with context', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.sendPerformanceAlert('response_time', 500, 200, { endpoint: '/api/test' });

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('⚡ <b>Performance Alert</b>'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('response_time'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('500'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('/api/test'),
        { parse_mode: 'HTML' }
      );
    });

    it('should send performance alert without context', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.sendPerformanceAlert('memory_usage', 90, 80);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('memory_usage'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.not.stringContaining('Context:'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('sendTestMessage', () => {
    it('should send test message', async () => {
      const service = new TelegramService('test-token', 'chat-123');
      await service.sendTestMessage();

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('🤖 <b>Тестовое сообщение</b>'),
        { parse_mode: 'HTML' }
      );
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('Telegram notifications работают корректно!'),
        { parse_mode: 'HTML' }
      );
      expect(logger.info).toHaveBeenCalledWith('Test Telegram message sent successfully');
    });

    it('should log warning when service is disabled', async () => {
      const service = new TelegramService(); // No token/chatId
      await service.sendTestMessage();

      expect(mockTelegram.sendMessage).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Telegram service is not enabled');
    });

    it('should throw error when sending fails', async () => {
      const error = new Error('Send failed');
      mockTelegram.sendMessage.mockRejectedValue(error);
      const service = new TelegramService('test-token', 'chat-123');
      
      await expect(service.sendTestMessage()).rejects.toThrow('Send failed');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send test Telegram message',
        expect.any(Object)
      );
    });
  });
});

