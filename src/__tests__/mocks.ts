import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/**
 * Mock Pool для тестирования
 */
export const createMockPool = (): jest.Mocked<Pool> => {
  const mockClient: Partial<jest.Mocked<PoolClient>> = {
    query: jest.fn(),
    release: jest.fn(),
  };

  const mockPool: Partial<jest.Mocked<Pool>> = {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn(),
  };

  return mockPool as jest.Mocked<Pool>;
};

/**
 * Создает успешный QueryResult
 */
export const createQueryResult = <T extends QueryResultRow = any>(
  rows: T[],
  rowCount?: number
): QueryResult<T> => ({
  rows,
  rowCount: rowCount ?? rows.length,
  command: 'SELECT',
  oid: 0,
  fields: [],
});

/**
 * Mock TelegramService
 */
export const createMockTelegramService = () => ({
  notifyPersonCreated: jest.fn().mockResolvedValue(undefined),
  notifyAchievementCreated: jest.fn().mockResolvedValue(undefined),
  notifyPeriodCreated: jest.fn().mockResolvedValue(undefined),
  notifyPersonEditProposed: jest.fn().mockResolvedValue(undefined),
  sendAdminNotification: jest.fn().mockResolvedValue(undefined),
});

/**
 * Mock User для тестов
 */
export const createMockUser = (overrides?: Partial<any>) => ({
  sub: 1,
  email: 'test@example.com',
  role: 'user',
  ...overrides,
});

