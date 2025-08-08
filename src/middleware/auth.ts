import { Request, Response, NextFunction } from 'express';
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
    res.status(401).json({ 
      error: 'Access denied', 
      message: 'Токен доступа не предоставлен' 
    });
    return;
  }

  try {
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      res.status(403).json({ 
        error: 'Invalid token', 
        message: 'Недействительный токен доступа' 
      });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ 
      error: 'Invalid token', 
      message: 'Недействительный токен доступа' 
    });
  }
};

// Middleware для проверки роли
export const requireRoleMiddleware = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Требуется аутентификация' 
      });
      return;
    }

    const hasRequiredRole = requireRole(roles)(req.user.role);
    if (!hasRequiredRole) {
      res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Недостаточно прав для выполнения операции' 
      });
      return;
    }

    next();
  };
};

// Middleware для проверки разрешений
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Требуется аутентификация' 
      });
      return;
    }

    const hasRequiredPermission = hasPermission(req.user.role, permission);
    if (!hasRequiredPermission) {
      res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Недостаточно прав для выполнения операции' 
      });
      return;
    }

    next();
  };
};

// Middleware для проверки активного пользователя
export const requireActiveUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Требуется аутентификация' 
    });
    return;
  }

  // Проверка активности пользователя будет происходить в базе данных
  // Здесь мы просто передаем управление дальше
  next();
};

// Middleware для проверки подтвержденного email
export const requireVerifiedEmail = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Требуется аутентификация' 
    });
    return;
  }

  // Проверка подтверждения email будет происходить в базе данных
  // Здесь мы просто передаем управление дальше
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

  if (err.name === 'ValidationError') {
    res.status(400).json({ 
      error: 'Validation Error', 
      message: err.message 
    });
    return;
  }

  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Недействительный токен' 
    });
    return;
  }

  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: 'Внутренняя ошибка сервера' 
  });
};

// Middleware для CORS
export const corsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
};

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
      res.status(429).json({ 
        error: 'Too Many Requests', 
        message: 'Слишком много запросов. Попробуйте позже.' 
      });
      return;
    } else {
      current.count++;
    }

    next();
  };
}; 