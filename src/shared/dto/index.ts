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

// Re-export centralized runtime descriptors and version
export { dtoDescriptors, DTO_VERSION } from '../../dtoDescriptors'
