-- Migration: Add quiz leaderboards and sharing functionality
-- Description: Creates tables for quiz attempts, shared quizzes, quiz sessions, and related indexes

-- Table: shared_quizzes (create FIRST because quiz_attempts references it)
-- Stores shared quiz configurations and questions
CREATE TABLE IF NOT EXISTS shared_quizzes (
    id SERIAL PRIMARY KEY,
    creator_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    share_code VARCHAR(20) UNIQUE NOT NULL,
    config JSONB NOT NULL, -- Quiz setup configuration
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE
);

-- Table: shared_quiz_questions
-- Stores individual questions for shared quizzes
CREATE TABLE IF NOT EXISTS shared_quiz_questions (
    id SERIAL PRIMARY KEY,
    shared_quiz_id INTEGER NOT NULL REFERENCES shared_quizzes(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    question_data JSONB NOT NULL, -- Full question data including correct answers
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (shared_quiz_id, question_index)
);

-- Table: quiz_attempts
-- Stores results of quiz attempts (both regular and shared quizzes)
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    shared_quiz_id INTEGER REFERENCES shared_quizzes(id) ON DELETE CASCADE,
    correct_answers INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    total_time_ms INTEGER NOT NULL,
    rating_points DECIMAL(10, 2) NOT NULL DEFAULT 0,
    config JSONB, -- Quiz configuration (filters, question types, etc.)
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: quiz_sessions
-- Tracks active quiz sessions for shared quizzes (for answer validation)
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id SERIAL PRIMARY KEY,
    shared_quiz_id INTEGER NOT NULL REFERENCES shared_quizzes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_token VARCHAR(64) UNIQUE NOT NULL,
    answers JSONB NOT NULL DEFAULT '[]', -- Array of answered questions
    started_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

-- Indexes for quiz_attempts
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_shared_quiz_id ON quiz_attempts(shared_quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_created_at ON quiz_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_rating_points ON quiz_attempts(rating_points DESC);

-- Indexes for shared_quizzes
CREATE INDEX IF NOT EXISTS idx_shared_quizzes_share_code ON shared_quizzes(share_code);
CREATE INDEX IF NOT EXISTS idx_shared_quizzes_creator ON shared_quizzes(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_quizzes_created_at ON shared_quizzes(created_at DESC);

-- Indexes for shared_quiz_questions
CREATE INDEX IF NOT EXISTS idx_shared_quiz_questions_quiz_id ON shared_quiz_questions(shared_quiz_id);

-- Indexes for quiz_sessions
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_token ON quiz_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_expires ON quiz_sessions(expires_at);

-- Comments
COMMENT ON TABLE quiz_attempts IS 'Stores quiz completion results for leaderboard tracking';
COMMENT ON TABLE shared_quizzes IS 'Stores shared quiz configurations for friend competitions';
COMMENT ON TABLE shared_quiz_questions IS 'Stores frozen questions for shared quizzes';
COMMENT ON TABLE quiz_sessions IS 'Tracks active quiz sessions for answer validation';
COMMENT ON COLUMN quiz_attempts.rating_points IS 'Calculated rating using: BaseScore × DifficultyMultiplier × TimeBonus';
COMMENT ON COLUMN shared_quizzes.share_code IS 'Short unique code for sharing (e.g., "ABC123")';
COMMENT ON COLUMN quiz_sessions.session_token IS 'Unique session identifier for tracking progress';

