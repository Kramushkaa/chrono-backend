import { mapApiPersonRow, parseLimitOffset, paginateRows } from '../../utils/api';
import type { PersonsViewRow, PersonWithRelations } from '../../types/database';

describe('api utils', () => {
  // ============================================================================
  // mapApiPersonRow() tests
  // ============================================================================

  describe('mapApiPersonRow', () => {
    it('should map person row with all fields', () => {
      const row: PersonsViewRow = {
        id: 'person-1',
        name: 'Test Person',
        birth_year: 1900,
        death_year: 1980,
        reign_start: 1950,
        reign_end: 1975,
        category: 'Политик',
        country: 'Россия',
        description: 'Test description',
        wiki_link: 'https://wikipedia.org/person-1',
        achievements: ['Achievement 1', 'Achievement 2'],
        achievements_wiki: null,
        achievement_years: null,
        image_url: 'https://example.com/image.jpg',
        status: 'approved',
        created_by: 1,
      };

      const result = mapApiPersonRow(row);

      expect(result).toEqual({
        id: 'person-1',
        name: 'Test Person',
        birthYear: 1900,
        deathYear: 1980,
        reignStart: 1950,
        reignEnd: 1975,
        category: 'Политик',
        country: 'Россия',
        description: 'Test description',
        wikiLink: 'https://wikipedia.org/person-1',
        achievementsWiki: [],
        achievements: ['Achievement 1', 'Achievement 2'],
        achievementYears: undefined,
        rulerPeriods: [],
        imageUrl: 'https://example.com/image.jpg',
        status: 'approved',
      });
    });

    it('should handle null/undefined fields', () => {
      const row: PersonsViewRow = {
        id: 'person-2',
        name: 'Person 2',
        birth_year: 1800,
        death_year: null,
        reign_start: null,
        reign_end: null,
        category: 'Ученый',
        country: 'Франция',
        description: null,
        wiki_link: null,
        achievements: [],
        achievements_wiki: null,
        achievement_years: null,
        image_url: null,
        status: 'approved',
        created_by: 1,
      };

      const result = mapApiPersonRow(row);

      expect(result.deathYear).toBeNull();
      expect(result.reignStart).toBeNull();
      expect(result.reignEnd).toBeNull();
      expect(result.description).toBeNull();
      expect(result.wikiLink).toBeNull();
      expect(result.imageUrl).toBeNull();
      expect(result.achievements).toEqual([]);
    });

    it('should handle empty achievements array', () => {
      const row: PersonsViewRow = {
        id: 'person-3',
        name: 'Person 3',
        birth_year: 1900,
        death_year: 1950,
        reign_start: null,
        reign_end: null,
        category: 'Писатель',
        country: 'Англия',
        description: 'Author',
        wiki_link: null,
        achievements: [],
        achievements_wiki: null,
        achievement_years: null,
        image_url: null,
        status: 'approved',
        created_by: 2,
      };

      const result = mapApiPersonRow(row);

      expect(result.achievements).toEqual([]);
    });

    it('should handle person with ruler periods', () => {
      const row = {
        id: 'ruler-1',
        name: 'King',
        birth_year: 1500,
        death_year: 1580,
        reign_start: 1550,
        reign_end: 1580,
        category: 'Правитель',
        country: 'Англия',
        description: 'King of England',
        wiki_link: null,
        achievements: [],
        image_url: null,
        ruler_periods: [
          {
            start_year: 1550,
            end_year: 1580,
            country_id: 1,
            country_name: 'Англия',
          },
        ],
      } as unknown as PersonWithRelations;

      const result = mapApiPersonRow(row);

      expect(result.rulerPeriods).toEqual([
        {
          startYear: 1550,
          endYear: 1580,
          countryId: 1,
          countryName: 'Англия',
        },
      ]);
    });

    it('should handle person with achievements wiki and years', () => {
      const row = {
        id: 'person-4',
        name: 'Scientist',
        birth_year: 1850,
        death_year: 1920,
        reign_start: null,
        reign_end: null,
        category: 'Ученый',
        country: 'Германия',
        description: 'Scientist',
        wiki_link: null,
        achievements: ['Discovery 1', 'Discovery 2'],
        achievements_wiki: ['https://wiki.org/1', 'https://wiki.org/2'],
        achievement_years: [1880, 1900],
        image_url: null,
      } as unknown as PersonWithRelations;

      const result = mapApiPersonRow(row);

      expect(result.achievementsWiki).toEqual(['https://wiki.org/1', 'https://wiki.org/2']);
      expect(result.achievementYears).toEqual([1880, 1900]);
    });

    it('should include status for moderation', () => {
      const row: PersonsViewRow = {
        id: 'person-5',
        name: 'Pending Person',
        birth_year: 1900,
        death_year: 1950,
        reign_start: null,
        reign_end: null,
        category: 'Артист',
        country: 'США',
        description: null,
        wiki_link: null,
        achievements: [],
        achievements_wiki: null,
        achievement_years: null,
        image_url: null,
        status: 'pending',
        created_by: 3,
      };

      const result = mapApiPersonRow(row);

      expect(result.status).toBe('pending');
    });
  });

  // ============================================================================
  // parseLimitOffset() tests
  // ============================================================================

  describe('parseLimitOffset', () => {
    const defaults = { defLimit: 20, maxLimit: 100 };

    it('should use default values when no params provided', () => {
      const result = parseLimitOffset(undefined, undefined, defaults);

      expect(result).toEqual({
        limitParam: 20,
        offsetParam: 0,
      });
    });

    it('should parse custom valid values', () => {
      const result = parseLimitOffset(50, 100, defaults);

      expect(result).toEqual({
        limitParam: 50,
        offsetParam: 100,
      });
    });

    it('should parse string values', () => {
      const result = parseLimitOffset('30', '60', defaults);

      expect(result).toEqual({
        limitParam: 30,
        offsetParam: 60,
      });
    });

    it('should enforce max limit', () => {
      const result = parseLimitOffset(200, 0, defaults); // Exceeds maxLimit

      expect(result.limitParam).toBe(100); // Clamped to maxLimit
    });

    it('should handle negative offset', () => {
      const result = parseLimitOffset(20, -10, defaults);

      expect(result.offsetParam).toBe(0); // Negative becomes 0
    });

    it('should handle NaN values', () => {
      const result = parseLimitOffset('invalid', 'invalid', defaults);

      expect(result).toEqual({
        limitParam: 20, // Falls back to default
        offsetParam: 0, // Falls back to 0
      });
    });

    it('should handle zero limit', () => {
      const result = parseLimitOffset(0, 0, defaults);

      expect(result.limitParam).toBe(0);
      expect(result.offsetParam).toBe(0);
    });
  });

  // ============================================================================
  // paginateRows() tests
  // ============================================================================

  describe('paginateRows', () => {
    it('should paginate when there are more rows', () => {
      const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // 11 rows
      const result = paginateRows(rows, 10, 0); // limit 10

      expect(result.data).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // First 10
      expect(result.meta).toEqual({
        limit: 10,
        offset: 0,
        hasMore: true,
        nextOffset: 10,
      });
    });

    it('should indicate no more pages when all rows fit', () => {
      const rows = [1, 2, 3, 4, 5];
      const result = paginateRows(rows, 10, 0);

      expect(result.data).toEqual([1, 2, 3, 4, 5]);
      expect(result.meta).toEqual({
        limit: 10,
        offset: 0,
        hasMore: false,
        nextOffset: null,
      });
    });

    it('should handle empty array', () => {
      const rows: number[] = [];
      const result = paginateRows(rows, 10, 0);

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        limit: 10,
        offset: 0,
        hasMore: false,
        nextOffset: null,
      });
    });

    it('should calculate correct nextOffset for second page', () => {
      const rows = [1, 2, 3, 4, 5, 6]; // 6 rows
      const result = paginateRows(rows, 5, 10); // offset 10, limit 5

      expect(result.data).toEqual([1, 2, 3, 4, 5]);
      expect(result.meta).toEqual({
        limit: 5,
        offset: 10,
        hasMore: true,
        nextOffset: 15, // 10 + 5
      });
    });

    it('should handle exact limit match (hasMore = false)', () => {
      const rows = [1, 2, 3, 4, 5];
      const result = paginateRows(rows, 5, 0);

      expect(result.data).toEqual([1, 2, 3, 4, 5]);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.nextOffset).toBeNull();
    });
  });
});
