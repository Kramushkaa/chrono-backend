import { Pool } from 'pg';
import * as crypto from 'crypto';
import { BaseService } from './BaseService';
import { logger } from '../utils/logger';
import type {
  QuizQuestion,
  QuizQuestionType,
  QuizSetupConfig,
  QuizAttemptDB,
  QuizSessionDB,
  QuizSessionAnswer,
  GlobalLeaderboardEntry,
  SharedQuizLeaderboardEntry,
  QuizAttemptDTO,
  SharedQuizDTO,
  QuizQuestionWithoutAnswer,
  DetailedQuestionResult,
} from '@chrononinja/dto';

export class QuizService extends BaseService {
  constructor(pool: Pool) {
    super(pool);
  }

  // ============================================================================
  // Rating Calculation
  // ============================================================================

  /**
   * Calculate rating points based on quiz performance
   * Formula: Σ(QuestionPoints × DifficultyMultiplier × TimeBonus) for each correct answer
   */
  calculateRatingPoints(
    correctAnswers: number,
    totalQuestions: number,
    totalTimeMs: number,
    questionTypes: QuizQuestionType[],
    detailedAnswers?: Array<{
      isCorrect: boolean;
      timeSpent: number;
      questionType: QuizQuestionType;
    }>
  ): number {
    // Если есть детальная информация, используем её
    if (detailedAnswers && detailedAnswers.length === questionTypes.length) {
      return this.calculateDetailedRatingPoints(detailedAnswers, totalQuestions);
    }

    // Fallback на старый алгоритм если детальной информации нет
    const baseScore = (correctAnswers / totalQuestions) * 100;
    const questionCountBonus = (totalQuestions - 5) * 0.1;
    const typeDifficulty = this.calculateTypeDifficulty(questionTypes);
    const difficultyMultiplier = 1 + questionCountBonus + typeDifficulty;

    let timeBonus = 1.0;
    if (correctAnswers > 0) {
      const avgTimePerQuestion = totalTimeMs / totalQuestions;
      const rawBonus = Math.min(1.5, 1 + (30000 - avgTimePerQuestion) / 60000);
      const cappedBonus = Math.max(1.0, rawBonus);
      const correctRatio = correctAnswers / totalQuestions;
      timeBonus = 1.0 + (cappedBonus - 1.0) * correctRatio;
    }

    const ratingPoints = baseScore * difficultyMultiplier * timeBonus;
    return Math.round(ratingPoints * 100) / 100;
  }

  /**
   * Calculate rating points with detailed per-question information
   */
  private calculateDetailedRatingPoints(
    answers: Array<{ isCorrect: boolean; timeSpent: number; questionType: QuizQuestionType }>,
    totalQuestions: number
  ): number {
    const basePointsPerQuestion = 100 / totalQuestions;
    const questionCountBonus = (totalQuestions - 5) * 0.1;

    let totalRating = 0;

    for (const answer of answers) {
      if (!answer.isCorrect) continue;

      // Базовые очки за правильный ответ
      let questionPoints = basePointsPerQuestion;

      // Бонус за сложность вопроса
      const typeDifficulty = this.getQuestionTypeDifficulty(answer.questionType);
      const difficultyMultiplier = 1 + questionCountBonus + typeDifficulty;
      questionPoints *= difficultyMultiplier;

      // Бонус за скорость ответа (разный для разных типов)
      const timeBonus = this.calculateQuestionTimeBonus(answer.timeSpent, answer.questionType);
      questionPoints *= timeBonus;

      totalRating += questionPoints;
    }

    return Math.round(totalRating * 100) / 100;
  }

  /**
   * Calculate time bonus for a single question using hyperbolic curve (1/t)
   * Faster answers get exponentially more bonus
   */
  private calculateQuestionTimeBonus(timeMs: number, questionType: QuizQuestionType): number {
    const isSingleChoice = ['birthYear', 'deathYear', 'profession', 'country'].includes(
      questionType
    );
    const isContemporaries = questionType === 'contemporaries';

    let maxBonus: number;
    let k: number; // Коэффициент для гиперболической кривой
    let offset: number; // Смещение для избежания деления на 0

    if (isSingleChoice) {
      maxBonus = 1.5; // Увеличиваем максимальный бонус
      k = 3000; // Настраиваем крутизну кривой
      offset = 500; // Минимальное смещение
    } else if (isContemporaries) {
      maxBonus = 2.0; // Больший бонус для сложных вопросов
      k = 20000;
      offset = 2000;
    } else {
      // achievementsMatch, birthOrder, guessPerson
      maxBonus = 1.8;
      k = 10000;
      offset = 1000;
    }

    // Гиперболическая функция: bonus = 1 + k / (timeMs + offset)
    const rawBonus = 1 + k / (timeMs + offset);

    // Ограничиваем максимальным бонусом и минимумом 1.0
    return Math.min(maxBonus, Math.max(1.0, rawBonus));
  }

