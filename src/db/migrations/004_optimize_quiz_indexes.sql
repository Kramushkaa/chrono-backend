-- Migration: Optimize quiz_attempts indexes for better leaderboard performance
-- Description: Adds GIN index for JSONB config and composite indexes for leaderboard queries

-- GIN index for filtering by config (for filtered leaderboards in the future)
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_config_gin 
  ON quiz_attempts USING gin (config);

-- Composite index for shared quiz leaderboards (most common query)
-- Covers: SELECT * FROM quiz_attempts WHERE shared_quiz_id = ? ORDER BY correct_answers DESC, total_time_ms ASC
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_shared_leaderboard 
  ON quiz_attempts(shared_quiz_id, correct_answers DESC, total_time_ms ASC) 
  WHERE shared_quiz_id IS NOT NULL;

-- Partial index for global leaderboard (rating-based, excluding shared quizzes)
-- Covers: SELECT * FROM quiz_attempts WHERE shared_quiz_id IS NULL ORDER BY rating_points DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_global_leaderboard 
  ON quiz_attempts(rating_points DESC, created_at DESC) 
  WHERE shared_quiz_id IS NULL;

-- Index for user's quiz history queries
-- Covers: SELECT * FROM quiz_attempts WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_history 
  ON quiz_attempts(user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_quiz_attempts_config_gin IS 'Supports filtering leaderboards by quiz configuration (categories, countries, etc.)';
COMMENT ON INDEX idx_quiz_attempts_shared_leaderboard IS 'Optimizes shared quiz leaderboard queries';
COMMENT ON INDEX idx_quiz_attempts_global_leaderboard IS 'Optimizes global leaderboard queries by rating';
COMMENT ON INDEX idx_quiz_attempts_user_history IS 'Optimizes user quiz history queries';

