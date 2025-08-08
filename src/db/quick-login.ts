import { Pool } from 'pg';
import dotenv from 'dotenv';
import { AuthService } from '../services/authService';

dotenv.config();

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined as any,
  });
  const service = new AuthService(pool);
  try {
  const result = await service.loginUser({ email: 'admin@chrono.ninja', password: 'admin123' });
    console.log('login ok:', {
      user: { id: result.user.id, email: result.user.email, role: result.user.role },
      accessTokenLen: result.accessToken.length,
      refreshTokenLen: result.refreshToken.length,
    });
  } catch (e) {
    console.error('login error:', e);
  } finally {
    process.exit(0);
  }
}

main();


