import { BaseService } from '../../services/BaseService';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { createMockPool, createQueryResult } from '../mocks';
import { jest } from '@jest/globals';
import { ApiError, errors } from '../../utils/errors';

// Test service class that extends BaseService to expose protected methods
class TestService extends BaseService {
  constructor(pool: Pool) {
    super(pool);
  }

  async testExecuteQuery<T extends QueryResultRow = any>(
    query: string,
    params: unknown[] = [],
    context?: any
  ) {
    return this.executeQuery<T>(query, params, context);
  }

  async testExecuteTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
    return this.executeTransaction(callback);
  }

  async testCheckRecordExists(
    table: string,
    condition: string,
    params: unknown[],
    errorMessage?: string
  ) {
    return this.checkRecordExists(table, condition, params, errorMessage);
  }

  testHandleError(error: Error, context?: any) {
    this.handleError(error, context);
  }
}

describe('BaseService', () => {
  let service: TestService;
  let mockPool: any;

  beforeEach(() => {
    mockPool = createMockPool();
    service = new TestService(mockPool);
    jest.clearAllMocks();
  });

  describe('executeQuery', () => {
    it('should execute query successfully', async () => {
      const mockResult = createQueryResult([{ id: 1, name: 'test' }]);
      mockPool.query.mockResolvedValue(mockResult);

      const result = await service.testExecuteQuery('SELECT * FROM test', []);

      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM test', []);
    });

    it('should execute query with parameters', async () => {
      const mockResult = createQueryResult([{ id: 1 }]);
      mockPool.query.mockResolvedValue(mockResult);

      const result = await service.testExecuteQuery('SELECT * FROM test WHERE id = $1', [123]);

      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [123]);
    });

    it('should handle database errors - duplicate key', async () => {
      const duplicateError = new Error('duplicate key value violates unique constraint');
      mockPool.query.mockRejectedValue(duplicateError);

      await expect(service.testExecuteQuery('INSERT INTO test VALUES (1)', [])).rejects.toThrow(
        /уже существует/
      );
    });

    it('should handle database errors - foreign key constraint', async () => {
      const fkError = new Error('foreign key constraint fails');
      mockPool.query.mockRejectedValue(fkError);

      await expect(service.testExecuteQuery('INSERT INTO test VALUES (1)', [])).rejects.toThrow(
        /Связанная запись не найдена/
      );
    });

    it('should handle database errors - not found', async () => {
      const notFoundError = new Error('no rows found');
      mockPool.query.mockRejectedValue(notFoundError);

      await expect(
        service.testExecuteQuery('SELECT * FROM test WHERE id = 999', [])
      ).rejects.toThrow(/Запись не найдена/);
    });

    it('should handle generic database errors', async () => {
      const genericError = new Error('Connection failed');
      mockPool.query.mockRejectedValue(genericError);

      await expect(service.testExecuteQuery('SELECT * FROM test', [])).rejects.toThrow(
        /ошибка при работе с базой данных/
      );
    });

    it('should include context in error logging', async () => {
      const error = new Error('Test error');
      mockPool.query.mockRejectedValue(error);

      await expect(
        service.testExecuteQuery('SELECT * FROM test', [], { userId: 123, action: 'test' })
      ).rejects.toThrow();
    });
  });

  describe('executeTransaction', () => {
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      // Mock successful query responses
      mockClient.query.mockResolvedValue(createQueryResult([]));
    });

    it('should commit transaction on success', async () => {
      mockPool.connect.mockResolvedValue(mockClient);

      const mockCallback = (client: PoolClient) => Promise.resolve('success result');
      const result = await service.testExecuteTransaction(mockCallback);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe('success result');
    });

    it('should rollback transaction on error', async () => {
      mockPool.connect.mockResolvedValue(mockClient);

      const mockCallback = (client: PoolClient) => Promise.reject(new Error('Transaction failed'));

      await expect(service.testExecuteTransaction(mockCallback)).rejects.toThrow(
        'Transaction failed'
      );

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('checkRecordExists', () => {
    it('should return true when record exists', async () => {
      mockPool.query.mockResolvedValue(createQueryResult([{ id: 1 }], 1));

      const exists = await service.testCheckRecordExists('users', 'id = $1', [123]);

      expect(exists).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1 FROM users WHERE id = $1 LIMIT 1', [
        123,
      ]);
    });

    it('should return false when record does not exist', async () => {
      mockPool.query.mockResolvedValue(createQueryResult([], 0));

      const exists = await service.testCheckRecordExists('users', 'id = $1', [999]);

      expect(exists).toBe(false);
    });

    it('should throw custom error message when provided', async () => {
      const notFoundError = new Error('not found');
      mockPool.query.mockRejectedValue(notFoundError);

      await expect(
        service.testCheckRecordExists('users', 'id = $1', [999], 'User not found')
      ).rejects.toThrow(/User not found/);
    });

    it('should return false on not found error without custom message', async () => {
      const notFoundError = new Error('not found');
      mockPool.query.mockRejectedValue(notFoundError);

      const exists = await service.testCheckRecordExists('users', 'id = $1', [999]);

      expect(exists).toBe(false);
    });

    it('should rethrow non-not-found errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPool.query.mockRejectedValue(dbError);

      await expect(service.testCheckRecordExists('users', 'id = $1', [999])).rejects.toThrow(
        /ошибка при работе с базой данных/
      );
    });
  });

  describe('handleError', () => {
    it('should throw the error after logging', () => {
      const testError = new Error('Test error message');

      expect(() => {
        service.testHandleError(testError, { userId: 123, action: 'testAction' });
      }).toThrow('Test error message');
    });

    it('should handle error without context', () => {
      const testError = new Error('Error without context');

      expect(() => {
        service.testHandleError(testError);
      }).toThrow('Error without context');
    });
  });

  describe('constructor', () => {
    it('should initialize with pool', () => {
      const newService = new TestService(mockPool);
      expect(newService).toBeInstanceOf(BaseService);
    });
  });
});
