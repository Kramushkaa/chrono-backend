import { Router } from 'express';
import { Pool } from 'pg';
import { TelegramService } from '../../services/telegramService';
import { PersonsService } from '../../services/personsService';
import { createAdminPersonRoutes } from './person.admin.routes';
import { createPublicPersonRoutes } from './person.public.routes';
import { createUserPersonRoutes } from './person.user.routes';

export function createPersonRoutes(
  pool: Pool,
  telegramService: TelegramService,
  personsService: PersonsService
) {
  const router = Router();

  // Combine all person routes
  router.use(createAdminPersonRoutes(pool, telegramService, personsService));
  router.use(createPublicPersonRoutes(pool, telegramService, personsService));
  router.use(createUserPersonRoutes(pool, telegramService, personsService));

  return router;
}
