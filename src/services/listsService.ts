import { Pool, PoolClient } from 'pg';
import jwt from 'jsonwebtoken';
import { errors } from '../utils/errors';
import { BaseService } from './BaseService';
import { slugify } from '../utils/slug';
import { TelegramService } from './telegramService';
import { logger } from '../utils/logger';

// Database row interfaces
interface ListRow {
  id: number;
  title: string;
  owner_user_id: number;
  created_at: Date;
  updated_at: Date;
  moderation_status: ListModerationStatus;
  public_description: string;
  moderation_requested_at: Date | null;
  published_at: Date | null;
  moderated_by: number | null;
  moderated_at: Date | null;
  moderation_comment: string | null;
  public_slug: string | null;
}

interface ModerationListRow extends ListRow {
  owner_email: string | null;
  owner_full_name: string | null;
  owner_username: string | null;
}

type ListCountSummary = {
  total: number;
  persons: number;
  achievements: number;
  periods: number;
};

interface ListCountRow extends ListCountSummary {
  list_id: number;
}

export type ListModerationStatus = 'draft' | 'pending' | 'published' | 'rejected';

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
  moderation_status: ListModerationStatus;
  public_description: string;
  moderation_requested_at: Date | null;
  published_at: Date | null;
  moderation_comment: string | null;
  public_slug: string | null;
  moderated_at: Date | null;
  moderated_by: number | null;
  items_count: number;
  persons_count: number;
  achievements_count: number;
  periods_count: number;
}

export interface PublicListSummary {
  id: number;
  title: string;
  public_description: string;
  public_slug: string | null;
  published_at: Date | null;
  owner_user_id: number;
  owner_display_name: string | null;
  items_count: number;
  persons_count: number;
  achievements_count: number;
  periods_count: number;
}

export interface PublicListDetail extends PublicListSummary {
  items: Array<PublicListItem>;
}

export interface ModerationListSummary extends PublicListSummary {
  moderation_status: ListModerationStatus;
  moderation_requested_at: Date | null;
  moderation_comment: string | null;
  moderated_at: Date | null;
}

export type PublicListItem =
  | {
      list_item_id: number;
      type: 'person';
      person_id: string;
      name: string;
      birth_year: number | null;
      death_year: number | null;
      category: string | null;
    }
  | {
      list_item_id: number;
      type: 'achievement';
      achievement_id: number;
      person_id: string | null;
      year: number | null;
      description: string;
    }
  | {
      list_item_id: number;
      type: 'period';
      period_id: number;
      person_id: string | null;
      start_year: number | null;
      end_year: number | null;
      period_type: string | null;
    };

const MAX_PUBLIC_DESCRIPTION_LENGTH = 2000;
const MAX_PUBLIC_SLUG_LENGTH = 80;

export class ListsService extends BaseService {
  private jwtSecret: string;
  private telegramService: TelegramService;

