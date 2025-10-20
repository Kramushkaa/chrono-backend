import { Request, Response, NextFunction } from 'express';
import { QuizController } from '../../controllers/quizController';
import { QuizService } from '../../services/quizService';
import type {
  SaveQuizAttemptRequest,
  CreateSharedQuizRequest,
  CheckAnswerRequest,
  FinishSharedQuizRequest,
} from '@chrononinja/dto';

// Mock QuizService
jest.mock('../../services/quizService');

describe('QuizController', () => {
  let quizController: QuizController;
  let mockQuizService: jest.Mocked<QuizService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockQuizService = {
      saveQuizAttempt: jest.fn(),
      createSharedQuiz: jest.fn(),
      getSharedQuiz: jest.fn(),
      startQuizSession: jest.fn(),
      checkAnswer: jest.fn(),
      finishQuizSession: jest.fn(),
      getGlobalLeaderboard: jest.fn(),
      getUserStats: jest.fn(),
      getSharedQuizLeaderboard: jest.fn(),
      getUserQuizHistory: jest.fn(),
      getAttemptDetail: jest.fn(),
      getSessionDetail: jest.fn(),
    } as any;

    quizController = new QuizController(mockQuizService);

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: undefined,
    } as any;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // saveQuizAttempt() tests
  // ============================================================================

  describe('saveQuizAttempt', () => {
    const validAttemptData: SaveQuizAttemptRequest = {
      correctAnswers: 8,
      totalQuestions: 10,
      totalTimeMs: 120000,
      config: { questionCount: 10 } as any,
      questionTypes: ['birthYear', 'deathYear'],
      answers: [],
      questions: [],
    };

    it('should successfully save quiz attempt with authenticated user', async () => {
      (mockRequest as any).user = { sub: 1 };
      mockRequest.body = validAttemptData;
      mockQuizService.saveQuizAttempt.mockResolvedValue({
        attemptId: 1,
        ratingPoints: 85.5,
      });

      await quizController.saveQuizAttempt(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.saveQuizAttempt).toHaveBeenCalledWith(
        1,
        8,
        10,
        120000,
        validAttemptData.config,
        validAttemptData.questionTypes,
        validAttemptData.answers,
        validAttemptData.questions
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            attemptId: 1,
            ratingPoints: 85.5,
          }),
        })
      );
    });

    it('should successfully save quiz attempt as guest', async () => {
      (mockRequest as any).user = undefined; // Guest
      mockRequest.body = validAttemptData;
      mockQuizService.saveQuizAttempt.mockResolvedValue({
        attemptId: 2,
        ratingPoints: 0, // Guests don't get rating
      });

      await quizController.saveQuizAttempt(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.saveQuizAttempt).toHaveBeenCalledWith(
        null,
        8,
        10,
        120000,
        expect.any(Object),
        expect.any(Array),
        expect.any(Array),
        expect.any(Array)
      );
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should reject invalid data types', async () => {
      mockRequest.body = {
        correctAnswers: 'eight', // Should be number
        totalQuestions: 10,
        totalTimeMs: 120000,
      };

      await quizController.saveQuizAttempt(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid request data',
        })
      );
      expect(mockQuizService.saveQuizAttempt).not.toHaveBeenCalled();
    });

    it('should reject invalid answer count', async () => {
      mockRequest.body = {
        correctAnswers: 15, // More than totalQuestions
        totalQuestions: 10,
        totalTimeMs: 120000,
      };

      await quizController.saveQuizAttempt(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid answer count',
        })
      );
    });
  });

  // ============================================================================
  // createSharedQuiz() tests
  // ============================================================================

  describe('createSharedQuiz', () => {
    const validQuizData: CreateSharedQuizRequest = {
      title: 'My Quiz',
      description: 'Test quiz',
      config: {} as any,
      questions: [
        {
          id: 'q1',
          type: 'birthYear',
          question: 'When was X born?',
          correctAnswer: '1900',
          data: {},
        },
      ],
    };

    it('should successfully create shared quiz', async () => {
      (mockRequest as any).user = { sub: 1 };
      mockRequest.body = validQuizData;
      mockQuizService.createSharedQuiz.mockResolvedValue({
        id: 10,
        shareCode: 'ABC123',
      });

      await quizController.createSharedQuiz(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.createSharedQuiz).toHaveBeenCalledWith(
        1,
        'My Quiz',
        'Test quiz',
        validQuizData.config,
        validQuizData.questions,
        undefined
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            shareCode: 'ABC123',
            shareUrl: '/quiz/ABC123',
          }),
        })
      );
    });

    it('should require authentication', async () => {
      (mockRequest as any).user = undefined;
      mockRequest.body = validQuizData;

      await quizController.createSharedQuiz(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Unauthorized',
        })
      );
      expect(mockQuizService.createSharedQuiz).not.toHaveBeenCalled();
    });

    it('should reject invalid title', async () => {
      (mockRequest as any).user = { sub: 1 };
      mockRequest.body = {
        ...validQuizData,
        title: '   ', // Empty after trim
      };

      await quizController.createSharedQuiz(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid title',
        })
      );
    });

    it('should reject too many questions', async () => {
      (mockRequest as any).user = { sub: 1 };
      mockRequest.body = {
        ...validQuizData,
        questions: Array(101).fill({ id: 'q', type: 'birthYear' }), // 101 questions
      };

      await quizController.createSharedQuiz(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Too many questions',
        })
      );
    });
  });

  // ============================================================================
  // getSharedQuiz() tests
  // ============================================================================

  describe('getSharedQuiz', () => {
    it('should successfully get shared quiz', async () => {
      mockRequest.params = { shareCode: 'ABC123' };
      mockQuizService.getSharedQuiz.mockResolvedValue({
        id: 1,
        title: 'Test Quiz',
        description: 'Test',
        shareCode: 'ABC123',
        createdBy: 1,
        createdAt: new Date(),
        config: {},
      } as any);

      await quizController.getSharedQuiz(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.getSharedQuiz).toHaveBeenCalledWith('ABC123');
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            title: 'Test Quiz',
          }),
        })
      );
    });

    it('should handle quiz not found', async () => {
      mockRequest.params = { shareCode: 'INVALID' };
      mockQuizService.getSharedQuiz.mockResolvedValue(null);

      await quizController.getSharedQuiz(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Quiz not found',
        })
      );
    });
  });

  // ============================================================================
  // startSharedQuiz() tests
  // ============================================================================

  describe('startSharedQuiz', () => {
    it('should successfully start shared quiz with authentication', async () => {
      (mockRequest as any).user = { sub: 1 };
      mockRequest.params = { shareCode: 'ABC123' };
      mockQuizService.getSharedQuiz.mockResolvedValue({ id: 1 } as any);
      mockQuizService.startQuizSession.mockResolvedValue({
        sessionToken: 'session-123',
        expiresAt: new Date(),
      });

      await quizController.startSharedQuiz(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.getSharedQuiz).toHaveBeenCalledWith('ABC123');
      expect(mockQuizService.startQuizSession).toHaveBeenCalledWith(1, 1);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            sessionToken: 'session-123',
          }),
        })
      );
    });

    it('should successfully start shared quiz as guest', async () => {
      (mockRequest as any).user = undefined;
      mockRequest.params = { shareCode: 'ABC123' };
      mockQuizService.getSharedQuiz.mockResolvedValue({ id: 1 } as any);
      mockQuizService.startQuizSession.mockResolvedValue({
        sessionToken: 'session-456',
        expiresAt: new Date(),
      });

      await quizController.startSharedQuiz(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.startQuizSession).toHaveBeenCalledWith(1, null);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should handle quiz not found', async () => {
      mockRequest.params = { shareCode: 'INVALID' };
      mockQuizService.getSharedQuiz.mockResolvedValue(null);

      await quizController.startSharedQuiz(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Quiz not found',
        })
      );
      expect(mockQuizService.startQuizSession).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // checkAnswer() tests
  // ============================================================================

  describe('checkAnswer', () => {
    const validAnswerData: CheckAnswerRequest = {
      sessionToken: 'session-123',
      questionId: 'q1',
      answer: '1900',
      timeSpent: 5000,
    };

    it('should successfully check valid answer', async () => {
      mockRequest.body = validAnswerData;
      mockQuizService.checkAnswer.mockResolvedValue({
        isCorrect: true,
      });

      await quizController.checkAnswer(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockQuizService.checkAnswer).toHaveBeenCalledWith('session-123', 'q1', '1900', 5000);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            isCorrect: true,
          }),
        })
      );
    });

    it('should handle invalid session', async () => {
      mockRequest.body = validAnswerData;
      mockQuizService.checkAnswer.mockRejectedValue(new Error('Invalid or expired session'));

      await quizController.checkAnswer(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid or expired'),
        })
      );
    });

    it('should reject invalid time', async () => {
      mockRequest.body = {
        ...validAnswerData,
        timeSpent: -100, // Negative time
      };

      await quizController.checkAnswer(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid time',
        })
      );
      expect(mockQuizService.checkAnswer).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // finishSharedQuiz() tests
  // ============================================================================

  describe('finishSharedQuiz', () => {
    it('should successfully finish shared quiz', async () => {
      mockRequest.body = { sessionToken: 'session-123' } as FinishSharedQuizRequest;
      mockQuizService.finishQuizSession.mockResolvedValue({
        attemptId: 1,
        correctAnswers: 8,
        totalQuestions: 10,
        totalTimeMs: 60000,
        detailedResults: [],
      });

      await quizController.finishSharedQuiz(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.finishQuizSession).toHaveBeenCalledWith('session-123');
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            attemptId: 1,
            correctAnswers: 8,
          }),
        })
      );
    });

    it('should handle invalid/expired session', async () => {
      mockRequest.body = { sessionToken: 'expired-session' };
      mockQuizService.finishQuizSession.mockRejectedValue(new Error('Invalid or expired session'));

      await quizController.finishSharedQuiz(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('недействительна'),
        })
      );
    });
  });

  // ============================================================================
  // getGlobalLeaderboard() tests
  // ============================================================================

  describe('getGlobalLeaderboard', () => {
    it('should get leaderboard with authenticated user', async () => {
      (mockRequest as any).user = { id: 1 };
      mockQuizService.getGlobalLeaderboard.mockResolvedValue({
        topPlayers: [
          {
            rank: 1,
            userId: 2,
            username: 'user2',
            totalRating: 1000,
            gamesPlayed: 10,
            averageScore: 85,
            bestScore: 100,
          },
        ],
        userEntry: {
          rank: 5,
          userId: 1,
          username: 'user1',
          totalRating: 500,
          gamesPlayed: 5,
          averageScore: 75,
          bestScore: 95,
        },
        totalPlayers: 100,
      });

      await quizController.getGlobalLeaderboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.getGlobalLeaderboard).toHaveBeenCalledWith(1);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            topPlayers: expect.any(Array),
            userEntry: expect.any(Object),
          }),
        })
      );
    });

    it('should get leaderboard without user (guest)', async () => {
      (mockRequest as any).user = undefined;
      mockQuizService.getGlobalLeaderboard.mockResolvedValue({
        topPlayers: [
          {
            rank: 1,
            userId: 1,
            username: 'user1',
            totalRating: 1000,
            gamesPlayed: 10,
            averageScore: 80,
            bestScore: 100,
          },
        ],
        userEntry: undefined,
        totalPlayers: 100,
      });

      await quizController.getGlobalLeaderboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.getGlobalLeaderboard).toHaveBeenCalledWith(undefined);
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getUserStats() tests
  // ============================================================================

  describe('getUserStats', () => {
    it('should successfully get user stats', async () => {
      (mockRequest as any).user = { sub: 1 };
      mockQuizService.getUserStats.mockResolvedValue({
        totalGames: 50,
        totalRating: 1500,
        averageRating: 30,
        bestRating: 50,
        averageScore: 75,
        rank: 10,
        recentAttempts: [],
      });

      await quizController.getUserStats(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockQuizService.getUserStats).toHaveBeenCalledWith(1);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalGames: 50,
          }),
        })
      );
    });

    it('should require authentication', async () => {
      (mockRequest as any).user = undefined;

      await quizController.getUserStats(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Unauthorized',
        })
      );
      expect(mockQuizService.getUserStats).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getSharedQuizLeaderboard() tests
  // ============================================================================

  describe('getSharedQuizLeaderboard', () => {
    it('should successfully get shared quiz leaderboard', async () => {
      mockRequest.params = { shareCode: 'ABC123' };
      (mockRequest as any).user = { sub: 1 };
      mockQuizService.getSharedQuizLeaderboard.mockResolvedValue({
        quizTitle: 'Test Quiz',
        entries: [
          {
            rank: 1,
            userId: 2,
            username: 'user2',
            correctAnswers: 10,
            totalQuestions: 10,
            totalTimeMs: 60000,
            completedAt: new Date().toISOString(),
          },
        ],
        userEntry: {
          rank: 3,
          userId: 1,
          username: 'user1',
          correctAnswers: 9,
          totalQuestions: 10,
          totalTimeMs: 70000,
          completedAt: new Date().toISOString(),
        },
        totalAttempts: 50,
      });

      await quizController.getSharedQuizLeaderboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.getSharedQuizLeaderboard).toHaveBeenCalledWith('ABC123', 1);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
        })
      );
    });

    it('should handle quiz not found', async () => {
      mockRequest.params = { shareCode: 'INVALID' };
      mockQuizService.getSharedQuizLeaderboard.mockRejectedValue(new Error('Quiz not found'));

      await quizController.getSharedQuizLeaderboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Quiz not found',
        })
      );
    });

    it('should work without authentication', async () => {
      mockRequest.params = { shareCode: 'ABC123' };
      (mockRequest as any).user = undefined;
      mockQuizService.getSharedQuizLeaderboard.mockResolvedValue({
        quizTitle: 'Test Quiz',
        entries: [],
        userEntry: undefined,
        totalAttempts: 0,
      });

      await quizController.getSharedQuizLeaderboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.getSharedQuizLeaderboard).toHaveBeenCalledWith('ABC123', undefined);
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getUserHistory() tests
  // ============================================================================

  describe('getUserHistory', () => {
    it('should successfully get user history with pagination', async () => {
      (mockRequest as any).user = { sub: 1 };
      mockRequest.query = { limit: '10' };
      mockQuizService.getUserQuizHistory.mockResolvedValue([
        {
          attempt_id: 1,
          session_token: 'sess-1',
          quiz_title: 'Quiz 1',
          shared_quiz_id: undefined,
          is_shared: false,
          correct_answers: 8,
          total_questions: 10,
          total_time_ms: 60000,
          rating_points: 85.5,
          created_at: new Date(),
          config: {},
        },
      ]);

      await quizController.getUserHistory(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.getUserQuizHistory).toHaveBeenCalledWith(1, 10);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            attempts: expect.any(Array),
            total: 1,
          }),
        })
      );
    });

    it('should transform data correctly', async () => {
      (mockRequest as any).user = { sub: 1 };
      mockQuizService.getUserQuizHistory.mockResolvedValue([
        {
          attempt_id: 1,
          session_token: 'sess-1',
          quiz_title: undefined,
          shared_quiz_id: undefined,
          is_shared: false,
          correct_answers: 5,
          total_questions: 10,
          total_time_ms: 30000,
          rating_points: 42.5,
          created_at: new Date(),
          config: {},
        },
      ]);

      await quizController.getUserHistory(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.data.attempts[0].quizTitle).toBe('Обычный квиз');
      expect(response.data.attempts[0].ratingPoints).toBe(42.5);
    });

    it('should require authentication', async () => {
      (mockRequest as any).user = undefined;

      await quizController.getUserHistory(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockQuizService.getUserQuizHistory).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getAttemptDetail() tests
  // ============================================================================

  describe('getAttemptDetail', () => {
    it('should successfully get attempt detail with ownership', async () => {
      (mockRequest as any).user = { sub: 1 };
      mockRequest.params = { attemptId: '10' };
      mockQuizService.getAttemptDetail.mockResolvedValue({
        attempt: {
          id: 10,
          user_id: 1,
          correct_answers: 8,
          total_questions: 10,
          total_time_ms: 60000,
          rating_points: '85.5',
          created_at: new Date(),
          shared_quiz_id: null,
          questions: [
            {
              id: 'q1',
              type: 'birthYear',
              question: 'When?',
              correctAnswer: '1900',
              data: {},
            },
          ],
          answers: [
            {
              questionId: 'q1',
              answer: '1900',
              isCorrect: true,
              timeSpent: 5000,
            },
          ],
        },
        quizTitle: 'Test Quiz',
      } as any);

      await quizController.getAttemptDetail(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.getAttemptDetail).toHaveBeenCalledWith(10, 1);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            attempt: expect.any(Object),
            results: expect.any(Object),
            detailedAnswers: expect.any(Array),
          }),
        })
      );
    });

    it('should handle attempt not found', async () => {
      (mockRequest as any).user = { sub: 1 };
      mockRequest.params = { attemptId: '999' };
      mockQuizService.getAttemptDetail.mockResolvedValue(null);

      await quizController.getAttemptDetail(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Attempt not found',
        })
      );
    });

    it('should require authentication', async () => {
      (mockRequest as any).user = undefined;
      mockRequest.params = { attemptId: '10' };

      await quizController.getAttemptDetail(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockQuizService.getAttemptDetail).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getSessionDetail() tests
  // ============================================================================

  describe('getSessionDetail', () => {
    it('should successfully get session detail', async () => {
      (mockRequest as any).user = { sub: 1 };
      mockRequest.params = { sessionToken: 'sess-123' };
      mockQuizService.getSessionDetail.mockResolvedValue({
        session: {
          session_token: 'sess-123',
          user_id: 1,
          shared_quiz_id: 1,
          started_at: new Date(),
          finished_at: new Date(),
          answers: [
            {
              questionId: 'q1',
              answer: '1900',
              isCorrect: true,
              timeSpent: 5000,
            },
          ],
        },
        questions: [
          {
            id: 'q1',
            type: 'birthYear',
            question: 'When?',
            correctAnswer: '1900',
          },
        ],
        quizTitle: 'Test Quiz',
      } as any);

      await quizController.getSessionDetail(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockQuizService.getSessionDetail).toHaveBeenCalledWith('sess-123');
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            session: expect.any(Object),
            results: expect.any(Object),
            detailedAnswers: expect.any(Array),
          }),
        })
      );
    });

    it('should enforce ownership check (403)', async () => {
      (mockRequest as any).user = { sub: 2 }; // Different user
      mockRequest.params = { sessionToken: 'sess-123' };
      mockQuizService.getSessionDetail.mockResolvedValue({
        session: {
          session_token: 'sess-123',
          user_id: 1, // Owned by user 1
          answers: [],
        },
        questions: [],
        quizTitle: 'Test',
      } as any);

      await quizController.getSessionDetail(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Forbidden',
        })
      );
    });

    it('should handle session not found', async () => {
      mockRequest.params = { sessionToken: 'invalid' };
      mockQuizService.getSessionDetail.mockResolvedValue(null);

      await quizController.getSessionDetail(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Session not found',
        })
      );
    });
  });
});
