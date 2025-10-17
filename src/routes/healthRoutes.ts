import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export function createHealthRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * Health check endpoint
   * GET /health
   * Returns 200 if the service is healthy, 503 otherwise
   */
  router.get('/health', async (req: Request, res: Response) => {
    const healthCheck = {
      uptime: process.uptime(),
      message: 'OK',
      timestamp: new Date().toISOString(),
      database: 'checking...',
    };

    try {
      // Check database connection
      const result = await pool.query('SELECT NOW()');
      healthCheck.database = 'connected';
      healthCheck.message = 'OK';

      res.status(200).json({
        success: true,
        ...healthCheck,
      });
    } catch (error) {
      healthCheck.database = 'disconnected';
      healthCheck.message = 'Database connection failed';

      res.status(503).json({
        success: false,
        ...healthCheck,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Readiness check endpoint
   * GET /ready
   * Returns 200 if the service is ready to handle requests
   */
  router.get('/ready', async (req: Request, res: Response) => {
    try {
      // Check if database is ready
      await pool.query('SELECT 1');

      res.status(200).json({
        success: true,
        message: 'Service is ready',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        message: 'Service is not ready',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Liveness check endpoint
   * GET /live
   * Returns 200 if the service is alive (doesn't check dependencies)
   */
  router.get('/live', (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Service is alive',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

