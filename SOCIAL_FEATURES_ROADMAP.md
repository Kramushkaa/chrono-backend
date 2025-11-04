# План развития социальных функций Хронониндзя

Дата создания: 1 ноября 2025

## 🎯 Цель

Добавить базовые социальные функции для увеличения engagement и создания сообщества вокруг проекта.

---

## 📋 Фичи для реализации

1. ✅ **Система достижений (Badges)** - мотивация пользователей
2. ✅ **Публичные списки** - каталог списков, созданных сообществом
3. ✅ **Публичные профили** - витрина активности пользователя
4. ✅ **Стрики (Streaks)** - ежедневная активность

---

## 📊 1. Система достижений (Badges)

### База данных

```sql
-- Таблица с определениями достижений
CREATE TABLE badges (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    icon_url VARCHAR(500),
    rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('quiz', 'social', 'content', 'special')),
    criteria JSONB NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Связь пользователей с полученными достижениями
CREATE TABLE user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    progress JSONB,
    UNIQUE(user_id, badge_id)
);

-- Индексы
CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge_id ON user_badges(badge_id);
CREATE INDEX idx_user_badges_earned_at ON user_badges(earned_at DESC);
CREATE INDEX idx_badges_category ON badges(category);
CREATE INDEX idx_badges_rarity ON badges(rarity);
```

### Стартовый набор достижений

```sql
-- Квизы
INSERT INTO badges (code, title, description, icon_url, rarity, category, criteria, points) VALUES
('quiz_first', 'Первый квиз', 'Пройдите свой первый квиз', '/badges/quiz_first.svg', 'common', 'quiz', '{"type": "quiz_completed", "count": 1}', 10),
('quiz_master_10', 'Мастер Квиза', 'Пройдите 10 квизов', '/badges/quiz_master_10.svg', 'common', 'quiz', '{"type": "quiz_completed", "count": 10}', 50),
('quiz_master_50', 'Гуру Квиза', 'Пройдите 50 квизов', '/badges/quiz_master_50.svg', 'rare', 'quiz', '{"type": "quiz_completed", "count": 50}', 200),
('quiz_master_100', 'Легенда Квиза', 'Пройдите 100 квизов', '/badges/quiz_master_100.svg', 'epic', 'quiz', '{"type": "quiz_completed", "count": 100}', 500),

('perfectionist_1', 'Перфекционист', 'Пройдите квиз с результатом 100%', '/badges/perfectionist_1.svg', 'common', 'quiz', '{"type": "perfect_quiz", "count": 1}', 20),
('perfectionist_10', 'Абсолютный Перфекционист', 'Пройдите 10 квизов с результатом 100%', '/badges/perfectionist_10.svg', 'rare', 'quiz', '{"type": "perfect_quiz", "count": 10}', 150),

('speedster', 'Скоростной гонщик', 'Пройдите квиз менее чем за 30 секунд', '/badges/speedster.svg', 'rare', 'quiz', '{"type": "quiz_speed", "max_time": 30000}', 100),
('sniper', 'Снайпер', 'Ответьте правильно на 50 вопросов подряд', '/badges/sniper.svg', 'epic', 'quiz', '{"type": "correct_streak", "count": 50}', 300),

-- Социальные
('popular_10', 'Популярный', 'Получите 10 подписчиков', '/badges/popular_10.svg', 'common', 'social', '{"type": "followers", "count": 10}', 30),
('popular_50', 'Известный', 'Получите 50 подписчиков', '/badges/popular_50.svg', 'rare', 'social', '{"type": "followers", "count": 50}', 150),
('popular_100', 'Знаменитость', 'Получите 100 подписчиков', '/badges/popular_100.svg', 'epic', 'social', '{"type": "followers", "count": 100}', 500),

('friendly', 'Общительный', 'Оставьте 100 комментариев', '/badges/friendly.svg', 'common', 'social', '{"type": "comments", "count": 100}', 50),
('beloved', 'Любимчик', 'Получите 500 лайков', '/badges/beloved.svg', 'rare', 'social', '{"type": "likes_received", "count": 500}', 200),
('creator', 'Создатель', 'Создайте 10 списков', '/badges/creator.svg', 'common', 'social', '{"type": "lists_created", "count": 10}', 40),
('generous', 'Щедрый', 'Поделитесь 20 квизами', '/badges/generous.svg', 'common', 'social', '{"type": "quizzes_shared", "count": 20}', 60),

-- Контент
('historian', 'Историк', 'Добавьте 10 личностей', '/badges/historian.svg', 'common', 'content', '{"type": "persons_added", "count": 10}', 100),
('encyclopedist', 'Энциклопедист', 'Добавьте 50 достижений', '/badges/encyclopedist.svg', 'rare', 'content', '{"type": "achievements_added", "count": 50}', 250),
('approved_100', 'Одобрено!', 'Получите 100 одобренных контрибуций', '/badges/approved_100.svg', 'epic', 'content', '{"type": "approved_contributions", "count": 100}', 400),

-- Особые
('veteran_1year', 'Ветеран', 'Зарегистрируйтесь год назад', '/badges/veteran_1year.svg', 'epic', 'special', '{"type": "account_age", "days": 365}', 300),
('top1', 'Топ-1', 'Займите первое место в глобальном рейтинге', '/badges/top1.svg', 'legendary', 'special', '{"type": "leaderboard_rank", "rank": 1}', 1000),
('unique', 'Уникум', 'Особые заслуги перед сообществом', '/badges/unique.svg', 'legendary', 'special', '{"type": "manual"}', 500);
```

