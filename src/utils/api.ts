export function mapApiPersonRow(row: any) {
  const result: any = {
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
    achievementsWiki: Array.isArray(row.achievements_wiki) ? row.achievements_wiki : [],
    achievements: row.achievements || [],
    achievementYears: Array.isArray(row.achievement_years) ? row.achievement_years : undefined,
    rulerPeriods: Array.isArray(row.ruler_periods)
      ? row.ruler_periods.map((p: any) => ({
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

export function parseLimitOffset(
  rawLimit: any,
  rawOffset: any,
  defaults: { defLimit: number; maxLimit: number }
) {
  const def = defaults.defLimit;
  const max = defaults.maxLimit;
  const lim = Number.parseInt(String(rawLimit ?? def), 10);
  const off = Number.parseInt(String(rawOffset ?? 0), 10);
  const limitParam = Math.min(Number.isFinite(lim) ? lim : def, max);
  const offsetParam = Math.max(Number.isFinite(off) ? off : 0, 0);
  return { limitParam, offsetParam };
}

export function paginateRows<T>(rows: T[], limitParam: number, offsetParam: number) {
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


