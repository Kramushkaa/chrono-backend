import { PersonsService } from '../../services/personsService';
import { createMockPool, createMockTelegramService, createMockUser, createQueryResult } from '../mocks';
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

      mockPool.query
        .mockResolvedValueOnce(createQueryResult([personRow]))
        .mockResolvedValueOnce(
          createQueryResult([
            {
              periods: [
                { startYear: 1900, endYear: 1950, countryId: 1, countryName: 'USA' },
              ],
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
        lifePeriods: [
          { countryId: 1, start: 1900, end: 2000 },
        ],
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

      await expect(
        personsService.proposePersonWithLifePeriods(data, user, false)
      ).rejects.toThrow('Database error');

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

      await expect(
        personsService.proposePersonWithLifePeriods(data, user, false)
      ).rejects.toThrow('Для отправки на модерацию необходимо указать хотя бы один период жизни');
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

      await expect(
        personsService.proposePersonWithLifePeriods(data, user, false)
      ).rejects.toThrow('Периоды должны быть в пределах годов жизни');

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
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE persons'),
        ['approved', 1, 'Good', 'test-id']
      );
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

      await expect(
        personsService.reviewPerson('test-id', 'approve', 1)
      ).rejects.toThrow('Можно модерировать только личности в статусе pending');
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
});

