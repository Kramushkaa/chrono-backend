import { Router } from 'express';
import { Pool } from 'pg';
import { QuizController } from '../controllers/quizController';
import { QuizService } from '../services/quizService';
import { authenticateToken, optionalAuthenticateToken, rateLimit } from '../middleware/auth';
import { validateBody, validateParams, quizSchemas } from '../middleware/validation';

export function createQuizRoutes(pool: Pool): Router {
  const router = Router();
  const quizService = new QuizService(pool);
  const quizController = new QuizController(quizService);

  // Rate limiting: 50 requests per 5 minutes (gameplay protection)
  router.use(rateLimit(5 * 60 * 1000, 50));

  // ============================================================================
  // Regular Quiz Routes
  // ============================================================================

  // Save quiz attempt (optional auth - guests can play too, but won't be in leaderboard)
  router.post(
    '/quiz/save-result',
    optionalAuthenticateToken,
    validateBody(quizSchemas.saveQuizAttempt),
    quizController.saveQuizAttempt
  );

  // ============================================================================
  // Shared Quiz Routes
  // ============================================================================

  // Create shared quiz (requires auth)
  router.post('/quiz/share', authenticateToken, quizController.createSharedQuiz);

  // Get shared quiz (public)
  router.get(
    '/quiz/shared/:shareCode',
    validateParams(quizSchemas.shareCode),
    quizController.getSharedQuiz
  );

  // Start shared quiz session (optional auth)
  router.post(
    '/quiz/shared/:shareCode/start',
    validateParams(quizSchemas.shareCode),
    optionalAuthenticateToken,
    quizController.startSharedQuiz
  );

  // Check answer (public - uses session token)
  router.post(
    '/quiz/shared/:shareCode/check-answer',
    validateParams(quizSchemas.shareCode),
    validateBody(quizSchemas.checkAnswer),
    quizController.checkAnswer
  );

  // Finish shared quiz (public - uses session token)
  router.post(
    '/quiz/shared/:shareCode/finish',
    validateParams(quizSchemas.shareCode),
    validateBody(quizSchemas.finishQuiz),
    quizController.finishSharedQuiz
  );

  // Get shared quiz leaderboard (optional auth - to highlight user)
  router.get(
    '/quiz/shared/:shareCode/leaderboard',
    validateParams(quizSchemas.shareCode),
    optionalAuthenticateToken,
    quizController.getSharedQuizLeaderboard
  );

  // ============================================================================
  // Leaderboard Routes
  // ============================================================================

  // Get global leaderboard (optional auth - to highlight user)
  router.get('/quiz/leaderboard', optionalAuthenticateToken, quizController.getGlobalLeaderboard);

  // Get user stats (requires auth)
  router.get('/quiz/leaderboard/me', authenticateToken, quizController.getUserStats);

  // ============================================================================
  // Quiz History Routes
  // ============================================================================

  // Get user's quiz history (all types, requires auth)
  router.get('/quiz/history', authenticateToken, quizController.getUserHistory);

  // Get detailed attempt history by ID (requires auth, checks ownership)
  router.get(
    '/quiz/history/attempt/:attemptId',
    validateParams(quizSchemas.attemptId),
    authenticateToken,
    quizController.getAttemptDetail
  );

  // Get detailed session history (legacy, for shared quizzes, requires auth)
  router.get(
    '/quiz/history/:sessionToken',
    validateParams(quizSchemas.sessionToken),
    authenticateToken,
    quizController.getSessionDetail
  );

  return router;
}
