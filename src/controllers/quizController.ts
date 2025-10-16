import { Request, Response, NextFunction } from 'express';
import { QuizService } from '../services/quizService';
import type {
  SaveQuizAttemptRequest,
  CreateSharedQuizRequest,
  CheckAnswerRequest,
  FinishSharedQuizRequest,
} from '@chrononinja/dto';

export class QuizController {
  private quizService: QuizService;

  constructor(quizService: QuizService) {
    this.quizService = quizService;
  }

  // ============================================================================
  // Regular Quiz Attempts
  // ============================================================================

  /**
   * Save regular quiz attempt
   * POST /api/quiz/save-result
   */
  saveQuizAttempt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.sub || null;
      const data = req.body as SaveQuizAttemptRequest;

      // Validation
      if (
        typeof data.correctAnswers !== 'number' ||
        typeof data.totalQuestions !== 'number' ||
        typeof data.totalTimeMs !== 'number'
      ) {
        res.status(400).json({
          success: false,
          error: 'Invalid request data',
          message: 'Некорректные данные запроса',
        });
        return;
      }

      if (data.correctAnswers < 0 || data.correctAnswers > data.totalQuestions) {
        res.status(400).json({
          success: false,
          error: 'Invalid answer count',
          message: 'Некорректное количество правильных ответов',
        });
        return;
      }

      const result = await this.quizService.saveQuizAttempt(
        userId,
        data.correctAnswers,
        data.totalQuestions,
        data.totalTimeMs,
        data.config,
        data.questionTypes,
        data.answers
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // Shared Quizzes
  // ============================================================================

  /**
   * Create shared quiz
   * POST /api/quiz/share
   */
  createSharedQuiz = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.sub;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Требуется авторизация для создания квиза',
        });
        return;
      }

      const data = req.body as CreateSharedQuizRequest;

      // Validation
      if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid title',
          message: 'Название квиза обязательно',
        });
        return;
      }

      if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid questions',
          message: 'Квиз должен содержать хотя бы один вопрос',
        });
        return;
      }

      if (data.questions.length > 100) {
        res.status(400).json({
          success: false,
          error: 'Too many questions',
          message: 'Максимальное количество вопросов: 100',
        });
        return;
      }

      const result = await this.quizService.createSharedQuiz(
        userId,
        data.title.trim(),
        data.description?.trim(),
        data.config,
        data.questions,
        data.creatorAttempt
      );

      // Construct share URL (will be configured on frontend)
      const shareUrl = `/quiz/${result.shareCode}`;

      res.json({
        success: true,
        data: {
          ...result,
          shareUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get shared quiz
   * GET /api/quiz/shared/:shareCode
   */
  getSharedQuiz = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { shareCode } = req.params;

      if (!shareCode) {
        res.status(400).json({
          success: false,
          error: 'Invalid share code',
          message: 'Код квиза не указан',
        });
        return;
      }

      const quiz = await this.quizService.getSharedQuiz(shareCode);

      if (!quiz) {
        res.status(404).json({
          success: false,
          error: 'Quiz not found',
          message: 'Квиз не найден',
        });
        return;
      }

      res.json({
        success: true,
        data: quiz,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Start shared quiz session
   * POST /api/quiz/shared/:shareCode/start
   */
  startSharedQuiz = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { shareCode } = req.params;
      const userId = (req as any).user?.sub || null;

      if (!shareCode) {
        res.status(400).json({
          success: false,
          error: 'Invalid share code',
          message: 'Код квиза не указан',
        });
        return;
      }

      // Get quiz to verify it exists
      const quiz = await this.quizService.getSharedQuiz(shareCode);
      if (!quiz) {
        res.status(404).json({
          success: false,
          error: 'Quiz not found',
          message: 'Квиз не найден',
        });
        return;
      }

      // Create session
      const session = await this.quizService.startQuizSession(quiz.id, userId);

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Check answer
   * POST /api/quiz/shared/:shareCode/check-answer
   */
  checkAnswer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CheckAnswerRequest;

      if (!data.sessionToken || !data.questionId) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'Некорректные данные запроса',
        });
        return;
      }

      if (typeof data.timeSpent !== 'number' || data.timeSpent < 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid time',
          message: 'Некорректное время ответа',
        });
        return;
      }

      const result = await this.quizService.checkAnswer(
        data.sessionToken,
        data.questionId,
        data.answer,
        data.timeSpent
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('Invalid or expired session') ||
          error.message.includes('already answered')
        ) {
          res.status(400).json({
            success: false,
            error: error.message,
            message: error.message,
          });
          return;
        }
      }
      next(error);
    }
  };

  /**
   * Finish shared quiz
   * POST /api/quiz/shared/:shareCode/finish
   */
  finishSharedQuiz = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as FinishSharedQuizRequest;

      if (!data.sessionToken) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'Токен сессии не указан',
        });
        return;
      }

      const result = await this.quizService.finishQuizSession(data.sessionToken);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid or expired session')) {
        res.status(400).json({
          success: false,
          error: error.message,
          message: 'Сессия недействительна или истекла',
        });
        return;
      }
      next(error);
    }
  };

  // ============================================================================
  // Leaderboards
  // ============================================================================

  /**
   * Get global leaderboard
   * GET /api/quiz/leaderboard
   */
  getGlobalLeaderboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;

      const result = await this.quizService.getGlobalLeaderboard(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user stats
   * GET /api/quiz/leaderboard/me
   */
  getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.sub;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Требуется авторизация',
        });
        return;
      }

      const stats = await this.quizService.getUserStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get shared quiz leaderboard
   * GET /api/quiz/shared/:shareCode/leaderboard
   */
  getSharedQuizLeaderboard = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { shareCode } = req.params;
      const userId = (req as any).user?.sub;

      if (!shareCode) {
        res.status(400).json({
          success: false,
          error: 'Invalid share code',
          message: 'Код квиза не указан',
        });
        return;
      }

      const result = await this.quizService.getSharedQuizLeaderboard(shareCode, userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Quiz not found') {
        res.status(404).json({
          success: false,
          error: 'Quiz not found',
          message: 'Квиз не найден',
        });
        return;
      }
      next(error);
    }
  };
}
