import { Router } from 'express';
import { Pool } from 'pg';
import { TelegramService } from '../../services/telegramService';
import { createAdminPersonRoutes } from './person.admin.routes';
import { createPublicPersonRoutes } from './person.public.routes';
import { createUserPersonRoutes } from './person.user.routes';

export function createPersonRoutes(pool: Pool, telegramService: TelegramService) {
  const router = Router();

  // Combine all person routes
  router.use(createAdminPersonRoutes(pool, telegramService));
  router.use(createPublicPersonRoutes(pool, telegramService));
  router.use(createUserPersonRoutes(pool, telegramService));

  return router;
}

