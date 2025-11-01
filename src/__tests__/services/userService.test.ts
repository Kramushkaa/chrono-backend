import { Pool, PoolClient } from 'pg';
import { UserService } from '../../services/userService';
import { UserRow } from '../../types/database';

describe('UserService', () => {
  let userService: UserService;
  let mockPool: any;
  let mockClient: any;

  const createMockUserRow = (overrides?: Partial<UserRow>): UserRow => ({
    id: 1,
    email: 'test@example.com',
    password_hash: 'hash',
    username: 'testuser',
    full_name: 'Test User',
    avatar_url: null,
    role: 'user',
    is_active: true,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
    email_verification_token: null,
    email_verification_expires: null,
    password_reset_token: null,
    password_reset_expires: null,
    ...overrides,
  });

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue(mockClient),
    };

    userService = new UserService(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should get all users with default pagination', async () => {
      const mockUserRow = createMockUserRow();

      mockPool.query.mockResolvedValue({
        rows: [mockUserRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await userService.getAllUsers({});

      expect(result.users).toHaveLength(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should apply custom limit and offset', async () => {
      mockPool.query.mockResolvedValue({
        rows: [createMockUserRow()],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await userService.getAllUsers({ limit: 10, offset: 5 });

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(5);
    });

    it('should cap limit at 100', async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const result = await userService.getAllUsers({ limit: 500 });

      expect(result.limit).toBe(100);
    });

    it('should filter by role', async () => {
      mockPool.query.mockResolvedValue({
        rows: [createMockUserRow({ role: 'moderator' })],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await userService.getAllUsers({ role: 'moderator' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('role = $'),
        expect.arrayContaining(['moderator'])
      );
    });

    it('should filter by is_active', async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      await userService.getAllUsers({ is_active: true });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_active = $'),
        expect.arrayContaining([true])
      );
    });

    it('should filter by email_verified', async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      await userService.getAllUsers({ email_verified: false });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('email_verified = $'),
        expect.arrayContaining([false])
      );
    });

    it('should filter by search query', async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      await userService.getAllUsers({ search: 'test' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%test%'])
      );
    });

    it('should detect hasMore when results exceed limit', async () => {
      const mockUserRow = createMockUserRow();
      
      mockPool.query.mockResolvedValue({
        rows: [mockUserRow, mockUserRow, mockUserRow], // 3 results for limit=2
        command: 'SELECT',
        rowCount: 3,
        oid: 0,
        fields: [],
      });

      const result = await userService.getAllUsers({ limit: 2 });

      expect(result.users).toHaveLength(2); // Sliced to limit
      expect(result.hasMore).toBe(true);
    });

    it('should set hasMore to false when no more results', async () => {
      mockPool.query.mockResolvedValue({
        rows: [createMockUserRow()],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await userService.getAllUsers({ limit: 2 });

      expect(result.hasMore).toBe(false);
    });
  });

  describe('getUserById', () => {
    it('should get user by id', async () => {
      const mockUserRow = createMockUserRow();

      mockPool.query.mockResolvedValue({
        rows: [mockUserRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await userService.getUserById(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null when user not found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const result = await userService.getUserById(999);

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user role successfully', async () => {
      const mockUserRow = createMockUserRow({ role: 'moderator' });

      mockPool.query.mockResolvedValue({
        rows: [mockUserRow],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await userService.updateUser(1, {
        role: 'moderator',
      });

      expect(result).toBeDefined();
      expect(result.role).toBe('moderator');
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should handle is_active update', async () => {
      const mockUserRow = createMockUserRow({ is_active: false });

      mockPool.query.mockResolvedValue({
        rows: [mockUserRow],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await userService.updateUser(1, {
        is_active: false,
      });

      expect(result.is_active).toBe(false);
    });

    it('should handle email_verified update', async () => {
      const mockUserRow = createMockUserRow({ email_verified: true });

      mockPool.query.mockResolvedValue({
        rows: [mockUserRow],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await userService.updateUser(1, {
        email_verified: true,
      });

      expect(result.email_verified).toBe(true);
    });
  });

  describe('getUserStats', () => {
    it('should get user stats', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            total_quiz_rating: 1500,
            total_quiz_games: 50,
            average_quiz_score: 75.5,
            best_quiz_score: 95,
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await userService.getUserStats();

      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('mapUserFromDb', () => {
    it('should map user row to User object', async () => {
      const mockUserRow = createMockUserRow({
        username: 'testuser',
        full_name: 'Test User',
      });

      mockPool.query.mockResolvedValue({
        rows: [mockUserRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await userService.getUserById(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.email).toBe('test@example.com');
      expect(result?.username).toBe('testuser');
      expect(result?.full_name).toBe('Test User');
      expect(result?.role).toBe('user');
      expect(result?.is_active).toBe(true);
      expect(result?.email_verified).toBe(true);
    });

    it('should handle user without optional fields', async () => {
      const mockUserRow = createMockUserRow({
        username: null,
        full_name: null,
        email_verified: false,
      });

      mockPool.query.mockResolvedValue({
        rows: [mockUserRow],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await userService.getUserById(1);

      expect(result).toBeDefined();
      expect(result?.username).toBeFalsy();
      expect(result?.full_name).toBeFalsy();
    });
  });

  describe('error handling', () => {
    it('should handle database errors in getAllUsers', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      await expect(userService.getAllUsers({})).rejects.toThrow();
    });

    it('should handle database errors in getUserById', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection error'));

      await expect(userService.getUserById(1)).rejects.toThrow();
    });

    it('should handle database errors in updateUser', async () => {
      mockPool.query.mockRejectedValue(new Error('Update failed'));

      await expect(
        userService.updateUser(1, { role: 'moderator' })
      ).rejects.toThrow();
    });
  });
});
