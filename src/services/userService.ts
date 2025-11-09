import { Pool } from 'pg';
import { BaseService } from './BaseService';
import { User, UserUpdateRequest, UserQueryParams, UserStatsResponse } from '../types/auth';
import { UserRow } from '../types/database';

export class UserService extends BaseService {
  constructor(pool: Pool) {
    super(pool);
  }

  /**
   * Получение списка всех пользователей с фильтрацией и пагинацией
   */
  async getAllUsers(params: UserQueryParams): Promise<{
    users: User[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    const limit = Math.min(params.limit || 20, 100);
    const offset = params.offset || 0;

    // Построение WHERE условия
    const conditions: string[] = ['1=1'];
    const values: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (params.role) {
      conditions.push(`role = $${paramIndex++}`);
      values.push(params.role);
    }

    if (params.is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(params.is_active);
    }

    if (params.email_verified !== undefined) {
      conditions.push(`email_verified = $${paramIndex++}`);
      values.push(params.email_verified);
    }

    if (params.search) {
      conditions.push(`(email ILIKE $${paramIndex} OR username ILIKE $${paramIndex})`);
      values.push(`%${params.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Запрос с пагинацией (LIMIT + 1 для проверки hasMore)
    const query = `
      SELECT id, email, username, full_name, role, email_verified, is_active, created_at, updated_at
      FROM users
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit + 1, offset);

    const result = await this.executeQuery<UserRow>(query, values, {
      action: 'getAllUsers',
      params: { limit, offset, filters: params },
    });

    const hasMore = result.rows.length > limit;
    const users = result.rows.slice(0, limit).map(row => this.mapUserFromDb(row));

    return {
      users,
      total: users.length, // Note: For exact total, we'd need a separate COUNT query
      limit,
      offset,
      hasMore,
    };
  }

  /**
   * Получение пользователя по ID
   */
  async getUserById(userId: number): Promise<User | null> {
    const result = await this.executeQuery<UserRow>(
      'SELECT id, email, username, full_name, role, email_verified, is_active, created_at, updated_at FROM users WHERE id = $1',
      [userId],
      {
        action: 'getUserById',
        params: { userId },
      }
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapUserFromDb(result.rows[0]);
  }

  /**
   * Обновление пользователя админом
   */
  async updateUser(userId: number, updates: UserUpdateRequest): Promise<User> {
    const updateFields: string[] = [];
    const values: (string | boolean | number)[] = [];
    let paramIndex = 1;

    if (updates.role !== undefined) {
      updateFields.push(`role = $${paramIndex++}`);
      values.push(updates.role);
    }

    if (updates.is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }

    if (updates.email_verified !== undefined) {
      updateFields.push(`email_verified = $${paramIndex++}`);
      values.push(updates.email_verified);
      // Clear verification token if verifying manually
      if (updates.email_verified) {
        updateFields.push('email_verification_token = NULL');
        updateFields.push('email_verification_expires = NULL');
      }
    }

    if (updateFields.length === 0) {
      throw new Error('Нет данных для обновления');
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.executeQuery<UserRow>(query, values, {
      action: 'updateUser',
      params: { userId, updates },
    });

    if (result.rows.length === 0) {
      throw new Error('Пользователь не найден');
    }

    return this.mapUserFromDb(result.rows[0]);
  }

  /**
   * Деактивация пользователя (мягкое удаление)
   */
  async deactivateUser(userId: number): Promise<void> {
    const result = await this.executeQuery(
      'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId],
      {
        action: 'deactivateUser',
        params: { userId },
      }
    );

    if (result.rowCount === 0) {
      throw new Error('Пользователь не найден');
    }
  }

  /**
   * Получение статистики пользователей
   */
  async getUserStats(): Promise<UserStatsResponse> {
    // Total users
    const totalResult = await this.executeQuery<{ count: string }>(
      'SELECT COUNT(*) as count FROM users',
      [],
      { action: 'getUserStats_total' }
    );
    const total = parseInt(totalResult.rows[0].count);

    // Active/inactive
    const activeResult = await this.executeQuery<{ is_active: boolean; count: string }>(
      'SELECT is_active, COUNT(*) as count FROM users GROUP BY is_active',
      [],
      { action: 'getUserStats_active' }
    );
    const activeMap = Object.fromEntries(
      activeResult.rows.map(r => [r.is_active ? 'active' : 'inactive', parseInt(r.count)])
    );

    // Verified/unverified
    const verifiedResult = await this.executeQuery<{ email_verified: boolean; count: string }>(
      'SELECT email_verified, COUNT(*) as count FROM users GROUP BY email_verified',
      [],
      { action: 'getUserStats_verified' }
    );
    const verifiedMap = Object.fromEntries(
      verifiedResult.rows.map(r => [
        r.email_verified ? 'verified' : 'unverified',
        parseInt(r.count),
      ])
    );

    // By role
    const roleResult = await this.executeQuery<{ role: string; count: string }>(
      'SELECT role, COUNT(*) as count FROM users GROUP BY role',
      [],
      { action: 'getUserStats_role' }
    );
    const roleMap = Object.fromEntries(roleResult.rows.map(r => [r.role, parseInt(r.count)]));

    // Recent registrations (last 7 days)
    const recentResult = await this.executeQuery<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '7 days'",
      [],
      { action: 'getUserStats_recent' }
    );
    const recentRegistrations = parseInt(recentResult.rows[0].count);

    return {
      total,
      active: activeMap.active || 0,
      inactive: activeMap.inactive || 0,
      verified: verifiedMap.verified || 0,
      unverified: verifiedMap.unverified || 0,
      byRole: {
        user: roleMap.user || 0,
        moderator: roleMap.moderator || 0,
        admin: roleMap.admin || 0,
      },
      recentRegistrations,
    };
  }

  /**
   * Маппинг пользователя из базы данных
   */
  private mapUserFromDb(dbUser: UserRow): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username ?? undefined,
      full_name: dbUser.full_name ?? undefined,
      avatar_url: dbUser.avatar_url ?? undefined,
      role: dbUser.role,
      is_active: dbUser.is_active,
      email_verified: dbUser.email_verified,
      email_verification_token: dbUser.email_verification_token ?? undefined,
      created_at: new Date(dbUser.created_at),
      updated_at: new Date(dbUser.updated_at),
    };
  }
}
