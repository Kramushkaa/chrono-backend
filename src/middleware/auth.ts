import { Request, Response, NextFunction } from 'express';
import { ApiError, errors } from '../utils/errors';
import { verifyAccessToken, hasPermission, requireRole } from '../utils/auth';
import { JWTPayload } from '../types/auth';
import { logger } from '../utils/logger';

// Расширение типа Request для добавления пользователя
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// Типы для error handling
interface ErrorWithName extends Error {
  name: string;
}

// Вспомогательная функция для получения IP адреса
function getClientIp(req: Request): string {
  // Express за прокси (trust proxy должен быть включен)
  if (req.ip) {
    return req.ip;
  }

  // Fallback для случаев без прокси
  const socket = req.socket as { remoteAddress?: string };
  if (socket?.remoteAddress) {
    return socket.remoteAddress;
  }

  return 'unknown';
}

// Middleware для аутентификации
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.authError('Missing authentication token', undefined, getClientIp(req));
    next(errors.unauthorized('Токен доступа не предоставлен', 'token_missing'));
    return;
  }

  try {
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      logger.authError('Invalid token format or signature', undefined, getClientIp(req));
      next(errors.unauthorized('Недействительный токен доступа', 'invalid_token'));
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    const ip = getClientIp(req);
    logger.authError('Token verification failed', undefined, ip);
    // Security event logging for invalid token attempts
    logger.securityEvent(
      'invalid_token_attempt',
      {
        ip,
        endpoint: req.path,
        method: req.method,
      },
      'low'
    );
    next(errors.unauthorized('Недействительный токен доступа', 'invalid_token'));
  }
};

// Optional authentication middleware (doesn't fail if token is missing)
export const optionalAuthenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    // No token provided, continue without user
    next();
    return;
  }

  try {
    const decoded = verifyAccessToken(token);
    if (decoded) {
      req.user = decoded;
    }
    next();
  } catch (error) {
    // Invalid token, but continue without user (no error thrown)
    next();
  }
};

// Middleware для проверки роли
export const requireRoleMiddleware = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(errors.unauthorized('Требуется аутентификация'));
      return;
    }

    const hasRequiredRole = requireRole(roles)(req.user.role);
    if (!hasRequiredRole) {
      next(errors.forbidden('Недостаточно прав для выполнения операции'));
      return;
    }

    next();
  };
};

// Middleware для проверки разрешений
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(errors.unauthorized('Требуется аутентификация'));
      return;
    }

    const hasRequiredPermission = hasPermission(req.user.role, permission);
    if (!hasRequiredPermission) {
      next(errors.forbidden('Недостаточно прав для выполнения операции'));
      return;
    }

    next();
  };
};

// Middleware для проверки активного пользователя
export const requireActiveUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(errors.unauthorized('Требуется аутентификация'));
    return;
  }

  // Проверка активности пользователя будет происходить в базе данных
  // Здесь мы просто передаем управление дальше
  next();
};

// Middleware для проверки подтвержденного email
export const requireVerifiedEmail = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(errors.unauthorized('Требуется аутентификация'));
    return;
  }

  if (!req.user.email_verified) {
    next(errors.forbidden('Требуется подтверждение email для выполнения этой операции'));
    return;
  }

  next();
};

// Middleware для логирования запросов
export const logRequest = (req: Request, res: Response, next: NextFunction): void => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const userAgent = req.headers['user-agent'];
  const ip = getClientIp(req);

  // Определяем пользователя
  let userInfo = 'anonymous';
  if (req.user) {
    const role = req.user.role || 'user';
    const userId = req.user.sub;
    const email = req.user.email;
    userInfo = `${email} (ID: ${userId}, ${role})`;
  }

  // Сокращаем User-Agent для читаемости
  let shortUA = 'unknown';
  if (userAgent) {
    if (userAgent.includes('Chrome')) {
      shortUA = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
      shortUA = 'Firefox';
    } else if (userAgent.includes('Safari')) {
      shortUA = 'Safari';
    } else if (userAgent.includes('Edge')) {
      shortUA = 'Edge';
    } else if (userAgent.includes('Postman')) {
      shortUA = 'Postman';
    } else if (userAgent.includes('curl')) {
      shortUA = 'curl';
    } else {
      // Берем первые 50 символов для неизвестных браузеров
      shortUA = userAgent.length > 50 ? userAgent.substring(0, 50) + '...' : userAgent;
    }
  }

  logger.info('Request', {
    timestamp,
    method,
    url,
    userInfo,
    ip,
    userAgent: shortUA,
  });

  next();
};

// Middleware для обработки ошибок
export const errorHandler = (
  err: Error | ErrorWithName | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Request error', { error: err });

  if (err instanceof ApiError) {
    res
      .status(err.status)
      .json({ success: false, code: err.code, message: err.message, details: err.details });
    return;
  }

  const errorWithName = err as ErrorWithName;

  if (errorWithName.name === 'ValidationError') {
    res.status(400).json({ success: false, code: 'validation_error', message: err.message });
    return;
  }

  if (errorWithName.name === 'UnauthorizedError') {
    res
      .status(401)
      .json({ success: false, code: 'unauthorized', message: 'Недействительный токен' });
    return;
  }

  res
    .status(500)
    .json({ success: false, code: 'internal_error', message: 'Внутренняя ошибка сервера' });
};

// Middleware для CORS
// removed custom corsMiddleware: using cors() in server.ts with strict patterns

// Middleware для ограничения запросов (rate limiting)
export const rateLimit = (windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Очистка старых записей
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < windowStart) {
        requests.delete(key);
      }
    }

    const current = requests.get(ip);

    if (!current || current.resetTime < windowStart) {
      requests.set(ip, { count: 1, resetTime: now });
    } else if (current.count >= maxRequests) {
      // Security event logging for rate limit exceeded
      logger.securityEvent(
        'rate_limit_exceeded',
        {
          ip,
          endpoint: req.path,
          method: req.method,
          count: current.count,
          limit: maxRequests,
        },
        'medium'
      );
      next(errors.tooMany('Слишком много запросов. Попробуйте позже.'));
      return;
    } else {
      current.count++;
    }

    next();
  };
};
