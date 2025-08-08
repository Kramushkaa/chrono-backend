import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { 
  authenticateToken, 
  requireRoleMiddleware, 
  requirePermission,
  rateLimit,
  corsMiddleware 
} from '../middleware/auth';

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  // Применяем CORS и rate limiting ко всем маршрутам
  router.use(corsMiddleware);
  router.use(rateLimit(15 * 60 * 1000, 100)); // 100 запросов за 15 минут

  // Публичные маршруты (не требуют аутентификации)
  
  // Регистрация пользователя
  router.post('/register', async (req, res) => {
    await authController.register(req, res);
  });

  // Вход пользователя
  router.post('/login', async (req, res) => {
    await authController.login(req, res);
  });

  // Обновление токена доступа
  router.post('/refresh', async (req, res) => {
    await authController.refreshToken(req, res);
  });

  // Запрос на восстановление пароля
  router.post('/forgot-password', async (req, res) => {
    await authController.forgotPassword(req, res);
  });

  // Сброс пароля
  router.post('/reset-password', async (req, res) => {
    await authController.resetPassword(req, res);
  });

  // Подтверждение email
  router.post('/verify-email', async (req, res) => {
    await authController.verifyEmail(req, res);
  });

  // Защищенные маршруты (требуют аутентификации)
  
  // Выход пользователя
  router.post('/logout', authenticateToken, async (req, res) => {
    await authController.logout(req, res);
  });

  // Получение профиля пользователя
  router.get('/profile', authenticateToken, async (req, res) => {
    await authController.getProfile(req, res);
  });

  // Обновление профиля пользователя
  router.put('/profile', authenticateToken, async (req, res) => {
    await authController.updateProfile(req, res);
  });

  // Изменение пароля
  router.put('/change-password', authenticateToken, async (req, res) => {
    await authController.changePassword(req, res);
  });

  // Проверка статуса аутентификации
  router.get('/check', authenticateToken, async (req, res) => {
    await authController.checkAuth(req, res);
  });

  // Маршруты для администраторов
  
  // Получение списка пользователей (только для админов)
  router.get('/users', 
    authenticateToken, 
    requireRoleMiddleware(['admin']), 
    async (req, res) => {
      // TODO: Реализовать получение списка пользователей
      res.status(501).json({
        success: false,
        error: 'Not implemented',
        message: 'Функция получения списка пользователей пока не реализована'
      });
    }
  );

  // Получение пользователя по ID (только для админов)
  router.get('/users/:id', 
    authenticateToken, 
    requireRoleMiddleware(['admin']), 
    async (req, res) => {
      // TODO: Реализовать получение пользователя по ID
      res.status(501).json({
        success: false,
        error: 'Not implemented',
        message: 'Функция получения пользователя по ID пока не реализована'
      });
    }
  );

  // Обновление пользователя (только для админов)
  router.put('/users/:id', 
    authenticateToken, 
    requireRoleMiddleware(['admin']), 
    async (req, res) => {
      // TODO: Реализовать обновление пользователя
      res.status(501).json({
        success: false,
        error: 'Not implemented',
        message: 'Функция обновления пользователя пока не реализована'
      });
    }
  );

  // Удаление пользователя (только для админов)
  router.delete('/users/:id', 
    authenticateToken, 
    requireRoleMiddleware(['admin']), 
    async (req, res) => {
      // TODO: Реализовать удаление пользователя
      res.status(501).json({
        success: false,
        error: 'Not implemented',
        message: 'Функция удаления пользователя пока не реализована'
      });
    }
  );

  // Маршруты для работы с ролями и разрешениями
  
  // Получение списка ролей (только для админов)
  router.get('/roles', 
    authenticateToken, 
    requireRoleMiddleware(['admin']), 
    async (req, res) => {
      // TODO: Реализовать получение списка ролей
      res.status(501).json({
        success: false,
        error: 'Not implemented',
        message: 'Функция получения списка ролей пока не реализована'
      });
    }
  );

  // Получение списка разрешений (только для админов)
  router.get('/permissions', 
    authenticateToken, 
    requireRoleMiddleware(['admin']), 
    async (req, res) => {
      // TODO: Реализовать получение списка разрешений
      res.status(501).json({
        success: false,
        error: 'Not implemented',
        message: 'Функция получения списка разрешений пока не реализована'
      });
    }
  );

  // Маршруты для модераторов
  
  // Получение статистики пользователей (для модераторов и админов)
  router.get('/stats/users', 
    authenticateToken, 
    requireRoleMiddleware(['moderator', 'admin']), 
    async (req, res) => {
      // TODO: Реализовать получение статистики пользователей
      res.status(501).json({
        success: false,
        error: 'Not implemented',
        message: 'Функция получения статистики пользователей пока не реализована'
      });
    }
  );

  // Маршруты для проверки разрешений
  
  // Проверка разрешения пользователя
  router.get('/check-permission/:permission', 
    authenticateToken, 
    async (req, res) => {
      const { permission } = req.params;
      const userRole = req.user?.role;

      if (!userRole) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Требуется аутентификация'
        });
        return;
      }

      // TODO: Реализовать проверку разрешений через базу данных
      res.status(501).json({
        success: false,
        error: 'Not implemented',
        message: 'Функция проверки разрешений пока не реализована'
      });
    }
  );

  // Обработка ошибок 404 для неизвестных маршрутов (Express 5 совместимо)
  router.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: 'Маршрут не найден'
    });
  });

  return router;
} 