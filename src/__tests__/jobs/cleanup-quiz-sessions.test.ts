import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pool } from 'pg';
import {
  cleanupExpiredQuizSessions,
  cleanupOldFinishedQuizSessions,
  runQuizSessionsCleanup,
} from '../../jobs/cleanup-quiz-sessions';
import { logger } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('cleanup-quiz-sessions', () => {
  let mockPool: any;
  let mockQuery: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockQuery = (jest.fn() as any).mockResolvedValue({
      rowCount: 0,
      rows: [],
    });

    mockPool = {
      query: mockQuery,
    } as any;
  });

  describe('cleanupExpiredQuizSessions', () => {
    it('should delete expired unfinished sessions', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 5,
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
      });

      const result = await cleanupExpiredQuizSessions(mockPool);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM quiz_sessions'));
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE expires_at < NOW()'));
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('AND finished_at IS NULL'));
      expect(result.deletedCount).toBe(5);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Удалено просроченных quiz sessions: 5'),
        expect.objectContaining({
          deletedCount: 5,
          action: 'cleanup_expired_sessions',
        })
      );
    });

    it('should return zero when no expired sessions found', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 0,
        rows: [],
      });

      const result = await cleanupExpiredQuizSessions(mockPool);

      expect(result.deletedCount).toBe(0);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should handle null rowCount', async () => {
      mockQuery.mockResolvedValue({
        rowCount: null,
        rows: [],
      });

      const result = await cleanupExpiredQuizSessions(mockPool);

      expect(result.deletedCount).toBe(0);
    });

    it('should log error and throw when query fails', async () => {
      const error = new Error('Database connection failed');
      mockQuery.mockRejectedValue(error);

      await expect(cleanupExpiredQuizSessions(mockPool)).rejects.toThrow(
        'Database connection failed'
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Cleanup: Ошибка при очистке quiz sessions',
        expect.objectContaining({
          error,
          action: 'cleanup_expired_sessions',
        })
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockQuery.mockRejectedValue('String error');

      await expect(cleanupExpiredQuizSessions(mockPool)).rejects.toBe('String error');

      expect(logger.error).toHaveBeenCalledWith(
        'Cleanup: Ошибка при очистке quiz sessions',
        expect.objectContaining({
          error: expect.any(Error),
          action: 'cleanup_expired_sessions',
        })
      );
    });

    it('should only delete unfinished sessions', async () => {
      await cleanupExpiredQuizSessions(mockPool);

      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain('finished_at IS NULL');
    });

    it('should use RETURNING clause to count deletions', async () => {
      await cleanupExpiredQuizSessions(mockPool);

      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain('RETURNING id');
    });
  });

  describe('cleanupOldFinishedQuizSessions', () => {
    it('should delete old finished sessions with default days', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 10,
        rows: Array(10).fill({ id: 1 }),
      });

      const result = await cleanupOldFinishedQuizSessions(mockPool);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM quiz_sessions'));
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INTERVAL '90 days'"));
      expect(result.deletedCount).toBe(10);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Удалено старых завершённых quiz sessions: 10'),
        expect.objectContaining({
          deletedCount: 10,
          daysOld: 90,
          action: 'cleanup_old_finished_sessions',
        })
      );
    });

    it('should delete old finished sessions with custom days', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 3,
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
      });

      const result = await cleanupOldFinishedQuizSessions(mockPool, 30);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INTERVAL '30 days'"));
      expect(result.deletedCount).toBe(3);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Удалено старых завершённых quiz sessions: 3'),
        expect.objectContaining({
          deletedCount: 3,
          daysOld: 30,
          action: 'cleanup_old_finished_sessions',
        })
      );
    });

    it('should return zero when no old finished sessions found', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 0,
        rows: [],
      });

      const result = await cleanupOldFinishedQuizSessions(mockPool, 60);

      expect(result.deletedCount).toBe(0);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should handle null rowCount', async () => {
      mockQuery.mockResolvedValue({
        rowCount: null,
        rows: [],
      });

      const result = await cleanupOldFinishedQuizSessions(mockPool);

      expect(result.deletedCount).toBe(0);
    });

    it('should log error and throw when query fails', async () => {
      const error = new Error('Query timeout');
      mockQuery.mockRejectedValue(error);

      await expect(cleanupOldFinishedQuizSessions(mockPool, 90)).rejects.toThrow('Query timeout');

      expect(logger.error).toHaveBeenCalledWith(
        'Cleanup: Ошибка при очистке старых quiz sessions',
        expect.objectContaining({
          error,
          daysOld: 90,
          action: 'cleanup_old_finished_sessions',
        })
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockQuery.mockRejectedValue({ code: 'DB_ERROR' });

      await expect(cleanupOldFinishedQuizSessions(mockPool)).rejects.toEqual({
        code: 'DB_ERROR',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Cleanup: Ошибка при очистке старых quiz sessions',
        expect.objectContaining({
          error: expect.any(Error),
          daysOld: 90,
          action: 'cleanup_old_finished_sessions',
        })
      );
    });

    it('should target finished sessions', async () => {
      await cleanupOldFinishedQuizSessions(mockPool);

      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain('finished_at <');
    });

    it('should use correct time interval calculation', async () => {
      await cleanupOldFinishedQuizSessions(mockPool, 180);

      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain("INTERVAL '180 days'");
    });
  });

  describe('runQuizSessionsCleanup', () => {
    it('should run only expired cleanup when cleanOldFinished is false', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 5,
        rows: Array(5).fill({ id: 1 }),
      });

      const result = await runQuizSessionsCleanup(mockPool, false);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(result.expired).toEqual({
        deletedCount: 5,
        timestamp: expect.any(Date),
      });
      expect(result.oldFinished).toBeUndefined();
    });

    it('should run both cleanups when cleanOldFinished is true', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rowCount: 5,
          rows: Array(5).fill({ id: 1 }),
        })
        .mockResolvedValueOnce({
          rowCount: 10,
          rows: Array(10).fill({ id: 1 }),
        });

      const result = await runQuizSessionsCleanup(mockPool, true);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(result.expired).toEqual({
        deletedCount: 5,
        timestamp: expect.any(Date),
      });
      expect(result.oldFinished).toEqual({
        deletedCount: 10,
        timestamp: expect.any(Date),
      });
    });

    it('should use custom daysOld for old finished cleanup', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 0,
        rows: [],
      });

      await runQuizSessionsCleanup(mockPool, true, 45);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INTERVAL '45 days'"));
    });

    it('should handle errors in expired cleanup', async () => {
      mockQuery.mockRejectedValue(new Error('Connection error'));

      await expect(runQuizSessionsCleanup(mockPool)).rejects.toThrow('Connection error');
    });

    it('should handle errors in old finished cleanup', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rowCount: 5,
          rows: Array(5).fill({ id: 1 }),
        })
        .mockRejectedValueOnce(new Error('Table lock error'));

      await expect(runQuizSessionsCleanup(mockPool, true)).rejects.toThrow('Table lock error');
    });

    it('should use default parameters correctly', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 0,
        rows: [],
      });

      const result = await runQuizSessionsCleanup(mockPool);

      expect(result.expired).toBeDefined();
      expect(result.oldFinished).toBeUndefined();
    });

    it('should execute expired cleanup first, then old finished', async () => {
      const callOrder: string[] = [];

      mockQuery.mockImplementation((query: string) => {
        if (query.includes('expires_at')) {
          callOrder.push('expired');
        } else if (query.includes('finished_at')) {
          callOrder.push('oldFinished');
        }
        return Promise.resolve({ rowCount: 0, rows: [] });
      });

      await runQuizSessionsCleanup(mockPool, true, 90);

      expect(callOrder).toEqual(['expired', 'oldFinished']);
    });

    it('should return proper result structure for full cleanup', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rowCount: 3,
          rows: Array(3).fill({ id: 1 }),
        })
        .mockResolvedValueOnce({
          rowCount: 7,
          rows: Array(7).fill({ id: 1 }),
        });

      const result = await runQuizSessionsCleanup(mockPool, true, 120);

      expect(result).toHaveProperty('expired');
      expect(result).toHaveProperty('oldFinished');
      expect(result.expired.deletedCount).toBe(3);
      expect(result.oldFinished!.deletedCount).toBe(7);
      expect(result.expired.timestamp).toBeInstanceOf(Date);
      expect(result.oldFinished!.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Edge cases and integration scenarios', () => {
    it('should handle very large deletion counts', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 100000,
        rows: Array(100000).fill({ id: 1 }),
      });

      const result = await cleanupExpiredQuizSessions(mockPool);

      expect(result.deletedCount).toBe(100000);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should handle zero days for old finished cleanup', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 0,
        rows: [],
      });

      const result = await cleanupOldFinishedQuizSessions(mockPool, 0);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INTERVAL '0 days'"));
      expect(result.deletedCount).toBe(0);
    });

    it('should maintain timestamp accuracy across multiple runs', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 1,
        rows: [{ id: 1 }],
      });

      const beforeTime = new Date();
      const result1 = await cleanupExpiredQuizSessions(mockPool);
      const result2 = await cleanupExpiredQuizSessions(mockPool);
      const afterTime = new Date();

      expect(result1.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(result1.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      expect(result2.timestamp.getTime()).toBeGreaterThanOrEqual(result1.timestamp.getTime());
    });

    it('should handle Pool disconnection gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('Connection pool exhausted'));

      await expect(runQuizSessionsCleanup(mockPool, true)).rejects.toThrow(
        'Connection pool exhausted'
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Ошибка при очистке'),
        expect.any(Object)
      );
    });

    it('should properly format SQL for parameterized days', async () => {
      const testDays = [1, 7, 30, 90, 365, 1000];

      for (const days of testDays) {
        mockQuery.mockClear();
        mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });

        await cleanupOldFinishedQuizSessions(mockPool, days);

        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining(`INTERVAL '${days} days'`));
      }
    });
  });
});
