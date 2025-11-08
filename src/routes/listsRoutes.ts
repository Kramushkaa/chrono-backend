import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticateToken, rateLimit, requireRoleMiddleware } from '../middleware/auth';
import { asyncHandler, errors } from '../utils/errors';
import { ListsService, ListModerationStatus } from '../services/listsService';
import {
  validateBody,
  validateParams,
  commonSchemas,
  validateQuery,
} from '../middleware/validation';
import { parseLimitOffset } from '../utils/api';
import { z } from 'zod';

// Валидационные схемы для lists
const listsSchemas = {
  // Схема для ID списка
  listId: z.object({
    listId: commonSchemas.numericId,
  }),

  // Схема для кода шаринга
  shareCode: z.object({
    code: z.string().min(1, 'Код шаринга обязателен'),
  }),

  // Схема для создания списка
  createList: z.object({
    title: z.string().min(1, 'Название списка обязательно').max(255, 'Название слишком длинное'),
  }),

  // Схема для добавления элементов в список
  addListItem: z.object({
    item_type: z.enum(['person', 'achievement', 'period'], {
      message: 'item_type должен быть person, achievement или period',
    }),
    person_id: z.string().optional(),
    achievement_id: z.number().int().positive().optional(),
    period_id: z.number().int().positive().optional(),
  }),

  publishRequest: z.object({
    description: z.string().trim().max(2000, 'Описание слишком длинное').optional(),
  }),

  moderationQuery: z.object({
    status: z
      .string()
      .trim()
      .optional()
      .transform(val => (val ? (val as ListModerationStatus) : undefined))
      .refine(
        val =>
          !val || val === 'pending' || val === 'published' || val === 'rejected' || val === 'draft',
        { message: 'Недопустимый статус' }
      ),
  }),

  reviewList: z.object({
    action: z.enum(['approve', 'reject']),
    comment: z.string().trim().max(2000, 'Комментарий слишком длинный').optional(),
    slug: z
      .string()
      .trim()
      .max(80, 'Slug слишком длинный')
      .regex(/^[a-z0-9-]+$/i, 'Slug может содержать только буквы, цифры и дефисы')
      .optional(),
  }),
};

const moderationListQuerySchema = commonSchemas.pagination.extend({
  status: listsSchemas.moderationQuery.shape.status,
});

const publicListQuerySchema = commonSchemas.pagination;

