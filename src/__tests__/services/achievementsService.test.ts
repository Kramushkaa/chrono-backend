/* eslint-disable @typescript-eslint/no-explicit-any */
import { AchievementsService } from '../../services/achievementsService';
import {
  createMockPool,
  createMockTelegramService,
  createMockUser,
  createQueryResult,
} from '../mocks';
import { errors as _errors } from '../../utils/errors';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Pool } from 'pg';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TelegramService } from '../../services/telegramService';

describe('AchievementsService', () => {
  let achievementsService: AchievementsService;
  let mockPool: any;
  let mockTelegramService: any;

  beforeEach(() => {
    mockPool = createMockPool();
    mockTelegramService = createMockTelegramService();
    achievementsService = new AchievementsService(mockPool, mockTelegramService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // 1.1. Validation Methods
  // ============================================================================

  describe('validateAchievementYears', () => {
    it('should validate achievement year successfully', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            birth_year: 1900,
            death_year: 2000,
            name: 'Test Person',
          },
        ])
      );

      await expect(
        achievementsService.validateAchievementYears(1950, 'person-1')
      ).resolves.not.toThrow();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT birth_year, death_year, name FROM persons'),
        ['person-1']
      );
    });

    it('should throw error when person not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(
        achievementsService.validateAchievementYears(1950, 'nonexistent-person')
      ).rejects.toThrow('Личность не найдена');
    });

    it('should throw error when year is before birth year', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            birth_year: 1900,
            death_year: 2000,
            name: 'Test Person',
          },
        ])
      );

      await expect(achievementsService.validateAchievementYears(1850, 'person-1')).rejects.toThrow(
        /должен входить в годы жизни/
      );
    });

    it('should throw error when year is after death year', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            birth_year: 1900,
            death_year: 2000,
            name: 'Test Person',
          },
        ])
      );

      await expect(achievementsService.validateAchievementYears(2050, 'person-1')).rejects.toThrow(
        /должен входить в годы жизни/
      );
    });
  });

  // ============================================================================
  // 1.2. CRUD Operations - Create
  // ============================================================================

  describe('createAchievement', () => {
    const achievementData = {
      personId: 'person-1',
      countryId: 1,
      year: 1950,
      description: 'Test achievement',
      wikipediaUrl: 'https://wikipedia.org',
      imageUrl: 'https://example.com/image.jpg',
    };

    it('should create achievement with approved status for admin', async () => {
      const user = createMockUser({ role: 'admin' });

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              birth_year: 1900,
              death_year: 2000,
              name: 'Test Person',
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([{ name: 'Test Person' }]))
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              ...achievementData,
              status: 'approved',
            },
          ])
        );

      const result = await achievementsService.createAchievement(achievementData, user, false);

      expect(result.status).toBe('approved');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });

    it('should create achievement with pending status for regular user', async () => {
      const user = createMockUser({ role: 'user' });

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              birth_year: 1900,
              death_year: 2000,
              name: 'Test Person',
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([{ name: 'Test Person' }]))
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              ...achievementData,
              status: 'pending',
            },
          ])
        );

      const result = await achievementsService.createAchievement(achievementData, user, false);

      expect(result.status).toBe('pending');
      expect(mockTelegramService.notifyAchievementCreated).toHaveBeenCalled();
    });

    it('should create achievement as draft when saveAsDraft is true', async () => {
      const user = createMockUser();

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              birth_year: 1900,
              death_year: 2000,
              name: 'Test Person',
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([{ name: 'Test Person' }]))
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              ...achievementData,
              status: 'draft',
            },
          ])
        );

      const result = await achievementsService.createAchievement(achievementData, user, true);

      expect(result.status).toBe('draft');
      expect(mockTelegramService.notifyAchievementCreated).not.toHaveBeenCalled();
    });

    it('should validate achievement year when personId is provided', async () => {
      const user = createMockUser();

      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(
        achievementsService.createAchievement(achievementData, user, false)
      ).rejects.toThrow('Личность не найдена');
    });

    it('should create achievement without personId', async () => {
      const user = createMockUser({ role: 'admin' });
      const dataWithoutPerson = {
        countryId: 1,
        year: 1950,
        description: 'Global achievement',
      };

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            ...dataWithoutPerson,
            status: 'approved',
          },
        ])
      );

      const result = await achievementsService.createAchievement(dataWithoutPerson, user, false);

      expect(result.status).toBe('approved');
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // 1.2. CRUD Operations - Update
  // ============================================================================

  describe('updateAchievement', () => {
    it('should update achievement successfully', async () => {
      const user = createMockUser();

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              created_by: user.sub,
              status: 'draft',
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              description: 'Updated description',
              year: 1951,
            },
          ])
        );

      const result = await achievementsService.updateAchievement(1, user.sub, {
        description: 'Updated description',
        year: 1951,
      });

      expect(result.description).toBe('Updated description');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE achievements SET'),
        expect.any(Array)
      );
    });

    it('should throw error when achievement not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(
        achievementsService.updateAchievement(999, 1, { description: 'New' })
      ).rejects.toThrow('Достижение не найдено');
    });

    it('should throw error when user does not own achievement', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: 999,
            status: 'draft',
          },
        ])
      );

      await expect(
        achievementsService.updateAchievement(1, 1, { description: 'New' })
      ).rejects.toThrow('Вы можете редактировать только свои достижения');
    });

    it('should throw error when achievement is not a draft', async () => {
      const user = createMockUser();

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: user.sub,
            status: 'approved',
          },
        ])
      );

      await expect(
        achievementsService.updateAchievement(1, user.sub, { description: 'New' })
      ).rejects.toThrow('Можно редактировать только черновики');
    });

    it('should throw error when no fields to update', async () => {
      const user = createMockUser();

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: user.sub,
            status: 'draft',
          },
        ])
      );

      await expect(achievementsService.updateAchievement(1, user.sub, {})).rejects.toThrow(
        'Нет полей для обновления'
      );
    });
  });

  // ============================================================================
  // 1.2. CRUD Operations - Delete
  // ============================================================================

  describe('deleteAchievement', () => {
    it('should delete achievement successfully', async () => {
      const user = createMockUser();

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              created_by: user.sub,
              status: 'draft',
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([]));

      await expect(achievementsService.deleteAchievement(1, user.sub)).resolves.not.toThrow();

      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM achievements WHERE id = $1', [1]);
    });

    it('should throw error when achievement not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(achievementsService.deleteAchievement(999, 1)).rejects.toThrow(
        'Достижение не найдено'
      );
    });

    it('should throw error when user does not own achievement', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: 999,
            status: 'draft',
          },
        ])
      );

      await expect(achievementsService.deleteAchievement(1, 1)).rejects.toThrow(
        'Вы можете удалять только свои достижения'
      );
    });

    it('should throw error when achievement is not a draft', async () => {
      const user = createMockUser();

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: user.sub,
            status: 'approved',
          },
        ])
      );

      await expect(achievementsService.deleteAchievement(1, user.sub)).rejects.toThrow(
        'Можно удалять только черновики'
      );
    });
  });

  // ============================================================================
  // 1.3. Retrieval Methods
  // ============================================================================

  describe('getAchievements', () => {
    it('should get achievements with filters', async () => {
      const mockAchievements = [
        {
          id: 1,
          person_id: 'person-1',
          year: 1950,
          description: 'Achievement 1',
        },
        {
          id: 2,
          person_id: 'person-2',
          year: 1960,
          description: 'Achievement 2',
        },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockAchievements));

      const result = await achievementsService.getAchievements(
        {
          personId: 'person-1',
          yearFrom: 1900,
          yearTo: 2000,
        },
        10,
        0
      );

      expect(result.data).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('v_approved_achievements'),
        expect.any(Array)
      );
    });

    it('should search achievements by query', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await achievementsService.getAchievements({ q: 'Nobel' }, 10, 0);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%Nobel%'])
      );
    });

    it('should filter by country', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await achievementsService.getAchievements({ countryId: 5 }, 10, 0);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([5]));
    });

    it('should handle pagination correctly', async () => {
      const mockAchievements = Array.from({ length: 11 }, (_, i) => ({
        id: i + 1,
        description: `Achievement ${i + 1}`,
      }));

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockAchievements));

      const result = await achievementsService.getAchievements({}, 10, 0);

      expect(result.data).toHaveLength(10);
      expect(result.meta.hasMore).toBe(true);
    });
  });

  describe('getUserAchievements', () => {
    it('should get user achievements', async () => {
      const mockAchievements = [
        { id: 1, status: 'approved' },
        { id: 2, status: 'pending' },
        { id: 3, status: 'draft' },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockAchievements));

      const result = await achievementsService.getUserAchievements(1, 10, 0);

      expect(result.data).toHaveLength(3);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE a.created_by = $1'),
        [1, 11, 0]
      );
    });

    it('should handle pagination for user achievements', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await achievementsService.getUserAchievements(1, 5, 10);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [1, 6, 10]);
    });
  });

  describe('getPendingAchievements', () => {
    it('should get pending achievements for moderation', async () => {
      const mockPending = [
        {
          id: 1,
          status: 'pending',
          creator_email: 'user@example.com',
        },
        {
          id: 2,
          status: 'pending',
          creator_email: 'user2@example.com',
        },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockPending));

      const result = await achievementsService.getPendingAchievements(10, 0);

      expect(result.data).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE a.status = 'pending'"),
        [11, 0]
      );
    });

    it('should handle pagination for pending achievements', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await achievementsService.getPendingAchievements(20, 40);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [21, 40]);
    });
  });

  describe('getAchievementsByPerson', () => {
    it('should get achievements by person ID', async () => {
      const mockAchievements = [
        { id: 1, person_id: 'person-1', year: 1950 },
        { id: 2, person_id: 'person-1', year: 1960 },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockAchievements));

      const result = await achievementsService.getAchievementsByPerson('person-1');

      expect(result).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE person_id = $1'), [
        'person-1',
      ]);
    });
  });

  describe('getUserDrafts', () => {
    it('should get user drafts', async () => {
      const mockDrafts = [
        { id: 1, status: 'draft' },
        { id: 2, status: 'draft' },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockDrafts));

      const result = await achievementsService.getUserDrafts(1, 10, 0);

      expect(result.data).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("AND a.status = 'draft'"),
        [1, 11, 0]
      );
    });

    it('should handle pagination for drafts', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await achievementsService.getUserDrafts(1, 15, 30);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [1, 16, 30]);
    });
  });

  // ============================================================================
  // 1.4. Moderation
  // ============================================================================

  describe('reviewAchievement', () => {
    it('should approve achievement', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              status: 'pending',
              created_by: 1,
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              status: 'approved',
            },
          ])
        );

      const result = await achievementsService.reviewAchievement(1, 'approve', 2, 'Looks good');

      expect(result.status).toBe('approved');
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE achievements'), [
        'approved',
        2,
        'Looks good',
        1,
      ]);
    });

    it('should reject achievement', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              status: 'pending',
              created_by: 1,
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              status: 'rejected',
            },
          ])
        );

      const result = await achievementsService.reviewAchievement(
        1,
        'reject',
        2,
        'Needs improvement'
      );

      expect(result.status).toBe('rejected');
    });

    it('should throw error when achievement not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(achievementsService.reviewAchievement(999, 'approve', 2)).rejects.toThrow(
        'Достижение не найдено'
      );
    });

    it('should throw error when achievement is not pending', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            status: 'approved',
            created_by: 1,
          },
        ])
      );

      await expect(achievementsService.reviewAchievement(1, 'approve', 2)).rejects.toThrow(
        'Можно модерировать только достижения в статусе pending'
      );
    });
  });

  describe('submitDraft', () => {
    it('should submit draft for moderation', async () => {
      const user = createMockUser();

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              created_by: user.sub,
              status: 'draft',
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              status: 'pending',
            },
          ])
        );

      const result = await achievementsService.submitDraft(1, user.sub);

      expect(result.status).toBe('pending');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'pending'"),
        [1]
      );
    });

    it('should throw error when draft not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(achievementsService.submitDraft(999, 1)).rejects.toThrow(
        'Достижение не найдено'
      );
    });

    it('should throw error when user does not own draft', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: 999,
            status: 'draft',
          },
        ])
      );

      await expect(achievementsService.submitDraft(1, 1)).rejects.toThrow(
        'Вы можете отправлять только свои черновики'
      );
    });

    it('should throw error when achievement is not a draft', async () => {
      const user = createMockUser();

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: user.sub,
            status: 'pending',
          },
        ])
      );

      await expect(achievementsService.submitDraft(1, user.sub)).rejects.toThrow(
        'Можно отправлять только черновики'
      );
    });
  });

  // ============================================================================
  // 1.5. Counters
  // ============================================================================

  describe('getUserAchievementsCount', () => {
    it('should return user achievements count', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([{ cnt: 42 }]));

      const count = await achievementsService.getUserAchievementsCount(1);

      expect(count).toBe(42);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('v_user_content_counts'),
        [1]
      );
    });

    it('should return 0 when user has no achievements', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      const count = await achievementsService.getUserAchievementsCount(1);

      expect(count).toBe(0);
    });
  });

  describe('getPendingCount', () => {
    it('should return pending achievements count', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([{ cnt: 15 }]));

      const count = await achievementsService.getPendingCount();

      expect(count).toBe(15);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'pending'")
      );
    });

    it('should return 0 when no pending achievements', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      const count = await achievementsService.getPendingCount();

      expect(count).toBe(0);
    });
  });
});
