import { Router } from 'express';
import { Pool } from 'pg';
import { QuizController } from '../controllers/quizController';
import { QuizService } from '../services/quizService';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';

export function createQuizRoutes(pool: Pool): Router {
  const router = Router();
  const quizService = new QuizService(pool);
  const quizController = new QuizController(quizService);

  // ============================================================================
  // Regular Quiz Routes
  // ============================================================================

  // Save quiz attempt (optional auth - guests can play too, but won't be in leaderboard)
  router.post('/quiz/save-result', optionalAuthenticateToken, quizController.saveQuizAttempt);

  // ============================================================================
  // Shared Quiz Routes
  // ============================================================================

  // Create shared quiz (requires auth)
  router.post('/quiz/share', authenticateToken, quizController.createSharedQuiz);

  // Get shared quiz (public)
  router.get('/quiz/shared/:shareCode', quizController.getSharedQuiz);

  // Start shared quiz session (optional auth)
  router.post(
    '/quiz/shared/:shareCode/start',
    optionalAuthenticateToken,
    quizController.startSharedQuiz
  );

  // Check answer (public - uses session token)
  router.post('/quiz/shared/:shareCode/check-answer', quizController.checkAnswer);

  // Finish shared quiz (public - uses session token)
  router.post('/quiz/shared/:shareCode/finish', quizController.finishSharedQuiz);

  // Get shared quiz leaderboard (optional auth - to highlight user)
  router.get(
    '/quiz/shared/:shareCode/leaderboard',
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

  return router;
}
