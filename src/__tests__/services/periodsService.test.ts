import { PeriodsService } from '../../services/periodsService';
import {
  createMockPool,
  createMockTelegramService,
  createMockUser,
  createQueryResult,
} from '../mocks';
import { errors } from '../../utils/errors';

describe('PeriodsService', () => {
  let periodsService: PeriodsService;
  let mockPool: any;
  let mockTelegramService: any;

  beforeEach(() => {
    mockPool = createMockPool();
    mockTelegramService = createMockTelegramService();
    periodsService = new PeriodsService(mockPool, mockTelegramService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // 2.1. Validation Methods
  // ============================================================================

  describe('validatePeriodYears', () => {
    it('should validate period years successfully', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'person-1',
            birth_year: 1900,
            death_year: 2000,
            name: 'Test Person',
          },
        ])
      );

      const result = await periodsService.validatePeriodYears(1950, 1970, 'person-1');

      expect(result.personName).toBe('Test Person');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, birth_year, death_year, name FROM persons'),
        ['person-1']
      );
    });

    it('should throw error when start >= end', async () => {
      await expect(periodsService.validatePeriodYears(1970, 1950, 'person-1')).rejects.toThrow(
        'start_year должен быть меньше end_year'
      );
    });

    it('should throw error when start equals end', async () => {
      await expect(periodsService.validatePeriodYears(1970, 1970, 'person-1')).rejects.toThrow(
        'start_year должен быть меньше end_year'
      );
    });

    it('should throw error when person not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(
        periodsService.validatePeriodYears(1950, 1970, 'nonexistent')
      ).rejects.toThrow('Личность не найдена');
    });

    it('should throw error when period starts before birth year', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'person-1',
            birth_year: 1900,
            death_year: 2000,
            name: 'Test Person',
          },
        ])
      );

      await expect(periodsService.validatePeriodYears(1850, 1920, 'person-1')).rejects.toThrow(
        /должны входить в годы жизни/
      );
    });

    it('should throw error when period ends after death year', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'person-1',
            birth_year: 1900,
            death_year: 2000,
            name: 'Test Person',
          },
        ])
      );

      await expect(periodsService.validatePeriodYears(1980, 2050, 'person-1')).rejects.toThrow(
        /должны входить в годы жизни/
      );
    });
  });

  describe('validatePeriodOverlap', () => {
    it('should pass when no overlap exists', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(
        periodsService.validatePeriodOverlap('person-1', 'life', 1950, 1970)
      ).resolves.not.toThrow();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('int4range'),
        ['person-1', 'life', 1950, 1970]
      );
    });

    it('should throw error when overlap detected', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            start_year: 1960,
            end_year: 1980,
          },
        ])
      );

      await expect(
        periodsService.validatePeriodOverlap('person-1', 'life', 1950, 1970)
      ).rejects.toThrow(/Период пересекается с существующим периодом/);
    });

    it('should exclude specific period when excludeId provided', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await periodsService.validatePeriodOverlap('person-1', 'life', 1950, 1970, 5);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND id != $5'),
        ['person-1', 'life', 1950, 1970, 5]
      );
    });
  });

  // ============================================================================
  // 2.2. CRUD Operations - Create
  // ============================================================================

  describe('createPeriod', () => {
    const periodData = {
      personId: 'person-1',
      startYear: 1950,
      endYear: 1970,
      periodType: 'life',
      countryId: 1,
      comment: 'Test comment',
    };

    it('should create period with approved status for admin', async () => {
      const user = createMockUser({ role: 'admin' });

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 'person-1',
              birth_year: 1900,
              death_year: 2000,
              name: 'Test Person',
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([]))
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              ...periodData,
              status: 'approved',
            },
          ])
        );

      const result = await periodsService.createPeriod(periodData, user, false);

      expect(result.status).toBe('approved');
      expect(mockTelegramService.notifyPeriodCreated).toHaveBeenCalled();
    });

    it('should create period with pending status for regular user', async () => {
      const user = createMockUser({ role: 'user' });

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 'person-1',
              birth_year: 1900,
              death_year: 2000,
              name: 'Test Person',
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([]))
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              ...periodData,
              status: 'pending',
            },
          ])
        );

      const result = await periodsService.createPeriod(periodData, user, false);

      expect(result.status).toBe('pending');
      expect(mockTelegramService.notifyPeriodCreated).toHaveBeenCalled();
    });

    it('should create period as draft', async () => {
      const user = createMockUser();

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 'person-1',
              birth_year: 1900,
              death_year: 2000,
              name: 'Test Person',
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              ...periodData,
              status: 'draft',
            },
          ])
        );

      const result = await periodsService.createPeriod(periodData, user, true);

      expect(result.status).toBe('draft');
      expect(mockTelegramService.notifyPeriodCreated).not.toHaveBeenCalled();
    });

    it('should validate period years', async () => {
      const user = createMockUser();

      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(periodsService.createPeriod(periodData, user, false)).rejects.toThrow(
        'Личность не найдена'
      );
    });

    it('should check overlap for non-drafts', async () => {
      const user = createMockUser();

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 'person-1',
              birth_year: 1900,
              death_year: 2000,
              name: 'Test Person',
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 2,
              start_year: 1960,
              end_year: 1980,
            },
          ])
        );

      await expect(periodsService.createPeriod(periodData, user, false)).rejects.toThrow(
        /Период пересекается/
      );
    });

    it('should skip overlap check for drafts', async () => {
      const user = createMockUser();

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 'person-1',
              birth_year: 1900,
              death_year: 2000,
              name: 'Test Person',
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              ...periodData,
              status: 'draft',
            },
          ])
        );

      const result = await periodsService.createPeriod(periodData, user, true);

      expect(result.status).toBe('draft');
      // Проверяем, что validatePeriodOverlap не был вызван
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // 2.2. CRUD Operations - Update
  // ============================================================================

  describe('updatePeriod', () => {
    it('should update period successfully', async () => {
      const user = createMockUser();

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              created_by: user.sub,
              status: 'draft',
              person_id: 'person-1',
              period_type: 'life',
              start_year: 1950,
              end_year: 1970,
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 'person-1',
              birth_year: 1900,
              death_year: 2000,
              name: 'Test Person',
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([]))
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              start_year: 1955,
              end_year: 1975,
            },
          ])
        );

      const result = await periodsService.updatePeriod(1, user.sub, {
        startYear: 1955,
        endYear: 1975,
      });

      expect(result.start_year).toBe(1955);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE periods SET'),
        expect.any(Array)
      );
    });

    it('should throw error when period not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(periodsService.updatePeriod(999, 1, { comment: 'New' })).rejects.toThrow(
        'Период не найден'
      );
    });

    it('should throw error when user does not own period', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: 999,
            status: 'draft',
            person_id: 'person-1',
            period_type: 'life',
            start_year: 1950,
            end_year: 1970,
          },
        ])
      );

      await expect(periodsService.updatePeriod(1, 1, { comment: 'New' })).rejects.toThrow(
        'Вы можете редактировать только свои периоды'
      );
    });

    it('should throw error when period is not a draft', async () => {
      const user = createMockUser();

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: user.sub,
            status: 'approved',
            person_id: 'person-1',
            period_type: 'life',
            start_year: 1950,
            end_year: 1970,
          },
        ])
      );

      await expect(periodsService.updatePeriod(1, user.sub, { comment: 'New' })).rejects.toThrow(
        'Можно редактировать только черновики'
      );
    });

    it('should throw error when no fields to update', async () => {
      const user = createMockUser();

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              created_by: user.sub,
              status: 'draft',
              person_id: 'person-1',
              period_type: 'life',
              start_year: 1950,
              end_year: 1970,
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 'person-1',
              birth_year: 1900,
              death_year: 2000,
              name: 'Test Person',
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([])); // Overlap check

      await expect(periodsService.updatePeriod(1, user.sub, {})).rejects.toThrow(
        'Нет полей для обновления'
      );
    });

    it('should validate updated years', async () => {
      const user = createMockUser();

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              created_by: user.sub,
              status: 'draft',
              person_id: 'person-1',
              period_type: 'life',
              start_year: 1950,
              end_year: 1970,
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([]));

      await expect(
        periodsService.updatePeriod(1, user.sub, { startYear: 1920, endYear: 1930 })
      ).rejects.toThrow('Личность не найдена');
    });

    it('should check for overlaps when updating', async () => {
      const user = createMockUser();

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              created_by: user.sub,
              status: 'draft',
              person_id: 'person-1',
              period_type: 'life',
              start_year: 1950,
              end_year: 1970,
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 'person-1',
              birth_year: 1900,
              death_year: 2000,
              name: 'Test Person',
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 2,
              start_year: 1960,
              end_year: 1980,
            },
          ])
        );

      await expect(
        periodsService.updatePeriod(1, user.sub, { startYear: 1955, endYear: 1975 })
      ).rejects.toThrow(/Период пересекается/);
    });
  });

  // ============================================================================
  // 2.2. CRUD Operations - Delete
  // ============================================================================

  describe('deletePeriod', () => {
    it('should delete period successfully', async () => {
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

      await expect(periodsService.deletePeriod(1, user.sub)).resolves.not.toThrow();

      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM periods WHERE id = $1', [1]);
    });

    it('should throw error when period not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(periodsService.deletePeriod(999, 1)).rejects.toThrow('Период не найден');
    });

    it('should throw error when user does not own period', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: 999,
            status: 'draft',
          },
        ])
      );

      await expect(periodsService.deletePeriod(1, 1)).rejects.toThrow(
        'Вы можете удалять только свои периоды'
      );
    });

    it('should throw error when period is not a draft', async () => {
      const user = createMockUser();

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: user.sub,
            status: 'approved',
          },
        ])
      );

      await expect(periodsService.deletePeriod(1, user.sub)).rejects.toThrow(
        'Можно удалять только черновики'
      );
    });
  });

  // ============================================================================
  // 2.3. Retrieval Methods
  // ============================================================================

  describe('getPeriods', () => {
    it('should get periods with filters', async () => {
      const mockPeriods = [
        {
          id: 1,
          person_id: 'person-1',
          start_year: 1950,
          end_year: 1970,
          period_type: 'life',
        },
        {
          id: 2,
          person_id: 'person-2',
          start_year: 1960,
          end_year: 1980,
          period_type: 'work',
        },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockPeriods));

      const result = await periodsService.getPeriods(
        {
          personId: 'person-1',
          periodType: 'life',
          yearFrom: 1900,
          yearTo: 2000,
        },
        10,
        0
      );

      expect(result.data).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('v_approved_periods'),
        expect.any(Array)
      );
    });

    it('should search periods by query', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await periodsService.getPeriods({ q: 'France' }, 10, 0);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%France%'])
      );
    });

    it('should filter by country', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await periodsService.getPeriods({ countryId: 5 }, 10, 0);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([5]));
    });

    it('should handle pagination correctly', async () => {
      const mockPeriods = Array.from({ length: 11 }, (_, i) => ({
        id: i + 1,
        person_id: `person-${i + 1}`,
      }));

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockPeriods));

      const result = await periodsService.getPeriods({}, 10, 0);

      expect(result.data).toHaveLength(10);
      expect(result.meta.hasMore).toBe(true);
    });
  });

  describe('getUserPeriods', () => {
    it('should get user periods', async () => {
      const mockPeriods = [
        { id: 1, status: 'approved' },
        { id: 2, status: 'pending' },
        { id: 3, status: 'draft' },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockPeriods));

      const result = await periodsService.getUserPeriods(1, 10, 0);

      expect(result.data).toHaveLength(3);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE pr.created_by = $1'),
        [1, 11, 0]
      );
    });

    it('should handle pagination for user periods', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await periodsService.getUserPeriods(1, 5, 10);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [1, 6, 10]);
    });
  });

  describe('getPendingPeriods', () => {
    it('should get pending periods for moderation', async () => {
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

      const result = await periodsService.getPendingPeriods(10, 0);

      expect(result.data).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE pr.status = 'pending'"),
        [11, 0]
      );
    });

    it('should handle pagination for pending periods', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await periodsService.getPendingPeriods(20, 40);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [21, 40]);
    });
  });

  describe('getPeriodsByPerson', () => {
    it('should get periods by person ID', async () => {
      const mockPeriods = [
        { id: 1, person_id: 'person-1', start_year: 1950 },
        { id: 2, person_id: 'person-1', start_year: 1970 },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockPeriods));

      const result = await periodsService.getPeriodsByPerson('person-1');

      expect(result).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE person_id = $1'),
        ['person-1']
      );
    });
  });

  describe('getUserDrafts', () => {
    it('should get user drafts', async () => {
      const mockDrafts = [
        { id: 1, status: 'draft' },
        { id: 2, status: 'draft' },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockDrafts));

      const result = await periodsService.getUserDrafts(1, 10, 0);

      expect(result.data).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("AND pr.status = 'draft'"),
        [1, 11, 0]
      );
    });

    it('should handle pagination for drafts', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await periodsService.getUserDrafts(1, 15, 30);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [1, 16, 30]);
    });
  });

  // ============================================================================
  // 2.4. Moderation
  // ============================================================================

  describe('reviewPeriod', () => {
    it('should approve period', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              status: 'pending',
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

      const result = await periodsService.reviewPeriod(1, 'approve', 2, 'Looks good');

      expect(result.status).toBe('approved');
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE periods'), [
        'approved',
        2,
        'Looks good',
        1,
      ]);
    });

    it('should reject period', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              status: 'pending',
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

      const result = await periodsService.reviewPeriod(1, 'reject', 2, 'Needs improvement');

      expect(result.status).toBe('rejected');
    });

    it('should throw error when period not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(periodsService.reviewPeriod(999, 'approve', 2)).rejects.toThrow(
        'Период не найден'
      );
    });

    it('should throw error when period is not pending', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            status: 'approved',
          },
        ])
      );

      await expect(periodsService.reviewPeriod(1, 'approve', 2)).rejects.toThrow(
        'Можно модерировать только периоды в статусе pending'
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

      const result = await periodsService.submitDraft(1, user.sub);

      expect(result.status).toBe('pending');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'pending'"),
        [1]
      );
    });

    it('should throw error when draft not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(periodsService.submitDraft(999, 1)).rejects.toThrow('Период не найден');
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

      await expect(periodsService.submitDraft(1, 1)).rejects.toThrow(
        'Вы можете отправлять только свои черновики'
      );
    });

    it('should throw error when period is not a draft', async () => {
      const user = createMockUser();

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: user.sub,
            status: 'pending',
          },
        ])
      );

      await expect(periodsService.submitDraft(1, user.sub)).rejects.toThrow(
        'Можно отправлять только черновики'
      );
    });
  });

  // ============================================================================
  // 2.5. Counters
  // ============================================================================

  describe('getUserPeriodsCount', () => {
    it('should return user periods count', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([{ cnt: 25 }]));

      const count = await periodsService.getUserPeriodsCount(1);

      expect(count).toBe(25);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('v_user_content_counts'),
        [1]
      );
    });

    it('should return 0 when user has no periods', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      const count = await periodsService.getUserPeriodsCount(1);

      expect(count).toBe(0);
    });
  });

  describe('getPendingCount', () => {
    it('should return pending periods count', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([{ cnt: 8 }]));

      const count = await periodsService.getPendingCount();

      expect(count).toBe(8);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining("WHERE status = 'pending'"));
    });

    it('should return 0 when no pending periods', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      const count = await periodsService.getPendingCount();

      expect(count).toBe(0);
    });
  });
});

