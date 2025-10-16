# Quiz Leaderboards and Sharing - Migration Guide

## Overview

This migration adds quiz leaderboard functionality and shared quiz features to the application.

## What's New

### Backend

- **Global Leaderboard**: Players earn rating points based on their quiz performance
- **Shared Quizzes**: Create quizzes and share them with friends via unique links
- **Rating System**: Points calculated from accuracy, difficulty, and speed

### Database Tables

- `quiz_attempts`: Stores all quiz results
- `shared_quizzes`: Stores shared quiz configurations
- `shared_quiz_questions`: Stores frozen questions for shared quizzes
- `quiz_sessions`: Tracks active quiz sessions for validation

## Migration Steps

### 1. Run Database Migration

```bash
npm run migrate:quiz
```

This will:

- Create 4 new tables
- Add all necessary indexes
- Add comments for documentation

### 2. Rebuild Backend

```bash
npm run build
```

### 3. Restart Backend Server

```bash
npm run dev
# or
npm start
```

### 4. Test the Features

#### Global Leaderboard

- Visit: http://localhost:3000/quiz/leaderboard
- Play quizzes to earn rating points
- See your rank among all players

#### Share Quiz

- Complete a quiz
- Click "Поделиться квизом"
- Enter title and description
- Share the generated link with friends

#### Shared Quiz

- Open shared link (e.g., `/quiz/ABC12345`)
- Choose to login or continue as guest
- Complete the quiz
- View leaderboard to compare results

## API Endpoints

### Quiz Attempts

- `POST /api/quiz/save-result` - Save regular quiz attempt
- `GET /api/quiz/leaderboard` - Get global leaderboard
- `GET /api/quiz/leaderboard/me` - Get user stats (auth required)

### Shared Quizzes

- `POST /api/quiz/share` - Create shared quiz (auth required)
- `GET /api/quiz/shared/:shareCode` - Get shared quiz
- `POST /api/quiz/shared/:shareCode/start` - Start quiz session
- `POST /api/quiz/shared/:shareCode/check-answer` - Check answer
- `POST /api/quiz/shared/:shareCode/finish` - Finish quiz
- `GET /api/quiz/shared/:shareCode/leaderboard` - Get quiz leaderboard

## Rating Formula

```
Rating = BaseScore × DifficultyMultiplier × TimeBonus

Where:
- BaseScore = (Correct / Total) × 100
- DifficultyMultiplier = 1 + (questionCount - 5) × 0.1 + difficulty_sum
  - Simple questions (birthYear, deathYear, profession, country): +0.0
  - Medium questions (achievementsMatch, guessPerson): +0.1
  - Hard questions (birthOrder, contemporaries): +0.2
- TimeBonus = if all correct: min(1.5, 1 + (30000 - avgTimeMs) / 60000)
  - Max +50% bonus for speed
  - Only applies when all answers are correct
```

## Rollback (if needed)

If you need to rollback the migration:

```sql
DROP TABLE IF EXISTS quiz_sessions CASCADE;
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS shared_quiz_questions CASCADE;
DROP TABLE IF EXISTS shared_quizzes CASCADE;
```

## Troubleshooting

### Migration fails with "relation does not exist"

- Make sure the `users` table exists
- Check database connection in `.env`

### Frontend compilation errors

- Rebuild shared-dto: `cd shared-dto && npm run build`
- Clear node_modules if needed: `rm -rf node_modules && npm install`

### Quiz sharing not working

- Check that frontend routes are configured in `App.tsx`
- Verify backend routes are registered in `server.ts`
- Check CORS settings allow frontend origin
