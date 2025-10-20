import { Pool, PoolConfig } from 'pg';
import { config } from '../config';

export function createPool(): Pool {
  const sslConfig = config.database.ssl
    ? {
        rejectUnauthorized: config.server.nodeEnv === 'production',
        ...(config.database.sslCert && { ca: config.database.sslCert }),
      }
    : false;

  const poolConfig: PoolConfig = {
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    max: config.database.pool.max,
    idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
    connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
    ssl: sslConfig,
  };

  return new Pool(poolConfig);
}
