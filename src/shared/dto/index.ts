export type AchievementPersonDTO = {
  year: number
  description: string
  wikipedia_url?: string | null
  image_url?: string | null
  saveAsDraft?: boolean
}

export type ListPublicationRequestDTO = {
  description?: string
}

export type ListModerationActionDTO = {
  action: 'approve' | 'reject'
  comment?: string
  slug?: string
}

export type PersonLifePeriodInputDTO = {
  countryId: number
  start: number
  end: number
}

export type UpsertPersonDTO = {
  id: string
  name: string
  birthYear: number
  deathYear: number
  category: string
  description: string
  imageUrl?: string | null
  wikiLink?: string | null
  saveAsDraft?: boolean
  lifePeriods?: PersonLifePeriodInputDTO[]
}

// Lightweight descriptor to detect drift via runtime check (optional)
export const dtoDescriptors = {
  UpsertPerson: {
    id: 'string', name: 'string', birthYear: 'int', deathYear: 'int', category: 'string', description: 'string', imageUrl: 'url|null?', wikiLink: 'url|null?', saveAsDraft: 'boolean?', lifePeriods: 'PersonLifePeriodInput[]?'
  },
  PersonLifePeriodInput: {
    countryId: 'int+', start: 'int', end: 'int'
  },
  LifePeriodItem: {
    country_id: 'int+', start_year: 'int', end_year: 'int', period_type: 'string?'
  },
  LifePeriods: { periods: 'LifePeriodItem[]' },
  PersonEditPayload: {
    name: 'string?', birthYear: 'int?', deathYear: 'int?', category: 'string?', description: 'string?', imageUrl: 'url|null?', wikiLink: 'url|null?'
  },
  AchievementGeneric: {
    year: 'int', description: 'string', wikipedia_url: 'url|null?', image_url: 'url|null?', country_id: 'int|null?'
  },
  AchievementPerson: {
    year: 'int', description: 'string', wikipedia_url: 'url|null?', image_url: 'url|null?', saveAsDraft: 'boolean?'
  },
  ListPublicationRequest: {
    description: 'string?'
  },
  ListModerationAction: {
    action: "enum('approve'|'reject')",
    comment: 'string?',
    slug: 'string?'
  }
} as const

export const DTO_VERSION = '2025-11-08-2'