  /**
   * Get difficulty value for a single question type
   */
  private getQuestionTypeDifficulty(questionType: QuizQuestionType): number {
    const difficultyMap: Record<QuizQuestionType, number> = {
      birthYear: 0.0,
      deathYear: 0.0,
      profession: 0.0,
      country: 0.0,
      achievementsMatch: 0.1,
      guessPerson: 0.1,
      birthOrder: 0.2,
      contemporaries: 0.2,
    };

    return difficultyMap[questionType] || 0;
  }

  /**
   * Calculate difficulty bonus based on question types
   */
  private calculateTypeDifficulty(questionTypes: QuizQuestionType[]): number {
    const difficultyMap: Record<QuizQuestionType, number> = {
      birthYear: 0.0,
      deathYear: 0.0,
      profession: 0.0,
      country: 0.0,
      achievementsMatch: 0.1,
      guessPerson: 0.1,
      birthOrder: 0.2,
      contemporaries: 0.2,
    };

    return questionTypes.reduce((sum, type) => sum + (difficultyMap[type] || 0), 0);
  }

  // ============================================================================
  // Regular Quiz Attempts
  // ============================================================================

  /**
   * Save a regular (non-shared) quiz attempt
   */
  async saveQuizAttempt(
    userId: number | null,
    correctAnswers: number,
    totalQuestions: number,
    totalTimeMs: number,
    config: QuizSetupConfig,
    questionTypes: QuizQuestionType[],
    detailedAnswers?: Array<{
      questionId: string;
      answer: any;
      isCorrect: boolean;
      timeSpent: number;
      questionType: QuizQuestionType;
    }>,
    questions?: QuizQuestion[]
  ): Promise<{ attemptId: number; ratingPoints: number }> {
    // Prepare detailed answers for rating calculation (without questionId and answer)
    const answersForRating = detailedAnswers?.map(a => ({
      isCorrect: a.isCorrect,
      timeSpent: a.timeSpent,
      questionType: a.questionType,
    }));

    const ratingPoints = this.calculateRatingPoints(
      correctAnswers,
      totalQuestions,
      totalTimeMs,
      questionTypes,
      answersForRating
    );

    const query = `
      INSERT INTO quiz_attempts (user_id, shared_quiz_id, correct_answers, total_questions, total_time_ms, rating_points, config, answers, questions)
      VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const values = [
      userId,
      correctAnswers,
      totalQuestions,
      totalTimeMs,
      ratingPoints,
      config,
      detailedAnswers ? JSON.stringify(detailedAnswers) : null,
      questions ? JSON.stringify(questions) : null,
    ];

    const result = await this.executeQuery(query, values, {
      action: 'saveQuizAttempt',
      params: { userId, correctAnswers, totalQuestions },
    });
    return {
      attemptId: result.rows[0].id,
      ratingPoints,
    };
  }

  // ============================================================================
  // Shared Quizzes
  // ============================================================================

  /**
   * Generate a unique share code
   */
  private async generateShareCode(): Promise<string> {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const codeLength = 8;

    for (let attempt = 0; attempt < 10; attempt++) {
      let code = '';
      for (let i = 0; i < codeLength; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }

      // Check if code already exists
      const checkQuery = 'SELECT id FROM shared_quizzes WHERE share_code = $1';
      const result = await this.executeQuery(checkQuery, [code], {
        action: 'generateShareCode_check',
        params: { code },
      });

      if (result.rows.length === 0) {
        return code;
      }
    }

    throw new Error('Failed to generate unique share code');
  }

  /**
   * Create a shared quiz
   */
  async createSharedQuiz(
    creatorUserId: number,
    title: string,
    description: string | undefined,
    config: QuizSetupConfig,
    questions: QuizQuestion[],
    creatorAttempt?: {
      correctAnswers: number;
      totalQuestions: number;
      totalTimeMs: number;
      answers?: Array<{ questionId: string; answer: any; isCorrect: boolean; timeSpent: number }>;
    }
  ): Promise<{ id: number; shareCode: string }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Generate unique share code
      const shareCode = await this.generateShareCode();

      // Insert shared quiz
      const quizQuery = `
        INSERT INTO shared_quizzes (creator_user_id, title, description, share_code, config)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;
      const quizResult = await client.query(quizQuery, [
        creatorUserId,
        title,
        description || null,
        shareCode,
        config,
      ]);
      const sharedQuizId = quizResult.rows[0].id;

      // Insert questions
      const questionQuery = `
        INSERT INTO shared_quiz_questions (shared_quiz_id, question_index, question_data)
        VALUES ($1, $2, $3)
      `;

      for (let i = 0; i < questions.length; i++) {
        await client.query(questionQuery, [sharedQuizId, i, questions[i]]);
      }

      // Save creator's attempt if provided
      if (creatorAttempt) {
        const questionTypes = questions.map(q => q.type);

        // Prepare detailed answers with question types
        const detailedAnswers = creatorAttempt.answers?.map(answer => {
          const question = questions.find(q => q.id === answer.questionId);
          return {
            isCorrect: answer.isCorrect,
            timeSpent: answer.timeSpent,
            questionType: question!.type,
          };
        });

        const ratingPoints = this.calculateRatingPoints(
          creatorAttempt.correctAnswers,
          creatorAttempt.totalQuestions,
          creatorAttempt.totalTimeMs,
          questionTypes,
          detailedAnswers
        );

        const attemptQuery = `
          INSERT INTO quiz_attempts (user_id, shared_quiz_id, correct_answers, total_questions, total_time_ms, rating_points, config)
          VALUES ($1, $2, $3, $4, $5, $6, NULL)
        `;
        await client.query(attemptQuery, [
          creatorUserId,
          sharedQuizId,
          creatorAttempt.correctAnswers,
          creatorAttempt.totalQuestions,
          creatorAttempt.totalTimeMs,
          ratingPoints,
        ]);
      }

      await client.query('COMMIT');

      return { id: sharedQuizId, shareCode };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get shared quiz by share code (without correct answers)
   */
  async getSharedQuiz(shareCode: string): Promise<SharedQuizDTO | null> {
    const quizQuery = `
      SELECT sq.*, u.username as creator_username
      FROM shared_quizzes sq
      JOIN users u ON sq.creator_user_id = u.id
      WHERE sq.share_code = $1
    `;
    const quizResult = await this.executeQuery(quizQuery, [shareCode], {
      action: 'getSharedQuiz',
      params: { shareCode },
    });

    if (quizResult.rows.length === 0) {
      return null;
    }

    const quiz = quizResult.rows[0];

    // Get questions
    const questionsQuery = `
      SELECT question_data
      FROM shared_quiz_questions
      WHERE shared_quiz_id = $1
      ORDER BY question_index ASC
    `;
    const questionsResult = await this.executeQuery(questionsQuery, [quiz.id], {
      action: 'getSharedQuiz_questions',
      params: { quizId: quiz.id },
    });

    // Strip correct answers from questions
    const questions: QuizQuestionWithoutAnswer[] = questionsResult.rows.map(row => {
      const fullQuestion = row.question_data as QuizQuestion;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { correctAnswer, ...questionWithoutAnswer } = fullQuestion;
      return questionWithoutAnswer as QuizQuestionWithoutAnswer;
    });

    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      creatorUsername: quiz.creator_username,
      config: quiz.config,
      questions,
      createdAt: quiz.created_at.toISOString(),
    };
  }

