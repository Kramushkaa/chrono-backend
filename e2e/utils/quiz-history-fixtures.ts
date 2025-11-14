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

export interface QuizHistoryAnswerSeed {
  questionId: string;
  answer: string | string[] | string[][];
  isCorrect: boolean;
  timeSpent: number;
}

export interface QuizHistoryQuestionSeed {
  id: string;
  type:
    | 'birthYear'
    | 'deathYear'
    | 'profession'
    | 'country'
    | 'achievementsMatch'
    | 'birthOrder'
    | 'contemporaries'
    | 'guessPerson';
  question: string;
  correctAnswer: string | string[] | string[][];
  explanation?: string;
  data?: unknown;
  options?: string[];
}

export interface QuizHistorySharedSessionSeed {
  sessionToken?: string;
  userId?: number | null;
  answers?: QuizHistoryAnswerSeed[];
  startedAt?: Date;
  finishedAt?: Date;
  expiresAt?: Date;
}

export interface QuizHistorySharedQuizSeed {
  shareCode?: string;
  title?: string;
  description?: string;
  config?: Record<string, unknown>;
  questions?: QuizHistoryQuestionSeed[];
  session?: QuizHistorySharedSessionSeed;
}

export interface QuizHistoryAttemptSeed {
  correctAnswers: number;
  totalQuestions: number;
  totalTimeMs: number;
  ratingPoints?: number;
  createdAt?: Date;
  config?: Record<string, unknown>;
  answers?: QuizHistoryAnswerSeed[];
  questions?: QuizHistoryQuestionSeed[];
  sharedQuiz?: QuizHistorySharedQuizSeed;
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
  const sharedQuizIdsResult = await client.query<{ id: number }>(
    'SELECT id FROM test.shared_quizzes WHERE creator_user_id = $1',
    [userId]
  );
  const sharedQuizIds = sharedQuizIdsResult.rows.map(row => row.id);

  if (sharedQuizIds.length > 0) {
    await client.query('DELETE FROM test.quiz_sessions WHERE shared_quiz_id = ANY($1::int[])', [
      sharedQuizIds,
    ]);
    await client.query(
      'DELETE FROM test.shared_quiz_questions WHERE shared_quiz_id = ANY($1::int[])',
      [sharedQuizIds]
    );
  }

  await client.query('DELETE FROM test.quiz_attempts WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM test.shared_quizzes WHERE creator_user_id = $1', [userId]);
}

function ensureArray<T>(value: T[] | undefined, fallback: T[]): T[] {
  return Array.isArray(value) && value.length > 0 ? value : fallback;
}

function toJson(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
}

function generateShareCode(): string {
  return `SHARE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function generateSessionToken(): string {
  return `session-${Math.random().toString(36).substring(2, 12)}`;
}

async function upsertSharedQuiz(
  client: PoolClient,
  userId: number,
  seed: QuizHistorySharedQuizSeed | undefined,
  defaultQuestions: QuizHistoryQuestionSeed[]
): Promise<{ sharedQuizId: number | null; shareCode?: string }> {
  if (!seed) {
    return { sharedQuizId: null };
  }

  const shareCode = seed.shareCode ?? generateShareCode();
  const title = seed.title ?? 'E2E Shared Quiz';
  const config = seed.config ?? { questionCount: defaultQuestions.length };
  const description = seed.description ?? null;
  const createdAt = new Date();
  const expiresAt = seed.session?.expiresAt ?? new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  const sharedQuizResult = await client.query<{ id: number }>(
    `INSERT INTO test.shared_quizzes (creator_user_id, title, description, share_code, config, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (share_code)
     DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, config = EXCLUDED.config, expires_at = EXCLUDED.expires_at
     RETURNING id`,
    [userId, title, description, shareCode, JSON.stringify(config), createdAt, expiresAt]
  );
  const sharedQuizId = sharedQuizResult.rows[0].id;

  const questions = ensureArray(seed.questions, defaultQuestions);

  await client.query('DELETE FROM test.shared_quiz_questions WHERE shared_quiz_id = $1', [
    sharedQuizId,
  ]);

  for (let index = 0; index < questions.length; index += 1) {
    await client.query(
      `INSERT INTO test.shared_quiz_questions (shared_quiz_id, question_index, question_data)
       VALUES ($1, $2, $3)`,
      [sharedQuizId, index, JSON.stringify(questions[index])]
    );
  }

  if (seed.session) {
    const sessionToken = seed.session.sessionToken ?? generateSessionToken();
    const sessionAnswers = ensureArray(seed.session.answers, []);
    const startedAt = seed.session.startedAt ?? createdAt;
    const finishedAt = seed.session.finishedAt ?? createdAt;
    const expires = seed.session.expiresAt ?? new Date(startedAt.getTime() + 60 * 60 * 1000);

    await client.query(
      `INSERT INTO test.quiz_sessions (shared_quiz_id, user_id, session_token, answers, started_at, expires_at, finished_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (session_token)
       DO UPDATE SET answers = EXCLUDED.answers, finished_at = EXCLUDED.finished_at, expires_at = EXCLUDED.expires_at`,
      [
        sharedQuizId,
        seed.session.userId ?? null,
        sessionToken,
        JSON.stringify(sessionAnswers),
        startedAt,
        expires,
        finishedAt,
      ]
    );
  }

  return { sharedQuizId, shareCode };
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

    const defaultQuestions: QuizHistoryQuestionSeed[] = ensureArray(attempt.questions, [
      {
        id: 'q-default',
        type: 'birthYear',
        question: 'В каком году родился Альберт Эйнштейн?',
        correctAnswer: '1879',
        explanation: 'Эйнштейн родился 14 марта 1879 года в Ульме.',
        data: {
          person: {
            id: 'test-person-einstein',
            name: 'Альберт Эйнштейн',
            birthYear: 1879,
            deathYear: 1955,
            category: 'scientists',
            country: 'Германия',
            description: 'Теоретический физик, создатель теории относительности.',
          },
        },
      },
    ]);

    const answers = ensureArray(attempt.answers, [
      {
        questionId: defaultQuestions[0].id,
        answer: defaultQuestions[0].correctAnswer,
        isCorrect: true,
        timeSpent: 10_000,
      },
    ]);

    const { sharedQuizId } = await upsertSharedQuiz(client, userId, attempt.sharedQuiz, defaultQuestions);

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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        sharedQuizId,
        attempt.correctAnswers,
        attempt.totalQuestions,
        attempt.totalTimeMs,
        ratingPoints,
        attempt.config ? JSON.stringify(attempt.config) : null,
        attempt.createdAt ?? new Date(),
        toJson(answers),
        toJson(defaultQuestions),
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

