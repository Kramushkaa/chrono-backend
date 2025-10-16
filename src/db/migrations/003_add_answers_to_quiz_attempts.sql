-- Migration: Add answers field to quiz_attempts
-- Description: Allows storing detailed answers for all quiz types (not just shared quizzes)

-- Add answers column to store detailed answer information
ALTER TABLE quiz_attempts 
ADD COLUMN IF NOT EXISTS answers JSONB;

-- Add questions column to store the actual questions asked
ALTER TABLE quiz_attempts 
ADD COLUMN IF NOT EXISTS questions JSONB;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_created 
ON quiz_attempts(user_id, created_at DESC) 
WHERE user_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN quiz_attempts.answers IS 'Array of detailed answers: [{questionId, answer, isCorrect, timeSpent}]';
COMMENT ON COLUMN quiz_attempts.questions IS 'Array of questions asked in this quiz attempt';

