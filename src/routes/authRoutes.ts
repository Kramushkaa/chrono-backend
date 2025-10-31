import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken, requireRoleMiddleware, rateLimit } from '../middleware/auth';
import { validateBody, commonSchemas } from '../middleware/validation';

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  // Применяем rate limiting ко всем маршрутам
  router.use(rateLimit(15 * 60 * 1000, 100)); // 100 запросов за 15 минут

  // Публичные маршруты (не требуют аутентификации)

  // Регистрация пользователя
  router.post('/register', validateBody(commonSchemas.register), (req, res, next) =>
    authController.register(req, res, next)
  );

  // Вход пользователя
  router.post('/login', validateBody(commonSchemas.login), (req, res, next) =>
    authController.login(req, res, next)
  );

  // Обновление токена доступа
  router.post('/refresh', (req, res, next) => authController.refreshToken(req, res, next));

  // Запрос на восстановление пароля
  router.post('/forgot-password', (req, res, next) =>
    authController.forgotPassword(req, res, next)
  );

  // Сброс пароля
  router.post('/reset-password', (req, res, next) => authController.resetPassword(req, res, next));

  // Подтверждение email
  router.post('/verify-email', (req, res, next) => authController.verifyEmail(req, res, next));
  router.get('/verify-email', (req, res, next) => authController.verifyEmail(req, res, next));

  // Повторная отправка письма подтверждения
  router.post('/resend-verification', authenticateToken, (req, res, next) =>
    authController.resendVerification(req, res, next)
  );

  // Защищенные маршруты (требуют аутентификации)

  // Выход пользователя
  router.post('/logout', authenticateToken, (req, res, next) =>
    authController.logout(req, res, next)
  );

  // Получение профиля пользователя
  router.get('/profile', authenticateToken, (req, res, next) =>
    authController.getProfile(req, res, next)
  );

  // Обновление профиля пользователя
  router.put('/profile', authenticateToken, (req, res, next) =>
    authController.updateProfile(req, res, next)
  );

  // Изменение пароля
  router.put(
    '/change-password',
    authenticateToken,
    validateBody(commonSchemas.changePassword),
    (req, res, next) => authController.changePassword(req, res, next)
  );

  // Проверка статуса аутентификации
  router.get('/check', authenticateToken, (req, res, next) =>
    authController.checkAuth(req, res, next)
  );

  // ============================================================================
  // Admin Routes - User Management
  // ============================================================================

  // Получение списка пользователей (только для админов)
  router.get('/users', authenticateToken, requireRoleMiddleware(['admin']), (req, res, next) =>
    authController.getAllUsers(req, res, next)
  );

  // Получение пользователя по ID (только для админов)
  router.get(
    '/users/:id',
    authenticateToken,
    requireRoleMiddleware(['admin']),
    (req, res, next) => authController.getUserById(req, res, next)
  );

  // Обновление пользователя (только для админов)
  router.put(
    '/users/:id',
    authenticateToken,
    requireRoleMiddleware(['admin']),
    (req, res, next) => authController.updateUserById(req, res, next)
  );

  // Деактивация пользователя (только для админов)
  router.delete(
    '/users/:id',
    authenticateToken,
    requireRoleMiddleware(['admin']),
    (req, res, next) => authController.deactivateUser(req, res, next)
  );

  // ============================================================================
  // Admin Routes - Roles & Permissions
  // ============================================================================

  // Получение списка ролей (только для админов)
  router.get('/roles', authenticateToken, requireRoleMiddleware(['admin']), (req, res, next) =>
    authController.getRoles(req, res, next)
  );

  // Получение списка разрешений (только для админов)
  router.get(
    '/permissions',
    authenticateToken,
    requireRoleMiddleware(['admin']),
    (req, res, next) => authController.getPermissions(req, res, next)
  );

  // ============================================================================
  // Moderator/Admin Routes - Statistics
  // ============================================================================

  // Получение статистики пользователей (для модераторов и админов)
  router.get(
    '/stats/users',
    authenticateToken,
    requireRoleMiddleware(['moderator', 'admin']),
    (req, res, next) => authController.getUserStats(req, res, next)
  );

  // ============================================================================
  // Permission Check Routes (Not Implemented Yet)
  // ============================================================================

  // Проверка разрешения пользователя
  router.get('/check-permission/:permission', authenticateToken, async (req, res) => {
    const { permission: _permission } = req.params;
    const userRole = req.user?.role;

    if (!userRole) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Требуется аутентификация',
      });
      return;
    }

    res.status(501).json({
      success: false,
      error: 'Not implemented',
      message: 'Функция проверки разрешений пока не реализована',
    });
  });

  // Обработка ошибок 404 для неизвестных маршрутов (Express 5 совместимо)
  router.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: 'Маршрут не найден',
    });
  });

  return router;
}
