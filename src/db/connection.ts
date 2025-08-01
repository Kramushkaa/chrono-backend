import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// Определяем, какое подключение использовать
const isLocal = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || (isLocal ? 'chronoline-kramushka.db-msk0.amvera.tech' : 'amvera-kramushka-cnpg-chronoline-rw'),
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'chronoline',
  user: process.env.DB_USER || 'Kramushka',
  password: process.env.DB_PASSWORD || '1qwertyu'
};

const poolConfig: PoolConfig = {
  ...dbConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false
  }
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool; 