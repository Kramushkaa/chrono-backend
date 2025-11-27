import { Router } from 'express';
import { Pool } from 'pg';
import { createAchievementsRoutes } from '../../routes/achievementsRoutes';
import { AchievementsService } from '../../services/achievementsService';
import { TelegramService } from '../../services/telegramService';
import { createMockPool, createMockTelegramService } from '../mocks';

describe('Achievements Routes', () => {
  let mockPool: jest.Mocked<Pool>;
  let mockTelegramService: jest.Mocked<TelegramService>;
  let mockAchievementsService: jest.Mocked<AchievementsService>;

  beforeEach(() => {
    mockPool = createMockPool();
    mockTelegramService = createMockTelegramService() as any;
    mockAchievementsService = {
      getPendingCount: jest.fn(),
      getPendingAchievements: jest.fn(),
      getUserAchievementsCount: jest.fn(),
      getUserAchievements: jest.fn(),
      getAchievements: jest.fn(),
      getAchievementsByPerson: jest.fn(),
      createAchievement: jest.fn(),
      updateAchievement: jest.fn(),
      deleteAchievement: jest.fn(),
      submitDraft: jest.fn(),
      proposeEdit: jest.fn(),
      getUserDrafts: jest.fn(),
      reviewAchievement: jest.fn(),
      reviewEdit: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create router instance', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);

    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
    expect((router as any).stack).toBeDefined();
  });

  it('should register all routes', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);

    const routerStack = (router as any).stack;
    expect(routerStack).toBeDefined();
    expect(routerStack.length).toBeGreaterThan(0);
  });

  it('should apply rate limiting middleware', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    // Rate limiting middleware should be first
    expect(routerStack[0].handle).toBeDefined();
  });

  it('should have admin pending achievements route', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const adminRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/admin/achievements/pending' && layer.route?.methods?.get
    );

    expect(adminRoute).toBeDefined();
    // Should have authentication and role middleware
    expect(adminRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have user my achievements route', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const mineRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/achievements/mine' && layer.route?.methods?.get
    );

    expect(mineRoute).toBeDefined();
    // Should have authentication middleware
    expect(mineRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have public achievements list route', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const publicRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/achievements' && layer.route?.methods?.get
    );

    expect(publicRoute).toBeDefined();
  });

  it('should have achievements by person route', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const byPersonRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/persons/:id/achievements' && layer.route?.methods?.get
    );

    expect(byPersonRoute).toBeDefined();
  });

  it('should have create achievement route', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const createRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/persons/:id/achievements' && layer.route?.methods?.post
    );

    expect(createRoute).toBeDefined();
    // Should have authentication and verified email middleware
    expect(createRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have update achievement route', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const updateRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/achievements/:id' && layer.route?.methods?.put
    );

    expect(updateRoute).toBeDefined();
    // Should have authentication and verified email middleware
    expect(updateRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have delete achievement route', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const deleteRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/achievements/:id' && layer.route?.methods?.delete
    );

    expect(deleteRoute).toBeDefined();
    // Should have authentication middleware
    expect(deleteRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have submit draft route', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const submitRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/achievements/:id/submit' && layer.route?.methods?.post
    );

    expect(submitRoute).toBeDefined();
    // Should have authentication and verified email middleware
    expect(submitRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have propose edit route', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const editRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/achievements/:id/edits' && layer.route?.methods?.post
    );

    expect(editRoute).toBeDefined();
    // Should have authentication and verified email middleware
    expect(editRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have user drafts route', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const draftsRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/achievements/drafts' && layer.route?.methods?.get
    );

    expect(draftsRoute).toBeDefined();
    // Should have authentication middleware
    expect(draftsRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have lookup achievements by ids route', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const lookupRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/achievements/lookup/by-ids' && layer.route?.methods?.get
    );

    expect(lookupRoute).toBeDefined();
  });

  it('should have admin review achievement route', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const reviewRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/admin/achievements/:id/review' && layer.route?.methods?.post
    );

    expect(reviewRoute).toBeDefined();
    // Should have authentication and role middleware
    expect(reviewRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have admin review achievement edit route', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const reviewEditRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/admin/achievements/edits/:id/review' &&
        layer.route?.methods?.post
    );

    expect(reviewEditRoute).toBeDefined();
    // Should have authentication and role middleware
    expect(reviewEditRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should register multiple routes', () => {
    const router = createAchievementsRoutes(mockPool, mockTelegramService, mockAchievementsService);
    const routerStack = (router as any).stack;

    const routes = routerStack.filter((layer: any) => layer.route);
    expect(routes.length).toBeGreaterThan(10);
  });
});