### Backend API

```typescript
// src/types/database.ts - добавить типы
export interface BadgeRow {
  id: number;
  code: string;
  title: string;
  description: string;
  icon_url: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'quiz' | 'social' | 'content' | 'special';
  criteria: {
    type: string;
    count?: number;
    max_time?: number;
    rank?: number;
    days?: number;
  };
  points: number;
  created_at: Date;
}

export interface UserBadgeRow {
  id: number;
  user_id: number;
  badge_id: number;
  earned_at: Date;
  progress: Record<string, unknown> | null;
}

// src/services/BadgeService.ts
export class BadgeService {
  // Получить все достижения
  async getAllBadges(): Promise<BadgeRow[]>;

  // Получить достижения пользователя
  async getUserBadges(userId: number): Promise<(UserBadgeRow & { badge: BadgeRow })[]>;

  // Проверить и выдать достижение
  async checkAndAwardBadge(userId: number, badgeCode: string): Promise<boolean>;

  // Проверить все возможные достижения пользователя
  async checkAllBadges(userId: number): Promise<string[]>; // возвращает массив кодов новых бейджей

  // Выдать достижение вручную (для админов)
  async awardBadgeManually(userId: number, badgeCode: string): Promise<void>;
}
```

### Endpoints

```
GET    /api/badges                    - Получить все достижения
GET    /api/badges/:code              - Получить информацию о достижении
GET    /api/users/:userId/badges      - Получить достижения пользователя
GET    /api/users/me/badges           - Мои достижения (auth)
POST   /api/badges/check              - Проверить новые достижения (auth)
```

### Frontend компоненты

```typescript
// src/features/badges/components/BadgeCard.tsx
interface BadgeCardProps {
  badge: Badge;
  earned?: boolean;
  earnedAt?: Date;
  progress?: number; // 0-100
}

// src/features/badges/components/BadgeGrid.tsx
// Сетка всех достижений с фильтрами

// src/features/badges/components/BadgeNotification.tsx
// Всплывающее уведомление при получении достижения

// src/features/badges/pages/BadgesPage.tsx
// Страница со всеми достижениями
```

---

## 📚 2. Публичные списки

### База данных

