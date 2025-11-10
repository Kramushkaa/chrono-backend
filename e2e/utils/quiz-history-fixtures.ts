import { PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import { createTestPool } from './db-reset';

export interface QuizHistoryUserSeed {
  email: string;
  username: string;
  role?: 'user' | 'moderator' | 'admin';
  password?: string;
  emailVerified?: boolean;
}

export interface QuizHistoryAttemptSeed {
  correctAnswers: number;
  totalQuestions: number;
  totalTimeMs: number;
  ratingPoints?: number;
  createdAt?: Date;
  config?: Record<string, unknown>;
}

export interface QuizHistorySeedConfig {
  user: QuizHistoryUserSeed;
  attempts: QuizHistoryAttemptSeed[];
}

const DEFAULT_PASSWORD = 'Test123!';
const DEFAULT_ROLE: QuizHistoryUserSeed['role'] = 'user';
const HASH_CACHE = new Map<string, string>();
const HISTORY_LOCK_KEY = 917342;

async function getPasswordHash(password: string): Promise<string> {
  if (!HASH_CACHE.has(password)) {
    const hash = await bcrypt.hash(password, 10);
    HASH_CACHE.set(password, hash);
  }
  return HASH_CACHE.get(password)!;
}

async function ensureUser(client: PoolClient, seed: QuizHistoryUserSeed): Promise<number> {
  const {
    email,
    username,
    role = DEFAULT_ROLE,
    password = DEFAULT_PASSWORD,
    emailVerified = true,
  } = seed;

  const existing = await client.query('SELECT id FROM test.users WHERE email = $1', [email]);

  if (existing.rowCount && existing.rows[0]?.id) {
    return existing.rows[0].id as number;
  }

  const passwordHash = await getPasswordHash(password);

  const inserted = await client.query(
    `INSERT INTO test.users (username, email, password_hash, role, is_active, email_verified, created_at)
     VALUES ($1, $2, $3, $4, true, $5, NOW())
     RETURNING id`,
    [username, email, passwordHash, role, emailVerified]
  );

  return inserted.rows[0].id as number;
}

async function clearAttempts(client: PoolClient, userId: number): Promise<void> {
  await client.query('DELETE FROM test.quiz_attempts WHERE user_id = $1', [userId]);
}

async function insertAttempts(
  client: PoolClient,
  userId: number,
  attempts: QuizHistoryAttemptSeed[]
): Promise<void> {
  for (const attempt of attempts) {
    const ratingPoints =
      attempt.ratingPoints ??
      Math.round((attempt.correctAnswers / attempt.totalQuestions) * 100);

    await client.query(
      `INSERT INTO test.quiz_attempts (
        user_id,
        shared_quiz_id,
        correct_answers,
        total_questions,
        total_time_ms,
        rating_points,
        config,
        created_at,
        answers,
        questions
      )
      VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, NULL, NULL)`,
      [
        userId,
        attempt.correctAnswers,
        attempt.totalQuestions,
        attempt.totalTimeMs,
        ratingPoints,
        attempt.config ? JSON.stringify(attempt.config) : null,
        attempt.createdAt ?? new Date(),
      ]
    );
  }
}

async function seedUsingClient(
  client: PoolClient,
  config: QuizHistorySeedConfig
): Promise<number> {
  const userId = await ensureUser(client, config.user);
  await clearAttempts(client, userId);
  if (config.attempts.length > 0) {
    await insertAttempts(client, userId, config.attempts);
  }
  return userId;
}

export async function seedQuizHistoryData(config: QuizHistorySeedConfig): Promise<void> {
  const pool = createTestPool();
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [HISTORY_LOCK_KEY]);
    await client.query('BEGIN');

    await seedUsingClient(client, config);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [HISTORY_LOCK_KEY]);
    } catch (unlockError) {
      console.error('Failed to release quiz history advisory lock:', unlockError);
    }
    client.release();
    await pool.end();
  }
}

export async function withQuizHistoryData(
  config: QuizHistorySeedConfig,
  action: () => Promise<void>
): Promise<void> {
  const pool = createTestPool();
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [HISTORY_LOCK_KEY]);
    await client.query('BEGIN');

    await seedUsingClient(client, config);

    await client.query('COMMIT');

    await action();
  } finally {
    try {
      await client.query('BEGIN');
      const userId = await ensureUser(client, config.user);
      await clearAttempts(client, userId);
      await client.query('COMMIT');
    } catch (cleanupError) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Failed to cleanup quiz history data:', cleanupError);
    }

    try {
      await client.query('SELECT pg_advisory_unlock($1)', [HISTORY_LOCK_KEY]);
    } catch (unlockError) {
      console.error('Failed to release quiz history advisory lock:', unlockError);
    }

    client.release();
    await pool.end();
  }
}

