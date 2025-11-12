/**
 * Типы для E2E тестов
 */

// Учётные данные пользователя
export interface UserCredentials {
  email: string;
  password: string;
  username?: string;
}

// Токены авторизации
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Данные пользователя
export interface TestUser extends UserCredentials {
  id?: string;
  role?: 'user' | 'moderator' | 'admin';
}

// Данные личности для тестов
export interface TestPerson {
  id?: string;
  name: string;
  birth_year: number;
  death_year?: number;
  category?: string;
  country?: string;
  occupation?: string;
  bio?: string;
  wiki_link?: string;
}

// Данные достижения
export interface TestAchievement {
  id?: number;
  person_id?: string;
  year: number;
  title: string;
  description?: string;
}

// Данные периода жизни
export interface TestPeriod {
  id?: number;
  person_id?: string;
  start_year: number;
  end_year?: number;
  title: string;
  description?: string;
  location?: string;
}

// Данные списка
export interface TestList {
  id?: number;
  title: string;
  user_id?: string;
  moderation_status?: 'draft' | 'pending' | 'published' | 'rejected';
  slug?: string;
}

// Элемент списка
export interface TestListItem {
  id?: number;
  list_id: number;
  item_type: 'person' | 'achievement' | 'period';
  person_id?: string;
  achievement_id?: number;
  period_id?: number;
}

// Настройки квиза
export interface QuizSettings {
  questionCount?: number;
  categories?: string[];
  countries?: string[];
}

// Результат квиза
export interface QuizResult {
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent?: number;
}






