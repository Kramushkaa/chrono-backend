import { ListsService } from '../../services/listsService';
import { createMockPool, createQueryResult } from '../mocks';

describe('ListsService', () => {
  let listsService: ListsService;
  let mockPool: any;

  beforeEach(() => {
    mockPool = createMockPool();
    listsService = new ListsService(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createList', () => {
    it('should create a list with valid title', async () => {
      const title = 'Test List';
      const userId = 1;
      const now = new Date();

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            owner_user_id: userId,
            title,
            created_at: now,
            updated_at: now,
            moderation_status: 'draft',
            public_description: '',
            moderation_requested_at: null,
            published_at: null,
            moderated_by: null,
            moderated_at: null,
            moderation_comment: null,
            public_slug: null,
          },
        ])
      );

      const result = await listsService.createList(title, userId);

      expect(result.id).toBe(1);
      expect(result.title).toBe(title);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO lists (owner_user_id, title)'),
        [userId, title]
      );
    });

    it('should throw error if title is empty', async () => {
      await expect(listsService.createList('  ', 1)).rejects.toThrow('Название списка обязательно');
    });

    it('should throw error if title is too long', async () => {
      const longTitle = 'a'.repeat(201);

      await expect(listsService.createList(longTitle, 1)).rejects.toThrow(
        'Название списка слишком длинное (макс. 200)'
      );
    });

    it('should trim title before validation', async () => {
      const title = '  Test List  ';
      const now = new Date();
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 1,
            owner_user_id: 1,
            title: 'Test List',
            created_at: now,
            updated_at: now,
            moderation_status: 'draft',
            public_description: '',
            moderation_requested_at: null,
            published_at: null,
            moderated_by: null,
            moderated_at: null,
            moderation_comment: null,
            public_slug: null,
          },
        ])
      );

      await listsService.createList(title, 1);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [1, 'Test List']);
    });
  });

  describe('getUserLists', () => {
    it('should return user lists with item counts', async () => {
      const listRows = [
        {
          id: 1,
          owner_user_id: 1,
          title: 'List 1',
          created_at: new Date(),
          updated_at: new Date(),
          moderation_status: 'draft',
          public_description: '',
          moderation_requested_at: null,
          published_at: null,
          moderated_by: null,
          moderated_at: null,
          moderation_comment: null,
          public_slug: null,
        },
        {
          id: 2,
          owner_user_id: 1,
          title: 'List 2',
          created_at: new Date(),
          updated_at: new Date(),
          moderation_status: 'draft',
          public_description: '',
          moderation_requested_at: null,
          published_at: null,
          moderated_by: null,
          moderated_at: null,
          moderation_comment: null,
          public_slug: null,
        },
      ];

      const countRows = [
        { list_id: 1, total: 5, persons: 3, achievements: 1, periods: 1 },
        { list_id: 2, total: 3, persons: 2, achievements: 1, periods: 0 },
      ];

      mockPool.query
        .mockResolvedValueOnce(createQueryResult(listRows))
        .mockResolvedValueOnce(createQueryResult(countRows));

      const result = await listsService.getUserLists(1);

      expect(result).toHaveLength(2);
      expect(result[0].items_count).toBe(5);
      expect(result[0].persons_count).toBe(3);
      expect(result[0].achievements_count).toBe(1);
      expect(result[0].periods_count).toBe(1);
      expect(result[1].items_count).toBe(3);
      expect(result[1].persons_count).toBe(2);
    });

    it('should handle empty lists', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      const result = await listsService.getUserLists(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('requestPublication', () => {
    it('should mark list as pending and update description', async () => {
      const now = new Date();
      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([{ owner_user_id: 1, moderation_status: 'draft' as const }])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              owner_user_id: 1,
              title: 'List 1',
              created_at: now,
              updated_at: now,
              moderation_status: 'pending' as const,
              public_description: 'desc',
              moderation_requested_at: now,
              published_at: null,
              moderated_by: null,
              moderated_at: null,
              moderation_comment: null,
              public_slug: null,
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([{ total: 3, persons: 2, achievements: 1, periods: 0 }])
        );

      const result = await listsService.requestPublication(1, 1, 'desc');

      expect(result.moderation_status).toBe('pending');
      expect(result.public_description).toBe('desc');
      expect(mockPool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE lists'), [
        1,
        1,
        'desc',
      ]);
    });

    it('should throw if list already published', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([{ owner_user_id: 1, moderation_status: 'published' as const }])
      );

      await expect(listsService.requestPublication(1, 1, 'desc')).rejects.toThrow(
        'Список уже опубликован'
      );
    });
  });

  describe('reviewList', () => {
    it('should publish list with generated slug', async () => {
      const now = new Date();
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce(createQueryResult([])) // BEGIN
          .mockResolvedValueOnce(
            createQueryResult([
              {
                id: 1,
                owner_user_id: 1,
                title: 'List Title',
                moderation_status: 'pending' as const,
                public_slug: null,
              },
            ])
          )
          .mockResolvedValueOnce(createQueryResult([])) // ensureUniqueSlug check
          .mockResolvedValueOnce(
            createQueryResult([
              {
                id: 1,
                owner_user_id: 1,
                title: 'List Title',
                created_at: now,
                updated_at: now,
                moderation_status: 'published' as const,
                public_description: 'desc',
                moderation_requested_at: now,
                published_at: now,
                moderated_by: 2,
                moderated_at: now,
                moderation_comment: null,
                public_slug: 'list-title',
              },
            ])
          )
          .mockResolvedValueOnce(
            createQueryResult([{ total: 2, persons: 1, achievements: 1, periods: 0 }])
          )
          .mockResolvedValueOnce(createQueryResult([])), // COMMIT
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient as any);

      const result = await listsService.reviewList(1, 2, 'approve', { comment: 'ok' });

      expect(result.moderation_status).toBe('published');
      expect(result.public_slug).toBe('list-title');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should reject list with comment', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce(createQueryResult([])) // BEGIN
          .mockResolvedValueOnce(
            createQueryResult([
              {
                id: 1,
                owner_user_id: 1,
                title: 'List Title',
                moderation_status: 'pending' as const,
                public_slug: null,
              },
            ])
          )
          .mockResolvedValueOnce(
            createQueryResult([
              {
                id: 1,
                owner_user_id: 1,
                title: 'List Title',
                created_at: new Date(),
                updated_at: new Date(),
                moderation_status: 'rejected' as const,
                public_description: 'desc',
                moderation_requested_at: new Date(),
                published_at: null,
                moderated_by: 2,
                moderated_at: new Date(),
                moderation_comment: 'needs fixes',
                public_slug: null,
              },
            ])
          )
          .mockResolvedValueOnce(
            createQueryResult([{ total: 2, persons: 1, achievements: 1, periods: 0 }])
          )
          .mockResolvedValueOnce(createQueryResult([])), // COMMIT
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient as any);

      const result = await listsService.reviewList(1, 2, 'reject', { comment: 'needs fixes' });

      expect(result.moderation_status).toBe('rejected');
      expect(result.moderation_comment).toBe('needs fixes');
    });
  });

  describe('getListItems', () => {
    it('should return list items for owner', async () => {
      mockPool.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // ownership check
        .mockResolvedValueOnce(
          createQueryResult([
            {
              id: 1,
              list_id: 1,
              item_type: 'person',
              person_id: 'person-1',
              achievement_id: null,
              period_id: null,
              position: 1,
              created_at: new Date(),
            },
          ])
        );

      const result = await listsService.getListItems(1, 1);

      expect(result).toHaveLength(1);
      expect(result[0].item_type).toBe('person');
    });

    it('should throw error if user is not owner', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([])); // No ownership

      await expect(listsService.getListItems(1, 2)).rejects.toThrow('Нет прав на доступ к списку');
    });
  });

  describe('addListItem', () => {
    it('should add person to list', async () => {
      mockPool.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // ownership check
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // person exists
        .mockResolvedValueOnce(createQueryResult([])) // no duplicate
        .mockResolvedValueOnce(createQueryResult([{ id: 1, item_type: 'person' }])); // insert

      const result = await listsService.addListItem(1, 1, 'person', 'person-1');

      expect(result.data.item_type).toBe('person');
    });

    it('should return existing item if already added', async () => {
      mockPool.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // ownership check
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // person exists
        .mockResolvedValueOnce(createQueryResult([{ id: 5, item_type: 'person' }])); // duplicate exists

      const result = await listsService.addListItem(1, 1, 'person', 'person-1');

      expect(result.message).toBe('already_exists');
      expect(result.data.id).toBe(5);
    });

    it('should throw error if person not found', async () => {
      mockPool.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // ownership check
        .mockResolvedValueOnce(createQueryResult([])); // person not found

      await expect(listsService.addListItem(1, 1, 'person', 'non-existent')).rejects.toThrow(
        'Личность не найдена'
      );
    });

    it('should throw error for invalid item type', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([{ id: 1 }])); // ownership check

      await expect(listsService.addListItem(1, 1, 'invalid' as any, 'test')).rejects.toThrow(
        'Некорректный тип элемента'
      );
    });
  });

  describe('deleteList', () => {
    it('should delete list and its items', async () => {
      mockPool.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // ownership check
        .mockResolvedValueOnce(createQueryResult([])) // delete items
        .mockResolvedValueOnce(createQueryResult([])); // delete list

      await listsService.deleteList(1, 1);

      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM list_items WHERE list_id = $1', [1]);
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM lists WHERE id = $1 AND owner_user_id = $2',
        [1, 1]
      );
    });

    it('should throw error if user is not owner', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([])); // No ownership

      await expect(listsService.deleteList(1, 2)).rejects.toThrow('Нет прав на удаление списка');
    });
  });

  describe('shareList', () => {
    it('should create share code for owner', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            owner_user_id: 1,
            title: 'Test List',
          },
        ])
      );

      const code = await listsService.shareList(1, 1);

      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    });

    it('should throw error if list not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(listsService.shareList(999, 1)).rejects.toThrow('Список не найден');
    });

    it('should throw error if user is not owner', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            owner_user_id: 2, // Different owner
            title: 'Test List',
          },
        ])
      );

      await expect(listsService.shareList(1, 1)).rejects.toThrow('Нет прав на публикацию списка');
    });
  });

  describe('copyListFromShare', () => {
    it('should copy list from valid share code', async () => {
      // First, create a share code
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([{ owner_user_id: 1, title: 'Original List' }])
      );

      const code = await listsService.shareList(1, 1);

      // Reset mocks
      mockPool.query.mockClear();

      // Now copy the list
      mockPool.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1, title: 'Original List' }])) // src list
        .mockResolvedValueOnce(createQueryResult([{ id: 2 }])) // insert new list
        .mockResolvedValueOnce(createQueryResult([])); // copy items

      const result = await listsService.copyListFromShare(code, 2);

      expect(result.id).toBe(2);
      expect(result.title).toBe('Original List');
    });

    it('should use custom title if provided', async () => {
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([{ owner_user_id: 1, title: 'Original' }])
      );

      const code = await listsService.shareList(1, 1);

      mockPool.query.mockClear();

      mockPool.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1, title: 'Original' }]))
        .mockResolvedValueOnce(createQueryResult([{ id: 2 }]))
        .mockResolvedValueOnce(createQueryResult([]));

      const result = await listsService.copyListFromShare(code, 2, 'My Copy');

      expect(result.title).toBe('My Copy');
    });

    it('should throw error for invalid code', async () => {
      await expect(listsService.copyListFromShare('invalid-code', 1)).rejects.toThrow(
        'Некорректный код'
      );
    });
  });
});
