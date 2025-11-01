import { Router } from 'express';
import { Pool } from 'pg';
import { createMetaRoutes } from '../../routes/metaRoutes';

describe('Meta Routes', () => {
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
  });

  it('should create router instance', () => {
    const router = createMetaRoutes(mockPool);

    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should register all routes', () => {
    const router = createMetaRoutes(mockPool);
    
    const routerStack = (router as any).stack;
    expect(routerStack).toBeDefined();
    expect(routerStack.length).toBeGreaterThan(0);
  });

  it('should have health route', () => {
    const router = createMetaRoutes(mockPool);
    const routerStack = (router as any).stack;
    
    const healthRoute = routerStack.find((layer: any) => 
      layer.route?.path === '/health'
    );
    
    expect(healthRoute).toBeDefined();
  });

  it('should have dto-version route', () => {
    const router = createMetaRoutes(mockPool);
    const routerStack = (router as any).stack;
    
    const dtoRoute = routerStack.find((layer: any) => 
      layer.route?.path === '/dto-version'
    );
    
    expect(dtoRoute).toBeDefined();
  });

  it('should have categories route', () => {
    const router = createMetaRoutes(mockPool);
    const routerStack = (router as any).stack;
    
    const categoriesRoute = routerStack.find((layer: any) => 
      layer.route?.path === '/categories'
    );
    
    expect(categoriesRoute).toBeDefined();
  });

  it('should have countries route', () => {
    const router = createMetaRoutes(mockPool);
    const routerStack = (router as any).stack;
    
    const countriesRoute = routerStack.find((layer: any) => 
      layer.route?.path === '/countries'
    );
    
    expect(countriesRoute).toBeDefined();
  });

  it('should register multiple GET routes', () => {
    const router = createMetaRoutes(mockPool);
    const routerStack = (router as any).stack;
    
    const getRoutes = routerStack.filter((layer: any) => 
      layer.route?.methods?.get
    );
    
    expect(getRoutes.length).toBeGreaterThan(2);
  });
});