```sql
-- Добавить колонки к существующей таблице lists
ALTER TABLE lists ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private'
    CHECK (visibility IN ('private', 'public', 'unlisted'));
ALTER TABLE lists ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS share_code VARCHAR(20) UNIQUE;

-- Таблица лайков к спискам
CREATE TABLE list_likes (
    id SERIAL PRIMARY KEY,
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(list_id, user_id)
);

-- Таблица комментариев к спискам
CREATE TABLE list_comments (
    id SERIAL PRIMARY KEY,
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id INTEGER REFERENCES list_comments(id) ON DELETE CASCADE,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_edited BOOLEAN DEFAULT FALSE
);

-- Таблица лайков к комментариям
CREATE TABLE list_comment_likes (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES list_comments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, user_id)
);

-- Индексы
CREATE INDEX idx_lists_visibility ON lists(visibility);
CREATE INDEX idx_lists_share_code ON lists(share_code);
CREATE INDEX idx_lists_public_created ON lists(visibility, created_at DESC) WHERE visibility = 'public';
CREATE INDEX idx_list_likes_list ON list_likes(list_id);
CREATE INDEX idx_list_likes_user ON list_likes(user_id);
CREATE INDEX idx_list_comments_list ON list_comments(list_id, created_at DESC);
CREATE INDEX idx_list_comments_user ON list_comments(user_id);
CREATE INDEX idx_list_comment_likes_comment ON list_comment_likes(comment_id);

-- Триггер для обновления счётчика лайков
CREATE OR REPLACE FUNCTION update_list_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE lists SET likes_count = likes_count + 1 WHERE id = NEW.list_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE lists SET likes_count = likes_count - 1 WHERE id = OLD.list_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_list_likes_count
AFTER INSERT OR DELETE ON list_likes
FOR EACH ROW EXECUTE FUNCTION update_list_likes_count();

-- Триггер для обновления счётчика лайков комментариев
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE list_comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE list_comments SET likes_count = likes_count - 1 WHERE id = OLD.comment_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_likes_count
AFTER INSERT OR DELETE ON list_comment_likes
FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();

-- Функция для генерации share_code
CREATE OR REPLACE FUNCTION generate_share_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- без I, O, 0, 1 для читаемости
    code TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN code;
END;
$$ LANGUAGE plpgsql;
```

### Backend API

```typescript
// src/services/PublicListsService.ts
export class PublicListsService {
  // Получить публичные списки
  async getPublicLists(params: {
    limit?: number;
    offset?: number;
    sortBy?: 'recent' | 'popular' | 'likes';
    category?: string;
  }): Promise<{ lists: PublicList[]; total: number }>;

  // Получить список по share_code
  async getListByShareCode(shareCode: string): Promise<PublicList | null>;

  // Сделать список публичным
  async publishList(
    listId: number,
    userId: number,
    description?: string
  ): Promise<{ shareCode: string }>;

  // Изменить видимость списка
  async updateListVisibility(
    listId: number,
    userId: number,
    visibility: 'private' | 'public' | 'unlisted'
  ): Promise<void>;

  // Лайкнуть список
  async likeList(listId: number, userId: number): Promise<void>;
  async unlikeList(listId: number, userId: number): Promise<void>;

  // Инкремент просмотров
  async incrementViews(listId: number): Promise<void>;
}

// src/services/ListCommentsService.ts
export class ListCommentsService {
  // Получить комментарии к списку
  async getComments(
    listId: number,
    params: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Comment[]>;

  // Добавить комментарий
  async addComment(
    listId: number,
    userId: number,
    content: string,
    parentId?: number
  ): Promise<Comment>;

  // Редактировать комментарий
  async updateComment(commentId: number, userId: number, content: string): Promise<void>;

  // Удалить комментарий
  async deleteComment(commentId: number, userId: number): Promise<void>;

  // Лайкнуть комментарий
  async likeComment(commentId: number, userId: number): Promise<void>;
  async unlikeComment(commentId: number, userId: number): Promise<void>;
}
```

### Endpoints

