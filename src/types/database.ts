// Типы для строк базы данных PostgreSQL
// Автоматически сгенерировано на основе DB_SCHEMA.md

// ============================================
// Основные таблицы
// ============================================

export interface PersonRow {
  id: string;
  name: string;
  birth_year: number;
  death_year: number | null;
  category: string;
  country: string;
  description: string | null;
  image_url: string | null;
  reign_start: number | null;
  reign_end: number | null;
  wiki_link: string | null;
  created_at: Date;
  updated_at: Date;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_by: number | null;
  updated_by: number | null;
  reviewed_by: number | null;
  review_comment: string | null;
}

export interface AchievementRow {
  id: number;
  person_id: string | null;
  year: number;
  description: string;
  wikipedia_url: string | null;
  image_url: string | null;
  created_at: Date;
  updated_at: Date;
  country_id: number | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_by: number | null;
  updated_by: number | null;
  reviewed_by: number | null;
  review_comment: string | null;
}

export interface PeriodRow {
  id: number;
  person_id: string | null;
  start_year: number;
  end_year: number;
  country_id: number | null;
  created_at: Date;
  updated_at: Date;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_by: number | null;
  updated_by: number | null;
  reviewed_by: number | null;
  review_comment: string | null;
}

export interface CountryRow {
  id: number;
  name: string;
  created_at: Date | null;
}

export interface ListRow {
  id: number;
  owner_user_id: number;
  title: string;
  created_at: Date | null;
  updated_at: Date | null;
  visibility: 'private' | 'public';
}

export interface ListItemRow {
  id: number;
  list_id: number;
  item_type: 'person' | 'achievement' | 'period';
  person_id: string | null;
  achievement_id: number | null;
  period_id: number | null;
  period_json: Record<string, unknown> | null;
  position: number | null;
  created_at: Date | null;
}

export interface UserRow {
  id: number;
  email: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'moderator' | 'admin';
  is_active: boolean;
  email_verified: boolean;
  password_hash: string;
  email_verification_token: string | null;
  email_verification_expires: Date | null;
  password_reset_token: string | null;
  password_reset_expires: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserSessionRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  is_active: boolean;
}

// ============================================
// View типы (для представлений БД)
// ============================================

export interface PersonsViewRow {
  id: string;
  name: string;
  birth_year: number;
  death_year: number | null;
  category: string;
  country: string;
  description: string | null;
  image_url: string | null;
  reign_start: number | null;
  reign_end: number | null;
  wiki_link: string | null;
  achievements: string[] | null;
  achievements_wiki: string[] | null;
  achievement_years: number[] | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_by: number | null;
}

export interface AchievementsViewRow {
  id: number;
  person_id: string | null;
  person_name: string | null;
  year: number;
  description: string;
  wikipedia_url: string | null;
  image_url: string | null;
  country_id: number | null;
  country_name: string | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface PeriodsViewRow {
  id: number;
  person_id: string | null;
  person_name: string | null;
  start_year: number;
  end_year: number;
  country_id: number | null;
  country_name: string | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// Агрегированные типы для сложных запросов
// ============================================

export interface PersonWithRelations extends PersonRow {
  achievements?: string[] | AchievementRow[];
  achievements_wiki?: string[];
  achievement_years?: number[];
  periods?: PeriodRow[];
  ruler_periods?: Array<{
    start_year: number;
    end_year: number;
    country_id: number;
    country_name: string;
  }>;
}

export interface ListWithItems extends ListRow {
  items: Array<
    ListItemRow & {
      person?: PersonRow;
      achievement?: AchievementRow;
      period?: PeriodRow;
    }
  >;
  items_count: number;
}

// ============================================
// Статистика
// ============================================

export interface StatsRow {
  total_persons: number;
  total_achievements: number;
  total_periods: number;
  total_countries: number;
  categories: Array<{ category: string; count: number }>;
  countries: Array<{ country: string; count: number }>;
}

export interface CategoryStatsRow {
  category: string;
  count: number;
}

export interface CountryStatsRow {
  country: string;
  count: number;
}

export interface UserStatsRow {
  total_contributions: number;
  approved_contributions: number;
  pending_contributions: number;
  rejected_contributions: number;
}

// ============================================
// Вспомогательные типы для запросов
// ============================================

export interface QueryResultRow {
  [key: string]: unknown;
}

// Типы для результатов подсчета
export interface CountResult {
  count?: string | number;
  cnt?: string | number; // Альтернативное название для COUNT
}

export interface ExistsResult {
  exists: boolean;
}

// Типы для INSERT/UPDATE результатов
export interface InsertResult {
  id: number | string;
}

export interface UpdateResult {
  updated_at: Date;
}

export interface DeleteResult {
  deleted: boolean;
}
