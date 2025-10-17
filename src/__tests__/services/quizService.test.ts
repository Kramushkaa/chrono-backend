import { QuizService } from '../../services/quizService';
import { createMockPool } from '../mocks';
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
        [
          ['person-1', 'person-2'],
          ['person-3'],
        ],
        [
          ['person-1'],
          ['person-2', 'person-3'],
        ],
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
  // Integration Note
  // ============================================================================
  // Database-dependent methods (saveQuizAttempt, getGlobalLeaderboard, etc.)
  // require complex mocking or actual integration tests with test database
  // These are better covered by integration tests rather than unit tests
});