```
# Публичные списки
GET    /api/lists/public                           - Каталог публичных списков
GET    /api/lists/public/:shareCode                - Получить список по коду
POST   /api/lists/:id/publish                      - Опубликовать список (auth)
PUT    /api/lists/:id/visibility                   - Изменить видимость (auth)
POST   /api/lists/:id/like                         - Лайкнуть (auth)
DELETE /api/lists/:id/like                         - Убрать лайк (auth)
POST   /api/lists/:id/view                         - Инкремент просмотров

# Комментарии к спискам
GET    /api/lists/:id/comments                     - Получить комментарии
POST   /api/lists/:id/comments                     - Добавить комментарий (auth)
PUT    /api/lists/:id/comments/:commentId          - Редактировать (auth)
DELETE /api/lists/:id/comments/:commentId          - Удалить (auth)
POST   /api/lists/:id/comments/:commentId/like     - Лайкнуть (auth)
DELETE /api/lists/:id/comments/:commentId/like     - Убрать лайк (auth)
```

### Frontend компоненты

```typescript
// src/features/lists/pages/PublicListsPage.tsx
// Каталог публичных списков с фильтрами и сортировкой

// src/features/lists/pages/ListDetailPage.tsx
// Детальная страница списка с комментариями

// src/features/lists/components/ListCard.tsx
// Карточка списка в каталоге

// src/features/lists/components/PublishListModal.tsx
// Модалка для публикации списка

// src/features/lists/components/ListComments.tsx
// Компонент комментариев

// src/features/lists/components/ListStats.tsx
// Статистика списка (просмотры, лайки, комментарии)
```

---

## 👤 3. Публичные профили

### База данных

```sql
-- Расширение таблицы users
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS website_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_period_start INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_period_end INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_categories TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_stats BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_badges BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_activity BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_quiz_points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS quiz_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS perfect_quizzes INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Таблица подписок
CREATE TABLE user_follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Таблица активности пользователя
CREATE TABLE user_activity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    metadata JSONB,
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'private')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX idx_users_username_public ON users(username) WHERE is_public_profile = TRUE;
CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON user_follows(following_id);
CREATE INDEX idx_user_activity_user ON user_activity(user_id, created_at DESC);
CREATE INDEX idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX idx_user_activity_visibility ON user_activity(visibility, created_at DESC);

-- Триггеры для счётчиков подписок
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
        UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE users SET followers_count = followers_count - 1 WHERE id = OLD.following_id;
        UPDATE users SET following_count = following_count - 1 WHERE id = OLD.follower_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_follow_counts
AFTER INSERT OR DELETE ON user_follows
FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- View для публичных профилей
CREATE OR REPLACE VIEW v_user_profiles AS
SELECT
    u.id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.bio,
    u.location,
    u.website_url,
    u.favorite_period_start,
    u.favorite_period_end,
    u.favorite_categories,
    u.total_quiz_points,
    u.quiz_count,
    u.perfect_quizzes,
    u.followers_count,
    u.following_count,
    u.created_at as joined_at,
    (SELECT COUNT(*) FROM lists WHERE owner_user_id = u.id AND visibility = 'public') as public_lists_count,
    (SELECT COUNT(*) FROM user_badges WHERE user_id = u.id) as badges_count,
    COALESCE(
        (SELECT COUNT(*) FROM persons WHERE created_by = u.id AND status = 'approved'),
        0
    ) +
    COALESCE(
        (SELECT COUNT(*) FROM achievements WHERE created_by = u.id AND status = 'approved'),
        0
    ) +
    COALESCE(
        (SELECT COUNT(*) FROM periods WHERE created_by = u.id AND status = 'approved'),
        0
    ) as approved_contributions
FROM users u
WHERE u.is_public_profile = TRUE AND u.is_active = TRUE;
```

### Backend API

