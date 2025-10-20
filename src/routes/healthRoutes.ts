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
    const startTime = Date.now();
    const healthCheck = {
      uptime: process.uptime(),
      message: 'OK',
      timestamp: new Date().toISOString(),
      database: {
        status: 'checking',
        responseTime: 0,
      },
      pool: {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
      },
    };

    try {
      // Check database connection with timing
      const dbStartTime = Date.now();
      await pool.query('SELECT NOW()');
      const dbResponseTime = Date.now() - dbStartTime;
      
      healthCheck.database = {
        status: 'connected',
        responseTime: dbResponseTime,
      };

      // Check if response time is acceptable (should be < 1000ms)
      if (dbResponseTime > 1000) {
        healthCheck.message = 'Database slow response';
        res.status(200).json({
          success: true,
          ...healthCheck,
          warning: 'Database response time is higher than expected',
        });
        return;
      }

      // Check pool health
      const isPoolHealthy = pool.totalCount < pool.options.max * 0.9; // Less than 90% capacity
      
      if (!isPoolHealthy) {
        healthCheck.message = 'Pool near capacity';
        res.status(200).json({
          success: true,
          ...healthCheck,
          warning: 'Connection pool is near capacity',
        });
        return;
      }

      res.status(200).json({
        success: true,
        ...healthCheck,
      });
    } catch (error) {
      const dbResponseTime = Date.now() - startTime;
      healthCheck.database = {
        status: 'disconnected',
        responseTime: dbResponseTime,
      };
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
