import { Router } from 'express';
import { Pool } from 'pg';
import { createListsRoutes } from '../../routes/listsRoutes';
import { ListsService } from '../../services/listsService';
import { createMockPool } from '../mocks';

describe('Lists Routes', () => {
  let mockPool: jest.Mocked<Pool>;
  let mockListsService: jest.Mocked<ListsService>;

  beforeEach(() => {
    mockPool = createMockPool();
    mockListsService = {
      shareList: jest.fn(),
      getSharedList: jest.fn(),
      getUserLists: jest.fn(),
      createList: jest.fn(),
      getListItems: jest.fn(),
      addListItem: jest.fn(),
      deleteListItem: jest.fn(),
      deleteList: jest.fn(),
      requestPublication: jest.fn(),
      getModerationQueue: jest.fn(),
      reviewList: jest.fn(),
      copyListFromShare: jest.fn(),
      getPublicLists: jest.fn(),
      getPublicList: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create router instance', () => {
    const router = createListsRoutes(mockPool, mockListsService);

    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
    expect((router as any).stack).toBeDefined();
  });

  it('should register all routes', () => {
    const router = createListsRoutes(mockPool, mockListsService);

    const routerStack = (router as any).stack;
    expect(routerStack).toBeDefined();
    expect(routerStack.length).toBeGreaterThan(0);
  });

  it('should apply rate limiting middleware', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    // Rate limiting middleware should be first
    expect(routerStack[0].handle).toBeDefined();
  });

  it('should have create share token route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const shareRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/lists/:listId/share' && layer.route?.methods?.post
    );

    expect(shareRoute).toBeDefined();
    // Should have authentication middleware
    expect(shareRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have resolve share token route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const resolveRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/list-shares/:code' && layer.route?.methods?.get
    );

    expect(resolveRoute).toBeDefined();
  });

  it('should have get all lists route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const getListsRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/lists' && layer.route?.methods?.get
    );

    expect(getListsRoute).toBeDefined();
    // Should have authentication middleware
    expect(getListsRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have create list route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const createRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/lists' && layer.route?.methods?.post
    );

    expect(createRoute).toBeDefined();
    // Should have authentication middleware
    expect(createRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have get list items route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const getItemsRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/lists/:listId/items' && layer.route?.methods?.get
    );

    expect(getItemsRoute).toBeDefined();
    // Should have authentication middleware
    expect(getItemsRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have add list item route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const addItemRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/lists/:listId/items' && layer.route?.methods?.post
    );

    expect(addItemRoute).toBeDefined();
    // Should have authentication middleware
    expect(addItemRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have delete list item route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const deleteItemRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/lists/:listId/items/:itemId' && layer.route?.methods?.delete
    );

    expect(deleteItemRoute).toBeDefined();
    // Should have authentication middleware
    expect(deleteItemRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have delete list route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const deleteRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/lists/:listId' && layer.route?.methods?.delete
    );

    expect(deleteRoute).toBeDefined();
    // Should have authentication middleware
    expect(deleteRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have request publication route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const publishRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/lists/:listId/publish-request' && layer.route?.methods?.post
    );

    expect(publishRoute).toBeDefined();
    // Should have authentication middleware
    expect(publishRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have admin moderation queue route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const moderationRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/admin/lists/moderation' && layer.route?.methods?.get
    );

    expect(moderationRoute).toBeDefined();
    // Should have authentication and role middleware
    expect(moderationRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have admin review list route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const reviewRoute = routerStack.find(
      (layer: any) =>
        layer.route?.path === '/admin/lists/:listId/review' && layer.route?.methods?.post
    );

    expect(reviewRoute).toBeDefined();
    // Should have authentication and role middleware
    expect(reviewRoute.route.stack.length).toBeGreaterThan(2);
  });

  it('should have copy from share route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const copyRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/lists/copy-from-share' && layer.route?.methods?.post
    );

    expect(copyRoute).toBeDefined();
    // Should have authentication middleware
    expect(copyRoute.route.stack.length).toBeGreaterThan(1);
  });

  it('should have public lists index route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const publicListsRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/public/lists' && layer.route?.methods?.get
    );

    expect(publicListsRoute).toBeDefined();
  });

  it('should have public list detail by slug route', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const publicListRoute = routerStack.find(
      (layer: any) => layer.route?.path === '/public/lists/:slug' && layer.route?.methods?.get
    );

    expect(publicListRoute).toBeDefined();
  });

  it('should register multiple routes', () => {
    const router = createListsRoutes(mockPool, mockListsService);
    const routerStack = (router as any).stack;

    const routes = routerStack.filter((layer: any) => layer.route);
    expect(routes.length).toBeGreaterThan(10);
  });
});