```typescript
// src/services/UserProfileService.ts
export class UserProfileService {
  // Получить публичный профиль
  async getPublicProfile(username: string): Promise<PublicProfile | null>;

  // Обновить свой профиль
  async updateProfile(userId: number, data: ProfileUpdateData): Promise<void>;

  // Получить статистику пользователя
  async getUserStats(userId: number): Promise<UserStats>;

  // Получить активность пользователя
  async getUserActivity(
    username: string,
    params: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Activity[]>;

  // Записать активность
  async logActivity(
    userId: number,
    activity: {
      type: string;
      entityType?: string;
      entityId?: string;
      metadata?: Record<string, unknown>;
      visibility?: 'public' | 'followers' | 'private';
    }
  ): Promise<void>;
}

// src/services/FollowService.ts
export class FollowService {
  // Подписаться
  async follow(followerId: number, followingId: number): Promise<void>;

  // Отписаться
  async unfollow(followerId: number, followingId: number): Promise<void>;

  // Проверить подписку
  async isFollowing(followerId: number, followingId: number): Promise<boolean>;

  // Получить подписчиков
  async getFollowers(
    userId: number,
    params: {
      limit?: number;
      offset?: number;
    }
  ): Promise<{ users: UserBasic[]; total: number }>;

  // Получить подписки
  async getFollowing(
    userId: number,
    params: {
      limit?: number;
      offset?: number;
    }
  ): Promise<{ users: UserBasic[]; total: number }>;
}
```

### Endpoints

```
# Профили
GET    /api/users/:username/profile           - Публичный профиль
GET    /api/users/me/profile                  - Мой профиль (auth)
PUT    /api/users/me/profile                  - Обновить профиль (auth)
GET    /api/users/:username/stats             - Статистика пользователя
GET    /api/users/:username/activity          - Активность пользователя
GET    /api/users/:username/lists             - Публичные списки пользователя
GET    /api/users/:username/badges            - Достижения пользователя

# Подписки
POST   /api/users/:username/follow            - Подписаться (auth)
DELETE /api/users/:username/unfollow          - Отписаться (auth)
GET    /api/users/:username/followers         - Подписчики
GET    /api/users/:username/following         - Подписки
GET    /api/users/:username/is-following      - Проверить подписку (auth)
```

### Frontend компоненты

```typescript
// src/features/users/pages/UserProfilePage.tsx
// Страница публичного профиля

// src/features/users/pages/EditProfilePage.tsx
// Редактирование своего профиля

// src/features/users/components/ProfileHeader.tsx
// Шапка профиля с аватаром, био, статистикой

// src/features/users/components/FollowButton.tsx
// Кнопка подписки/отписки

// src/features/users/components/ActivityFeed.tsx
// Лента активности пользователя

// src/features/users/components/UserBadges.tsx
// Витрина достижений

// src/features/users/components/UserStats.tsx
// Статистика (квизы, вклад, рейтинг)

// src/features/users/components/UserLists.tsx
// Публичные списки пользователя
```

---

## 🔥 4. Стрики (Streaks)

### База данных

```sql
-- Таблица стриков
CREATE TABLE user_streaks (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    total_active_days INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица ежедневных активностей
CREATE TABLE daily_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    activities_completed JSONB DEFAULT '[]',
    quiz_completed BOOLEAN DEFAULT FALSE,
    person_added BOOLEAN DEFAULT FALSE,
    list_created BOOLEAN DEFAULT FALSE,
    comment_added BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, activity_date)
);

-- Индексы
CREATE INDEX idx_user_streaks_longest ON user_streaks(longest_streak DESC);
CREATE INDEX idx_daily_activities_user_date ON daily_activities(user_id, activity_date DESC);
CREATE INDEX idx_daily_activities_date ON daily_activities(activity_date);

-- Функция для обновления стрика
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id INTEGER)
RETURNS void AS $$
DECLARE
    v_last_date DATE;
    v_today DATE := CURRENT_DATE;
    v_current_streak INTEGER := 0;
    v_longest_streak INTEGER := 0;
BEGIN
    -- Получаем текущие данные
    SELECT last_activity_date, current_streak, longest_streak
    INTO v_last_date, v_current_streak, v_longest_streak
    FROM user_streaks
    WHERE user_id = p_user_id;

    -- Если записи нет, создаём
    IF NOT FOUND THEN
        INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date, total_active_days)
        VALUES (p_user_id, 1, 1, v_today, 1);
        RETURN;
    END IF;

    -- Если активность уже была сегодня
    IF v_last_date = v_today THEN
        RETURN;
    END IF;

    -- Если вчера была активность - продолжаем стрик
    IF v_last_date = v_today - INTERVAL '1 day' THEN
        v_current_streak := v_current_streak + 1;
        IF v_current_streak > v_longest_streak THEN
            v_longest_streak := v_current_streak;
        END IF;
    -- Если пропуск - сбрасываем стрик
    ELSIF v_last_date < v_today - INTERVAL '1 day' THEN
        v_current_streak := 1;
    END IF;

    -- Обновляем
    UPDATE user_streaks
    SET current_streak = v_current_streak,
        longest_streak = v_longest_streak,
        last_activity_date = v_today,
        total_active_days = total_active_days + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
```

