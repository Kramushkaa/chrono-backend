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
      const userId = req.user?.sub || null;
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
        data.answers,
        data.questions
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
      const userId = req.user?.sub;

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
      const userId = req.user?.sub || null;

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

      // Validate timeSpent
      if (typeof data.timeSpent !== 'number' || data.timeSpent < 0 || data.timeSpent > 600000) {
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
      const userId = req.user?.sub;
      const rawLimit = parseInt(req.query.limit as string, 10);
      const rawOffset = parseInt(req.query.offset as string, 10);

      const limit = Number.isFinite(rawLimit) ? rawLimit : 30;
      const offset = Number.isFinite(rawOffset) ? rawOffset : 0;

      const result = await this.quizService.getGlobalLeaderboard(limit, offset, userId);

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
      const userId = req.user?.sub;

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
      const userId = req.user?.sub;

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

  // ============================================================================
  // Quiz Session History
  // ============================================================================

  /**
   * Get user's quiz history (all quiz types)
   * GET /api/quiz/history
   */
  getUserHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.sub;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Требуется авторизация',
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const attempts = await this.quizService.getUserQuizHistory(userId, limit);

      // Transform to match DTO
      const transformedAttempts = attempts.map(a => ({
        attemptId: a.attempt_id,
        sessionToken: a.session_token,
        quizTitle: a.quiz_title || 'Обычный квиз',
        sharedQuizId: a.shared_quiz_id,
        shareCode: a.share_code,
        isShared: a.is_shared,
        correctAnswers: a.correct_answers,
        totalQuestions: a.total_questions,
        totalTimeMs: a.total_time_ms,
        ratingPoints: Number(a.rating_points),
        createdAt: a.created_at,
        config: a.config,
      }));

      res.json({
        success: true,
        data: {
          attempts: transformedAttempts,
          total: attempts.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get detailed attempt history
   * GET /api/quiz/history/attempt/:attemptId
   */
  getAttemptDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { attemptId } = req.params;
      const userId = req.user?.sub;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Требуется авторизация',
        });
        return;
      }

      if (!attemptId) {
        res.status(400).json({
          success: false,
          error: 'Invalid attempt ID',
          message: 'ID попытки не указан',
        });
        return;
      }

      const result = await this.quizService.getAttemptDetail(parseInt(attemptId), userId);

      if (!result) {
        res.status(404).json({
          success: false,
          error: 'Attempt not found',
          message: 'Попытка не найдена',
        });
        return;
      }

      // Prepare detailed answers with full question data (including data field)
      const detailedAnswers =
        result.attempt.questions?.map(question => {
          const userAnswer = result.attempt.answers?.find(a => a.questionId === question.id);
          return {
            questionId: question.id,
            question: question.question,
            questionType: question.type,
            userAnswer: userAnswer?.answer || '',
            correctAnswer: question.correctAnswer,
            isCorrect: userAnswer?.isCorrect || false,
            timeSpent: userAnswer?.timeSpent || 0,
            explanation: question.explanation,
            data: question.data, // Include full question data for rendering
          };
        }) || [];

      res.json({
        success: true,
        data: {
          attempt: {
            attemptId: result.attempt.id,
            quizTitle: result.quizTitle || 'Обычный квиз',
            isShared: !!result.attempt.shared_quiz_id,
            shareCode: result.shareCode,
            createdAt: result.attempt.created_at,
          },
          results: {
            correctAnswers: result.attempt.correct_answers,
            totalQuestions: result.attempt.total_questions,
            totalTimeMs: result.attempt.total_time_ms,
            ratingPoints: Number(result.attempt.rating_points),
          },
          detailedAnswers,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get detailed session history (legacy, for shared quizzes)
   * GET /api/quiz/history/:sessionToken
   */
  getSessionDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionToken } = req.params;
      const userId = req.user?.sub;

      if (!sessionToken) {
        res.status(400).json({
          success: false,
          error: 'Invalid session token',
          message: 'Токен сессии не указан',
        });
        return;
      }

      const result = await this.quizService.getSessionDetail(sessionToken);

      if (!result) {
        res.status(404).json({
          success: false,
          error: 'Session not found',
          message: 'Сессия не найдена',
        });
        return;
      }

      // Check if user owns this session
      if (result.session.user_id && userId && result.session.user_id !== userId) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Нет доступа к этой сессии',
        });
        return;
      }

      // Calculate results
      const correctAnswers = result.session.answers.filter(a => a.isCorrect).length;
      const totalQuestions = result.questions.length;
      const totalTimeMs = result.session.answers.reduce((sum, a) => sum + a.timeSpent, 0);

      // Prepare detailed answers with full question data
      const detailedAnswers = result.questions.map(question => {
        const userAnswer = result.session.answers.find(a => a.questionId === question.id);
        return {
          questionId: question.id,
          question: question.question,
          questionType: question.type,
          userAnswer: userAnswer?.answer || '',
          correctAnswer: question.correctAnswer,
          isCorrect: userAnswer?.isCorrect || false,
          timeSpent: userAnswer?.timeSpent || 0,
          explanation: question.explanation,
        };
      });

      res.json({
        success: true,
        data: {
          session: {
            sessionToken: result.session.session_token,
            quizTitle: result.quizTitle,
            startedAt: result.session.started_at,
            finishedAt: result.session.finished_at!,
          },
          results: {
            correctAnswers,
            totalQuestions,
            totalTimeMs,
          },
          detailedAnswers,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
