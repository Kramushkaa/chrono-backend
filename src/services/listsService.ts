import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { errors } from '../utils/errors';
import { BaseService } from './BaseService';

// Database row interfaces
interface ListRow {
  id: number;
  title: string;
  user_id: number;
  created_at: Date;
  updated_at: Date;
}

interface ListCountRow {
  list_id: number;
  cnt: number;
}

interface JwtPayload {
  listId: number;
  iat?: number;
  exp?: number;
}

export interface ListItem {
  id: number;
  list_id: number;
  item_type: 'person' | 'achievement' | 'period';
  person_id?: string | null;
  achievement_id?: number | null;
  period_id?: number | null;
  position?: number;
  created_at?: Date;
}

export interface List {
  id: number;
  owner_user_id: number;
  title: string;
  created_at: Date;
  updated_at: Date;
}

export class ListsService extends BaseService {
  private jwtSecret: string;

  constructor(pool: Pool) {
    super(pool);
    this.jwtSecret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-secret';
  }

  /**
   * Создание списка
   */
  async createList(title: string, userId: number): Promise<any> {
    const t = title.trim();

    if (t.length === 0) {
      throw errors.badRequest('Название списка обязательно');
    }

    if (t.length > 200) {
      throw errors.badRequest('Название списка слишком длинное (макс. 200)');
    }

    const result = await this.executeQuery(
      'INSERT INTO lists (owner_user_id, title) VALUES ($1, $2) RETURNING id, title',
      [userId, t],
      {
        action: 'createList',
        params: { userId, title: t },
      }
    );

    return result.rows[0];
  }

  /**
   * Получение списков пользователя
   */
  async getUserLists(userId: number): Promise<any[]> {
    const rows = await this.executeQuery(
      'SELECT id, owner_user_id, title, created_at, updated_at FROM lists WHERE owner_user_id = $1 ORDER BY id ASC',
      [userId],
      {
        action: 'getUserLists',
        params: { userId },
      }
    );

    const ids = rows.rows.map((r: ListRow) => r.id);
    let counts: Record<number, number> = {};

    if (ids.length > 0) {
      const inParams = ids.map((_, i: number) => `$${i + 1}`).join(',');
      const c = await this.executeQuery<ListCountRow>(
        `SELECT list_id, COUNT(*)::int AS cnt FROM list_items WHERE list_id IN (${inParams}) GROUP BY list_id`,
        ids,
        {
          action: 'getUserLists_countItems',
          params: { userId, listIdsCount: ids.length },
        }
      );
      counts = Object.fromEntries(c.rows.map((r: ListCountRow) => [r.list_id, r.cnt]));
    }

    return rows.rows.map((r: ListRow) => ({
      id: r.id,
      title: r.title,
      items_count: counts[r.id] || 0,
    }));
  }

  /**
   * Получение элементов списка
   */
  async getListItems(listId: number, userId: number): Promise<ListItem[]> {
    // Проверка прав
    const own = await this.executeQuery(
      'SELECT 1 FROM lists WHERE id = $1 AND owner_user_id = $2',
      [listId, userId],
      {
        action: 'getListItems_checkOwnership',
        params: { listId, userId },
      }
    );

    if (own.rowCount === 0) {
      throw errors.forbidden('Нет прав на доступ к списку');
    }

    const rows = await this.executeQuery(
      'SELECT id, list_id, item_type, person_id, achievement_id, period_id, position, created_at FROM list_items WHERE list_id = $1 ORDER BY position ASC, id ASC',
      [listId],
      {
        action: 'getListItems_getItems',
        params: { listId, userId },
      }
    );

    return rows.rows;
  }

