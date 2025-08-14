import { Router } from 'express'
import { Pool } from 'pg'
import { asyncHandler } from '../utils/errors'
import { DTO_VERSION as DTO_VERSION_BE } from '../dtoDescriptors'

export function createMetaRoutes(pool: Pool): Router {
  const router = Router()

  // Health
  router.get('/health', asyncHandler(async (_req: any, res: any) => {
    res.json({ success: true, data: { message: 'Хронониндзя API работает', timestamp: new Date().toISOString(), version: '1.0.0' } })
  }))

  // DTO version
  router.get('/dto-version', asyncHandler(async (_req: any, res: any) => {
    res.json({ success: true, data: { version: DTO_VERSION_BE } })
  }))

  // Categories
  router.get('/categories', asyncHandler(async (_req: any, res: any) => {
    let query = 'SELECT category FROM unique_categories'
    let result = await pool.query(query)
    if (result.rows.length === 0) {
      query = `
        SELECT DISTINCT category 
          FROM persons 
         WHERE category IS NOT NULL 
         ORDER BY category`
      result = await pool.query(query)
    }
    const categories = result.rows.map(row => row.category)
    res.json({ success: true, data: categories })
  }))

  // Countries (names only)
  router.get('/countries', asyncHandler(async (_req: any, res: any) => {
    const result = await pool.query('SELECT name FROM v_countries ORDER BY name')
    const countries = result.rows.map(r => r.name)
    res.json({ success: true, data: countries })
  }))

  // Country options (id + name)
  router.get('/countries/options', asyncHandler(async (_req: any, res: any) => {
    const result = await pool.query('SELECT id, name FROM countries ORDER BY name')
    res.json({ success: true, data: result.rows })
  }))

  // Stats
  router.get('/stats', asyncHandler(async (_req: any, res: any) => {
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_persons,
        MIN(birth_year) as earliest_birth,
        MAX(death_year) as latest_death,
        COUNT(DISTINCT category) as unique_categories,
        (SELECT COUNT(*) FROM v_countries) as unique_countries
      FROM persons`)
    const categoryStatsResult = await pool.query(`
      SELECT category, COUNT(*) as count
        FROM persons
       GROUP BY category
       ORDER BY count DESC`)
    const countryStatsResult = await pool.query(`
      SELECT name AS country, persons_with_periods AS count
        FROM v_country_stats
       ORDER BY count DESC`)
    const stats = {
      overview: statsResult.rows[0],
      categories: categoryStatsResult.rows,
      countries: countryStatsResult.rows,
    }
    res.json({ success: true, data: stats })
  }))

  return router
}


