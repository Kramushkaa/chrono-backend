import { PersonsViewRow, PersonWithRelations } from '../types/database';

// ============================================
// API Response типы
// ============================================

export interface ApiPerson {
  id: string;
  name: string;
  birthYear: number;
  deathYear: number | null;
  reignStart: number | null;
  reignEnd: number | null;
  category: string;
  country: string;
  description: string | null;
  wikiLink: string | null;
  achievementsWiki: string[];
  achievements: string[];
  achievementYears?: number[];
  rulerPeriods: Array<{
    startYear: number;
    endYear: number;
    countryId: number;
    countryName: string;
  }>;
  imageUrl: string | null;
  status?: 'draft' | 'pending' | 'approved' | 'rejected';
}

// ============================================
// Маппинг из database row в API response
// ============================================

export function mapApiPersonRow(row: PersonsViewRow | PersonWithRelations): ApiPerson {
  const achievements =
    Array.isArray(row.achievements) && row.achievements.length > 0
      ? typeof row.achievements[0] === 'string'
        ? (row.achievements as string[])
        : []
      : [];

  const result: ApiPerson = {
    id: row.id,
    name: row.name,
    birthYear: row.birth_year,
    deathYear: row.death_year,
    reignStart: row.reign_start,
    reignEnd: row.reign_end,
    category: row.category,
    country: row.country,
    description: row.description,
    wikiLink: row.wiki_link || null,
    achievementsWiki:
      'achievements_wiki' in row && Array.isArray(row.achievements_wiki)
        ? row.achievements_wiki
        : [],
    achievements,
    achievementYears:
      'achievement_years' in row && Array.isArray(row.achievement_years)
        ? row.achievement_years
        : undefined,
    rulerPeriods:
      'ruler_periods' in row && Array.isArray(row.ruler_periods)
        ? row.ruler_periods.map(p => ({
            startYear: p.start_year,
            endYear: p.end_year,
            countryId: p.country_id,
            countryName: p.country_name,
          }))
        : [],
    imageUrl: row.image_url,
  };

  // Добавляем поля модерации, если они есть в исходной строке
  if (row.status !== undefined) {
    result.status = row.status;
  }

  return result;
}

// ============================================
// Pagination utilities
// ============================================

export interface PaginationDefaults {
  defLimit: number;
  maxLimit: number;
}

export interface PaginationParams {
  limitParam: number;
  offsetParam: number;
}

export function parseLimitOffset(
  rawLimit: string | number | undefined,
  rawOffset: string | number | undefined,
  defaults: PaginationDefaults
): PaginationParams {
  const def = defaults.defLimit;
  const max = defaults.maxLimit;
  const lim = Number.parseInt(String(rawLimit ?? def), 10);
  const off = Number.parseInt(String(rawOffset ?? 0), 10);
  const limitParam = Math.min(Number.isFinite(lim) ? lim : def, max);
  const offsetParam = Math.max(Number.isFinite(off) ? off : 0, 0);
  return { limitParam, offsetParam };
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
}

export function paginateRows<T>(
  rows: T[],
  limitParam: number,
  offsetParam: number
): PaginatedResult<T> {
  const hasMore = rows.length > limitParam;
  const data = hasMore ? rows.slice(0, limitParam) : rows;
  return {
    data,
    meta: {
      limit: limitParam,
      offset: offsetParam,
      hasMore,
      nextOffset: hasMore ? offsetParam + limitParam : null,
    },
  };
}
