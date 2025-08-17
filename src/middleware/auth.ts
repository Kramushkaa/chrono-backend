import { Request, Response, NextFunction } from 'express';
import { ApiError, errors } from '../utils/errors';
import { verifyAccessToken, hasPermission, requireRole } from '../utils/auth';
import { JWTPayload } from '../types/auth';

// Расширение типа Request для добавления пользователя
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// Middleware для аутентификации
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    next(errors.unauthorized('Токен доступа не предоставлен', 'token_missing'));
    return;
  }

  try {
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      next(errors.unauthorized('Недействительный токен доступа', 'invalid_token'));
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    next(errors.unauthorized('Недействительный токен доступа', 'invalid_token'));
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
  const ip = (req.ip as any) || (req as any).socket?.remoteAddress || (req as any).connection?.remoteAddress || 'unknown';
  const userId = req.user?.sub || 'anonymous';

  console.log(`[${timestamp}] ${method} ${url} - User: ${userId} - IP: ${ip} - UA: ${userAgent}`);
  
  next();
};

// Middleware для обработки ошибок
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error('Error:', err);
  if (err instanceof ApiError) {
    res.status(err.status).json({ success: false, code: err.code, message: err.message, details: err.details })
    return
  }
  if ((err as any)?.name === 'ValidationError') {
    res.status(400).json({ success: false, code: 'validation_error', message: err.message });
    return;
  }
  if ((err as any)?.name === 'UnauthorizedError') {
    res.status(401).json({ success: false, code: 'unauthorized', message: 'Недействительный токен' });
    return;
  }
  res.status(500).json({ success: false, code: 'internal_error', message: 'Внутренняя ошибка сервера' });
};

// Middleware для CORS
// removed custom corsMiddleware: using cors() in server.ts with strict patterns

// Middleware для ограничения запросов (rate limiting)
export const rateLimit = (windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.ip as any) || (req as any).socket?.remoteAddress || (req as any).connection?.remoteAddress || 'unknown';
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
      next(errors.tooMany('Слишком много запросов. Попробуйте позже.'));
      return;
    } else {
      current.count++;
    }

    next();
  };
}; 