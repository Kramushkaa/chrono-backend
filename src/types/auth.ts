// Типы для аутентификации и авторизации

export interface User {
  id: number;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  role: 'user' | 'moderator' | 'admin';
  is_active: boolean;
  email_verified: boolean;
  email_verification_token?: string;
  email_verification_expires?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UserSession {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
  created_at: Date;
}

export interface Permission {
  id: number;
  name: string;
  description?: string;
  created_at: Date;
}

export interface RolePermission {
  role_id: number;
  permission_id: number;
  created_at: Date;
}

// Типы для запросов
export interface RegisterRequest {
  email: string;
  password: string;
  username?: string; // legacy alias, keep for backward compatibility
  login?: string; // preferred alias for username
  full_name?: string;
}

export interface LoginRequest {
  // Single field that may contain either email or username
  login: string;
  password: string;
}

export interface UpdateProfileRequest {
  username?: string; // legacy alias, keep for backward compatibility
  login?: string; // preferred alias for username
  full_name?: string;
  avatar_url?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

// Admin типы для запросов
export interface UserUpdateRequest {
  role?: 'user' | 'moderator' | 'admin';
  is_active?: boolean;
  email_verified?: boolean;
}

export interface UserQueryParams {
  limit?: number;
  offset?: number;
  role?: string;
  is_active?: boolean;
  email_verified?: boolean;
  search?: string; // search by email or username
}

// Типы для ответов
export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ProfileResponse {
  user: User;
}

export interface UsersListResponse {
  users: User[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface UserStatsResponse {
  total: number;
  active: number;
  inactive: number;
  verified: number;
  unverified: number;
  byRole: {
    user: number;
    moderator: number;
    admin: number;
  };
  recentRegistrations: number; // last 7 days
}

// Типы для JWT
export interface JWTPayload {
  sub: number; // user_id
  email: string;
  role: string;
  email_verified: boolean;
}

// Типы для middleware
export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}

// Типы для валидации
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}
