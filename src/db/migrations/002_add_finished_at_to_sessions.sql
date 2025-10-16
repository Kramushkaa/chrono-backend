-- Migration: Add finished_at column to quiz_sessions
-- Description: Allows tracking when a quiz session was completed instead of deleting it

-- Add finished_at column
ALTER TABLE quiz_sessions 
ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP WITHOUT TIME ZONE;

-- Create index for finished sessions (partial index for better performance)
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_finished 
ON quiz_sessions(finished_at) 
WHERE finished_at IS NOT NULL;

-- Create index for active sessions (partial index)
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_active 
ON quiz_sessions(expires_at) 
WHERE finished_at IS NULL;

-- Add comment
COMMENT ON COLUMN quiz_sessions.finished_at IS 'Timestamp when the quiz session was completed. NULL means session is still active.';