  // ============================================================================
  // Quiz Sessions (for shared quizzes)
  // ============================================================================

  /**
   * Start a new quiz session
   */
  async startQuizSession(
    sharedQuizId: number,
    userId: number | null
  ): Promise<{ sessionToken: string; expiresAt: Date }> {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    const query = `
      INSERT INTO quiz_sessions (shared_quiz_id, user_id, session_token, answers, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING expires_at
    `;

    const result = await this.executeQuery(
      query,
      [sharedQuizId, userId, sessionToken, JSON.stringify([]), expiresAt],
      {
        action: 'startQuizSession',
        params: { sharedQuizId, userId },
      }
    );

    return {
      sessionToken,
      expiresAt: result.rows[0].expires_at,
    };
  }

  /**
   * Get quiz session by token
   */
  async getQuizSession(sessionToken: string): Promise<QuizSessionDB | null> {
    const query = `
      SELECT * FROM quiz_sessions
      WHERE session_token = $1 
        AND expires_at > NOW() 
        AND finished_at IS NULL
    `;

    const result = await this.executeQuery(query, [sessionToken], {
      action: 'getQuizSession',
      params: { sessionToken },
    });

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as QuizSessionDB;
  }

  /**
   * Check answer for a shared quiz question
   */
  async checkAnswer(
    sessionToken: string,
    questionId: string,
    answer: string | string[] | string[][],
    timeSpent: number
  ): Promise<{ isCorrect: boolean }> {
    const session = await this.getQuizSession(sessionToken);
    if (!session) {
      throw new Error('Invalid or expired session');
    }

    // Check if already answered
    const existingAnswer = session.answers.find(a => a.questionId === questionId);
    if (existingAnswer) {
      throw new Error('Question already answered');
    }

    // Get the question with correct answer
    const questionQuery = `
      SELECT question_data
      FROM shared_quiz_questions
      WHERE shared_quiz_id = $1 AND (question_data->>'id')::text = $2
    `;
    const questionResult = await this.executeQuery(
      questionQuery,
      [session.shared_quiz_id, questionId],
      {
        action: 'checkAnswer_getQuestion',
        params: { sessionToken, questionId },
      }
    );

    if (questionResult.rows.length === 0) {
      throw new Error('Question not found');
    }

    const question = questionResult.rows[0].question_data as QuizQuestion;
    const isCorrect = this.compareAnswers(answer, question.correctAnswer, question.type);

    // Save answer to session
    const newAnswer: QuizSessionAnswer = {
      questionId,
      answer,
      isCorrect,
      timeSpent,
    };

    const updatedAnswers = [...session.answers, newAnswer];

    const updateQuery = `
      UPDATE quiz_sessions
      SET answers = $1
      WHERE session_token = $2
    `;
    await this.executeQuery(updateQuery, [JSON.stringify(updatedAnswers), sessionToken], {
      action: 'checkAnswer_updateSession',
      params: { sessionToken, questionId },
    });

    return { isCorrect };
  }

