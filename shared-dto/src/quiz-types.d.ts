export type QuizQuestionType = 'birthYear' | 'deathYear' | 'profession' | 'country' | 'achievementsMatch' | 'birthOrder' | 'contemporaries' | 'guessPerson';
export interface QuizQuestion {
    id: string;
    type: QuizQuestionType;
    question: string;
    options?: string[];
    correctAnswer: string | string[] | string[][];
    explanation?: string;
    data: unknown;
}
export interface QuizSetupConfig {
    selectedCountries: string[];
    selectedCategories: string[];
    questionTypes: string[];
    questionCount: number;
    timeRange: {
        start: number;
        end: number;
    };
}
export interface SaveQuizAttemptRequest {
    correctAnswers: number;
    totalQuestions: number;
    totalTimeMs: number;
    config: QuizSetupConfig;
    questionTypes: QuizQuestionType[];
}
export interface SaveQuizAttemptResponse {
    success: boolean;
    data: {
        attemptId: number;
        ratingPoints: number;
    };
}
export interface CreateSharedQuizRequest {
    title: string;
    description?: string;
    config: QuizSetupConfig;
    questions: QuizQuestion[];
}
export interface CreateSharedQuizResponse {
    success: boolean;
    data: {
        id: number;
        shareCode: string;
        shareUrl: string;
    };
}
export interface SharedQuizDTO {
    id: number;
    title: string;
    description?: string;
    creatorUsername: string;
    config: QuizSetupConfig;
    questions: QuizQuestionWithoutAnswer[];
    createdAt: string;
}
export interface QuizQuestionWithoutAnswer {
    id: string;
    type: QuizQuestionType;
    question: string;
    options?: string[];
    explanation?: string;
    data: unknown;
}
export interface StartSharedQuizRequest {
    shareCode: string;
}
export interface StartSharedQuizResponse {
    success: boolean;
    data: {
        sessionToken: string;
        expiresAt: string;
    };
}
export interface CheckAnswerRequest {
    sessionToken: string;
    questionId: string;
    answer: string | string[] | string[][];
    timeSpent: number;
}
export interface CheckAnswerResponse {
    success: boolean;
    data: {
        isCorrect: boolean;
    };
}
export interface FinishSharedQuizRequest {
    sessionToken: string;
}
export interface FinishSharedQuizResponse {
    success: boolean;
    data: {
        attemptId: number;
        correctAnswers: number;
        totalQuestions: number;
        totalTimeMs: number;
        detailedResults: DetailedQuestionResult[];
        leaderboardPosition?: number;
    };
}
export interface DetailedQuestionResult {
    questionId: string;
    question: string;
    isCorrect: boolean;
    userAnswer: string | string[] | string[][];
    correctAnswer: string | string[] | string[][];
    explanation?: string;
    timeSpent: number;
}
export interface GlobalLeaderboardEntry {
    rank: number;
    userId?: number;
    username: string;
    totalRating: number;
    gamesPlayed: number;
    averageScore: number;
    bestScore: number;
}
export interface LeaderboardPageInfo {
    limit: number;
    offset: number;
    hasMore: boolean;
}
export interface GlobalLeaderboardResponse {
    success: boolean;
    data: {
        topPlayers: GlobalLeaderboardEntry[];
        userEntry?: GlobalLeaderboardEntry & {
            isCurrentUser: true;
        };
        totalPlayers: number;
        page: LeaderboardPageInfo;
    };
}
export interface UserStatsResponse {
    success: boolean;
    data: {
        totalGames: number;
        totalRating: number;
        averageRating: number;
        bestRating: number;
        averageScore: number;
        rank?: number;
        recentAttempts: QuizAttemptDTO[];
    };
}
export interface QuizAttemptDTO {
    id: number;
    correctAnswers: number;
    totalQuestions: number;
    totalTimeMs: number;
    ratingPoints: number;
    config?: QuizSetupConfig;
    sharedQuizTitle?: string;
    createdAt: string;
}
export interface SharedQuizLeaderboardEntry {
    rank: number;
    userId?: number;
    username: string;
    correctAnswers: number;
    totalQuestions: number;
    totalTimeMs: number;
    completedAt: string;
}
export interface SharedQuizLeaderboardResponse {
    success: boolean;
    data: {
        quizTitle: string;
        entries: SharedQuizLeaderboardEntry[];
        userEntry?: SharedQuizLeaderboardEntry & {
            isCurrentUser: true;
        };
        totalAttempts: number;
    };
}
export interface QuizAttemptDB {
    id: number;
    user_id: number | null;
    shared_quiz_id: number | null;
    correct_answers: number;
    total_questions: number;
    total_time_ms: number;
    rating_points: number;
    config: QuizSetupConfig | null;
    created_at: Date;
}
export interface SharedQuizDB {
    id: number;
    creator_user_id: number;
    title: string;
    description: string | null;
    share_code: string;
    config: QuizSetupConfig;
    created_at: Date;
    expires_at: Date | null;
}
export interface SharedQuizQuestionDB {
    id: number;
    shared_quiz_id: number;
    question_index: number;
    question_data: QuizQuestion;
    created_at: Date;
}
export interface QuizSessionDB {
    id: number;
    shared_quiz_id: number;
    user_id: number | null;
    session_token: string;
    answers: QuizSessionAnswer[];
    started_at: Date;
    expires_at: Date;
}
export interface QuizSessionAnswer {
    questionId: string;
    answer: string | string[] | string[][];
    isCorrect: boolean;
    timeSpent: number;
}
//# sourceMappingURL=quiz-types.d.ts.map