export function createListsRoutes(pool: Pool, listsService: ListsService): Router {
  const router = Router();

  // Rate limiting: 300 requests per minute (content mutations)
  router.use(rateLimit(1 * 60 * 1000, 300));

  // Create a share token for a list (owner only)
  router.post(
    '/lists/:listId/share',
    authenticateToken,
    validateParams(listsSchemas.listId),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.sub;
      const { listId } = req.params as unknown as { listId: number };

      const code = await listsService.shareList(listId, userId);

      res.json({ success: true, data: { code } });
    })
  );

  // Resolve a share token to list metadata and items (no auth required)
  router.get(
    '/list-shares/:code',
    validateParams(listsSchemas.shareCode),
    asyncHandler(async (req: Request, res: Response) => {
      const { code } = req.params as unknown as { code: string };

      try {
        const data = await listsService.getSharedList(code);
        res.json({ success: true, data });
      } catch (e) {
        res.status(400).json({ success: false, message: 'invalid_share_code' });
      }
    })
  );

  // Get all lists for current user
  router.get(
    '/lists',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.sub;
      const data = await listsService.getUserLists(userId);
      res.json({ success: true, data });
    })
  );

  // Create list
  router.post(
    '/lists',
    authenticateToken,
    validateBody(listsSchemas.createList),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.sub;
      const { title } = req.body;

      const result = await listsService.createList(title, userId);

      res.status(201).json({ success: true, data: result });
    })
  );

  // List items
  router.get(
    '/lists/:listId/items',
    authenticateToken,
    validateParams(listsSchemas.listId),
    asyncHandler(async (req: Request, res: Response) => {
      const { listId } = req.params as unknown as { listId: number };
      const userId = req.user!.sub;

      const data = await listsService.getListItems(listId, userId);

      res.json({ success: true, data });
    })
  );

  router.post(
    '/lists/:listId/items',
    authenticateToken,
    validateParams(listsSchemas.listId),
    validateBody(listsSchemas.addListItem),
    asyncHandler(async (req: Request, res: Response) => {
      const { listId } = req.params as unknown as { listId: number };
      const { item_type, person_id, achievement_id, period_id } = req.body;
      const userId = req.user!.sub;

      let itemId: string | number;
      if (item_type === 'person') {
        itemId = person_id;
      } else if (item_type === 'achievement') {
        itemId = achievement_id;
      } else if (item_type === 'period') {
        itemId = period_id;
      } else {
        throw errors.badRequest('Некорректный тип элемента');
      }

      const result = await listsService.addListItem(Number(listId), userId, item_type, itemId);

      if (result.message === 'already_exists') {
        res.status(200).json({ success: true, data: result.data, message: 'already_exists' });
      } else {
        res.status(201).json({ success: true, data: result.data });
      }
    })
  );

  // Request list publication (owner only)
  router.post(
    '/lists/:listId/publish-request',
    authenticateToken,
    validateParams(listsSchemas.listId),
    validateBody(listsSchemas.publishRequest),
    asyncHandler(async (req: Request, res: Response) => {
      const { listId } = req.params as unknown as { listId: number };
      const { description } = req.body as { description?: string };
      const userId = req.user!.sub;

      const data = await listsService.requestPublication(Number(listId), userId, description);
      res.json({ success: true, data });
    })
  );

  router.delete(
    '/lists/:listId/items/:itemId',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const { listId, itemId } = req.params;
      const userId = req.user!.sub;

      await listsService.deleteListItem(Number(listId), Number(itemId), userId);

      res.json({ success: true });
    })
  );

  // Delete list (only owner)
  router.delete(
    '/lists/:listId',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.sub;
      const { listId } = req.params;

      await listsService.deleteList(Number(listId), userId);

      res.json({ success: true });
    })
  );

  // Admin moderation queue for lists
  router.get(
    '/admin/lists/moderation',
    authenticateToken,
    requireRoleMiddleware(['admin', 'moderator']),
    validateQuery(moderationListQuerySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const status = (req.query.status as ListModerationStatus | undefined) || 'pending';
      const { limitParam, offsetParam } = parseLimitOffset(
        req.query.limit as number | undefined,
        req.query.offset as number | undefined,
        { defLimit: 50, maxLimit: 200 }
      );

      const { total, data } = await listsService.getModerationQueue(
        status,
        limitParam,
        offsetParam
      );

      res.json({
        success: true,
        data,
        meta: {
          total,
          limit: limitParam,
          offset: offsetParam,
          hasMore: offsetParam + limitParam < total,
        },
      });
    })
  );

  // Admin review list (approve / reject)
  router.post(
    '/admin/lists/:listId/review',
    authenticateToken,
    requireRoleMiddleware(['admin', 'moderator']),
    validateParams(listsSchemas.listId),
    validateBody(listsSchemas.reviewList),
    asyncHandler(async (req: Request, res: Response) => {
      const { listId } = req.params as unknown as { listId: number };
      const { action, comment, slug } = req.body as {
        action: 'approve' | 'reject';
        comment?: string;
        slug?: string;
      };
      const moderatorId = req.user!.sub;

      const data = await listsService.reviewList(Number(listId), moderatorId, action, {
        comment,
        slug,
      });

      res.json({ success: true, data });
    })
  );

  // Copy list from a public share code into current user's account
  router.post(
    '/lists/copy-from-share',
    authenticateToken,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.sub;
      const code = (req.body?.code || '').toString().trim();
      const newTitle = (req.body?.title || '').toString();

      const result = await listsService.copyListFromShare(code, userId, newTitle);

      res.status(201).json({ success: true, data: result });
    })
  );

  // Public lists index
  router.get(
    '/public/lists',
    validateQuery(publicListQuerySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { limitParam, offsetParam } = parseLimitOffset(
        req.query.limit as number | undefined,
        req.query.offset as number | undefined,
        { defLimit: 20, maxLimit: 100 }
      );

      const { total, data } = await listsService.getPublicLists(limitParam, offsetParam);

      res.json({
        success: true,
        data,
        meta: {
          total,
          limit: limitParam,
          offset: offsetParam,
          hasMore: offsetParam + limitParam < total,
        },
      });
    })
  );

  // Public list detail by slug
  router.get(
    '/public/lists/:slug',
    asyncHandler(async (req: Request, res: Response) => {
      const { slug } = req.params as { slug: string };
      const data = await listsService.getPublicList(slug);
      res.json({ success: true, data });
    })
  );

  return router;
}