  /**
   * Добавление элемента в список
   */
  async addListItem(
    listId: number,
    userId: number,
    itemType: 'person' | 'achievement' | 'period',
    itemId: string | number
  ): Promise<any> {
    // Проверка прав
    const own = await this.executeQuery(
      'SELECT 1 FROM lists WHERE id = $1 AND owner_user_id = $2',
      [listId, userId],
      {
        action: 'addListItem_checkOwnership',
        params: { listId, userId, itemType, itemId },
      }
    );

    if (own.rowCount === 0) {
      throw errors.forbidden('Нет прав на изменение списка');
    }

    if (!['person', 'achievement', 'period'].includes(itemType)) {
      throw errors.badRequest('Некорректный тип элемента');
    }

    // Проверка существования элемента
    if (itemType === 'person') {
      const r = await this.executeQuery('SELECT 1 FROM persons WHERE id = $1', [itemId], {
        action: 'addListItem_checkPersonExists',
        params: { listId, userId, itemType, itemId },
      });
      if (r.rowCount === 0) {
        throw errors.notFound('Личность не найдена');
      }

      // Проверка на дубликат
      const exists = await this.executeQuery(
        'SELECT id FROM list_items WHERE list_id=$1 AND item_type=$2 AND person_id=$3 LIMIT 1',
        [listId, 'person', itemId],
        {
          action: 'addListItem_checkPersonDuplicate',
          params: { listId, userId, itemType, itemId },
        }
      );

      if (exists.rowCount && exists.rowCount > 0) {
        return { data: exists.rows[0], message: 'already_exists' };
      }
    } else if (itemType === 'achievement') {
      const r = await this.executeQuery('SELECT 1 FROM achievements WHERE id = $1', [itemId], {
        action: 'addListItem_checkAchievementExists',
        params: { listId, userId, itemType, itemId },
      });
      if (r.rowCount === 0) {
        throw errors.notFound('Достижение не найдено');
      }

      const exists = await this.executeQuery(
        'SELECT id FROM list_items WHERE list_id=$1 AND item_type=$2 AND achievement_id=$3 LIMIT 1',
        [listId, 'achievement', itemId],
        {
          action: 'addListItem_checkAchievementDuplicate',
          params: { listId, userId, itemType, itemId },
        }
      );

      if (exists.rowCount && exists.rowCount > 0) {
        return { data: exists.rows[0], message: 'already_exists' };
      }
    } else if (itemType === 'period') {
      const r = await this.executeQuery('SELECT 1 FROM periods WHERE id = $1', [itemId], {
        action: 'addListItem_checkPeriodExists',
        params: { listId, userId, itemType, itemId },
      });
      if (r.rowCount === 0) {
        throw errors.notFound('Период не найден');
      }

      const exists = await this.executeQuery(
        'SELECT id FROM list_items WHERE list_id=$1 AND item_type=$2 AND period_id=$3 LIMIT 1',
        [listId, 'period', itemId],
        {
          action: 'addListItem_checkPeriodDuplicate',
          params: { listId, userId, itemType, itemId },
        }
      );

      if (exists.rowCount && exists.rowCount > 0) {
        return { data: exists.rows[0], message: 'already_exists' };
      }
    }

    // Вставка элемента
    const result = await this.executeQuery(
      'INSERT INTO list_items (list_id, item_type, person_id, achievement_id, period_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [
        listId,
        itemType,
        itemType === 'person' ? itemId : null,
        itemType === 'achievement' ? itemId : null,
        itemType === 'period' ? itemId : null,
      ],
      {
        action: 'addListItem_insert',
        params: { listId, userId, itemType, itemId },
      }
    );