  constructor(pool: Pool, telegramService: TelegramService) {
    super(pool);
    // Критичная переменная - должна быть установлена всегда
    const jwtSecret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET или JWT_ACCESS_SECRET должен быть установлен! Это критичная переменная окружения.');
    }
    this.jwtSecret = jwtSecret;
    this.telegramService = telegramService;
  }

  /**
   * Публичный список опубликованных списков
   */
  async getPublicLists(
    limit: number,
    offset: number
  ): Promise<{ total: number; data: PublicListSummary[] }> {
    const countResult = await this.executeQuery<{ cnt: number }>(
      `SELECT COUNT(*)::int AS cnt FROM lists WHERE moderation_status = 'published'`,
      [],
      { action: 'getPublicLists_count' }
    );

    const result = await this.executeQuery<ModerationListRow>(
      `SELECT l.id,
              l.owner_user_id,
              l.title,
              l.created_at,
              l.updated_at,
              l.moderation_status,
              l.public_description,
              l.moderation_requested_at,
              l.published_at,
              l.moderated_by,
              l.moderated_at,
              l.moderation_comment,
              l.public_slug,
              u.email AS owner_email,
              u.full_name AS owner_full_name,
              u.username AS owner_username
       FROM lists l
       LEFT JOIN users u ON u.id = l.owner_user_id
       WHERE l.moderation_status = 'published'
       ORDER BY l.published_at DESC NULLS LAST, l.id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
      { action: 'getPublicLists_data', params: { limit, offset } }
    );

    const listIds = result.rows.map(row => row.id);
    let summaries: Record<number, ListCountSummary> = {};

    if (listIds.length > 0) {
      const counts = await this.executeQuery<ListCountRow>(
        `SELECT list_id,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE item_type = 'person')::int AS persons,
                COUNT(*) FILTER (WHERE item_type = 'achievement')::int AS achievements,
                COUNT(*) FILTER (WHERE item_type = 'period')::int AS periods
         FROM list_items
         WHERE list_id = ANY($1::int[])
         GROUP BY list_id`,
        [listIds],
        { action: 'getPublicLists_counts', params: { listCount: listIds.length } }
      );
      summaries = Object.fromEntries(counts.rows.map(row => [row.list_id, row]));
    }

    return {
      total: countResult.rows[0]?.cnt ?? 0,
      data: result.rows.map(row => this.mapPublicSummary(row, summaries[row.id])),
    };
  }

  /**
   * Публичные детали списка по slug или ID
   */
  async getPublicList(identifier: string): Promise<PublicListDetail> {
    const trimmed = identifier.trim();
    const isNumeric = /^\d+$/.test(trimmed);
    const whereClause = isNumeric ? 'l.id = $1' : 'l.public_slug = $1';

    const result = await this.executeQuery<ModerationListRow>(
      `SELECT l.id,
              l.owner_user_id,
              l.title,
              l.created_at,
              l.updated_at,
              l.moderation_status,
              l.public_description,
              l.moderation_requested_at,
              l.published_at,
              l.moderated_by,
              l.moderated_at,
              l.moderation_comment,
              l.public_slug,
              u.email AS owner_email,
              u.full_name AS owner_full_name,
              u.username AS owner_username
       FROM lists l
       LEFT JOIN users u ON u.id = l.owner_user_id
       WHERE l.moderation_status = 'published'
         AND ${whereClause}
       LIMIT 1`,
      [trimmed],
      { action: 'getPublicList_lookup', params: { identifier: trimmed } }
    );

    if (result.rowCount === 0) {
      throw errors.notFound('Публичный список не найден');
    }

    const row = result.rows[0];
    const counts = await this.getListCounts(row.id);
    const summary = this.mapPublicSummary(row, counts);
    const items = await this.loadPublicItems(row.id);

    return {
      ...summary,
      items,
    };
  }

  /**
   * Модерация списка (approve / reject)
   */
  async reviewList(
    listId: number,
    moderatorId: number,
    action: 'approve' | 'reject',
    options?: { comment?: string; slug?: string }
  ): Promise<List> {
    const trimmedComment = options?.comment?.toString().trim() || null;
    const normalizedComment =
      trimmedComment && trimmedComment.length > MAX_PUBLIC_DESCRIPTION_LENGTH
        ? trimmedComment.slice(0, MAX_PUBLIC_DESCRIPTION_LENGTH)
        : trimmedComment;

    return this.executeTransaction(async client => {
      const currentResult = await client.query<{
        id: number;
        owner_user_id: number;
        title: string;
        moderation_status: ListModerationStatus;
        public_slug: string | null;
      }>(
        `SELECT id, owner_user_id, title, moderation_status, public_slug
         FROM lists
         WHERE id = $1
         FOR UPDATE`,
        [listId]
      );

      if (currentResult.rowCount === 0) {
        throw errors.notFound('Список не найден');
      }

      const current = currentResult.rows[0];

      if (current.moderation_status !== 'pending') {
        throw errors.badRequest('Список не находится в очереди на модерацию');
      }

      let updateResult;

      if (action === 'approve') {
        let slugCandidate = this.normalizeSlugCandidate(options?.slug);
        if (!slugCandidate) {
          slugCandidate = this.normalizeSlugCandidate(current.title);
        }
        if (!slugCandidate) {
          slugCandidate = `list-${listId}`;
        }
        const uniqueSlug = await this.ensureUniqueSlug(slugCandidate, listId, client);

        updateResult = await client.query<ListRow>(
          `UPDATE lists
           SET moderation_status = 'published',
               public_slug = $2,
               published_at = NOW(),
               moderated_by = $3,
               moderated_at = NOW(),
               moderation_comment = $4
           WHERE id = $1
           RETURNING id,
                     owner_user_id,
                     title,
                     created_at,
                     updated_at,
                     moderation_status,
                     public_description,
                     moderation_requested_at,
                     published_at,
                     moderated_by,
                     moderated_at,
                     moderation_comment,
                     public_slug`,
          [listId, uniqueSlug, moderatorId, normalizedComment]
        );
      } else {
        updateResult = await client.query<ListRow>(
          `UPDATE lists
           SET moderation_status = 'rejected',
               public_slug = NULL,
               published_at = NULL,
               moderated_by = $2,
               moderated_at = NOW(),
               moderation_comment = $3
           WHERE id = $1
           RETURNING id,
                     owner_user_id,
                     title,
                     created_at,
                     updated_at,
                     moderation_status,
                     public_description,
                     moderation_requested_at,
                     published_at,
                     moderated_by,
                     moderated_at,
                     moderation_comment,
                      public_slug`,
          [listId, moderatorId, normalizedComment]
        );
      }

      const counts = await this.getListCounts(listId, client);
      const result = this.mapList(updateResult.rows[0], counts);

      // Получаем email модератора для уведомления
      const moderatorResult = await client.query<{ email: string }>(
        `SELECT email FROM users WHERE id = $1`,
        [moderatorId]
      );

      if (moderatorResult.rowCount && moderatorResult.rowCount > 0) {
        const moderatorEmail = moderatorResult.rows[0].email;
        const updatedList = updateResult.rows[0];
        // Отправка уведомления в Telegram (неблокирующее)
        this.telegramService
          .notifyListReviewed(
            updatedList.title,
            action,
            moderatorEmail,
            listId,
            updatedList.public_slug || undefined
          )
          .catch(err =>
            logger.warn('Telegram notification failed (list reviewed)', { error: err })
          );
      }

      return result;
    });
  }

  private mapList(row: ListRow, summary?: ListCountSummary): List {
    const stats: ListCountSummary = summary ?? {
      total: 0,
      persons: 0,
      achievements: 0,
      periods: 0,
    };

    return {
      id: row.id,
      owner_user_id: row.owner_user_id,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
      moderation_status: row.moderation_status,
      public_description: row.public_description,
      moderation_requested_at: row.moderation_requested_at,
      published_at: row.published_at,
      moderated_by: row.moderated_by,
      moderated_at: row.moderated_at,
      moderation_comment: row.moderation_comment,
      public_slug: row.public_slug,
      items_count: stats.total ?? 0,
      persons_count: stats.persons ?? 0,
      achievements_count: stats.achievements ?? 0,
      periods_count: stats.periods ?? 0,
    };
  }

  private mapPublicSummary(row: ModerationListRow, summary?: ListCountSummary): PublicListSummary {
    const stats: ListCountSummary = summary ?? {
      total: 0,
      persons: 0,
      achievements: 0,
      periods: 0,
    };

    const slug =
      row.public_slug ?? (row.moderation_status === 'published' ? `list-${row.id}` : null);

    return {
      id: row.id,
      title: row.title,
      public_description: row.public_description,
      public_slug: slug,
      published_at: row.published_at,
      owner_user_id: row.owner_user_id,
      owner_display_name: this.resolveOwnerDisplayName(row),
      items_count: stats.total ?? 0,
      persons_count: stats.persons ?? 0,
      achievements_count: stats.achievements ?? 0,
      periods_count: stats.periods ?? 0,
    };
  }

  private sanitizeDescription(description?: string | null): string {
    const value = (description ?? '').toString().trim();
    return value.slice(0, MAX_PUBLIC_DESCRIPTION_LENGTH);
  }

  private resolveOwnerDisplayName(row: {
    owner_full_name?: string | null;
    owner_username?: string | null;
    owner_email?: string | null;
  }): string | null {
    const fullName = row.owner_full_name?.trim();
    if (fullName) return fullName;
    const username = row.owner_username?.trim();
    if (username) return username;
    const email = row.owner_email?.trim();
    return email || null;
  }

  private normalizeSlugCandidate(candidate?: string | null): string {
    const raw = (candidate ?? '').toString();
    const slug = slugify(raw, MAX_PUBLIC_SLUG_LENGTH);
    return slug.replace(/^-+/, '').replace(/-+$/, '');
  }

  private async ensureUniqueSlug(
    base: string,
    listId: number,
    client?: PoolClient
  ): Promise<string> {
    const normalizedBase = base || `list-${listId}`;
    let slug = normalizedBase;
    let attempt = 1;
    const runner = client ? client.query.bind(client) : this.pool.query.bind(this.pool);

    while (true) {
      const result = await runner(
        `SELECT 1 FROM lists WHERE public_slug = $1 AND id <> $2 LIMIT 1`,
        [slug, listId]
      );
      if ((result.rowCount ?? 0) === 0) {
        return slug;
      }
      attempt += 1;
      const suffix = `-${attempt}`;
      const trimmedBase = normalizedBase.slice(0, MAX_PUBLIC_SLUG_LENGTH - suffix.length);
      slug = `${trimmedBase}${suffix}`;
      if (attempt > 100) {
        throw errors.server('Не удалось подобрать уникальный slug для списка');
      }
    }
  }

  private async getListCounts(listId: number, client?: PoolClient): Promise<ListCountSummary> {
    const runner = client ? client.query.bind(client) : this.pool.query.bind(this.pool);
    const result = await runner(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE item_type = 'person')::int AS persons,
              COUNT(*) FILTER (WHERE item_type = 'achievement')::int AS achievements,
              COUNT(*) FILTER (WHERE item_type = 'period')::int AS periods
       FROM list_items
       WHERE list_id = $1`,
      [listId]
    );

    const row = result.rows[0] as ListCountSummary | undefined;
    return {
      total: row?.total ?? 0,
      persons: row?.persons ?? 0,
      achievements: row?.achievements ?? 0,
      periods: row?.periods ?? 0,
    };
  }

  private async loadPublicItems(listId: number): Promise<PublicListItem[]> {
    const itemsResult = await this.executeQuery<ListItem>(
      `SELECT id, list_id, item_type, person_id, achievement_id, period_id, position
       FROM list_items
       WHERE list_id = $1
       ORDER BY position ASC, id ASC`,
      [listId],
      { action: 'loadPublicItems_items', params: { listId } }
    );

    const items = itemsResult.rows;

    const personIds = Array.from(
      new Set(
        items
          .filter(item => item.item_type === 'person' && item.person_id)
          .map(item => item.person_id as string)
      )
    );
    const achievementIds = Array.from(
      new Set(
        items
          .filter(item => item.item_type === 'achievement' && item.achievement_id)
          .map(item => item.achievement_id as number)
      )
    );
    const periodIds = Array.from(
      new Set(
        items
          .filter(item => item.item_type === 'period' && item.period_id)
          .map(item => item.period_id as number)
      )
    );

    const personsMap = new Map<
      string,
      {
        name: string;
        birth_year: number | null;
        death_year: number | null;
        category: string | null;
      }
    >();
    const achievementsMap = new Map<
      number,
      { description: string; year: number | null; person_id: string | null }
    >();
    const periodsMap = new Map<
      number,
      {
        start_year: number | null;
        end_year: number | null;
        period_type: string | null;
        person_id: string | null;
      }
    >();

    if (personIds.length > 0) {
      const persons = await this.executeQuery<{
        id: string;
        name: string;
        birth_year: number | null;
        death_year: number | null;
        category: string | null;
      }>(
        `SELECT id, name, birth_year, death_year, category
         FROM persons
         WHERE id = ANY($1::text[])
           AND status = 'approved'`,
        [personIds],
        { action: 'loadPublicItems_persons', params: { count: personIds.length } }
      );
      persons.rows.forEach(person => {
        personsMap.set(person.id, {
          name: person.name,
          birth_year: person.birth_year,
          death_year: person.death_year,
          category: person.category,
        });
      });
    }

    if (achievementIds.length > 0) {
      const achievements = await this.executeQuery<{
        id: number;
        description: string;
        year: number | null;
        person_id: string | null;
      }>(
        `SELECT id, description, year, person_id
         FROM achievements
         WHERE id = ANY($1::int[])
           AND status = 'approved'`,
        [achievementIds],
        { action: 'loadPublicItems_achievements', params: { count: achievementIds.length } }
      );
      achievements.rows.forEach(achievement => {
        achievementsMap.set(achievement.id, {
          description: achievement.description,
          year: achievement.year,
          person_id: achievement.person_id,
        });
      });
    }

    if (periodIds.length > 0) {
      const periods = await this.executeQuery<{
        id: number;
        start_year: number | null;
        end_year: number | null;
        period_type: string | null;
        person_id: string | null;
        status: string;
      }>(
        `SELECT id, start_year, end_year, period_type, person_id, status
         FROM periods
         WHERE id = ANY($1::int[])
           AND status = 'approved'`,
        [periodIds],
        { action: 'loadPublicItems_periods', params: { count: periodIds.length } }
      );
      periods.rows.forEach(period => {
        periodsMap.set(period.id, {
          start_year: period.start_year,
          end_year: period.end_year,
          period_type: period.period_type,
          person_id: period.person_id,
        });
      });
    }

    const enriched: PublicListItem[] = [];

    for (const item of items) {
      if (item.item_type === 'person') {
        const personId = item.person_id;
        if (!personId) continue;
        const data = personsMap.get(personId);
        if (!data) continue;
        enriched.push({
          list_item_id: item.id,
          type: 'person',
          person_id: personId,
          name: data.name,
          birth_year: data.birth_year ?? null,
          death_year: data.death_year ?? null,
          category: data.category ?? null,
        });
      } else if (item.item_type === 'achievement') {
        const achievementId = item.achievement_id;
        if (!achievementId) continue;
        const data = achievementsMap.get(achievementId);
        if (!data) continue;
        enriched.push({
          list_item_id: item.id,
          type: 'achievement',
          achievement_id: achievementId,
          description: data.description,
          year: data.year ?? null,
          person_id: data.person_id ?? null,
        });
      } else if (item.item_type === 'period') {
        const periodId = item.period_id;
        if (!periodId) continue;
        const data = periodsMap.get(periodId);
        if (!data) continue;
        enriched.push({
          list_item_id: item.id,
          type: 'period',
          period_id: periodId,
          start_year: data.start_year ?? null,
          end_year: data.end_year ?? null,
          period_type: data.period_type ?? null,
          person_id: data.person_id ?? null,
        });
      }
    }

    return enriched;
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

    const result = await this.executeQuery<ListRow>(
      `INSERT INTO lists (owner_user_id, title)
       VALUES ($1, $2)
       RETURNING id,
                 owner_user_id,
                 title,
                 created_at,
                 updated_at,
                 moderation_status,
                 public_description,
                 moderation_requested_at,
                 published_at,
                 moderated_by,
                 moderated_at,
                 moderation_comment,
                 public_slug`,
      [userId, t],
      {
        action: 'createList',
        params: { userId, title: t },
      }
    );

    return this.mapList(result.rows[0], {
      total: 0,
      persons: 0,
      achievements: 0,
      periods: 0,
    });
  }

  /**
   * Получение списков пользователя
   */
  async getUserLists(userId: number): Promise<List[]> {
    const rows = await this.executeQuery<ListRow>(
      `SELECT id,
              owner_user_id,
              title,
              created_at,
              updated_at,
              moderation_status,
              public_description,
              moderation_requested_at,
              published_at,
              moderated_by,
              moderated_at,
              moderation_comment,
              public_slug
       FROM lists
       WHERE owner_user_id = $1
       ORDER BY id ASC`,
      [userId],
      {
        action: 'getUserLists',
        params: { userId },
      }
    );

    const ids = rows.rows.map((r: ListRow) => r.id);
    let counts: Record<number, ListCountSummary> = {};

    if (ids.length > 0) {
      const inParams = ids.map((_, i: number) => `$${i + 1}`).join(',');
      const c = await this.executeQuery<ListCountRow>(
        `SELECT list_id,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE item_type = 'person')::int AS persons,
                COUNT(*) FILTER (WHERE item_type = 'achievement')::int AS achievements,
                COUNT(*) FILTER (WHERE item_type = 'period')::int AS periods
         FROM list_items
         WHERE list_id IN (${inParams})
         GROUP BY list_id`,
        ids,
        {
          action: 'getUserLists_countItems',
          params: { userId, listIdsCount: ids.length },
        }
      );
      counts = Object.fromEntries(
        c.rows.map((r: ListCountRow) => [r.list_id, r as ListCountSummary])
      );
    }

    return rows.rows.map((r: ListRow) => this.mapList(r, counts[r.id]));
  }

  /**
   * Запрос публикации списка владельцем
   */
  async requestPublication(listId: number, userId: number, description?: string): Promise<List> {
    const sanitizedDescription = this.sanitizeDescription(description);

    const current = await this.executeQuery<{
      owner_user_id: number;
      moderation_status: ListModerationStatus;
    }>(`SELECT owner_user_id, moderation_status FROM lists WHERE id = $1`, [listId], {
      action: 'requestPublication_lookup',
      params: { listId, userId },
    });

    if (current.rowCount === 0) {
      throw errors.notFound('Список не найден');
    }

    const row = current.rows[0];

    if (row.owner_user_id !== userId) {
      throw errors.forbidden('Нет прав на публикацию этого списка');
    }

    if (row.moderation_status === 'published') {
      throw errors.badRequest('Список уже опубликован');
    }

    const updated = await this.executeQuery<ListRow>(
      `UPDATE lists
       SET public_description = $3,
           moderation_status = 'pending',
           moderation_requested_at = NOW(),
           moderation_comment = NULL,
           moderated_by = NULL,
           moderated_at = NULL,
           published_at = NULL,
           public_slug = NULL
       WHERE id = $1 AND owner_user_id = $2
       RETURNING id,
                 owner_user_id,
                 title,
                 created_at,
                 updated_at,
                 moderation_status,
                 public_description,
                 moderation_requested_at,
                 published_at,
                 moderated_by,
                 moderated_at,
                 moderation_comment,
                 public_slug`,
      [listId, userId, sanitizedDescription],
      {
        action: 'requestPublication_update',
        params: { listId, userId },
      }
    );

    const counts = await this.getListCounts(listId);
    const result = this.mapList(updated.rows[0], counts);

    // Получаем email владельца для уведомления
    const ownerResult = await this.executeQuery<{ email: string }>(
      `SELECT email FROM users WHERE id = $1`,
      [userId],
      { action: 'requestPublication_getOwnerEmail', params: { userId } }
    );

    if (ownerResult.rowCount && ownerResult.rowCount > 0) {
      const ownerEmail = ownerResult.rows[0].email;
      // Отправка уведомления в Telegram (неблокирующее)
      this.telegramService
        .notifyListPublicationRequested(updated.rows[0].title, ownerEmail, listId, counts.total)
        .catch(err =>
          logger.warn('Telegram notification failed (list publication requested)', { error: err })
        );
    }

    return result;
  }

  /**
   * Модераторский список списков
   */
  async getModerationQueue(
    status: ListModerationStatus | null,
    limit: number,
    offset: number
  ): Promise<{ total: number; data: ModerationListSummary[] }> {
    let paramIndex = 1;
    const params: Array<string | number> = [];
    const filters: string[] = [];

    if (status) {
      filters.push(`l.moderation_status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const countResult = await this.executeQuery<{ cnt: number }>(
      `SELECT COUNT(*)::int AS cnt FROM lists l ${whereClause}`,
      params,
      { action: 'getModerationQueue_count', params: { status } }
    );

    const listResult = await this.executeQuery<ModerationListRow>(
      `SELECT l.id,
              l.owner_user_id,
              l.title,
              l.created_at,
              l.updated_at,
              l.moderation_status,
              l.public_description,
              l.moderation_requested_at,
              l.published_at,
              l.moderated_by,
              l.moderated_at,
              l.moderation_comment,
              l.public_slug,
              u.email AS owner_email,
              u.full_name AS owner_full_name,
              u.username AS owner_username
       FROM lists l
       LEFT JOIN users u ON u.id = l.owner_user_id
       ${whereClause}
       ORDER BY COALESCE(l.moderation_requested_at, l.updated_at) DESC NULLS LAST, l.id DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
      { action: 'getModerationQueue_lists', params: { status, limit, offset } }
    );

    const listIds = listResult.rows.map(row => row.id);
    let summaries: Record<number, ListCountSummary> = {};

    if (listIds.length > 0) {
      const counts = await this.executeQuery<ListCountRow>(
        `SELECT list_id,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE item_type = 'person')::int AS persons,
                COUNT(*) FILTER (WHERE item_type = 'achievement')::int AS achievements,
                COUNT(*) FILTER (WHERE item_type = 'period')::int AS periods
         FROM list_items
         WHERE list_id = ANY($1::int[])
         GROUP BY list_id`,
        [listIds],
        { action: 'getModerationQueue_counts', params: { listCount: listIds.length } }
      );
      summaries = Object.fromEntries(counts.rows.map(row => [row.list_id, row]));
    }

    const data = listResult.rows.map(row => {
      const base = this.mapPublicSummary(row, summaries[row.id]);
      return {
        ...base,
        moderation_status: row.moderation_status,
        moderation_requested_at: row.moderation_requested_at,
        moderation_comment: row.moderation_comment,
        moderated_at: row.moderated_at,
      };
    });

    return {
      total: countResult.rows[0]?.cnt ?? 0,
      data,
    };
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
      throw errors.forbidden('Нет прав на удаление элемента из списка');
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
    let listId: number;

    try {
      const payload = jwt.verify(code, this.jwtSecret) as JwtPayload;
      listId = Number(payload.listId);

      if (!Number.isFinite(listId) || listId <= 0) {
        throw new Error('bad list');
      }
    } catch (e) {
      throw errors.badRequest('Некорректный код');
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
      id: listRow.rows[0].id,
      list_id: listId,
      owner_user_id: listRow.rows[0].owner_user_id,
      title: listRow.rows[0].title,
      items: items.rows,
    };
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
