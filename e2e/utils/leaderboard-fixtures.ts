import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import { createTestPool } from './db-reset';

export interface LeaderboardUserSeed {
  email: string;
  username: string;
  role?: 'user' | 'moderator' | 'admin';
  password?: string;
  emailVerified?: boolean;
}

export interface LeaderboardAttemptSeed {
  email: string;
  correctAnswers: number;
  totalQuestions: number;
  totalTimeMs: number;
  ratingPoints?: number;
  createdAt?: Date;
  config?: Record<string, unknown>;
}

export interface LeaderboardSeedConfig {
  users?: LeaderboardUserSeed[];
  attempts: LeaderboardAttemptSeed[];
}

const DEFAULT_PASSWORD = 'Test123!';
const DEFAULT_ROLE: LeaderboardUserSeed['role'] = 'user';
const HASH_CACHE = new Map<string, string>();
const LEADERBOARD_LOCK_KEY = 917341; // Arbitrary constant to coordinate DB access

async function getPasswordHash(password: string): Promise<string> {
  if (!HASH_CACHE.has(password)) {
    const hash = await bcrypt.hash(password, 10);
    HASH_CACHE.set(password, hash);
  }
  return HASH_CACHE.get(password)!;
}

async function ensureUser(client: PoolClient, seed: LeaderboardUserSeed): Promise<number> {
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

async function clearLeaderboardData(client: PoolClient): Promise<void> {
  await client.query('DELETE FROM test.quiz_attempts');
  await client.query(`DELETE FROM test.users WHERE email LIKE 'leaderboard-e2e-%@test.com'`);
}

async function insertLeaderboardData(client: PoolClient, config: LeaderboardSeedConfig): Promise<void> {
  const userIdByEmail = new Map<string, number>();

  if (config.users) {
    for (const user of config.users) {
      const id = await ensureUser(client, user);
      userIdByEmail.set(user.email, id);
    }
  }

  for (const attempt of config.attempts) {
    if (!userIdByEmail.has(attempt.email)) {
      const fallbackUser: LeaderboardUserSeed = {
        email: attempt.email,
        username: attempt.email.split('@')[0],
      };
      const id = await ensureUser(client, fallbackUser);
      userIdByEmail.set(attempt.email, id);
    }

    const userId = userIdByEmail.get(attempt.email)!;
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
        created_at
      )
      VALUES ($1, NULL, $2, $3, $4, $5, $6, $7)`,
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

export async function resetLeaderboardData(): Promise<void> {
  const pool = createTestPool();
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [LEADERBOARD_LOCK_KEY]);
    await client.query('BEGIN');
    await clearLeaderboardData(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [LEADERBOARD_LOCK_KEY]);
    } catch (unlockError) {
      console.error('Failed to release leaderboard advisory lock in reset:', unlockError);
    }
    client.release();
    await pool.end();
  }
}

export async function seedLeaderboardData(config: LeaderboardSeedConfig): Promise<void> {
  const pool = createTestPool();
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [LEADERBOARD_LOCK_KEY]);
    await client.query('BEGIN');
    await insertLeaderboardData(client, config);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [LEADERBOARD_LOCK_KEY]);
    } catch (unlockError) {
      console.error('Failed to release leaderboard advisory lock in seed:', unlockError);
    }
    client.release();
    await pool.end();
  }
}

export async function withLeaderboardData(
  config: LeaderboardSeedConfig,
  action: () => Promise<void>
): Promise<void> {
  const pool = createTestPool();
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [LEADERBOARD_LOCK_KEY]);
    await client.query('BEGIN');
    await clearLeaderboardData(client);
    await insertLeaderboardData(client, config);
    await client.query('COMMIT');
    await action();
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [LEADERBOARD_LOCK_KEY]);
    } catch (unlockError) {
      console.error('Failed to release leaderboard advisory lock in withLeaderboardData:', unlockError);
    }
    client.release();
    await pool.end();
  }
}
