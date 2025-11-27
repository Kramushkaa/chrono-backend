import { Request, Response, NextFunction } from 'express';
import { ensureFeatureEnabled } from '../../middleware/featureFlags';
import * as configModule from '../../config';

// Mock config module
jest.mock('../../config', () => ({
  config: {
    features: {
      publicLists: false,
    },
  },
}));

describe('Feature Flags Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockRequest = {} as any;

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
  // ensureFeatureEnabled() tests
  // ============================================================================

  describe('ensureFeatureEnabled', () => {
    it('should allow request when feature is enabled', () => {
      // Enable feature
      (configModule.config as any).features.publicLists = true;

      const middleware = ensureFeatureEnabled('publicLists');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should return 404 when feature is disabled (default)', () => {
      (configModule.config as any).features.publicLists = false;

      const middleware = ensureFeatureEnabled('publicLists');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'feature_disabled',
        feature: 'publicLists',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return custom status code when provided', () => {
      (configModule.config as any).features.publicLists = false;

      const middleware = ensureFeatureEnabled('publicLists', { statusCode: 403 });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'feature_disabled',
        feature: 'publicLists',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return custom message when provided', () => {
      (configModule.config as any).features.publicLists = false;

      const customMessage = 'This feature is not available';
      const middleware = ensureFeatureEnabled('publicLists', {
        message: customMessage,
      });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: customMessage,
        feature: 'publicLists',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return custom status code and message when both provided', () => {
      (configModule.config as any).features.publicLists = false;

      const customMessage = 'Access denied';
      const middleware = ensureFeatureEnabled('publicLists', {
        statusCode: 403,
        message: customMessage,
      });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: customMessage,
        feature: 'publicLists',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle feature being disabled after being enabled', () => {
      // First enable feature
      (configModule.config as any).features.publicLists = true;

      const middleware = ensureFeatureEnabled('publicLists');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      mockNext.mockClear();

      // Then disable feature
      (configModule.config as any).features.publicLists = false;
      const middleware2 = ensureFeatureEnabled('publicLists');
      middleware2(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'feature_disabled',
        feature: 'publicLists',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should check feature status at request time, not middleware creation time', () => {
      // Create middleware when feature is disabled
      (configModule.config as any).features.publicLists = false;
      const middleware = ensureFeatureEnabled('publicLists');

      // Enable feature after middleware creation
      (configModule.config as any).features.publicLists = true;

      // Should allow request because feature is now enabled
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});
