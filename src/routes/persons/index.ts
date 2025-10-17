import { Router } from 'express';
import { Pool } from 'pg';
import { TelegramService } from '../../services/telegramService';
import { PersonsService } from '../../services/personsService';
import { rateLimit } from '../../middleware/auth';
import { createAdminPersonRoutes } from './person.admin.routes';
import { createPublicPersonRoutes } from './person.public.routes';
import { createUserPersonRoutes } from './person.user.routes';

export function createPersonRoutes(
  pool: Pool,
  telegramService: TelegramService,
  personsService: PersonsService
) {
  const router = Router();

  // Rate limiting: 30 requests per minute (content mutations)
  router.use(rateLimit(1 * 60 * 1000, 30));

  // Combine all person routes
  // User routes must be registered before public routes to avoid /persons/mine being matched by /persons/:id
  router.use(createAdminPersonRoutes(pool, telegramService, personsService));
  router.use(createUserPersonRoutes(pool, telegramService, personsService));
  router.use(createPublicPersonRoutes(pool, telegramService, personsService));

  return router;
}