### Backend API

```typescript
// src/services/StreakService.ts
export class StreakService {
  // Получить стрик пользователя
  async getUserStreak(userId: number): Promise<StreakData>;

  // Обновить стрик (вызывается при любой активности)
  async updateStreak(userId: number): Promise<StreakData>;

  // Получить топ стриков
  async getTopStreaks(limit: number = 10): Promise<UserStreak[]>;

  // Записать дневную активность
  async logDailyActivity(userId: number, activityType: string): Promise<void>;

  // Получить календарь активности
  async getActivityCalendar(userId: number, year: number, month: number): Promise<DayActivity[]>;
}

// Типы
interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  totalActiveDays: number;
  bonus: number; // множитель очков
}

interface DayActivity {
  date: Date;
  hasActivity: boolean;
  activities: string[];
}
```

### Endpoints

```
GET  /api/users/me/streak              - Мой стрик (auth)
GET  /api/users/:username/streak       - Стрик пользователя
GET  /api/streaks/leaderboard          - Топ стриков
GET  /api/users/:username/calendar     - Календарь активности
POST /api/streaks/update               - Обновить стрик (внутренний, вызывается автоматически)
```

### Frontend компоненты

```typescript
// src/features/streaks/components/StreakWidget.tsx
// Виджет текущего стрика (показывается в header или на главной)

// src/features/streaks/components/StreakStats.tsx
// Детальная статистика стрика

// src/features/streaks/components/ActivityCalendar.tsx
// Календарь активности (как на GitHub)

// src/features/streaks/components/StreakLeaderboard.tsx
// Топ стриков
```

---

## 📅 План реализации

### Фаза 1: Фундамент (Неделя 1-2)

#### Неделя 1: База данных и backend

- [ ] Создать миграции для всех таблиц
- [ ] Написать SQL-скрипты для triggers и functions
- [ ] Создать types в TypeScript
- [ ] Реализовать базовые Services

#### Неделя 2: API endpoints

- [ ] Реализовать routes для badges
- [ ] Реализовать routes для public lists
- [ ] Реализовать routes для profiles
- [ ] Реализовать routes для streaks
- [ ] Написать тесты для endpoints

### Фаза 2: Frontend базовый (Неделя 3-4)

#### Неделя 3: Страницы и компоненты

- [ ] BadgesPage - витрина достижений
- [ ] PublicListsPage - каталог списков
- [ ] UserProfilePage - публичный профиль
- [ ] StreakWidget - виджет стрика

#### Неделя 4: Интеграция

- [ ] Логика награждения бейджей
- [ ] Публикация списков
- [ ] Редактирование профиля
- [ ] Подписки follow/unfollow
- [ ] Обновление стриков

### Фаза 3: Полировка (Неделя 5-6)

#### Неделя 5: UX и анимации

- [ ] Анимация получения бейджа
- [ ] Красивое отображение стрика
- [ ] Улучшение UI карточек списков
- [ ] Адаптивность всех страниц

#### Неделя 6: Комментарии и активность

