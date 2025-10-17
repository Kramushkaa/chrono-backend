import { sendEmail } from '../../utils/email';
import nodemailer from 'nodemailer';
import https from 'https';

// Mock nodemailer
jest.mock('nodemailer');

describe('email utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ============================================================================
  // sendEmail via SMTP tests
  // ============================================================================

  describe('sendEmail via SMTP', () => {
    it('should send email via SMTP when no RESEND_API_KEY', async () => {
      delete process.env.RESEND_API_KEY;
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      process.env.EMAIL_FROM = 'Test <test@example.com>';

      const mockSendMail = jest.fn().mockResolvedValue({ messageId: '123' });
      const mockTransporter = {
        sendMail: mockSendMail,
      };

      (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

      await sendEmail('recipient@example.com', 'Test Subject', '<p>Test HTML</p>');

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'Test <test@example.com>',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
      });
    });

    it('should create transporter with correct config', async () => {
      delete process.env.RESEND_API_KEY;
      process.env.SMTP_HOST = 'smtp.gmail.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_SECURE = 'true';
      process.env.SMTP_USER = 'user@gmail.com';
      process.env.SMTP_PASS = 'pass123';

      const mockTransporter = { sendMail: jest.fn().mockResolvedValue({}) };
      (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

      await sendEmail('to@example.com', 'Subject', 'HTML');

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
            user: 'user@gmail.com',
            pass: 'pass123',
          },
        })
      );
    });

    it('should handle SMTP without auth', async () => {
      delete process.env.RESEND_API_KEY;
      process.env.SMTP_HOST = 'localhost';
      process.env.SMTP_PORT = '1025'; // Mailhog
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const mockTransporter = { sendMail: jest.fn().mockResolvedValue({}) };
      (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

      await sendEmail('to@example.com', 'Subject', 'HTML');

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: undefined,
        })
      );
    });
  });

  // ============================================================================
  // sendEmail via Resend API tests
  // ============================================================================

  describe('sendEmail via Resend', () => {
    let httpsRequestMock: jest.SpyInstance;

    beforeEach(() => {
      httpsRequestMock = jest.spyOn(https, 'request');
    });

    afterEach(() => {
      httpsRequestMock.mockRestore();
    });

    it('should send email via Resend API when RESEND_API_KEY is set', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.EMAIL_FROM = 'Test <test@example.com>';

      const mockRequest = {
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
      };

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            // Simulate response data
          } else if (event === 'end') {
            handler();
          }
          return mockResponse;
        }),
      };

      httpsRequestMock.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await sendEmail('to@resend.com', 'Subject', '<p>HTML</p>');

      expect(httpsRequestMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'api.resend.com',
          path: '/emails',
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
        }),
        expect.any(Function)
      );

      expect(mockRequest.write).toHaveBeenCalledWith(
        expect.stringContaining('"to":"to@resend.com"')
      );
    });

    it('should handle Resend API error (4xx)', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      const mockRequest = {
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
      };

      const mockResponse = {
        statusCode: 400,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(Buffer.from('{"error": "Invalid email"}'));
          } else if (event === 'end') {
            handler();
          }
          return mockResponse;
        }),
      };

      httpsRequestMock.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await expect(sendEmail('invalid', 'Subject', 'HTML')).rejects.toThrow(
        'Resend error 400'
      );
    });

    it('should handle network error', async () => {
      process.env.RESEND_API_KEY = 'test-api-key';

      const mockRequest = {
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            handler(new Error('Network error'));
          }
          return mockRequest;
        }),
      };

      httpsRequestMock.mockImplementation(() => {
        return mockRequest;
      });

      // Trigger the error event
      await expect(
        sendEmail('to@example.com', 'Subject', 'HTML')
      ).rejects.toThrow('Network error');
    });
  });

  // ============================================================================
  // getTransporter singleton tests
  // ============================================================================

  describe('getTransporter singleton', () => {
    it('should create transporter only once (singleton pattern)', async () => {
      delete process.env.RESEND_API_KEY;
      process.env.SMTP_HOST = 'smtp.test.com';

      const mockTransporter = { sendMail: jest.fn().mockResolvedValue({}) };
      (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

      // Send two emails
      await sendEmail('to1@example.com', 'Subject 1', 'HTML 1');
      await sendEmail('to2@example.com', 'Subject 2', 'HTML 2');

      // createTransport should be called only once (singleton)
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });
  });
});

