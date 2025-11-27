import { Router } from 'express';
import { Pool } from 'pg';
import { createQuizRoutes } from '../../routes/quizRoutes';
import { createMockPool } from '../mocks';

describe('Quiz Routes', () => {
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = createMockPool();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create router instance', () => {
    const router = createQuizRoutes(mockPool);

    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
    expect((router as any).stack).toBeDefined();
  });

  it('should register all routes', () => {
    const router = createQuizRoutes(mockPool);

    const routerStack = (router as any).stack;
    expect(routerStack).toBeDefined();
    expect(routerStack.length).toBeGreaterThan(0);
  });

  it('should apply rate limiting middleware', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    // Rate limiting middleware should be first
    expect(routerStack[0].handle).toBeDefined();
  });

  it('should have save quiz attempt route', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    const saveRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/quiz/save-result' && layer.route?.methods?.post
    );

    expect(saveRoute).toBeDefined();
    // Should have optional authentication and validation middleware
    expect(saveRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have create shared quiz route', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    const shareRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/quiz/share' && layer.route?.methods?.post
    );

    expect(shareRoute).toBeDefined();
    // Should have authentication middleware
    expect(shareRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have get shared quiz route', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    const getSharedRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/quiz/shared/:shareCode' && layer.route?.methods?.get
    );

    expect(getSharedRoute).toBeDefined();
    // Should have validation middleware
    expect(getSharedRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have start shared quiz route', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    const startRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/quiz/shared/:shareCode/start' && layer.route?.methods?.post
    );

    expect(startRoute).toBeDefined();
    // Should have optional authentication and validation middleware
    expect(startRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have check answer route', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    const checkRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/quiz/shared/:shareCode/check-answer' && layer.route?.methods?.post
    );

    expect(checkRoute).toBeDefined();
    // Should have validation middleware
    expect(checkRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have finish shared quiz route', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    const finishRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/quiz/shared/:shareCode/finish' && layer.route?.methods?.post
    );

    expect(finishRoute).toBeDefined();
    // Should have validation middleware
    expect(finishRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have shared quiz leaderboard route', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    const leaderboardRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/quiz/shared/:shareCode/leaderboard' &&
        layer.route?.methods?.get
    );

    expect(leaderboardRoute).toBeDefined();
    // Should have optional authentication and validation middleware
    expect(leaderboardRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have global leaderboard route', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    const globalLeaderboardRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/quiz/leaderboard' && layer.route?.methods?.get
    );

    expect(globalLeaderboardRoute).toBeDefined();
    // Should have optional authentication middleware
    expect(globalLeaderboardRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have user stats route', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    const userStatsRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/quiz/leaderboard/me' && layer.route?.methods?.get
    );

    expect(userStatsRoute).toBeDefined();
    // Should have authentication middleware
    expect(userStatsRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have user quiz history route', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    const historyRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/quiz/history' && layer.route?.methods?.get
    );

    expect(historyRoute).toBeDefined();
    // Should have authentication middleware
    expect(historyRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have attempt detail route', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    const attemptRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/quiz/history/attempt/:attemptId' && layer.route?.methods?.get
    );

    expect(attemptRoute).toBeDefined();
    // Should have authentication and validation middleware
    expect(attemptRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have session detail route', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    const sessionRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/quiz/history/:sessionToken' && layer.route?.methods?.get
    );

    expect(sessionRoute).toBeDefined();
    // Should have authentication and validation middleware
    expect(sessionRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should register multiple routes', () => {
    const router = createQuizRoutes(mockPool);
    const routerStack = (router as any).stack;

    const routes = routerStack.filter((layer: any) => layer.route);
    expect(routes.length).toBeGreaterThan(10);
  });
});

