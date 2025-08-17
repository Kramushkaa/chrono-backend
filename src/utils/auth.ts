import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, JWTPayload, ValidationResult, ValidationError } from '../types/auth';
import { config as appConfig } from '../config';

// Конфигурация (централизовано)
const SALT_ROUNDS = appConfig.security.bcryptRounds;
const JWT_SECRET = appConfig.jwt.secret;
const JWT_EXPIRES_IN = appConfig.jwt.expiresIn;
const REFRESH_TOKEN_EXPIRES_IN = appConfig.jwt.refreshExpiresIn;

// Хеширование паролей
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Генерация токенов
export const generateAccessToken = (user: User): string => {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    email_verified: user.email_verified
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

// Хеширование произвольных токенов (например, refresh)
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const generateEmailVerificationToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const generatePasswordResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Верификация токенов
export const verifyAccessToken = (token: string): JWTPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      email_verified: decoded.email_verified
    };
  } catch (error) {
    return null;
  }
};

// Валидация данных
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): ValidationResult => {
  const errors: ValidationError[] = [];
  
  if (password.length < 8) {
    errors.push({ field: 'password', message: 'Пароль должен содержать минимум 8 символов' });
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push({ field: 'password', message: 'Пароль должен содержать хотя бы одну заглавную букву' });
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push({ field: 'password', message: 'Пароль должен содержать хотя бы одну строчную букву' });
  }
  
  if (!/\d/.test(password)) {
    errors.push({ field: 'password', message: 'Пароль должен содержать хотя бы одну цифру' });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateUsername = (username: string): ValidationResult => {
  const errors: ValidationError[] = [];
  
  if (username.length < 3) {
    errors.push({ field: 'username', message: 'Имя пользователя должно содержать минимум 3 символа' });
  }
  
  if (username.length > 50) {
    errors.push({ field: 'username', message: 'Имя пользователя не должно превышать 50 символов' });
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push({ field: 'username', message: 'Имя пользователя может содержать только буквы, цифры, дефисы и подчеркивания' });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Валидация регистрации
export const validateRegisterData = (data: {
  email: string;
  password: string;
  username?: string;
  login?: string;
  full_name?: string;
}): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Валидация email
  if (!data.email) {
    errors.push({ field: 'email', message: 'Email обязателен' });
  } else if (!validateEmail(data.email)) {
    errors.push({ field: 'email', message: 'Некорректный формат email' });
  }
  
  // Валидация пароля
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    errors.push(...passwordValidation.errors);
  }
  
  // Валидация username/login (если предоставлен)
  const providedLogin = data.login || data.username;
  if (providedLogin) {
    const usernameValidation = validateUsername(providedLogin);
    if (!usernameValidation.isValid) {
      errors.push(...usernameValidation.errors);
    }
  }
  
  // Валидация full_name (если предоставлен)
  if (data.full_name && data.full_name.length > 255) {
    errors.push({ field: 'full_name', message: 'Имя пользователя не должно превышать 255 символов' });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Валидация входа
export const validateLoginData = (data: {
  login: string; // may be email or username
  password: string;
}): ValidationResult => {
  const errors: ValidationError[] = [];
  
  if (!data.login) {
    errors.push({ field: 'login', message: 'Логин обязателен' });
  }
  
  if (!data.password) {
    errors.push({ field: 'password', message: 'Пароль обязателен' });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Утилиты для работы с ролями и разрешениями
export const hasPermission = (userRole: string, requiredPermission: string): boolean => {
  const rolePermissions: { [key: string]: string[] } = {
    user: ['read:persons'],
    moderator: ['read:persons', 'write:persons', 'read:users'],
    admin: ['read:persons', 'write:persons', 'delete:persons', 'read:users', 'write:users', 'delete:users', 'manage:roles', 'manage:system']
  };
  
  const userPermissions = rolePermissions[userRole] || [];
  return userPermissions.includes(requiredPermission);
};

export const requireRole = (roles: string[]) => {
  return (userRole: string): boolean => {
    return roles.includes(userRole);
  };
};

// Утилиты для работы с датами
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const isTokenExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt;
}; 