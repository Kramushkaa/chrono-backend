import { Router } from 'express';
import { Pool } from 'pg';
import { createPersonRoutes } from '../../routes/persons';
import { PersonsService } from '../../services/personsService';
import { TelegramService } from '../../services/telegramService';
import { createMockPool, createMockTelegramService } from '../mocks';

describe('Person Routes', () => {
  let mockPool: jest.Mocked<Pool>;
  let mockTelegramService: jest.Mocked<TelegramService>;
  let mockPersonsService: jest.Mocked<PersonsService>;

  beforeEach(() => {
    mockPool = createMockPool();
    mockTelegramService = createMockTelegramService() as any;
    mockPersonsService = {
      proposePersonWithLifePeriods: jest.fn(),
      createOrUpdatePersonDirectly: jest.fn(),
      getPersons: jest.fn(),
      getPersonById: jest.fn(),
      getPersonsByIds: jest.fn(),
      reviewPerson: jest.fn(),
      proposeEdit: jest.fn(),
      replacePersonLifePeriods: jest.fn(),
      getUserPersonsCount: jest.fn(),
      getUserPersons: jest.fn(),
      updatePersonWithLifePeriods: jest.fn(),
      submitPersonDraft: jest.fn(),
      getPersonDrafts: jest.fn(),
      revertPersonToDraft: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create router instance', () => {
    const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);

    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
    expect((router as any).stack).toBeDefined();
  });

  it('should register all routes', () => {
    const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);

    const routerStack = (router as any).stack;
    expect(routerStack).toBeDefined();
    expect(routerStack.length).toBeGreaterThan(0);
  });

  it('should apply rate limiting middleware', () => {
    const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
    const routerStack = (router as any).stack;

    // Rate limiting middleware should be first
    expect(routerStack[0].handle).toBeDefined();
  });

  describe('Admin Routes', () => {
    // Helper function to recursively find routes in nested routers
    const findRouteInStack = (stack: any[], path: string, method: string): any => {
      for (const layer of stack) {
        if (layer.route && layer.route.path === path && layer.route.methods[method]) {
          return layer;
        }
        // Check nested routers
        if (layer.handle && layer.handle.stack && Array.isArray(layer.handle.stack)) {
          const found = findRouteInStack(layer.handle.stack, path, method);
          if (found) return found;
        }
      }
      return undefined;
    };

    it('should have admin create person route', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const adminCreateRoute = findRouteInStack(routerStack, '/admin/persons', 'post');

      expect(adminCreateRoute).toBeDefined();
      // Should have authentication and role middleware
      expect(adminCreateRoute.route.stack.length).toBeGreaterThan(2);
    });

    it('should have admin moderation queue route', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const moderationRoute = findRouteInStack(routerStack, '/admin/persons/moderation', 'get');

      expect(moderationRoute).toBeDefined();
      // Should have authentication and role middleware
      expect(moderationRoute.route.stack.length).toBeGreaterThan(2);
    });

    it('should have admin review person route', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const reviewRoute = findRouteInStack(routerStack, '/admin/persons/:id/review', 'post');

      expect(reviewRoute).toBeDefined();
      // Should have authentication and role middleware
      expect(reviewRoute.route.stack.length).toBeGreaterThan(2);
    });
  });

  describe('User Routes', () => {
    // Helper function to recursively find routes in nested routers
    const findRouteInStack = (stack: any[], path: string, method: string): any => {
      for (const layer of stack) {
        if (layer.route && layer.route.path === path && layer.route.methods[method]) {
          return layer;
        }
        // Check nested routers
        if (layer.handle && layer.handle.stack && Array.isArray(layer.handle.stack)) {
          const found = findRouteInStack(layer.handle.stack, path, method);
          if (found) return found;
        }
      }
      return undefined;
    };

    it('should have user my persons route', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const mineRoute = findRouteInStack(routerStack, '/persons/mine', 'get');

      expect(mineRoute).toBeDefined();
      // Should have authentication middleware
      expect(mineRoute.route.stack.length).toBeGreaterThan(1);
    });

    it('should have update person route', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const updateRoute = findRouteInStack(routerStack, '/persons/:id', 'put');

      expect(updateRoute).toBeDefined();
      // Should have authentication middleware
      expect(updateRoute.route.stack.length).toBeGreaterThan(1);
    });

    it('should have submit draft route', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const submitRoute = findRouteInStack(routerStack, '/persons/:id/submit', 'post');

      expect(submitRoute).toBeDefined();
      // Should have authentication middleware
      expect(submitRoute.route.stack.length).toBeGreaterThan(1);
    });

    it('should have user drafts route', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const draftsRoute = findRouteInStack(routerStack, '/persons/drafts', 'get');

      expect(draftsRoute).toBeDefined();
      // Should have authentication middleware
      expect(draftsRoute.route.stack.length).toBeGreaterThan(1);
    });

    it('should have revert to draft route', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const revertRoute = findRouteInStack(routerStack, '/persons/:id/revert-to-draft', 'post');

      expect(revertRoute).toBeDefined();
      // Should have authentication middleware
      expect(revertRoute.route.stack.length).toBeGreaterThan(1);
    });
  });

  describe('Public Routes', () => {
    // Helper function to recursively find routes in nested routers
    const findRouteInStack = (stack: any[], path: string, method: string): any => {
      for (const layer of stack) {
        if (layer.route && layer.route.path === path && layer.route.methods[method]) {
          return layer;
        }
        // Check nested routers
        if (layer.handle && layer.handle.stack && Array.isArray(layer.handle.stack)) {
          const found = findRouteInStack(layer.handle.stack, path, method);
          if (found) return found;
        }
      }
      return undefined;
    };

    it('should have public persons list route', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const publicListRoute = findRouteInStack(routerStack, '/persons', 'get');

      expect(publicListRoute).toBeDefined();
      // Should have validation middleware
      expect(publicListRoute.route.stack.length).toBeGreaterThan(0);
    });

    it('should have person details route', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const detailRoute = findRouteInStack(routerStack, '/persons/:id', 'get');

      expect(detailRoute).toBeDefined();
      // Should have validation middleware
      expect(detailRoute.route.stack.length).toBeGreaterThan(0);
    });

    it('should have persons lookup by ids route', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const lookupRoute = findRouteInStack(routerStack, '/persons/lookup/by-ids', 'get');

      expect(lookupRoute).toBeDefined();
      // Should have validation middleware
      expect(lookupRoute.route.stack.length).toBeGreaterThan(0);
    });

    it('should have propose person route', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const proposeRoute = findRouteInStack(routerStack, '/persons/propose', 'post');

      expect(proposeRoute).toBeDefined();
      // Should have authentication middleware
      expect(proposeRoute.route.stack.length).toBeGreaterThan(1);
    });

    it('should have propose edit route', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const editRoute = findRouteInStack(routerStack, '/persons/:id/edits', 'post');

      expect(editRoute).toBeDefined();
      // Should have authentication and verified email middleware
      expect(editRoute.route.stack.length).toBeGreaterThan(2);
    });

    it('should have replace life periods route (admin)', () => {
      const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
      const routerStack = (router as any).stack;

      const lifePeriodsRoute = findRouteInStack(routerStack, '/persons/:id/life-periods', 'post');

      expect(lifePeriodsRoute).toBeDefined();
      // Should have authentication and role middleware
      expect(lifePeriodsRoute.route.stack.length).toBeGreaterThan(2);
    });
  });

  it('should register multiple routes', () => {
    const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
    const routerStack = (router as any).stack;

    // Helper to count routes recursively in nested routers
    const countRoutes = (stack: any[]): number => {
      let count = 0;
      for (const layer of stack) {
        if (layer.route) {
          count++;
        }
        if (layer.handle && layer.handle.stack && Array.isArray(layer.handle.stack)) {
          count += countRoutes(layer.handle.stack);
        }
      }
      return count;
    };

    const totalRoutes = countRoutes(routerStack);
    expect(totalRoutes).toBeGreaterThan(10);
  });

  it('should have user routes before public routes to avoid conflicts', () => {
    const router = createPersonRoutes(mockPool, mockTelegramService, mockPersonsService);
    const routerStack = (router as any).stack;

    // Find indices of user and public routes in the main router stack
    // User routes are registered before public routes (see createPersonRoutes implementation)
    const userRouterIndex = routerStack.findIndex(
      (layer: any) => layer.handle && layer.handle.stack && 
        layer.handle.stack.some((l: any) => l.route?.path === '/persons/mine')
    );
    const publicRouterIndex = routerStack.findIndex(
      (layer: any) => layer.handle && layer.handle.stack && 
        layer.handle.stack.some((l: any) => l.route?.path === '/persons' && l.route?.methods?.get)
    );

    // User router should come before public router (to avoid /persons/mine being matched by /persons/:id)
    expect(userRouterIndex).toBeGreaterThan(-1);
    expect(publicRouterIndex).toBeGreaterThan(-1);
    expect(userRouterIndex).toBeLessThan(publicRouterIndex);
  });
});
