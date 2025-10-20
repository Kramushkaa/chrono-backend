import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import { createHealthRoutes } from '../../routes/healthRoutes';
import { createMockPool, createQueryResult } from '../mocks';

describe('Health Routes', () => {
  let app: express.Application;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = createMockPool();
    app = express();
    app.use('/', createHealthRoutes(mockPool));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // GET /health tests
  // ============================================================================

  describe('GET /health', () => {
    it('should return 200 when database is connected', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue(createQueryResult([{ now: new Date() }]));

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'OK',
        database: 'connected',
      });
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
      expect(mockPool.query).toHaveBeenCalledWith('SELECT NOW()');
    });

    it('should return 503 when database is disconnected', async () => {
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Database connection failed',
        database: 'disconnected',
        error: 'Connection refused',
      });
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should include uptime and timestamp in response', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue(createQueryResult([{}]));

      const response = await request(app).get('/health');

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
    });
  });

  // ============================================================================
  // GET /ready tests
  // ============================================================================

  describe('GET /ready', () => {
    it('should return 200 when service is ready', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue(createQueryResult([{ result: 1 }]));

      const response = await request(app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Service is ready',
      });
      expect(response.body).toHaveProperty('timestamp');
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return 503 when service is not ready', async () => {
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('Database unavailable'));

      const response = await request(app).get('/ready');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Service is not ready',
        error: 'Database unavailable',
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should check database readiness', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce(createQueryResult([{}]));

      await request(app).get('/ready');

      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
    });
  });

  // ============================================================================
  // GET /live tests
  // ============================================================================

  describe('GET /live', () => {
    it('should always return 200 (no dependencies check)', async () => {
      const response = await request(app).get('/live');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Service is alive',
      });
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should not check database', async () => {
      await request(app).get('/live');

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should include uptime and timestamp', async () => {
      const response = await request(app).get('/live');

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