  /**
   * Compare user answer with correct answer
   */
  private compareAnswers(
    userAnswer: string | string[] | string[][],
    correctAnswer: string | string[] | string[][],
    questionType: QuizQuestionType
  ): boolean {
    if (questionType === 'birthYear' || questionType === 'deathYear') {
      return parseInt(userAnswer as string) === parseInt(correctAnswer as string);
    }

    if (questionType === 'contemporaries') {
      const userGroups = userAnswer as string[][];
      const correctGroups = correctAnswer as string[][];
      const normalizeGroups = (groups: string[][]) =>
        groups.map(group => group.sort()).sort((a, b) => a[0].localeCompare(b[0]));
      return (
        JSON.stringify(normalizeGroups(userGroups)) ===
        JSON.stringify(normalizeGroups(correctGroups))
      );
    }

    if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
      return JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);
    }

    return userAnswer === correctAnswer;
  }

  /**
   * Finish quiz session and save attempt
   */
  async finishQuizSession(sessionToken: string): Promise<{
    attemptId: number;
    correctAnswers: number;
    totalQuestions: number;
    totalTimeMs: number;
    detailedResults: DetailedQuestionResult[];
  }> {
    const session = await this.getQuizSession(sessionToken);
    if (!session) {
      throw new Error('Invalid or expired session');
    }

    // Get all questions for this quiz
    const questionsQuery = `
      SELECT question_data, question_index
      FROM shared_quiz_questions
      WHERE shared_quiz_id = $1
      ORDER BY question_index ASC
    `;
    const questionsResult = await this.executeQuery(questionsQuery, [session.shared_quiz_id], {
      action: 'finishQuizSession_getQuestions',
      params: { sessionToken },
    });
    const questions = questionsResult.rows.map(row => row.question_data as QuizQuestion);

    // Calculate results
    const correctAnswers = session.answers.filter(a => a.isCorrect).length;
    const totalQuestions = questions.length;
    const totalTimeMs = session.answers.reduce((sum, a) => sum + a.timeSpent, 0);

    // Get question types for rating calculation
    const questionTypes = questions.map(q => q.type);

    // Prepare detailed answers with question types
    const detailedAnswers = session.answers.map(answer => {
      const question = questions.find(q => q.id === answer.questionId);
      return {
        isCorrect: answer.isCorrect,
        timeSpent: answer.timeSpent,
        questionType: question!.type,
      };
    });

    const ratingPoints = this.calculateRatingPoints(
      correctAnswers,
      totalQuestions,
      totalTimeMs,
      questionTypes,
      detailedAnswers
    );

    // Save attempt
    const attemptQuery = `
      INSERT INTO quiz_attempts (user_id, shared_quiz_id, correct_answers, total_questions, total_time_ms, rating_points, config)
      VALUES ($1, $2, $3, $4, $5, $6, NULL)
      RETURNING id
    `;

    const attemptResult = await this.executeQuery(
      attemptQuery,
      [
        session.user_id,
        session.shared_quiz_id,
        correctAnswers,
        totalQuestions,
        totalTimeMs,
        ratingPoints,
      ],
      {
        action: 'finishQuizSession_saveAttempt',
        params: { sessionToken, correctAnswers, totalQuestions },
      }
    );

    const attemptId = attemptResult.rows[0].id;

    // Mark session as finished (instead of deleting)
    await this.executeQuery(
      'UPDATE quiz_sessions SET finished_at = NOW() WHERE session_token = $1',
      [sessionToken],
      {
        action: 'finishQuizSession_markFinished',
        params: { sessionToken, attemptId },
      }
    );

    // Prepare detailed results
    const detailedResults: DetailedQuestionResult[] = questions.map(question => {
      const userAnswer = session.answers.find(a => a.questionId === question.id);
      return {
        questionId: question.id,
        question: question.question,
        isCorrect: userAnswer?.isCorrect || false,
        userAnswer: userAnswer?.answer || '',
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        timeSpent: userAnswer?.timeSpent || 0,
      };
    });

    return {
      attemptId,
      correctAnswers,
      totalQuestions,
      totalTimeMs,
      detailedResults,
    };
  }

  /**
   * Get user's quiz history (both regular and shared quizzes)
   */
  async getUserQuizHistory(
    userId: number,
    limit: number = 20
  ): Promise<
    Array<{
      attempt_id: number;
      session_token?: string; // For shared quizzes
      quiz_title?: string; // For shared quizzes
      shared_quiz_id?: number;
      is_shared: boolean;
      correct_answers: number;
      total_questions: number;
      total_time_ms: number;
      rating_points: number;
      created_at: Date;
      config?: any;
    }>
  > {
    const query = `
      SELECT 
        qa.id as attempt_id,
        NULL as session_token,
        CASE 
          WHEN qa.shared_quiz_id IS NOT NULL THEN sq.title
          ELSE NULL
        END as quiz_title,
        qa.shared_quiz_id,
        qa.shared_quiz_id IS NOT NULL as is_shared,
        qa.correct_answers,
        qa.total_questions,
        qa.total_time_ms,
        qa.rating_points,
        qa.created_at,
        qa.config
      FROM quiz_attempts qa
      LEFT JOIN shared_quizzes sq ON qa.shared_quiz_id = sq.id
      WHERE qa.user_id = $1
      ORDER BY qa.created_at DESC
      LIMIT $2
    `;

    const result = await this.executeQuery(query, [userId, limit], {
      action: 'getUserQuizHistory',
      params: { userId, limit },
    });
    return result.rows;
  }

  /**
   * Get detailed attempt by ID (for viewing history of any quiz type)
   */
  async getAttemptDetail(
    attemptId: number,
    userId: number
  ): Promise<{
    attempt: QuizAttemptDB;
    quizTitle?: string;
  } | null> {
    const query = `
      SELECT 
        qa.*,
        sq.title as quiz_title
      FROM quiz_attempts qa
      LEFT JOIN shared_quizzes sq ON qa.shared_quiz_id = sq.id
      WHERE qa.id = $1 AND qa.user_id = $2
    `;

    const result = await this.executeQuery(query, [attemptId, userId], {
      action: 'getAttemptDetail',
      params: { attemptId, userId },
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const attempt: QuizAttemptDB = {
      id: row.id,
      user_id: row.user_id,
      shared_quiz_id: row.shared_quiz_id,
      correct_answers: row.correct_answers,
      total_questions: row.total_questions,
      total_time_ms: row.total_time_ms,
      rating_points: row.rating_points,
      config: row.config,
      answers: row.answers,
      questions: row.questions,
      created_at: row.created_at,
    };

    return {
      attempt,
      quizTitle: row.quiz_title,
    };
  }

  /**
   * Get detailed session by token (for viewing history - legacy, for shared quizzes)
   */
  async getSessionDetail(sessionToken: string): Promise<{
    session: QuizSessionDB;
    questions: QuizQuestion[];
    quizTitle: string;
  } | null> {
    // Get session
    const sessionQuery = `
      SELECT qs.*, sq.title as quiz_title
      FROM quiz_sessions qs
      JOIN shared_quizzes sq ON qs.shared_quiz_id = sq.id
      WHERE qs.session_token = $1 AND qs.finished_at IS NOT NULL
    `;

    const sessionResult = await this.executeQuery(sessionQuery, [sessionToken], {
      action: 'getSessionDetail_getSession',
      params: { sessionToken },
    });

    if (sessionResult.rows.length === 0) {
      return null;
    }

    const session = sessionResult.rows[0] as QuizSessionDB & { quiz_title: string };

    // Get questions for this quiz
    const questionsQuery = `
      SELECT question_data, question_index
      FROM shared_quiz_questions
      WHERE shared_quiz_id = $1
      ORDER BY question_index ASC
    `;

    const questionsResult = await this.executeQuery(questionsQuery, [session.shared_quiz_id], {
      action: 'getSessionDetail_getQuestions',
      params: { sessionToken, sharedQuizId: session.shared_quiz_id },
    });
    const questions = questionsResult.rows.map(row => row.question_data as QuizQuestion);

    return {
      session,
      questions,
      quizTitle: session.quiz_title,
    };
  }

  /**
   * Cleanup expired unfinished sessions
   * Should be called periodically (e.g., via cron job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const query = `
      DELETE FROM quiz_sessions
      WHERE expires_at <= NOW() 
        AND finished_at IS NULL
      RETURNING id
    `;

    const result = await this.executeQuery(query, [], {
      action: 'cleanupExpiredSessions',
      params: {},
    });
    return result.rows.length;
  }

  // ============================================================================
  // Leaderboards
  // ============================================================================

  /**
   * Get global leaderboard (top 100 + user position)
   */
  async getGlobalLeaderboard(userId?: number): Promise<{
    topPlayers: GlobalLeaderboardEntry[];
    userEntry?: GlobalLeaderboardEntry;
    totalPlayers: number;
  }> {
    // Get top 100 players
    const topQuery = `
      WITH player_stats AS (
        SELECT 
          qa.user_id,
          u.username,
          SUM(qa.rating_points) as total_rating,
          COUNT(*) as games_played,
          AVG((qa.correct_answers::float / qa.total_questions) * 100) as average_score,
          MAX((qa.correct_answers::float / qa.total_questions) * 100) as best_score
        FROM quiz_attempts qa
        LEFT JOIN users u ON qa.user_id = u.id
        WHERE qa.user_id IS NOT NULL
        GROUP BY qa.user_id, u.username
        ORDER BY total_rating DESC
        LIMIT 100
      )
      SELECT 
        ROW_NUMBER() OVER (ORDER BY total_rating DESC) as rank,
        *
      FROM player_stats
    `;

    const topResult = await this.executeQuery(topQuery, [], {
      action: 'getGlobalLeaderboard_topPlayers',
      params: { userId },
    });

    const topPlayers: GlobalLeaderboardEntry[] = topResult.rows.map(row => ({
      rank: parseInt(row.rank),
      userId: row.user_id,
      username: row.username || 'Unknown',
      totalRating: parseFloat(row.total_rating),
      gamesPlayed: parseInt(row.games_played),
      averageScore: parseFloat(row.average_score),
      bestScore: parseFloat(row.best_score),
    }));

    // Get total players count
    const countQuery = `
      SELECT COUNT(DISTINCT user_id) as total
      FROM quiz_attempts
      WHERE user_id IS NOT NULL
    `;
    const countResult = await this.executeQuery(countQuery, [], {
      action: 'getGlobalLeaderboard_countPlayers',
      params: { userId },
    });
    const totalPlayers = parseInt(countResult.rows[0].total);

    // Get user entry if userId provided and not in top 100
    let userEntry: GlobalLeaderboardEntry | undefined;
    if (userId && !topPlayers.find(p => p.userId === userId)) {
      const userQuery = `
        WITH all_players AS (
          SELECT 
            qa.user_id,
            u.username,
            SUM(qa.rating_points) as total_rating,
            COUNT(*) as games_played,
            AVG((qa.correct_answers::float / qa.total_questions) * 100) as average_score,
            MAX((qa.correct_answers::float / qa.total_questions) * 100) as best_score
          FROM quiz_attempts qa
          LEFT JOIN users u ON qa.user_id = u.id
          WHERE qa.user_id IS NOT NULL
          GROUP BY qa.user_id, u.username
        ),
        ranked_players AS (
          SELECT 
            ROW_NUMBER() OVER (ORDER BY total_rating DESC) as rank,
            *
          FROM all_players
        )
        SELECT * FROM ranked_players WHERE user_id = $1
      `;
      const userResult = await this.executeQuery(userQuery, [userId], {
        action: 'getGlobalLeaderboard_userEntry',
        params: { userId },
      });

      if (userResult.rows.length > 0) {
        const row = userResult.rows[0];
        userEntry = {
          rank: parseInt(row.rank),
          userId: row.user_id,
          username: row.username,
          totalRating: parseFloat(row.total_rating),
          gamesPlayed: parseInt(row.games_played),
          averageScore: parseFloat(row.average_score),
          bestScore: parseFloat(row.best_score),
        };
      }
    }

    return { topPlayers, userEntry, totalPlayers };
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: number): Promise<{
    totalGames: number;
    totalRating: number;
    averageRating: number;
    bestRating: number;
    averageScore: number;
    rank?: number;
    recentAttempts: QuizAttemptDTO[];
  }> {
    // Get stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_games,
        SUM(rating_points) as total_rating,
        AVG(rating_points) as average_rating,
        MAX(rating_points) as best_rating,
        AVG((correct_answers::float / total_questions) * 100) as average_score
      FROM quiz_attempts
      WHERE user_id = $1
    `;
    const statsResult = await this.executeQuery(statsQuery, [userId], {
      action: 'getUserStats_getStats',
      params: { userId },
    });
    const stats = statsResult.rows[0];

    // Get rank
    const rankQuery = `
      WITH player_totals AS (
        SELECT 
          user_id,
          SUM(rating_points) as total_rating
        FROM quiz_attempts
        WHERE user_id IS NOT NULL
        GROUP BY user_id
      ),
      ranked_players AS (
        SELECT 
          user_id,
          ROW_NUMBER() OVER (ORDER BY total_rating DESC) as rank
        FROM player_totals
      )
      SELECT rank FROM ranked_players WHERE user_id = $1
    `;
    const rankResult = await this.executeQuery(rankQuery, [userId], {
      action: 'getUserStats_getRank',
      params: { userId },
    });
    const rank = rankResult.rows.length > 0 ? parseInt(rankResult.rows[0].rank) : undefined;

    // Get recent attempts
    const attemptsQuery = `
      SELECT 
        qa.*,
        sq.title as shared_quiz_title
      FROM quiz_attempts qa
      LEFT JOIN shared_quizzes sq ON qa.shared_quiz_id = sq.id
      WHERE qa.user_id = $1
      ORDER BY qa.created_at DESC
      LIMIT 10
    `;
    const attemptsResult = await this.executeQuery(attemptsQuery, [userId], {
      action: 'getUserStats_getRecentAttempts',
      params: { userId },
    });

    const recentAttempts: QuizAttemptDTO[] = attemptsResult.rows.map(row => ({
      id: row.id,
      correctAnswers: row.correct_answers,
      totalQuestions: row.total_questions,
      totalTimeMs: row.total_time_ms,
      ratingPoints: parseFloat(row.rating_points),
      config: row.config,
      sharedQuizTitle: row.shared_quiz_title,
      createdAt: row.created_at.toISOString(),
    }));

    return {
      totalGames: parseInt(stats.total_games),
      totalRating: parseFloat(stats.total_rating) || 0,
      averageRating: parseFloat(stats.average_rating) || 0,
      bestRating: parseFloat(stats.best_rating) || 0,
      averageScore: parseFloat(stats.average_score) || 0,
      rank,
      recentAttempts,
    };
  }

  /**
   * Get shared quiz leaderboard
   */
  async getSharedQuizLeaderboard(
    shareCode: string,
    userId?: number
  ): Promise<{
    quizTitle: string;
    entries: SharedQuizLeaderboardEntry[];
    userEntry?: SharedQuizLeaderboardEntry;
    totalAttempts: number;
  }> {
    // Get quiz info
    const quizQuery = 'SELECT id, title FROM shared_quizzes WHERE share_code = $1';
    const quizResult = await this.executeQuery(quizQuery, [shareCode], {
      action: 'getSharedQuizLeaderboard_getQuiz',
      params: { shareCode, userId },
    });

    if (quizResult.rows.length === 0) {
      throw new Error('Quiz not found');
    }

    const quiz = quizResult.rows[0];

    // Get leaderboard entries (top 100)
    const entriesQuery = `
      WITH ranked_attempts AS (
        SELECT 
          qa.user_id,
          COALESCE(u.username, 'Неизвестный ронин') as username,
          qa.correct_answers,
          qa.total_questions,
          qa.total_time_ms,
          qa.created_at,
          ROW_NUMBER() OVER (
            ORDER BY qa.correct_answers DESC, qa.total_time_ms ASC
          ) as rank
        FROM quiz_attempts qa
        LEFT JOIN users u ON qa.user_id = u.id
        WHERE qa.shared_quiz_id = $1
      )
      SELECT * FROM ranked_attempts
      ORDER BY rank
      LIMIT 100
    `;
    const entriesResult = await this.executeQuery(entriesQuery, [quiz.id], {
      action: 'getSharedQuizLeaderboard_getEntries',
      params: { shareCode, userId, quizId: quiz.id },
    });

    const entries: SharedQuizLeaderboardEntry[] = entriesResult.rows.map(row => ({
      rank: parseInt(row.rank),
      userId: row.user_id,
      username: row.username,
      correctAnswers: row.correct_answers,
      totalQuestions: row.total_questions,
      totalTimeMs: row.total_time_ms,
      completedAt: row.created_at.toISOString(),
    }));

    // Get total attempts
    const countQuery = 'SELECT COUNT(*) as total FROM quiz_attempts WHERE shared_quiz_id = $1';
    const countResult = await this.executeQuery(countQuery, [quiz.id], {
      action: 'getSharedQuizLeaderboard_getTotalAttempts',
      params: { shareCode, userId, quizId: quiz.id },
    });
    const totalAttempts = parseInt(countResult.rows[0].total);

    // Get user entry if not in top 100
    let userEntry: SharedQuizLeaderboardEntry | undefined;
    if (userId && !entries.find(e => e.userId === userId)) {
      const userQuery = `
        WITH ranked_attempts AS (
          SELECT 
            qa.user_id,
            u.username,
            qa.correct_answers,
            qa.total_questions,
            qa.total_time_ms,
            qa.created_at,
            ROW_NUMBER() OVER (
              ORDER BY qa.correct_answers DESC, qa.total_time_ms ASC
            ) as rank
          FROM quiz_attempts qa
          LEFT JOIN users u ON qa.user_id = u.id
          WHERE qa.shared_quiz_id = $1
        )
        SELECT * FROM ranked_attempts WHERE user_id = $2
      `;
      const userResult = await this.executeQuery(userQuery, [quiz.id, userId], {
        action: 'getSharedQuizLeaderboard_getUserEntry',
        params: { shareCode, userId, quizId: quiz.id },
      });

      if (userResult.rows.length > 0) {
        const row = userResult.rows[0];
        userEntry = {
          rank: parseInt(row.rank),
          userId: row.user_id,
          username: row.username,
          correctAnswers: row.correct_answers,
          totalQuestions: row.total_questions,
          totalTimeMs: row.total_time_ms,
          completedAt: row.created_at.toISOString(),
        };
      }
    }

    return {
      quizTitle: quiz.title,
      entries,
      userEntry,
      totalAttempts,
    };
  }
}
