import { Request, Response, NextFunction } from 'express';
import {
  authenticateToken,
  optionalAuthenticateToken,
  requireRoleMiddleware,
  requirePermission,
  requireActiveUser,
  requireVerifiedEmail,
  rateLimit,
  logRequest,
  errorHandler,
} from '../../middleware/auth';
import * as authUtils from '../../utils/auth';
import { JWTPayload } from '../../types/auth';
import { ApiError } from '../../utils/errors';

// Mock auth utils
jest.mock('../../utils/auth');

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      socket: {},
      ip: undefined,
    } as any;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // authenticateToken() tests
  // ============================================================================

  describe('authenticateToken', () => {
    it('should authenticate valid token and attach user to request', () => {
      const mockUser: JWTPayload = {
        sub: 1,
        email: 'test@example.com',
        role: 'user',
        email_verified: true,
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      (authUtils.verifyAccessToken as jest.Mock).mockReturnValue(mockUser);

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(authUtils.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject request without authorization header', () => {
      mockRequest.headers = {};

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Токен доступа не предоставлен'),
        })
      );
      expect(mockRequest.user).toBeUndefined();
    });

    it('should reject invalid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      (authUtils.verifyAccessToken as jest.Mock).mockReturnValue(null);

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Недействительный токен'),
        })
      );
    });

    it('should handle token verification errors', () => {
      mockRequest.headers = {
        authorization: 'Bearer error-token',
      };

      (authUtils.verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Token expired');
      });

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Недействительный токен'),
        })
      );
    });
  });

  // ============================================================================
  // optionalAuthenticateToken() tests
  // ============================================================================

  describe('optionalAuthenticateToken', () => {
    it('should authenticate valid token', () => {
      const mockUser: JWTPayload = {
        sub: 2,
        email: 'user@example.com',
        role: 'user',
        email_verified: true,
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      (authUtils.verifyAccessToken as jest.Mock).mockReturnValue(mockUser);

      optionalAuthenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user when no token provided', () => {
      mockRequest.headers = {};

      optionalAuthenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user on invalid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      (authUtils.verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      optionalAuthenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith(); // No error thrown
    });
  });

  // ============================================================================
  // requireRoleMiddleware() tests
  // ============================================================================

  describe('requireRoleMiddleware', () => {
    it('should allow user with correct role', () => {
      mockRequest.user = {
        sub: 1,
        email: 'admin@example.com',
        role: 'admin',
        email_verified: true,
      };

      (authUtils.requireRole as jest.Mock).mockReturnValue(() => true);

      const middleware = requireRoleMiddleware(['admin']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject user with wrong role', () => {
      mockRequest.user = {
        sub: 2,
        email: 'user@example.com',
        role: 'user',
        email_verified: true,
      };

      (authUtils.requireRole as jest.Mock).mockReturnValue(() => false);

      const middleware = requireRoleMiddleware(['admin']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Недостаточно прав'),
        })
      );
    });

    it('should reject unauthenticated request', () => {
      mockRequest.user = undefined;

      const middleware = requireRoleMiddleware(['admin']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Требуется аутентификация'),
        })
      );
    });
  });

  // ============================================================================
  // requirePermission() tests
  // ============================================================================

  describe('requirePermission', () => {
    it('should allow user with permission', () => {
      mockRequest.user = {
        sub: 1,
        email: 'admin@example.com',
        role: 'admin',
        email_verified: true,
      };

      (authUtils.hasPermission as jest.Mock).mockReturnValue(true);

      const middleware = requirePermission('write:persons');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(authUtils.hasPermission).toHaveBeenCalledWith('admin', 'write:persons');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject user without permission', () => {
      mockRequest.user = {
        sub: 2,
        email: 'user@example.com',
        role: 'user',
        email_verified: true,
      };

      (authUtils.hasPermission as jest.Mock).mockReturnValue(false);

      const middleware = requirePermission('write:persons');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Недостаточно прав'),
        })
      );
    });

    it('should reject unauthenticated request', () => {
      mockRequest.user = undefined;

      const middleware = requirePermission('read:persons');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Требуется аутентификация'),
        })
      );
    });
  });

  // ============================================================================
  // requireActiveUser() tests
  // ============================================================================

  describe('requireActiveUser', () => {
    it('should allow authenticated user', () => {
      mockRequest.user = {
        sub: 1,
        email: 'user@example.com',
        role: 'user',
        email_verified: true,
      };

      requireActiveUser(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject unauthenticated request', () => {
      mockRequest.user = undefined;

      requireActiveUser(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Требуется аутентификация'),
        })
      );
    });
  });

  // ============================================================================
  // requireVerifiedEmail() tests
  // ============================================================================

  describe('requireVerifiedEmail', () => {
    it('should allow user with verified email', () => {
      mockRequest.user = {
        sub: 1,
        email: 'verified@example.com',
        role: 'user',
        email_verified: true,
      };

      requireVerifiedEmail(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject user with unverified email', () => {
      mockRequest.user = {
        sub: 2,
        email: 'unverified@example.com',
        role: 'user',
        email_verified: false,
      };

      requireVerifiedEmail(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Требуется подтверждение email'),
        })
      );
    });

    it('should reject unauthenticated request', () => {
      mockRequest.user = undefined;

      requireVerifiedEmail(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Требуется аутентификация'),
        })
      );
    });
  });

  // ============================================================================
  // rateLimit() tests
  // ============================================================================

  describe('rateLimit', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should allow requests under limit', () => {
      const middleware = rateLimit(60000, 5); // 5 requests per minute

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        mockNext.mockClear();
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
        expect(mockNext).toHaveBeenCalledWith();
      }
    });

    it('should block requests over limit', () => {
      const middleware = rateLimit(60000, 2); // 2 requests per minute

      // First 2 requests should pass
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();

      mockNext.mockClear();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();

      // 3rd request should be blocked
      mockNext.mockClear();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 429,
          message: expect.stringContaining('Слишком много запросов'),
        })
      );
    });

    it('should reset limit after window expires', () => {
      const windowMs = 60000; // 1 minute
      const middleware = rateLimit(windowMs, 2);

      // Use up the limit
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Advance time past the window
      jest.advanceTimersByTime(windowMs + 1000);

      // Should allow new requests
      mockNext.mockClear();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  // ============================================================================
  // logRequest() tests
  // ============================================================================

  describe('logRequest', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log request with user info', () => {
      mockRequest.method = 'GET';
      mockRequest.url = '/api/persons';
      mockRequest.user = {
        sub: 1,
        email: 'user@example.com',
        role: 'user',
        email_verified: true,
      };
      (mockRequest as any).ip = '127.0.0.1';

      logRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('GET')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/persons')
      );
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should log request without user (unauthenticated)', () => {
      mockRequest.method = 'POST';
      mockRequest.url = '/api/auth/login';
      mockRequest.user = undefined;

      logRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  // ============================================================================
  // errorHandler() tests
  // ============================================================================

  describe('errorHandler', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should handle ApiError correctly', () => {
      const error = new ApiError({
        status: 404,
        message: 'Resource not found',
        code: 'not_found',
      });

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Resource not found',
        code: 'not_found',
        details: undefined,
      });
    });

    it('should handle generic Error', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        code: 'internal_error',
        message: 'Внутренняя ошибка сервера',
      });
    });

    it('should handle unknown error types', () => {
      const error = 'string error';

      errorHandler(error as any, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        code: 'internal_error',
        message: 'Внутренняя ошибка сервера',
      });
    });

    it('should log error details', () => {
      const error = new Error('Test error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});