- [ ] Компонент комментариев к спискам
- [ ] Лента активности пользователя
- [ ] Уведомления (базовые)
- [ ] Финальное тестирование

---

## 🎨 Дизайн концепты

### Badges (Достижения)

```
┌─────────────────────────────────────┐
│  🏆 Мои Достижения                  │
├─────────────────────────────────────┤
│  [Все] [Квизы] [Социальные]        │
│  [Контент] [Особые]                 │
├─────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ 🎓   │ │ 💯   │ │ 🏅   │        │
│  │Первый│ │Перфек│ │Мастер│        │
│  │Квиз  │ │ционст│ │Квиза │        │
│  └──────┘ └──────┘ └──────┘        │
│  Получено           Получено        │
│                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ ⚡   │ │ 🦄   │ │ 👑   │        │
│  │Скорст│ │Уникум│ │Топ-1 │        │
│  │ник   │ │  ?   │ │  ?   │        │
│  └──────┘ └──────┘ └──────┘        │
│  Получено  Не получено              │
└─────────────────────────────────────┘
```

### Public Lists (Каталог)

```
┌─────────────────────────────────────┐
│  📚 Каталог Списков                 │
├─────────────────────────────────────┤
│  🔍 Поиск...    [Последние ▼]      │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ 👤 username  📅 2 дня назад │   │
│  │ ⭐ Великие полководцы       │   │
│  │ Подборка великих военачал.  │   │
│  │ 👁 245  ❤️ 18  💬 5         │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 👤 maria123  📅 5 дней назад│   │
│  │ ⭐ Учёные эпохи Возрождения │   │
│  │ Мои любимые гении науки     │   │
│  │ 👁 189  ❤️ 24  💬 8         │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### User Profile

```
┌─────────────────────────────────────┐
│  ┌────┐                             │
│  │ 👤 │  @username                  │
│  └────┘  Иван Иванов                │
│          📍 Москва                  │
│          🌐 example.com             │
│          [✏️ Редактировать]         │
├─────────────────────────────────────┤
│  "Люблю историю Древней Руси..."   │
├─────────────────────────────────────┤
│  🏆 42 достижения                   │
│  👥 156 подписчиков | 89 подписок  │
│  📝 23 публичных списка             │
│  ⭐ 2,847 очков в квизах            │
│  🔥 15 дней подряд                  │
├─────────────────────────────────────┤
│  [Активность] [Списки] [Достижения]│
├─────────────────────────────────────┤
│  • Прошёл квиз "Древняя Русь" 98%  │
│    2 часа назад                     │
│  • Создал список "Русские князья"  │
│    1 день назад                     │
│  • Получил бейдж "Перфекционист"   │
│    2 дня назад                      │
└─────────────────────────────────────┘
```

### Streak Widget

```
┌─────────────────────┐
│  🔥 15 дней подряд  │
│  Лучший стрик: 28   │
│  +20% к очкам!      │
└─────────────────────┘
```

---

## 🔔 Интеграция с существующей системой

### Автоматическое награждение бейджами

```typescript
// После прохождения квиза
async function onQuizCompleted(userId: number, quizResult: QuizResult) {
  // Обновить статистику
  await updateUserQuizStats(userId, quizResult);

  // Обновить стрик
  await streakService.updateStreak(userId);

  // Проверить достижения
  const newBadges = await badgeService.checkAllBadges(userId);

  // Если получены новые бейджи - показать уведомление
  if (newBadges.length > 0) {
    await notifyNewBadges(userId, newBadges);
  }

  // Записать активность
  await logActivity(userId, {
    type: 'quiz_completed',
    entityId: quizResult.id,
    visibility: 'public',
  });
}
```

### Автоматическое логирование активности

```typescript
// Middleware для автоматического логирования
async function activityLogger(req, res, next) {
  // Отслеживаем определённые действия
  const actionsToLog = {
    'POST /api/lists': 'list_created',
    'POST /api/quiz/save-result': 'quiz_completed',
    'POST /api/persons': 'person_added',
    'POST /api/lists/:id/comments': 'comment_added',
  };

  // После успешного ответа логируем
  res.on('finish', async () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const action = actionsToLog[`${req.method} ${req.route.path}`];
      if (action && req.user) {
        await logActivity(req.user.id, {
          type: action,
          entityId: res.locals.entityId,
          visibility: 'public',
        });
      }
    }
  });

  next();
}
```

---

## 📊 Метрики успеха

### KPI для отслеживания

```javascript
// После внедрения социальных функций отслеживать:

