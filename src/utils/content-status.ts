/**
 * Утилита для определения статуса контента на основе роли пользователя и флага saveAsDraft
 * Устраняет дублирование логики в routes для achievements, periods, persons
 */

export type ContentStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type UserRole = 'admin' | 'moderator' | 'user';

export interface User {
  sub: number;
  role: UserRole;
  email?: string;
  emailVerified?: boolean;
}

/**
 * Определяет статус контента при создании
 * @param user - Пользователь из JWT токена (req.user)
 * @param saveAsDraft - Флаг сохранения как черновик
 * @returns Статус контента: 'draft', 'pending' или 'approved'
 */
export function determineContentStatus(
  user: User,
  saveAsDraft: boolean = false
): 'draft' | 'pending' | 'approved' {
  // Если явно указано сохранить как черновик
  if (saveAsDraft) {
    return 'draft';
  }

  // Администраторы и модераторы создают контент сразу в approved
  if (user.role === 'admin' || user.role === 'moderator') {
    return 'approved';
  }

  // Обычные пользователи создают контент в pending для модерации
  return 'pending';
}

/**
 * Проверяет, может ли пользователь создавать контент напрямую в approved статусе
 */
export function canApproveDirectly(user: User): boolean {
  return user.role === 'admin' || user.role === 'moderator';
}

/**
 * Проверяет, имеет ли пользователь права на модерацию
 */
export function canModerateContent(user: User): boolean {
  return user.role === 'admin' || user.role === 'moderator';
}

/**
 * Создаёт INSERT запрос с учётом статуса
 * Возвращает SQL и значения для query
 */
export function buildInsertWithStatus(
  table: string,
  fields: Record<string, any>,
  user: User,
  saveAsDraft: boolean = false
): { sql: string; values: any[] } {
  const status = determineContentStatus(user, saveAsDraft);
  const allFields = { ...fields, status, created_by: user.sub };

  const columns = Object.keys(allFields);
  const placeholders = columns.map((_, idx) => `$${idx + 1}`);
  const values = Object.values(allFields);

  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;

  return { sql, values };
}
