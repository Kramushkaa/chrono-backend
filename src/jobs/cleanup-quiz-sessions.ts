/**
 * Job для очистки истекших quiz sessions
 * 
 * Использование:
 * 1. Вызывать из server.ts при старте: await cleanupExpiredQuizSessions(pool)
 * 2. Настроить в cron (например, каждые 6 часов): cron pattern 0 star-slash-6 star star star
 * 3. Использовать с node-cron или другим scheduler
 */

import { Pool } from 'pg';

export interface CleanupResult {
  deletedCount: number;
  timestamp: Date;
}

/**
 * Удаляет истекшие незавершённые quiz sessions
 * @param pool - PostgreSQL connection pool
 * @returns Количество удалённых сессий
 */
export async function cleanupExpiredQuizSessions(pool: Pool): Promise<CleanupResult> {
  try {
    const result = await pool.query(`
      DELETE FROM quiz_sessions 
      WHERE expires_at < NOW() 
        AND finished_at IS NULL
      RETURNING id
    `);

    const deletedCount = result.rowCount || 0;
    
    if (deletedCount > 0) {
      console.log(`🧹 [Cleanup] Удалено просроченных quiz sessions: ${deletedCount}`);
    }

    return {
      deletedCount,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('❌ [Cleanup] Ошибка при очистке quiz sessions:', error);
    throw error;
  }
}

/**
 * Удаляет старые завершённые quiz sessions (старше заданного количества дней)
 * Это опциональная очистка для экономии места в БД
 * @param pool - PostgreSQL connection pool
 * @param daysOld - Количество дней (по умолчанию 90)
 * @returns Количество удалённых сессий
 */
export async function cleanupOldFinishedQuizSessions(
  pool: Pool,
  daysOld: number = 90
): Promise<CleanupResult> {
  try {
    const result = await pool.query(`
      DELETE FROM quiz_sessions 
      WHERE finished_at < NOW() - INTERVAL '${daysOld} days'
      RETURNING id
    `);

    const deletedCount = result.rowCount || 0;
    
    if (deletedCount > 0) {
      console.log(`🧹 [Cleanup] Удалено старых завершённых quiz sessions: ${deletedCount}`);
    }

    return {
      deletedCount,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('❌ [Cleanup] Ошибка при очистке старых quiz sessions:', error);
    throw error;
  }
}

/**
 * Запускает полную очистку quiz sessions
 * @param pool - PostgreSQL connection pool
 * @param cleanOldFinished - Также удалить старые завершённые сессии (по умолчанию false)
 * @param daysOld - Количество дней для старых сессий (по умолчанию 90)
 */
export async function runQuizSessionsCleanup(
  pool: Pool,
  cleanOldFinished: boolean = false,
  daysOld: number = 90
): Promise<{ expired: CleanupResult; oldFinished?: CleanupResult }> {
  const expired = await cleanupExpiredQuizSessions(pool);
  
  let oldFinished: CleanupResult | undefined;
  if (cleanOldFinished) {
    oldFinished = await cleanupOldFinishedQuizSessions(pool, daysOld);
  }

  return { expired, oldFinished };
}