// Engagement
- Процент пользователей с заполненным профилем
- Среднее количество подписок на пользователя
- Количество комментариев в день
- Количество лайков в день
- Процент публичных списков от всех созданных

// Retention
- Процент пользователей с активным стриком (>3 дней)
- Возврат после получения уведомления о новом подписчике
- Средняя длина стрика
- DAU/MAU ratio

// Gamification
- Среднее количество бейджей на пользователя
- Процент пользователей с хотя бы одним бейджем
- Популярность категорий бейджей
- Время до первого бейджа (onboarding метрика)

// Social
- Граф социальных связей (density)
- Топ-10 самых популярных пользователей
- Среднее количество просмотров публичных списков
- Conversion rate: просмотр списка -> создание своего
```

---

## 🚀 Быстрый старт для разработки

### 1. Создать миграцию

```bash
# В корне backend проекта
npm run create-migration social-features
```

### 2. Скопировать SQL из этого документа

```sql
-- В файл миграции скопировать все CREATE TABLE, ALTER TABLE и т.д.
```

### 3. Запустить миграцию

```bash
npm run migrate
```

### 4. Создать сервисы

```bash
# Backend
touch src/services/BadgeService.ts
touch src/services/PublicListsService.ts
touch src/services/ListCommentsService.ts
touch src/services/UserProfileService.ts
touch src/services/FollowService.ts
touch src/services/StreakService.ts
```

### 5. Создать routes

```bash
touch src/routes/badgesRoutes.ts
touch src/routes/publicListsRoutes.ts
touch src/routes/profilesRoutes.ts
touch src/routes/streaksRoutes.ts
```

### 6. Создать frontend структуру

```bash
# Frontend
mkdir -p src/features/badges/{components,pages,hooks}
mkdir -p src/features/public-lists/{components,pages,hooks}
mkdir -p src/features/profiles/{components,pages,hooks}
mkdir -p src/features/streaks/{components,hooks}
```

---

## 📝 Чеклист готовности к релизу

### Backend

- [ ] Все таблицы созданы
- [ ] Индексы настроены
- [ ] Triggers работают
- [ ] Services реализованы
- [ ] Routes подключены
- [ ] Тесты написаны (coverage >80%)
- [ ] API документация обновлена

### Frontend

- [ ] Все страницы работают
- [ ] Компоненты адаптивные
- [ ] Анимации плавные
- [ ] Ошибки обрабатываются
- [ ] Loading states показываются
- [ ] SEO meta-теги добавлены
- [ ] Accessibility проверена

### Integration

- [ ] Автоматическое награждение работает
- [ ] Стрики обновляются корректно
- [ ] Активность логируется
- [ ] Уведомления отправляются
- [ ] Кэширование настроено

### Testing

- [ ] Unit tests passed
- [ ] Integration tests passed
- [ ] E2E критичных флоу passed
- [ ] Performance тестирование
- [ ] Load testing (если большая база)

---

## 🎉 Итого

После реализации этого плана у вас будет:

✅ **Система достижений** - 25+ бейджей, автоматическая выдача
✅ **Публичные списки** - каталог, комментарии, лайки
✅ **Публичные профили** - витрина активности, подписки
✅ **Стрики** - ежедневная мотивация, бонусы

Это создаст базу для живого сообщества и значительно увеличит retention и engagement!

---

**Создано:** 1 ноября 2025  
**Версия:** 1.0  
**Статус:** Ready for implementation

