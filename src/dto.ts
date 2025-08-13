import { z } from 'zod'

export const UpsertPersonSchema = z.object({
  id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  birthYear: z.number().int(),
  deathYear: z.number().int(),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().max(5000).default(''),
  imageUrl: z.string().trim().url().max(1000).nullable().optional(),
  wikiLink: z.string().trim().url().max(1000).nullable().optional(),
})

export const LifePeriodItemSchema = z.object({
  country_id: z.number().int().positive(),
  start_year: z.number().int(),
  end_year: z.number().int(),
  period_type: z.string().trim().optional().default('life')
})

export const LifePeriodsSchema = z.object({
  periods: z.array(LifePeriodItemSchema).min(1)
})

export const PersonEditPayloadSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  birthYear: z.number().int().optional(),
  deathYear: z.number().int().optional(),
  category: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(5000).optional(),
  imageUrl: z.string().trim().url().max(1000).nullable().optional(),
  wikiLink: z.string().trim().url().max(1000).nullable().optional(),
}).refine((obj) => Object.keys(obj).length > 0, { message: 'Пустой payload' })

export const AchievementGenericSchema = z.object({
  year: z.number().int(),
  description: z.string().trim().min(2).max(2000),
  wikipedia_url: z.string().trim().url().max(1000).nullable().optional(),
  image_url: z.string().trim().url().max(1000).nullable().optional(),
  country_id: z.number().int().positive().nullable().optional()
})

export const AchievementPersonSchema = z.object({
  year: z.number().int(),
  description: z.string().trim().min(2).max(2000),
  wikipedia_url: z.string().trim().url().max(1000).nullable().optional(),
  image_url: z.string().trim().url().max(1000).nullable().optional(),
})

export type UpsertPersonDTO = z.infer<typeof UpsertPersonSchema>
export type LifePeriodItemDTO = z.infer<typeof LifePeriodItemSchema>
export type LifePeriodsDTO = z.infer<typeof LifePeriodsSchema>
export type PersonEditPayloadDTO = z.infer<typeof PersonEditPayloadSchema>
export type AchievementGenericDTO = z.infer<typeof AchievementGenericSchema>
export type AchievementPersonDTO = z.infer<typeof AchievementPersonSchema>


