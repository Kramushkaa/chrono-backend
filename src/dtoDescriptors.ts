export const DTO_VERSION = '2025-08-26-1';

// Very simple, hand-maintained descriptors to detect drift across apps
export const dtoDescriptors = {
  UpsertPerson: {
    id: 'string',
    name: 'string',
    birthYear: 'int',
    deathYear: 'int',
    category: 'string',
    description: 'string',
    imageUrl: 'url|null?',
    wikiLink: 'url|null?',
    saveAsDraft: 'boolean?',
  },
  LifePeriodItem: {
    country_id: 'int+',
    start_year: 'int',
    end_year: 'int',
    period_type: 'string?',
  },
  LifePeriods: {
    periods: 'LifePeriodItem[]',
  },
  PersonEditPayload: {
    name: 'string?',
    birthYear: 'int?',
    deathYear: 'int?',
    category: 'string?',
    description: 'string?',
    imageUrl: 'url|null?',
    wikiLink: 'url|null?',
  },
  AchievementGeneric: {
    year: 'int',
    description: 'string',
    wikipedia_url: 'url|null?',
    image_url: 'url|null?',
    country_id: 'int|null?',
  },
  AchievementPerson: {
    year: 'int',
    description: 'string',
    wikipedia_url: 'url|null?',
    image_url: 'url|null?',
    saveAsDraft: 'boolean?',
  },
} as const;
