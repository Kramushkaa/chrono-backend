import { PersonsService } from '../../services/personsService';
import {
  createMockPool,
  createMockTelegramService,
  createMockUser,
  createQueryResult,
} from '../mocks';
import { errors } from '../../utils/errors';

describe('PersonsService', () => {
  let personsService: PersonsService;
  let mockPool: any;
  let mockTelegramService: any;

  beforeEach(() => {
    mockPool = createMockPool();
    mockTelegramService = createMockTelegramService();
    personsService = new PersonsService(mockPool, mockTelegramService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPerson', () => {
    it('should create a person with approved status for admin', async () => {
      const personData = {
        name: 'Test Person',
        birthYear: 1900,
        deathYear: 2000,
        category: 'Scientist',
        description: 'Test description',
      };

      const user = createMockUser({ role: 'admin' });

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'test-person',
            ...personData,
            status: 'approved',
          },
        ])
      );

      const result = await personsService.createPerson(personData, user, false);

      expect(result.status).toBe('approved');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO persons'),
        expect.arrayContaining([
          expect.stringMatching(/test-person/),
          personData.name,
          personData.birthYear,
          personData.deathYear,
          personData.category,
          personData.description,
          null,
          null,
          'approved',
          user.sub,
        ])
      );
    });

    it('should create a person with draft status when saveAsDraft is true', async () => {
      const personData = {
        name: 'Draft Person',
        birthYear: 1850,
        deathYear: 1920,
        category: 'Writer',
        description: 'Draft description',
      };

      const user = createMockUser();

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([{ id: 'draft-person', status: 'draft' }])
      );

      const result = await personsService.createPerson(personData, user, true);

      expect(result.status).toBe('draft');
      expect(mockTelegramService.notifyPersonCreated).not.toHaveBeenCalled();
    });

    it('should send telegram notification for non-draft person', async () => {
      const personData = {
        name: 'Pending Person',
        birthYear: 1800,
        deathYear: 1880,
        category: 'Artist',
        description: 'Pending description',
      };

      const user = createMockUser();

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([{ id: 'pending-person', status: 'pending' }])
      );

      await personsService.createPerson(personData, user, false);

      expect(mockTelegramService.notifyPersonCreated).toHaveBeenCalledWith(
        personData.name,
        user.email,
        'pending',
        'pending-person'
      );
    });
  });

  describe('getPersonById', () => {
    it('should return person with periods', async () => {
      const personRow = {
        id: 'test-id',
        name: 'Test Person',
        birth_year: 1900,
        death_year: 2000,
        category: 'Scientist',
        description: 'Test',
        image_url: null,
        wiki_link: null,
        status: 'approved',
      };

      mockPool.query.mockResolvedValueOnce(createQueryResult([personRow])).mockResolvedValueOnce(
        createQueryResult([
          {
            periods: [{ startYear: 1900, endYear: 1950, countryId: 1, countryName: 'USA' }],
          },
        ])
      );

      const result = await personsService.getPersonById('test-id');

      expect(result.id).toBe('test-id');
      expect(result.name).toBe('Test Person');
      expect(result.periods).toHaveLength(1);
    });

    it('should throw error if person not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(personsService.getPersonById('non-existent')).rejects.toThrow(
        'Историческая Личность не найдена'
      );
    });
  });

  describe('proposePersonWithLifePeriods', () => {
    it('should create person with life periods in transaction', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query.mockResolvedValue(createQueryResult([]));

      const data = {
        id: 'new-person',
        name: 'New Person',
        birthYear: 1900,
        deathYear: 2000,
        category: 'Scientist',
        description: 'Description',
        lifePeriods: [{ countryId: 1, start: 1900, end: 2000 }],
      };

      const user = createMockUser();

      await personsService.proposePersonWithLifePeriods(data, user, false);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO persons'),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO periods'),
        expect.arrayContaining(['new-person', 1900, 2000, 1, 'pending', user.sub])
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      const data = {
        id: 'error-person',
        name: 'Error Person',
        birthYear: 1900,
        deathYear: 2000,
        category: 'Test',
        description: 'Test',
        lifePeriods: [{ countryId: 1, start: 1900, end: 2000 }], // Add valid periods
      };

      const user = createMockUser();

      await expect(personsService.proposePersonWithLifePeriods(data, user, false)).rejects.toThrow(
        'Database error'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if life periods missing for non-draft', async () => {
      const data = {
        id: 'no-periods',
        name: 'No Periods',
        birthYear: 1900,
        deathYear: 2000,
        category: 'Test',
        description: 'Test',
        lifePeriods: [],
      };

      const user = createMockUser();

      await expect(personsService.proposePersonWithLifePeriods(data, user, false)).rejects.toThrow(
        'Для отправки на модерацию необходимо указать хотя бы один период жизни'
      );
    });

    it('should validate life periods are within birth/death years', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query.mockResolvedValue(createQueryResult([]));

      const data = {
        id: 'invalid-periods',
        name: 'Invalid Periods',
        birthYear: 1900,
        deathYear: 2000,
        category: 'Test',
        description: 'Test',
        lifePeriods: [
          { countryId: 1, start: 1800, end: 1850 }, // Start before birth
        ],
      };

      const user = createMockUser();

      await expect(personsService.proposePersonWithLifePeriods(data, user, false)).rejects.toThrow(
        'Периоды должны быть в пределах годов жизни'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('submitPersonDraft', () => {
    it('should submit draft and update related periods', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: 1,
            status: 'draft',
            name: 'Test Person',
          },
        ])
      );

      mockPool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query.mockResolvedValue(createQueryResult([{ id: 'test' }]));

      await personsService.submitPersonDraft('test-id', 1, 'test@example.com');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'pending'"),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockTelegramService.notifyPersonCreated).toHaveBeenCalled();
    });

    it('should throw error if person not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(
        personsService.submitPersonDraft('non-existent', 1, 'test@example.com')
      ).rejects.toThrow('Личность не найдена');
    });

    it('should throw error if user is not owner', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: 2, // Different user
            status: 'draft',
            name: 'Test',
          },
        ])
      );

      await expect(
        personsService.submitPersonDraft('test-id', 1, 'test@example.com')
      ).rejects.toThrow('Нет прав для отправки этой личности');
    });

    it('should throw error if person is not a draft', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: 1,
            status: 'approved', // Not a draft
            name: 'Test',
          },
        ])
      );

      await expect(
        personsService.submitPersonDraft('test-id', 1, 'test@example.com')
      ).rejects.toThrow('Можно отправлять на модерацию только черновики');
    });
  });

  describe('revertPersonToDraft', () => {
    it('should revert person and related content to draft', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'test-id',
            status: 'pending',
            created_by: 1,
          },
        ])
      );

      mockPool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query.mockResolvedValue(createQueryResult([]));

      await personsService.revertPersonToDraft('test-id', 1);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'draft'"),
        expect.any(Array)
      );
      // Should update periods
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE periods'),
        expect.any(Array)
      );
      // Should update achievements
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE achievements'),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error if person is not pending', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'test-id',
            status: 'draft', // Not pending
            created_by: 1,
          },
        ])
      );

      await expect(personsService.revertPersonToDraft('test-id', 1)).rejects.toThrow(
        'Можно возвращать в черновики только личности на модерации'
      );
    });
  });

  describe('updatePersonWithLifePeriods', () => {
    it('should update person and life periods', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: 1,
            status: 'draft',
            birth_year: 1900,
            death_year: 2000,
          },
        ])
      );

      mockPool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query.mockResolvedValue(createQueryResult([]));

      const updates = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const lifePeriods = [{ countryId: 1, start: 1900, end: 2000 }];

      await personsService.updatePersonWithLifePeriods('test-id', 1, updates, lifePeriods);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE persons'),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM periods'),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO periods'),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error if user does not have permission', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: 2, // Different user
            status: 'approved', // Not draft
            birth_year: 1900,
            death_year: 2000,
          },
        ])
      );

      await expect(
        personsService.updatePersonWithLifePeriods('test-id', 1, {}, [])
      ).rejects.toThrow('Нет прав для редактирования этой личности');
    });
  });

  describe('getPersonDrafts', () => {
    it('should return paginated drafts for user', async () => {
      const draftRows = [
        {
          id: 'draft-1',
          name: 'Draft 1',
          birth_year: 1900,
          death_year: 2000,
          category: 'Test',
          description: 'Test',
          image_url: null,
          wiki_link: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'draft-2',
          name: 'Draft 2',
          birth_year: 1850,
          death_year: 1920,
          category: 'Test',
          description: 'Test',
          image_url: null,
          wiki_link: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(draftRows));

      const result = await personsService.getPersonDrafts(1, 10, 0);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('draft-1');
      expect(result.meta).toBeDefined();
    });
  });

  describe('replacePersonLifePeriods', () => {
    it('should validate and replace life periods for admin', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            birth_year: 1900,
            death_year: 2000,
          },
        ])
      );

      mockPool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query.mockResolvedValue(createQueryResult([]));

      const periods = [
        { country_id: 1, start_year: 1900, end_year: 1950 },
        { country_id: 2, start_year: 1950, end_year: 2000 },
      ];

      await personsService.replacePersonLifePeriods('test-id', periods, 1, 'admin');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM periods'),
        expect.any(Array)
      );
      expect(mockClient.query).toHaveBeenCalledTimes(5); // BEGIN, DELETE, 2x INSERT, COMMIT
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error if periods have gaps', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            birth_year: 1900,
            death_year: 2000,
          },
        ])
      );

      const periods = [
        { country_id: 1, start_year: 1900, end_year: 1950 },
        { country_id: 2, start_year: 1952, end_year: 2000 }, // Gap!
      ];

      await expect(
        personsService.replacePersonLifePeriods('test-id', periods, 1, 'admin')
      ).rejects.toThrow('Периоды стран должны покрывать все годы жизни без пропусков');
    });

    it('should throw error if periods overlap', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            birth_year: 1900,
            death_year: 2000,
          },
        ])
      );

      const periods = [
        { country_id: 1, start_year: 1900, end_year: 1960 },
        { country_id: 2, start_year: 1955, end_year: 2000 }, // Overlap!
      ];

      await expect(
        personsService.replacePersonLifePeriods('test-id', periods, 1, 'admin')
      ).rejects.toThrow('Периоды стран не должны пересекаться');
    });
  });

  describe('reviewPerson', () => {
    it('should approve pending person', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 'test-id',
              status: 'pending',
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 'test-id',
              status: 'approved',
            },
          ])
        );

      const result = await personsService.reviewPerson('test-id', 'approve', 1, 'Good');

      expect(result.status).toBe('approved');
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE persons'), [
        'approved',
        1,
        'Good',
        'test-id',
      ]);
    });

    it('should throw error if person is not pending', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'test-id',
            status: 'approved', // Already approved
          },
        ])
      );

      await expect(personsService.reviewPerson('test-id', 'approve', 1)).rejects.toThrow(
        'Можно модерировать только личности в статусе pending'
      );
    });
  });

  describe('deletePerson', () => {
    it('should delete draft person', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              created_by: 1,
              status: 'draft',
            },
          ])
        )
        .mockResolvedValueOnce(createQueryResult([]));

      await personsService.deletePerson('test-id', 1);

      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM persons WHERE id = $1', ['test-id']);
    });

    it('should throw error if person is not a draft', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: 1,
            status: 'approved', // Not draft
          },
        ])
      );

      await expect(personsService.deletePerson('test-id', 1)).rejects.toThrow(
        'Можно удалять только черновики'
      );
    });
  });

  // ============================================================================
  // Additional Tests for Life Periods Transactions
  // ============================================================================

  describe('proposePersonWithLifePeriods - edge cases', () => {
    const personData = {
      id: 'new-person',
      name: 'Test Person',
      birthYear: 1900,
      deathYear: 2000,
      category: 'Scientist',
      description: 'Test',
      lifePeriods: [{ countryId: 1, start: 1900, end: 2000 }],
    };

    it('should throw error when no periods provided for non-draft submission', async () => {
      const user = createMockUser();
      const dataWithoutPeriods = { ...personData, lifePeriods: [] };

      await expect(
        personsService.proposePersonWithLifePeriods(dataWithoutPeriods, user, false)
      ).rejects.toThrow('Для отправки на модерацию необходимо указать хотя бы один период жизни');
    });

    it('should allow draft submission without periods', async () => {
      const user = createMockUser();
      const dataWithoutPeriods = { ...personData, lifePeriods: [] };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createQueryResult([])) // INSERT person
          .mockResolvedValue(createQueryResult([])),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient);

      await personsService.proposePersonWithLifePeriods(dataWithoutPeriods, user, true);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error for invalid country ID', async () => {
      const user = createMockUser();
      const dataWithInvalidCountry = {
        ...personData,
        lifePeriods: [{ countryId: 0, start: 1900, end: 2000 }],
      };

      const mockClient = {
        query: jest.fn().mockResolvedValueOnce(createQueryResult([])), // INSERT person
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient);

      await expect(
        personsService.proposePersonWithLifePeriods(dataWithInvalidCountry, user, false)
      ).rejects.toThrow('Некорректная страна');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should throw error for periods outside life years', async () => {
      const user = createMockUser();
      const dataWithInvalidPeriod = {
        ...personData,
        lifePeriods: [{ countryId: 1, start: 1850, end: 1920 }],
      };

      const mockClient = {
        query: jest.fn().mockResolvedValueOnce(createQueryResult([])), // INSERT person
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient);

      await expect(
        personsService.proposePersonWithLifePeriods(dataWithInvalidPeriod, user, false)
      ).rejects.toThrow('Периоды должны быть в пределах годов жизни');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should sort periods before insertion', async () => {
      const user = createMockUser({ role: 'admin' });
      const dataWithUnsortedPeriods = {
        ...personData,
        lifePeriods: [
          { countryId: 2, start: 1950, end: 2000 },
          { countryId: 1, start: 1900, end: 1950 },
        ],
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createQueryResult([])) // INSERT person
          .mockResolvedValueOnce(createQueryResult([])) // DELETE periods
          .mockResolvedValueOnce(createQueryResult([])) // INSERT period 1
          .mockResolvedValueOnce(createQueryResult([])), // INSERT period 2
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient);

      await personsService.proposePersonWithLifePeriods(dataWithUnsortedPeriods, user, false);

      // Проверяем, что периоды вставлены в правильном порядке (1900-1950 перед 1950-2000)
      expect(mockClient.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('INSERT INTO periods'),
        ['new-person', 1900, 1950, 1, 'approved', user.sub]
      );
      expect(mockClient.query).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('INSERT INTO periods'),
        ['new-person', 1950, 2000, 2, 'approved', user.sub]
      );
    });
  });

  describe('revertPersonToDraft - edge cases', () => {
    it('should successfully revert pending person to draft', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(createQueryResult([])) // BEGIN
          .mockResolvedValueOnce(createQueryResult([])) // UPDATE persons
          .mockResolvedValueOnce(createQueryResult([])), // UPDATE periods
        release: jest.fn(),
      };

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 'person-1',
            created_by: 1,
            status: 'pending',
          },
        ])
      );
      mockPool.connect.mockResolvedValueOnce(mockClient);

      await expect(personsService.revertPersonToDraft('person-1', 1)).resolves.not.toThrow();

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error when person is not pending', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            created_by: 1,
            status: 'approved',
          },
        ])
      );

      await expect(personsService.revertPersonToDraft('person-1', 1)).rejects.toThrow(
        'Можно возвращать в черновики только личности на модерации'
      );
    });
  });

  describe('getPersonDrafts - edge cases', () => {
    it('should return empty list when no drafts exist', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      const result = await personsService.getPersonDrafts(1, 10, 0);

      expect(result.data).toHaveLength(0);
      expect(result.meta.hasMore).toBe(false);
    });

    it('should handle pagination correctly', async () => {
      const mockDrafts = Array.from({ length: 11 }, (_, i) => ({
        id: `person-${i + 1}`,
        status: 'draft',
      }));

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockDrafts));

      const result = await personsService.getPersonDrafts(1, 10, 0);

      expect(result.data).toHaveLength(10);
      expect(result.meta.hasMore).toBe(true);
    });
  });

  describe('getPersonLifePeriods - edge cases', () => {
    it('should return empty array when no life periods exist', async () => {
      mockPool.query
        .mockResolvedValueOnce(createQueryResult([{ id: 'person-1' }])) // Person exists
        .mockResolvedValueOnce(createQueryResult([])); // No periods

      const result = await personsService.getPersonLifePeriods('person-1');

      expect(result).toEqual([]);
    });

    it('should return multiple periods sorted by start year', async () => {
      const mockPeriods = [
        {
          id: 1,
          country_id: 1,
          start_year: 1900,
          end_year: 1950,
          status: 'approved',
          country_name: 'Country A',
        },
        {
          id: 2,
          country_id: 2,
          start_year: 1950,
          end_year: 2000,
          status: 'approved',
          country_name: 'Country B',
        },
      ];

      mockPool.query
        .mockResolvedValueOnce(createQueryResult([{ id: 'person-1' }])) // Person exists
        .mockResolvedValueOnce(createQueryResult(mockPeriods));

      const result = await personsService.getPersonLifePeriods('person-1');

      expect(result).toHaveLength(2);
      expect(result[0].startYear).toBe(1900);
      expect(result[1].startYear).toBe(1950);
    });
  });

  // ============================================================================
  // Additional Coverage - getPersons, getPendingPersons, getPersonsByIds
  // ============================================================================

  describe('getPersons', () => {
    it('should get persons with complex filters', async () => {
      const mockPersons = [
        { id: 'person-1', name: 'Test Person 1', category: 'Scientist' },
        { id: 'person-2', name: 'Test Person 2', category: 'Artist' },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockPersons));

      const result = await personsService.getPersons(
        {
          q: 'test',
          category: 'Scientist',
          startYear: 1900,
          endYear: 2000,
        },
        10,
        0
      );

      expect(result.data.length).toBeGreaterThan(0);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE'), expect.any(Array));
    });

    it('should handle search query', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await personsService.getPersons({ q: 'Einstein' }, 10, 0);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%Einstein%'])
      );
    });
  });

  describe('getPendingPersons', () => {
    it('should get pending persons for moderation', async () => {
      const mockPending = [
        {
          id: 'person-1',
          name: 'Pending Person 1',
          status: 'pending',
          creator_email: 'user@example.com',
        },
        {
          id: 'person-2',
          name: 'Pending Person 2',
          status: 'pending',
          creator_email: 'user2@example.com',
        },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockPending));

      const result = await personsService.getPendingPersons(10, 0);

      expect(result.data).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'pending'"),
        expect.any(Array)
      );
    });

    it('should handle pagination', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await personsService.getPendingPersons(20, 40);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [21, 40]);
    });
  });

  describe('getPersonsByIds', () => {
    it('should get persons by batch of IDs', async () => {
      const mockPersons = [
        { id: 'person-1', name: 'Person 1' },
        { id: 'person-2', name: 'Person 2' },
        { id: 'person-3', name: 'Person 3' },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockPersons));

      const result = await personsService.getPersonsByIds(['person-1', 'person-2', 'person-3']);

      expect(result).toHaveLength(3);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('generate_series'),
        [['person-1', 'person-2', 'person-3']]
      );
    });

    it('should return empty array for empty IDs', async () => {
      const result = await personsService.getPersonsByIds([]);

      expect(result).toEqual([]);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe('proposeEdit', () => {
    it('should propose edit for existing person', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 'person-1',
              name: 'Original Name',
              birth_year: 1900,
            },
          ])
        ) // Check person exists
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              person_id: 'person-1',
              status: 'pending',
            },
          ])
        ); // INSERT edit

      const result = await personsService.proposeEdit(
        'person-1',
        {
          name: 'Updated Name',
        },
        1
      );

      expect(result.status).toBe('pending');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO person_edits'),
        expect.any(Array)
      );
    });

    it('should throw error when person not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(personsService.proposeEdit('nonexistent', { name: 'Test' }, 1)).rejects.toThrow(
        'Личность не найдена'
      );
    });
  });

  describe('reviewEdit', () => {
    it('should approve edit and update person', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              person_id: 'person-1',
              status: 'pending',
              payload: { name: 'Updated Name' },
            },
          ])
        ) // Check edit exists
        .mockResolvedValueOnce(createQueryResult([])) // UPDATE person_edits
        .mockResolvedValueOnce(createQueryResult([])) // applyPayloadToPerson (UPDATE persons)
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              status: 'approved',
            },
          ])
        ); // SELECT updated edit

      const result = await personsService.reviewEdit(1, 'approve', 2);

      expect(result.status).toBe('approved');
    });

    it('should reject edit without updating person', async () => {
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              person_id: 'person-1',
              status: 'pending',
            },
          ])
        ) // Check edit exists
        .mockResolvedValueOnce(createQueryResult([])) // UPDATE person_edits
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              status: 'rejected',
            },
          ])
        ); // SELECT updated edit

      const result = await personsService.reviewEdit(1, 'reject', 2, 'Not accurate');

      expect(result.status).toBe('rejected');
    });
  });
});
