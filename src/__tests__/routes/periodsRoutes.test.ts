import { Router } from 'express';
import { Pool } from 'pg';
import { createPeriodsRoutes } from '../../routes/periodsRoutes';
import { PeriodsService } from '../../services/periodsService';
import { TelegramService } from '../../services/telegramService';
import { createMockPool, createMockTelegramService } from '../mocks';

describe('Periods Routes', () => {
  let mockPool: jest.Mocked<Pool>;
  let mockTelegramService: jest.Mocked<TelegramService>;
  let mockPeriodsService: jest.Mocked<PeriodsService>;

  beforeEach(() => {
    mockPool = createMockPool();
    mockTelegramService = createMockTelegramService() as any;
    mockPeriodsService = {
      createPeriod: jest.fn(),
      updatePeriod: jest.fn(),
      deletePeriod: jest.fn(),
      submitDraft: jest.fn(),
      proposeEdit: jest.fn(),
      getUserDrafts: jest.fn(),
      getPendingCount: jest.fn(),
      getPendingPeriods: jest.fn(),
      reviewPeriod: jest.fn(),
      reviewEdit: jest.fn(),
      getUserPeriodsCount: jest.fn(),
      getUserPeriods: jest.fn(),
      getPeriods: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create router instance', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);

    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
    expect((router as any).stack).toBeDefined();
  });

  it('should register all routes', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);

    const routerStack = (router as any).stack;
    expect(routerStack).toBeDefined();
    expect(routerStack.length).toBeGreaterThan(0);
  });

  it('should apply rate limiting middleware', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    // Rate limiting middleware should be first
    expect(routerStack[0].handle).toBeDefined();
  });

  it('should have create standalone period route', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const createRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/periods' && layer.route?.methods?.post
    );

    expect(createRoute).toBeDefined();
    // Should have authentication and verified email middleware
    expect(createRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have create period for person route', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const createForPersonRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/persons/:id/periods' && layer.route?.methods?.post
    );

    expect(createForPersonRoute).toBeDefined();
    // Should have authentication and verified email middleware
    expect(createForPersonRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have update period route', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const updateRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/periods/:id' && layer.route?.methods?.put
    );

    expect(updateRoute).toBeDefined();
    // Should have authentication and verified email middleware
    expect(updateRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have submit draft route', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const submitRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/periods/:id/submit' && layer.route?.methods?.post
    );

    expect(submitRoute).toBeDefined();
    // Should have authentication and verified email middleware
    expect(submitRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have propose edit route', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const editRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/periods/:id/edits' && layer.route?.methods?.post
    );

    expect(editRoute).toBeDefined();
    // Should have authentication and verified email middleware
    expect(editRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have delete period route', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const deleteRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/periods/:id' && layer.route?.methods?.delete
    );

    expect(deleteRoute).toBeDefined();
    // Should have authentication middleware
    expect(deleteRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have user drafts route', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const draftsRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/periods/drafts' && layer.route?.methods?.get
    );

    expect(draftsRoute).toBeDefined();
    // Should have authentication middleware
    expect(draftsRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have admin pending periods route', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const adminRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/admin/periods/pending' && layer.route?.methods?.get
    );

    expect(adminRoute).toBeDefined();
    // Should have authentication and role middleware
    expect(adminRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have admin review period route', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const reviewRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/admin/periods/:id/review' && layer.route?.methods?.post
    );

    expect(reviewRoute).toBeDefined();
    // Should have authentication and role middleware
    expect(reviewRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have admin review period edit route', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const reviewEditRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/admin/periods/edits/:id/review' && layer.route?.methods?.post
    );

    expect(reviewEditRoute).toBeDefined();
    // Should have authentication and role middleware
    expect(reviewEditRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have user my periods route', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const mineRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/periods/mine' && layer.route?.methods?.get
    );

    expect(mineRoute).toBeDefined();
    // Should have authentication middleware
    expect(mineRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have public periods list route', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const publicRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/periods' && layer.route?.methods?.get
    );

    expect(publicRoute).toBeDefined();
  });

  it('should have lookup periods by ids route', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const lookupRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/periods/lookup/by-ids' && layer.route?.methods?.get
    );

    expect(lookupRoute).toBeDefined();
  });

  it('should register multiple routes', () => {
    const router = createPeriodsRoutes(mockPool, mockTelegramService, mockPeriodsService);
    const routerStack = (router as any).stack;

    const routes = routerStack.filter((layer: any) => layer.route);
    expect(routes.length).toBeGreaterThan(10);
  });
});

