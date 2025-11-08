import { z } from 'zod';

export const UpsertPersonSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  birthYear: z.number().int(),
  deathYear: z.number().int(),
  category: z.string().trim().min(1),
  description: z.string().default(''),
  imageUrl: z.string().url().nullable().optional(),
  wikiLink: z.string().url().nullable().optional(),
});

export const LifePeriodItemSchema = z.object({
  country_id: z.number().int().positive(),
  start_year: z.number().int(),
  end_year: z.number().int(),
  period_type: z.string().trim().optional().default('life'),
});

export const LifePeriodsSchema = z.object({
  periods: z.array(LifePeriodItemSchema).min(1),
});

export const PersonEditPayloadSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    birthYear: z.number().int().optional(),
    deathYear: z.number().int().optional(),
    category: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().nullable().optional(),
    wikiLink: z.string().url().nullable().optional(),
  })
  .refine(obj => Object.keys(obj).length > 0, { message: 'Пустой payload' });

export const AchievementGenericSchema = z.object({
  year: z.number().int(),
  description: z.string().trim().min(2),
  wikipedia_url: z.string().url().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  country_id: z.number().int().positive().nullable().optional(),
});

export const AchievementPersonSchema = z.object({
  year: z.number().int(),
  description: z.string().trim().min(2),
  wikipedia_url: z.string().url().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
});

export const ListPublicationRequestSchema = z.object({
  description: z.string().trim().max(2000).optional(),
});

export const ListModerationActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().trim().max(2000).optional(),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]+$/i, 'Slug может содержать только латиницу, цифры и дефисы')
    .optional(),
});
