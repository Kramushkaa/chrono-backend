// Кастомные типы для Express Request/Response
import { Request, Response } from 'express';
import { JWTPayload } from './auth';

// ============================================
// Authenticated Request
// ============================================

// AuthRequest - Request с обязательным user (после authenticateToken middleware)
// Использует глобальное расширение Express.Request
export type AuthRequest = Request & {
  user: JWTPayload; // Non-optional - всегда присутствует после authenticateToken
};

// ============================================
// Typed Response (с типизацией body)
// ============================================

export interface TypedResponse<T = unknown> extends Response {
  json: (body: T) => this;
}

// ============================================
// API Response типы
// ============================================

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// Typed Request Bodies
// ============================================

export interface RequestWithBody<T> extends Request {
  body: T;
}

export interface AuthRequestWithBody<T> extends AuthRequest {
  body: T;
}

// ============================================
// Typed Query Parameters
// ============================================

export interface RequestWithQuery<T> extends Request {
  query: T & Record<string, string | string[] | undefined>;
}

export interface AuthRequestWithQuery<T> extends AuthRequest {
  query: T & Record<string, string | string[] | undefined>;
}

// ============================================
// Typed URL Parameters
// ============================================

export interface RequestWithParams<T> extends Request {
  params: T & Record<string, string>;
}

export interface AuthRequestWithParams<T> extends AuthRequest {
  params: T & Record<string, string>;
}

// ============================================
// Combined types
// ============================================

export interface RequestWithBodyAndParams<TBody, TParams> extends Request {
  body: TBody;
  params: TParams & Record<string, string>;
}

export interface AuthRequestWithBodyAndParams<TBody, TParams> extends AuthRequest {
  body: TBody;
  params: TParams & Record<string, string>;
}

export interface RequestWithQueryAndParams<TQuery, TParams> extends Request {
  query: TQuery & Record<string, string | string[] | undefined>;
  params: TParams & Record<string, string>;
}

export interface AuthRequestWithQueryAndParams<TQuery, TParams> extends AuthRequest {
  query: TQuery & Record<string, string | string[] | undefined>;
  params: TParams & Record<string, string>;
}

// ============================================
// Route Handler types
// ============================================

export type RouteHandler<TReq extends Request = Request, TRes = unknown> = (
  req: TReq,
  res: TypedResponse<ApiResponse<TRes>>
) => void | Promise<void>;

export type AuthRouteHandler<TReq extends AuthRequest = AuthRequest, TRes = unknown> = (
  req: TReq,
  res: TypedResponse<ApiResponse<TRes>>
) => void | Promise<void>;

// ============================================
// Конкретные типы для Query параметров
// ============================================

export interface PersonsQueryParams {
  category?: string;
  country?: string;
  startYear?: string;
  endYear?: string;
  status?: 'draft' | 'pending' | 'approved' | 'rejected';
  search?: string;
  page?: string;
  limit?: string;
}

export interface AchievementsQueryParams {
  person_id?: string;
  year?: string;
  country_id?: string;
  status?: 'draft' | 'pending' | 'approved' | 'rejected';
  search?: string;
  page?: string;
  limit?: string;
}

export interface PeriodsQueryParams {
  person_id?: string;
  country_id?: string;
  status?: 'draft' | 'pending' | 'approved' | 'rejected';
  page?: string;
  limit?: string;
}

export interface ListsQueryParams {
  visibility?: 'private' | 'public';
  page?: string;
  limit?: string;
}

// ============================================
// Конкретные типы для URL параметров
// ============================================

export interface IdParam {
  id: string;
}

export interface PersonIdParam {
  personId: string;
}

export interface ListIdParam {
  listId: string;
}

export interface AchievementIdParam {
  achievementId: string;
}

export interface PeriodIdParam {
  periodId: string;
}