    return { data: result.rows[0] };
  }

  /**
   * Удаление элемента из списка
   */
  async deleteListItem(listId: number, itemId: number, userId: number): Promise<void> {
    // Проверка прав
    const own = await this.executeQuery(
      'SELECT 1 FROM lists WHERE id = $1 AND owner_user_id = $2',
      [listId, userId],
      {
        action: 'deleteListItem_checkOwnership',
        params: { listId, itemId, userId },
      }
    );

    if (own.rowCount === 0) {
      throw errors.forbidden('Нет прав на изменение списка');
    }

    await this.executeQuery(
      'DELETE FROM list_items WHERE id = $1 AND list_id = $2',
      [itemId, listId],
      {
        action: 'deleteListItem_delete',
        params: { listId, itemId, userId },
      }
    );
  }

  /**
   * Удаление списка
   */
  async deleteList(listId: number, userId: number): Promise<void> {
    // Проверка прав
    const own = await this.executeQuery(
      'SELECT 1 FROM lists WHERE id = $1 AND owner_user_id = $2',
      [listId, userId],
      {
        action: 'deleteList_checkOwnership',
        params: { listId, userId },
      }
    );

    if (own.rowCount === 0) {
      throw errors.forbidden('Нет прав на удаление списка');
    }

    // Удаляем элементы списка
    await this.executeQuery('DELETE FROM list_items WHERE list_id = $1', [listId], {
      action: 'deleteList_deleteItems',
      params: { listId, userId },
    });

    // Удаляем сам список
    await this.executeQuery(
      'DELETE FROM lists WHERE id = $1 AND owner_user_id = $2',
      [listId, userId],
      {
        action: 'deleteList_deleteList',
        params: { listId, userId },
      }
    );
  }

  /**
   * Создание share-кода для списка
   */
  async shareList(listId: number, userId: number): Promise<string> {
    const own = await this.executeQuery(
      'SELECT owner_user_id, title FROM lists WHERE id = $1',
      [listId],
      {
        action: 'shareList_checkOwnership',
        params: { listId, userId },
      }
    );

    if (own.rowCount === 0) {
      throw errors.notFound('Список не найден');
    }

    if (own.rows[0].owner_user_id !== userId) {
      throw errors.forbidden('Нет прав на публикацию списка');
    }

    const code = jwt.sign({ listId: Number(listId), owner: String(userId) }, this.jwtSecret, {
      expiresIn: '365d',
    });

    return code;
  }

  /**
   * Получение списка по share-коду
   */
  async getSharedList(code: string): Promise<any> {
    try {
      const payload = jwt.verify(code, this.jwtSecret) as JwtPayload;
      const listId = Number(payload.listId);

      if (!Number.isFinite(listId) || listId <= 0) {
        throw new Error('bad list');
      }

      const listRow = await this.executeQuery(
        'SELECT id, owner_user_id, title FROM lists WHERE id = $1',
        [listId],
        {
          action: 'getSharedList_getList',
          params: { listId, code },
        }
      );

      if (listRow.rowCount === 0) {
        throw errors.notFound('Список не найден');
      }

      const items = await this.executeQuery(
        'SELECT id, list_id, item_type, person_id, achievement_id, period_id, position FROM list_items WHERE list_id = $1 ORDER BY position ASC, id ASC',
        [listId],
        {
          action: 'getSharedList_getItems',
          params: { listId, code },
        }
      );

      return {
        list_id: listId,
        owner_user_id: listRow.rows[0].owner_user_id,
        title: listRow.rows[0].title,
        items: items.rows,
      };
    } catch (e) {
      throw errors.badRequest('invalid_share_code');
    }
  }

  /**
   * Копирование списка из share-кода в аккаунт пользователя
   */
  async copyListFromShare(code: string, userId: number, newTitle?: string): Promise<any> {
    if (!code || code.trim().length === 0) {
      throw errors.badRequest('Не указан код');
    }

    let listId: number;

    try {
      const payload = jwt.verify(code, this.jwtSecret) as JwtPayload;
      listId = Number(payload.listId);

      if (!Number.isFinite(listId) || listId <= 0) {
        throw new Error('bad list');
      }
    } catch {
      throw errors.badRequest('Некорректный код');
    }

    const src = await this.executeQuery('SELECT id, title FROM lists WHERE id = $1', [listId], {
      action: 'copyListFromShare_getSource',
      params: { code, userId, listId },
    });

    if (src.rowCount === 0) {
      throw errors.notFound('Список не найден');
    }

    const fallbackTitle = src.rows[0].title || 'Импортированный список';
    const t0 = (newTitle || '').trim();
    const finalTitle = t0.length > 0 ? t0 : fallbackTitle;

    if (finalTitle.length > 200) {
      throw errors.badRequest('Название списка слишком длинное (макс. 200)');
    }

    // Создаем новый список
    const ins = await this.executeQuery(
      'INSERT INTO lists (owner_user_id, title) VALUES ($1, $2) RETURNING id',
      [userId, finalTitle],
      {
        action: 'copyListFromShare_createList',
        params: { code, userId, listId, finalTitle },
      }
    );

    const newListId = ins.rows[0].id;

    // Копируем элементы
    await this.executeQuery(
      `INSERT INTO list_items (list_id, item_type, person_id, achievement_id, period_id, position)
       SELECT $1, item_type, person_id, achievement_id, period_id, position
       FROM list_items WHERE list_id = $2
       ORDER BY position ASC, id ASC`,
      [newListId, listId],
      {
        action: 'copyListFromShare_copyItems',
        params: { code, userId, listId, newListId },
      }
    );

    return { id: newListId, title: finalTitle };
  }
}
