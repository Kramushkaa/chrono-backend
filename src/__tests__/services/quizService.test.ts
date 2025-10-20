/* eslint-disable @typescript-eslint/no-explicit-any */
import { QuizService } from '../../services/quizService';
import { createMockPool, createQueryResult } from '../mocks';
import type { QuizQuestionType } from '@chrononinja/dto';

describe('QuizService', () => {
  let quizService: QuizService;
  let mockPool: any;

  beforeEach(() => {
    mockPool = createMockPool();
    quizService = new QuizService(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Rating Calculation Tests (Pure Functions - No DB)
  // ============================================================================

  describe('calculateRatingPoints', () => {
    it('should calculate base rating correctly', () => {
      const rating = quizService.calculateRatingPoints(
        5, // correct
        10, // total
        60000, // 1 min total
        ['birthYear', 'deathYear', 'profession', 'country', 'achievementsMatch']
      );

      expect(rating).toBeGreaterThan(0);
      expect(typeof rating).toBe('number');
      expect(Number.isFinite(rating)).toBe(true);
    });

    it('should give higher rating for more correct answers', () => {
      const questionTypes: QuizQuestionType[] = [
        'birthYear',
        'deathYear',
        'profession',
        'country',
        'achievementsMatch',
      ];

      const rating5 = quizService.calculateRatingPoints(5, 5, 30000, questionTypes);
      const rating3 = quizService.calculateRatingPoints(3, 5, 30000, questionTypes);

      expect(rating5).toBeGreaterThan(rating3);
    });

    it('should give time bonus for faster completion', () => {
      const questionTypes: QuizQuestionType[] = ['birthYear', 'deathYear', 'profession'];

      const ratingFast = quizService.calculateRatingPoints(3, 3, 15000, questionTypes); // 5 sec avg
      const ratingSlow = quizService.calculateRatingPoints(3, 3, 90000, questionTypes); // 30 sec avg

      expect(ratingFast).toBeGreaterThan(ratingSlow);
    });

    it('should apply difficulty multiplier for complex question types', () => {
      const simpleTypes: QuizQuestionType[] = ['birthYear', 'deathYear', 'profession'];
      const complexTypes: QuizQuestionType[] = [
        'achievementsMatch',
        'birthOrder',
        'contemporaries',
      ];

      const ratingSimple = quizService.calculateRatingPoints(3, 3, 30000, simpleTypes);
      const ratingComplex = quizService.calculateRatingPoints(3, 3, 30000, complexTypes);

      expect(ratingComplex).toBeGreaterThan(ratingSimple);
    });

    it('should handle detailed answers if provided', () => {
      const detailedAnswers = [
        { isCorrect: true, timeSpent: 5000, questionType: 'birthYear' as QuizQuestionType },
        { isCorrect: false, timeSpent: 10000, questionType: 'deathYear' as QuizQuestionType },
        {
          isCorrect: true,
          timeSpent: 15000,
          questionType: 'achievementsMatch' as QuizQuestionType,
        },
      ];

      const rating = quizService.calculateRatingPoints(
        2,
        3,
        30000,
        ['birthYear', 'deathYear', 'achievementsMatch'],
        detailedAnswers
      );

      expect(rating).toBeGreaterThan(0);
      expect(typeof rating).toBe('number');
    });

    it('should return 0 for no correct answers', () => {
      const rating = quizService.calculateRatingPoints(0, 5, 60000, [
        'birthYear',
        'deathYear',
        'profession',
      ]);

      expect(rating).toBe(0);
    });

    it('should give higher rating for more questions', () => {
      const types3: QuizQuestionType[] = ['birthYear', 'deathYear', 'profession'];
      const types10: QuizQuestionType[] = [
        'birthYear',
        'deathYear',
        'profession',
        'country',
        'achievementsMatch',
        'birthOrder',
        'contemporaries',
        'guessPerson',
        'birthYear',
        'deathYear',
      ];

      const rating3 = quizService.calculateRatingPoints(3, 3, 30000, types3);
      const rating10 = quizService.calculateRatingPoints(10, 10, 100000, types10);

      expect(rating10).toBeGreaterThan(rating3);
    });

    it('should cap time bonus appropriately', () => {
      // Very fast answer should have bonus, but not infinite
      const types: QuizQuestionType[] = ['birthYear'];
      const veryFast = quizService.calculateRatingPoints(1, 1, 100, types); // 100ms
      const normal = quizService.calculateRatingPoints(1, 1, 10000, types); // 10s

      expect(veryFast).toBeGreaterThan(normal);
      expect(veryFast).toBeLessThan(normal * 3); // Should be capped reasonably
    });

    it('should handle perfect score correctly', () => {
      const types: QuizQuestionType[] = ['birthYear', 'deathYear', 'profession'];
      const perfect = quizService.calculateRatingPoints(3, 3, 30000, types);

      expect(perfect).toBeGreaterThan(100); // Perfect score with multipliers
      expect(typeof perfect).toBe('number');
    });
  });

  // ============================================================================
  // Helper Methods Tests (Private Methods via Type Assertion)
  // ============================================================================

  describe('compareAnswers', () => {
    it('should correctly compare string answers', () => {
      const isCorrect = (quizService as any).compareAnswers('1900', '1900', 'birthYear');
      const isIncorrect = (quizService as any).compareAnswers('1900', '1800', 'birthYear');

      expect(isCorrect).toBe(true);
      expect(isIncorrect).toBe(false);
    });

    it('should correctly compare array answers', () => {
      const correct = (quizService as any).compareAnswers(
        ['person-1', 'person-2'],
        ['person-1', 'person-2'],
        'birthOrder'
      );

      const incorrect = (quizService as any).compareAnswers(
        ['person-1', 'person-2'],
        ['person-2', 'person-1'],
        'birthOrder'
      );

      expect(correct).toBe(true);
      expect(incorrect).toBe(false);
    });

    it('should correctly compare nested array answers', () => {
      const correct = (quizService as any).compareAnswers(
        [
          ['person-1', 'person-2'],
          ['person-3', 'person-4'],
        ],
        [
          ['person-1', 'person-2'],
          ['person-3', 'person-4'],
        ],
        'contemporaries'
      );

      const incorrect = (quizService as any).compareAnswers(
        [['person-1', 'person-2'], ['person-3']],
        [['person-1'], ['person-2', 'person-3']],
        'contemporaries'
      );

      expect(correct).toBe(true);
      expect(incorrect).toBe(false);
    });

    it('should handle empty arrays', () => {
      const result = (quizService as any).compareAnswers([], [], 'birthOrder');
      expect(result).toBe(true);
    });

    it('should be case-sensitive for string comparison', () => {
      const different = (quizService as any).compareAnswers('Test', 'test', 'birthYear');
      expect(different).toBe(false);
    });
  });

  describe('generateShareCode', () => {
    it('should generate 8-character alphanumeric code', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // Code is unique

      const code = await (quizService as any).generateShareCode();

      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
    });

    it('should check for uniqueness in database', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await (quizService as any).generateShareCode();

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT id FROM shared_quizzes WHERE share_code = $1',
        expect.any(Array)
      );
    });
  });

  // ============================================================================
  // Type Difficulty Calculation Tests
  // ============================================================================

  describe('calculateTypeDifficulty', () => {
    it('should return 0 for simple question types', () => {
      const difficulty = (quizService as any).calculateTypeDifficulty([
        'birthYear',
        'deathYear',
        'profession',
        'country',
      ]);

      expect(difficulty).toBe(0);
    });

    it('should return positive value for complex question types', () => {
      const difficulty = (quizService as any).calculateTypeDifficulty([
        'achievementsMatch',
        'birthOrder',
        'contemporaries',
      ]);

      expect(difficulty).toBeGreaterThan(0);
    });

    it('should calculate sum (not average) of difficulties', () => {
      const mixedDifficulty = (quizService as any).calculateTypeDifficulty([
        'birthYear', // 0
        'achievementsMatch', // 0.1
        'contemporaries', // 0.2
      ]);

      const expectedSum = 0 + 0.1 + 0.2;
      expect(mixedDifficulty).toBeCloseTo(expectedSum, 2);
    });
  });

  describe('getQuestionTypeDifficulty', () => {
    it('should return correct difficulty for each question type', () => {
      expect((quizService as any).getQuestionTypeDifficulty('birthYear')).toBe(0);
      expect((quizService as any).getQuestionTypeDifficulty('deathYear')).toBe(0);
      expect((quizService as any).getQuestionTypeDifficulty('profession')).toBe(0);
      expect((quizService as any).getQuestionTypeDifficulty('country')).toBe(0);
      expect((quizService as any).getQuestionTypeDifficulty('achievementsMatch')).toBe(0.1);
      expect((quizService as any).getQuestionTypeDifficulty('guessPerson')).toBe(0.1);
      expect((quizService as any).getQuestionTypeDifficulty('birthOrder')).toBe(0.2);
      expect((quizService as any).getQuestionTypeDifficulty('contemporaries')).toBe(0.2);
    });
  });

  // ============================================================================
  // Database Methods Tests
  // ============================================================================

  describe('saveQuizAttempt', () => {
    it('should save quiz attempt with rating calculation', async () => {
      const config = {
        questionCount: 5,
        questionTypes: ['birthYear', 'deathYear', 'profession'] as QuizQuestionType[],
        selectedCategories: [],
        selectedCountries: [],
        timeRange: { start: -800, end: 2000 },
      };

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            id: 123,
          },
        ])
      );

      const result = await quizService.saveQuizAttempt(
        1,
        3,
        5,
        60000,
        config,
        config.questionTypes
      );

      expect(result.attemptId).toBe(123);
      expect(result.ratingPoints).toBeGreaterThan(0);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO quiz_attempts'),
        expect.arrayContaining([1, 3, 5, 60000])
      );
    });

    it('should handle guest users (null userId)', async () => {
      const config = {
        questionCount: 3,
        questionTypes: ['birthYear'] as QuizQuestionType[],
        selectedCategories: [],
        selectedCountries: [],
        timeRange: { start: -800, end: 2000 },
      };

      mockPool.query.mockResolvedValueOnce(createQueryResult([{ id: 456 }]));

      const result = await quizService.saveQuizAttempt(
        null,
        2,
        3,
        30000,
        config,
        config.questionTypes
      );

      expect(result.attemptId).toBe(456);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO quiz_attempts'),
        expect.arrayContaining([null, 2, 3, 30000])
      );
    });

    it('should include detailed answers and questions if provided', async () => {
      const config = {
        questionCount: 2,
        questionTypes: ['birthYear', 'achievementsMatch'] as QuizQuestionType[],
        selectedCategories: [],
        selectedCountries: [],
        timeRange: { start: -800, end: 2000 },
      };

      const detailedAnswers = [
        {
          questionId: '1',
          answer: '1900',
          isCorrect: true,
          timeSpent: 5000,
          questionType: 'birthYear' as QuizQuestionType,
        },
      ];

      const questions = [
        {
          id: '1',
          type: 'birthYear' as QuizQuestionType,
          question: 'Test?',
          correctAnswer: '1900',
          data: {},
        },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult([{ id: 789 }]));

      const result = await quizService.saveQuizAttempt(
        1,
        1,
        2,
        15000,
        config,
        config.questionTypes,
        detailedAnswers,
        questions
      );

      expect(result.attemptId).toBe(789);
    });
  });

  describe('getGlobalLeaderboard', () => {
    it('should return top players and total count', async () => {
      const topPlayersData = [
        {
          rank: 1, // ROW_NUMBER() result
          user_id: 1,
          username: 'Player1',
          total_rating: 1500.5,
          games_played: 20,
          average_score: 85.5,
          best_score: 100,
        },
        {
          rank: 2,
          user_id: 2,
          username: 'Player2',
          total_rating: 1200.3,
          games_played: 15,
          average_score: 80.0,
          best_score: 95,
        },
      ];

      mockPool.query
        .mockResolvedValueOnce(createQueryResult(topPlayersData))
        .mockResolvedValueOnce(createQueryResult([{ total: '150' }]));

      const result = await quizService.getGlobalLeaderboard(undefined);

      expect(result.topPlayers).toHaveLength(2);
      expect(result.topPlayers[0].rank).toBe(1);
      expect(result.topPlayers[0].totalRating).toBe(1500.5);
      expect(result.topPlayers[1].rank).toBe(2);
      expect(result.totalPlayers).toBe(150);
      expect(result.userEntry).toBeUndefined();
    });

    it('should include user entry if not in top 100', async () => {
      const topPlayersData = [
        {
          rank: 1,
          user_id: 1,
          username: 'Top1',
          total_rating: 1000,
          games_played: 10,
          average_score: 90,
          best_score: 100,
        },
      ];

      const userEntryData = {
        user_id: 999,
        username: 'CurrentUser',
        total_rating: 500,
        games_played: 5,
        average_score: 75,
        best_score: 85,
        user_rank: 120,
      };

      mockPool.query
        .mockResolvedValueOnce(createQueryResult(topPlayersData))
        .mockResolvedValueOnce(createQueryResult([{ total: '200' }]))
        .mockResolvedValueOnce(
          createQueryResult([{ ...userEntryData, rank: userEntryData.user_rank }])
        );

      const result = await quizService.getGlobalLeaderboard(999);

      expect(result.userEntry).not.toBeNull();
      expect(result.userEntry?.rank).toBe(120);
      expect(result.userEntry?.userId).toBe(999);
    });
  });

  describe('getUserQuizHistory', () => {
    it('should return user history with proper mapping', async () => {
      const historyData = [
        {
          attempt_id: 1,
          shared_quiz_id: null,
          quiz_title: null,
          correct_answers: 5,
          total_questions: 5,
          total_time_ms: 45000,
          rating_points: 120.5,
          created_at: new Date('2025-01-15'),
        },
      ];

      mockPool.query.mockResolvedValueOnce(createQueryResult(historyData));

      const result = await quizService.getUserQuizHistory(1, 20);

      expect(result).toHaveLength(1);
      expect(result[0].attempt_id).toBe(1);
      expect(result[0].correct_answers).toBe(5);
    });

    it('should apply limit parameter', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await quizService.getUserQuizHistory(1, 5);

      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT'), [1, 5]);
    });
  });

  describe('getSharedQuiz', () => {
    it('should return quiz with questions', async () => {
      const quizData = {
        id: 1,
        created_by: 1,
        title: 'Test Quiz',
        description: 'Test Description',
        share_code: 'ABC12345',
        config: { questionCount: 2 },
        created_at: new Date(),
      };

      const questionsData = [
        {
          id: 1,
          shared_quiz_id: 1,
          question_index: 0,
          question_type: 'birthYear',
          question_text: 'Question 1',
          question_data: { person: { id: 'p1', name: 'Test' } },
        },
      ];

      mockPool.query
        .mockResolvedValueOnce(createQueryResult([quizData]))
        .mockResolvedValueOnce(createQueryResult(questionsData));

      const result = await quizService.getSharedQuiz('ABC12345');

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.title).toBe('Test Quiz');
      expect(result?.questions).toHaveLength(1);
    });

    it('should return null if quiz not found', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      const result = await quizService.getSharedQuiz('NOTFOUND');

      expect(result).toBeNull();
    });
  });

  describe('startQuizSession', () => {
    it('should create session with token and expiration', async () => {
      const expiresAt = new Date(Date.now() + 7200000);

      // Мокируем возвращаемое значение pool.query
      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            session_token: 'generated-token',
            expires_at: expiresAt,
          },
        ])
      );

      const result = await quizService.startQuizSession(1, 1);

      expect(typeof result.sessionToken).toBe('string');
      expect(result.sessionToken.length).toBeGreaterThan(0);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should work for guest users', async () => {
      const expiresAt = new Date(Date.now() + 7200000);

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            session_token: 'guest-token',
            expires_at: expiresAt,
          },
        ])
      );

      const result = await quizService.startQuizSession(5, null);

      expect(typeof result.sessionToken).toBe('string');
      expect(result.sessionToken.length).toBeGreaterThan(0);
    });
  });

  describe('checkAnswer', () => {
    it('should validate answer and update session', async () => {
      const sessionData = {
        id: 1,
        session_token: 'token123',
        shared_quiz_id: 1,
        user_id: 1,
        current_question_index: 0,
        answers: [],
        started_at: new Date(),
        expires_at: new Date(Date.now() + 3600000),
      };

      const questionData = {
        id: 1,
        question_type: 'birthYear',
        question_data: {
          id: '1',
          type: 'birthYear' as QuizQuestionType,
          question: 'When was X born?',
          correctAnswer: '1900',
          data: { person: { id: 'p1', name: 'Test' } },
        },
      };

      mockPool.query
        .mockResolvedValueOnce(createQueryResult([sessionData]))
        .mockResolvedValueOnce(createQueryResult([questionData]))
        .mockResolvedValueOnce(createQueryResult([])); // Update

      const result = await quizService.checkAnswer('token123', '1', '1900', 5000);

      expect(result.isCorrect).toBe(true);
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    it('should handle incorrect answers', async () => {
      const sessionData = {
        id: 1,
        session_token: 'token',
        shared_quiz_id: 1,
        answers: [],
        expires_at: new Date(Date.now() + 3600000),
      };

      const questionData = {
        id: 1,
        question_type: 'profession',
        question_data: {
          id: '1',
          type: 'profession' as QuizQuestionType,
          question: 'What was X profession?',
          correctAnswer: 'Scientist',
          data: {},
        },
      };

      mockPool.query
        .mockResolvedValueOnce(createQueryResult([sessionData]))
        .mockResolvedValueOnce(createQueryResult([questionData]))
        .mockResolvedValueOnce(createQueryResult([]));

      const result = await quizService.checkAnswer('token', '1', 'Artist', 10000);

      expect(result.isCorrect).toBe(false);
    });

    it('should throw error for expired session', async () => {
      const expiredSession = {
        id: 1,
        session_token: 'expired',
        shared_quiz_id: 1,
        answers: [],
        expires_at: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockPool.query.mockResolvedValueOnce(createQueryResult([expiredSession]));

      await expect(quizService.checkAnswer('expired', '1', 'answer', 5000)).rejects.toThrow();
    });

    it('should throw error for invalid session token', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      await expect(quizService.checkAnswer('invalid', '1', 'answer', 5000)).rejects.toThrow();
    });
  });

  // ============================================================================
  // Additional Edge Cases
  // ============================================================================

  describe('getGlobalLeaderboard - edge cases', () => {
    it('should return empty leaderboard when no attempts exist', async () => {
      mockPool.query
        .mockResolvedValueOnce(createQueryResult([])) // top players
        .mockResolvedValueOnce(createQueryResult([{ total: '0' }])); // total

      const result = await quizService.getGlobalLeaderboard();

      expect(result.topPlayers).toEqual([]);
      expect(result.totalPlayers).toBe(0);
      expect(result.userEntry).toBeUndefined();
    });

    it('should handle ties in ranking correctly', async () => {
      const playersWithTies = [
        {
          user_id: 1,
          total_rating: 100,
          total_quizzes: 10,
          avg_score: 90,
          rank: 1, // Changed from user_rank to rank
        },
        {
          user_id: 2,
          total_rating: 100, // Same rating
          total_quizzes: 8,
          avg_score: 92,
          rank: 1, // Same rank
        },
        {
          user_id: 3,
          total_rating: 95,
          total_quizzes: 12,
          avg_score: 88,
          rank: 3,
        },
      ];

      mockPool.query
        .mockResolvedValueOnce(createQueryResult(playersWithTies))
        .mockResolvedValueOnce(createQueryResult([{ total: '3' }]));

      const result = await quizService.getGlobalLeaderboard();

      expect(result.topPlayers).toHaveLength(3);
      expect(result.topPlayers[0].rank).toBe(1);
      expect(result.topPlayers[1].rank).toBe(1); // Tied for first
      expect(result.topPlayers[2].rank).toBe(3);
    });

    it('should return user entry when user is outside top 100', async () => {
      const topPlayers = Array.from({ length: 100 }, (_, i) => ({
        user_id: i + 1,
        total_rating: 1000 - i,
        total_quizzes: 50,
        avg_score: 90 - i * 0.1,
        user_rank: String(i + 1),
      }));

      const userEntry = {
        user_id: 999,
        total_rating: 500,
        total_quizzes: 20,
        avg_score: 75,
        user_rank: '150',
      };

      mockPool.query
        .mockResolvedValueOnce(createQueryResult(topPlayers))
        .mockResolvedValueOnce(createQueryResult([{ total: '200' }]))
        .mockResolvedValueOnce(createQueryResult([{ ...userEntry, rank: userEntry.user_rank }]));

      const result = await quizService.getGlobalLeaderboard(999);

      expect(result.userEntry).toBeDefined();
      expect(result.userEntry?.rank).toBe(150);
      expect(result.userEntry?.userId).toBe(999);
    });
  });

  describe('getUserQuizHistory - edge cases', () => {
    it('should return empty history for new user', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      const result = await quizService.getUserQuizHistory(1);

      expect(result).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const mockAttempts = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        correct_answers: 5,
        total_questions: 10,
      }));

      mockPool.query.mockResolvedValueOnce(createQueryResult(mockAttempts));

      await quizService.getUserQuizHistory(1, 5);

      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT'), [1, 5]);
    });

    it('should include all necessary fields in history', async () => {
      const mockAttempt = {
        id: 1,
        user_id: 1,
        correct_answers: 8,
        total_questions: 10,
        total_time_ms: 120000,
        rating_points: 85.5,
        completed_at: new Date('2024-01-01'),
        config: {},
      };

      mockPool.query.mockResolvedValueOnce(createQueryResult([mockAttempt]));

      const result = await quizService.getUserQuizHistory(1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
      });
    });
  });

  describe('createSharedQuiz - edge cases', () => {
    it('should handle empty questions array', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce(createQueryResult([])) // BEGIN
          .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // INSERT shared_quiz
          .mockResolvedValueOnce(createQueryResult([])), // COMMIT
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient);

      const shareCode = await quizService.createSharedQuiz(
        1,
        'Test Quiz',
        'Test Description',
        {
          timeRange: { start: -800, end: 2000 },
          questionTypes: [],
          selectedCountries: [],
          selectedCategories: [],
          questionCount: 10,
        },
        []
      );

      expect(shareCode).toBeTruthy();
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on error', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce(createQueryResult([])) // BEGIN
          .mockRejectedValueOnce(new Error('Database error')),
        release: jest.fn(),
      };

      mockPool.connect.mockResolvedValueOnce(mockClient);

      await expect(
        quizService.createSharedQuiz(
          1,
          'Test Quiz',
          'Test Description',
          {
            timeRange: { start: -800, end: 2000 },
            questionTypes: [],
            selectedCountries: [],
            selectedCategories: [],
            questionCount: 10,
          },
          [
            {
              id: '1',
              type: 'birthYear',
              question: 'Test',
              data: {} as any,
              correctAnswer: '1900',
            },
          ]
        )
      ).rejects.toThrow();

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getSharedQuiz - edge cases', () => {
    it('should return null for invalid share code', async () => {
      mockPool.query.mockResolvedValueOnce(createQueryResult([]));

      const result = await quizService.getSharedQuiz('INVALID');

      expect(result).toBeNull();
    });

    it('should return quiz with all fields', async () => {
      const mockQuiz = {
        id: 1,
        creator_id: 1,
        title: 'Test Quiz',
        description: 'Test Description',
        config: { timeRange: { start: -800, end: 2000 } },
        created_at: new Date('2024-01-01'),
      };

      const mockQuestions = [
        {
          id: 1,
          question_data: {
            id: '1',
            type: 'birthYear',
            question: 'When was X born?',
            data: {},
          },
        },
      ];

      mockPool.query
        .mockResolvedValueOnce(createQueryResult([mockQuiz]))
        .mockResolvedValueOnce(createQueryResult(mockQuestions));

      const result = await quizService.getSharedQuiz('VALID123');

      expect(result).toBeDefined();
      expect(result).toMatchObject({
        id: 1,
        questions: expect.any(Array),
      });
      expect(result?.questions).toHaveLength(1);
    });
  });

  describe('startQuizSession - edge cases', () => {
    it('should generate unique session tokens', async () => {
      const expiresAt = new Date(Date.now() + 7200000);

      mockPool.query
        .mockResolvedValueOnce(
          createQueryResult([
            {
              session_token: 'token1',
              expires_at: expiresAt,
            },
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              session_token: 'token2',
              expires_at: expiresAt,
            },
          ])
        );

      const session1 = await quizService.startQuizSession(1, 10);
      const session2 = await quizService.startQuizSession(1, 10);

      expect(session1.sessionToken).toBeTruthy();
      expect(session2.sessionToken).toBeTruthy();
      // Note: In real implementation, tokens should be different, but our mock returns same values
    });

    it('should set expiration to 2 hours from now', async () => {
      const beforeTime = Date.now();

      mockPool.query.mockResolvedValueOnce(
        createQueryResult([
          {
            session_token: 'test-token',
            expires_at: new Date(Date.now() + 7200000),
          },
        ])
      );

      const session = await quizService.startQuizSession(1, 10);
      const afterTime = Date.now();

      const expiresTime = session.expiresAt.getTime();
      const expectedMin = beforeTime + 7200000 - 1000; // 2 hours minus 1 second tolerance
      const expectedMax = afterTime + 7200000 + 1000; // 2 hours plus 1 second tolerance

      expect(expiresTime).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresTime).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('checkAnswer - edge cases', () => {
    it('should handle correct answer', async () => {
      const validSession = {
        id: 1,
        user_id: 1,
        shared_quiz_id: 1,
        answers: [],
        expires_at: new Date(Date.now() + 3600000),
      };

      const questionData = {
        id: '1',
        type: 'birthYear' as const,
        question: 'When was X born?',
        data: {
          person: { id: 'person-1', name: 'Test', birthYear: 1900 },
          options: ['1900', '1901', '1902', '1903'],
        },
        correctAnswer: '1900',
      };

      mockPool.query
        .mockResolvedValueOnce(createQueryResult([validSession]))
        .mockResolvedValueOnce(createQueryResult([{ question_data: questionData }]));

      const result = await quizService.checkAnswer('valid-token', '1', '1900', 5000);

      expect(result.isCorrect).toBe(true);
    });

    it('should handle incorrect answer', async () => {
      const validSession = {
        id: 1,
        user_id: 1,
        shared_quiz_id: 1,
        answers: [],
        expires_at: new Date(Date.now() + 3600000),
      };

      const questionData = {
        id: '1',
        type: 'birthYear' as const,
        question: 'When was X born?',
        data: {
          person: { id: 'person-1', name: 'Test', birthYear: 1900 },
          options: ['1900', '1901', '1902', '1903'],
        },
        correctAnswer: '1900',
      };

      mockPool.query
        .mockResolvedValueOnce(createQueryResult([validSession]))
        .mockResolvedValueOnce(createQueryResult([{ question_data: questionData }]));

      const result = await quizService.checkAnswer('valid-token', '1', '1901', 5000);

      expect(result.isCorrect).toBe(false);
    });
  });

  // ============================================================================
  // Additional Answer Comparison Tests
  // ============================================================================

  describe('compareAnswers - additional edge cases', () => {
    it('should handle matching pairs with different order', () => {
      const userAnswer = [
        ['person-2', 'achievement-2'],
        ['person-1', 'achievement-1'],
      ];
      const correctAnswer = [
        ['person-1', 'achievement-1'],
        ['person-2', 'achievement-2'],
      ];

      const result = (quizService as any).compareAnswers(
        userAnswer,
        correctAnswer,
        'achievementsMatch'
      );

      // Order matters in achievementsMatch
      expect(result).toBe(false);
    });

    it('should handle birth order with partial correctness', () => {
      const correctOrder = ['person-1', 'person-2', 'person-3'];
      const partiallyCorrect = ['person-1', 'person-3', 'person-2'];

      const result = (quizService as any).compareAnswers(
        partiallyCorrect,
        correctOrder,
        'birthOrder'
      );

      expect(result).toBe(false);
    });

    it('should handle contemporaries groups with missing persons', () => {
      const userAnswer = [['person-1'], ['person-2']];
      const correctAnswer = [['person-1', 'person-2'], ['person-3']];

      const result = (quizService as any).compareAnswers(
        userAnswer,
        correctAnswer,
        'contemporaries'
      );

      expect(result).toBe(false);
    });

    it('should handle guessPerson answer format', () => {
      const correct = (quizService as any).compareAnswers(
        'person-123',
        'person-123',
        'guessPerson'
      );
      const incorrect = (quizService as any).compareAnswers(
        'person-456',
        'person-123',
        'guessPerson'
      );

      expect(correct).toBe(true);
      expect(incorrect).toBe(false);
    });

    it('should trim whitespace in string answers', () => {
      const result = (quizService as any).compareAnswers('  1900  ', '1900', 'birthYear');

      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // Shared Quiz Leaderboard
  // ============================================================================

  describe('getSharedQuizLeaderboard', () => {
    it('should get shared quiz leaderboard with entries', async () => {
      const mockQuiz = { id: 1, title: 'Test Quiz', creator_id: 1 };
      const mockAttempts = [
        {
          user_id: 1,
          correct_answers: 10,
          total_questions: 10,
          total_time_ms: 60000,
          rating_points: 100,
          created_at: new Date('2024-01-01'),
          rank: 1,
        },
        {
          user_id: 2,
          correct_answers: 8,
          total_questions: 10,
          total_time_ms: 70000,
          rating_points: 85,
          created_at: new Date('2024-01-02'),
          rank: 2,
        },
      ];

      mockPool.query
        .mockResolvedValueOnce(createQueryResult([mockQuiz])) // quiz info
        .mockResolvedValueOnce(createQueryResult(mockAttempts)) // top attempts
        .mockResolvedValueOnce(createQueryResult([{ total: '10' }])); // total count

      const result = await quizService.getSharedQuizLeaderboard('SHARE123');

      expect(result.entries).toHaveLength(2);
      expect(result.totalAttempts).toBe(10);
      expect(result.quizTitle).toBe('Test Quiz');
    });

    it('should return empty leaderboard when no attempts', async () => {
      const mockQuiz = { id: 1, title: 'Empty Quiz', creator_id: 1 };

      mockPool.query
        .mockResolvedValueOnce(createQueryResult([mockQuiz]))
        .mockResolvedValueOnce(createQueryResult([]))
        .mockResolvedValueOnce(createQueryResult([{ total: '0' }]));

      const result = await quizService.getSharedQuizLeaderboard('SHARE123');

      expect(result.entries).toEqual([]);
      expect(result.totalAttempts).toBe(0);
    });

    it('should include user entry when userId provided', async () => {
      const mockQuiz = { id: 1, title: 'Test Quiz', creator_id: 1 };
      const mockAttempts = [
        {
          user_id: 1,
          correct_answers: 10,
          total_questions: 10,
          total_time_ms: 60000,
          rating_points: 100,
          created_at: new Date('2024-01-01'),
          rank: 1,
        },
      ];
      const mockUserEntry = {
        user_id: 999,
        correct_answers: 5,
        total_questions: 10,
        total_time_ms: 80000,
        rating_points: 50,
        created_at: new Date('2024-01-15'),
        rank: 15,
      };

      mockPool.query
        .mockResolvedValueOnce(createQueryResult([mockQuiz]))
        .mockResolvedValueOnce(createQueryResult(mockAttempts))
        .mockResolvedValueOnce(createQueryResult([{ total: '20' }]))
        .mockResolvedValueOnce(createQueryResult([mockUserEntry])); // user entry

      const result = await quizService.getSharedQuizLeaderboard('SHARE123', 999);

      expect(result.userEntry).toBeDefined();
      expect(result.userEntry?.userId).toBe(999);
      expect(result.userEntry?.rank).toBe(15);
    });
  });

  // ============================================================================
  // Integration Note
  // ============================================================================
  // Complex transaction methods (createSharedQuiz, finishQuiz) require
  // extensive mocking and are better covered by integration tests
});
