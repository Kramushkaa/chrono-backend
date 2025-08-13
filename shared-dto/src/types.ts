import type { z } from 'zod'
import type {
  UpsertPersonSchema,
  LifePeriodItemSchema,
  LifePeriodsSchema,
  PersonEditPayloadSchema,
  AchievementGenericSchema,
  AchievementPersonSchema
} from './schemas'

export type UpsertPersonDTO = z.infer<typeof UpsertPersonSchema>
export type LifePeriodItemDTO = z.infer<typeof LifePeriodItemSchema>
export type LifePeriodsDTO = z.infer<typeof LifePeriodsSchema>
export type PersonEditPayloadDTO = z.infer<typeof PersonEditPayloadSchema>
export type AchievementGenericDTO = z.infer<typeof AchievementGenericSchema>
export type AchievementPersonDTO = z.infer<typeof AchievementPersonSchema>


