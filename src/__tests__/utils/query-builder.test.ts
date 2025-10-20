import { QueryBuilder, buildFilteredQuery } from '../../utils/query-builder';

describe('query-builder.ts Utils', () => {
  // ============================================================================
  // QueryBuilder Class
  // ============================================================================

  describe('QueryBuilder', () => {
    let builder: QueryBuilder;

    beforeEach(() => {
      builder = new QueryBuilder();
    });

    describe('addFilter', () => {
      it('should add basic filter', () => {
        builder.addFilter('id', 'test-123');
        const { whereClause, params } = builder.build();

        expect(whereClause).toContain('id = $1');
        expect(params).toEqual(['test-123']);
      });

      it('should add multiple filters', () => {
        builder.addFilter('id', 'test-123');
        builder.addFilter('status', 'active');

        const { whereClause, params } = builder.build();

        expect(whereClause).toContain('id = $1');
        expect(whereClause).toContain('status = $2');
        expect(whereClause).toContain('AND');
        expect(params).toEqual(['test-123', 'active']);
      });

      it('should skip null values', () => {
        builder.addFilter('id', null);
        const { whereClause, params } = builder.build();

        expect(whereClause).toBe('1=1');
        expect(params).toEqual([]);
      });

      it('should skip undefined values', () => {
        builder.addFilter('id', undefined);
        const { whereClause, params } = builder.build();

        expect(whereClause).toBe('1=1');
        expect(params).toEqual([]);
      });

      it('should skip empty strings', () => {
        builder.addFilter('id', '');
        const { whereClause, params } = builder.build();

        expect(whereClause).toBe('1=1');
        expect(params).toEqual([]);
      });
    });

    describe('addSearch', () => {
      it('should add search for single field', () => {
        builder.addSearch(['name'], 'John');
        const { whereClause, params } = builder.build();

        expect(whereClause).toContain('name ILIKE $1');
        expect(params).toEqual(['%John%']);
      });

      it('should add search for multiple fields with OR', () => {
        builder.addSearch(['name', 'email', 'description'], 'test');
        const { whereClause, params } = builder.build();

        expect(whereClause).toContain('name ILIKE $1');
        expect(whereClause).toContain('email ILIKE $1');
        expect(whereClause).toContain('description ILIKE $1');
        expect(whereClause).toContain('OR');
        expect(params).toEqual(['%test%']);
      });

      it('should wrap search term with percent signs', () => {
        builder.addSearch(['description'], 'test');
        const { whereClause, params } = builder.build();

        expect(params[0]).toBe('%test%');
      });

      it('should skip empty search query', () => {
        builder.addSearch(['name'], '');
        const { whereClause, params } = builder.build();

        expect(whereClause).toBe('1=1');
        expect(params).toEqual([]);
      });

      it('should skip whitespace-only search query', () => {
        builder.addSearch(['name'], '   ');
        const { whereClause, params } = builder.build();

        expect(whereClause).toBe('1=1');
        expect(params).toEqual([]);
      });
    });

    describe('addNumericFilter', () => {
      it('should add equality filter by default', () => {
        builder.addNumericFilter('year', 2000);
        const { whereClause, params } = builder.build();

        expect(whereClause).toContain('year = $1');
        expect(params).toEqual([2000]);
      });

      it('should add greater than filter', () => {
        builder.addNumericFilter('year', 1900, '>');
        const { whereClause, params } = builder.build();

        expect(whereClause).toContain('year > $1');
        expect(params).toEqual([1900]);
      });

      it('should add greater than or equal filter', () => {
        builder.addNumericFilter('year', 1900, '>=');
        const { whereClause, params } = builder.build();

        expect(whereClause).toContain('year >= $1');
        expect(params).toEqual([1900]);
      });

      it('should add less than filter', () => {
        builder.addNumericFilter('year', 2000, '<');
        const { whereClause, params } = builder.build();

        expect(whereClause).toContain('year < $1');
        expect(params).toEqual([2000]);
      });

      it('should add less than or equal filter', () => {
        builder.addNumericFilter('year', 2000, '<=');
        const { whereClause, params } = builder.build();

        expect(whereClause).toContain('year <= $1');
        expect(params).toEqual([2000]);
      });

      it('should skip undefined values', () => {
        builder.addNumericFilter('year', undefined);
        const { whereClause, params } = builder.build();

        expect(whereClause).toBe('1=1');
        expect(params).toEqual([]);
      });

      it('should handle zero as valid value', () => {
        builder.addNumericFilter('count', 0);
        const { whereClause, params } = builder.build();

        expect(whereClause).toContain('count = $1');
        expect(params).toEqual([0]);
      });
    });

    describe('build', () => {
      it('should return 1=1 for empty query', () => {
        const { whereClause, params } = builder.build();

        expect(whereClause).toBe('1=1');
        expect(params).toEqual([]);
      });

      it('should combine multiple filters with AND', () => {
        builder.addFilter('status', 'approved');
        builder.addNumericFilter('year', 2000, '>=');
        builder.addFilter('category', 'Science');

        const { whereClause, params } = builder.build();

        expect(whereClause).toContain('status = $1');
        expect(whereClause).toContain('year >= $2');
        expect(whereClause).toContain('category = $3');
        expect(params).toEqual(['approved', 2000, 'Science']);
      });

      it('should combine filters and search correctly', () => {
        // NOTE: addSearch должен вызываться ПЕРВЫМ (как в реальном коде)
        builder.addSearch(['name', 'description'], 'test');
        builder.addFilter('status', 'approved');

        const { whereClause, params } = builder.build();

        expect(whereClause).toContain('name ILIKE $1'); // Search uses $1 (called first)
        expect(whereClause).toContain('description ILIKE $1'); // Same $1 for all search fields
        expect(whereClause).toContain('status = $2'); // Filter uses $2
        expect(whereClause).toContain('OR');
        expect(whereClause).toContain('AND');
        expect(params).toEqual(['%test%', 'approved']);
      });
    });

    describe('getNextParamIndex', () => {
      it('should return next param index for pagination', () => {
        expect(builder.getNextParamIndex()).toBe(1);

        builder.addFilter('id', 'test');
        builder.addFilter('status', 'active');
        builder.build(); // Build increments paramIndex to 3 (used 1 and 2)

        // Next index should be 3 for LIMIT/OFFSET
        expect(builder.getNextParamIndex()).toBe(3);
      });

      it('should continue incrementing across multiple builds', () => {
        builder.addFilter('id', 'test');
        builder.build();
        expect(builder.getNextParamIndex()).toBe(2);

        builder.addFilter('status', 'active');
        builder.build();
        // paramIndex continues from where it left off
        expect(builder.getNextParamIndex()).toBeGreaterThanOrEqual(3);
      });
    });

    describe('reset', () => {
      it('should clear builder state', () => {
        builder.addFilter('id', 'test');
        builder.addSearch(['name'], 'query');
        builder.addNumericFilter('year', 2000);

        let result = builder.build();
        expect(result.params.length).toBeGreaterThan(0);

        builder.reset();
        result = builder.build();

        expect(result.whereClause).toBe('1=1');
        expect(result.params).toEqual([]);
        expect(builder.getNextParamIndex()).toBe(1);
      });
    });

    describe('complex scenarios', () => {
      it('should handle complex query with all filter types', () => {
        builder.addSearch(['name', 'description'], 'history');
        builder.addFilter('person_id', 'person-123');
        builder.addFilter('country_id', 'country-456');
        builder.addNumericFilter('year', 1900, '>=');
        builder.addNumericFilter('year', 2000, '<=');

        const { whereClause, params } = builder.build();

        expect(whereClause).toContain('ILIKE $1');
        expect(whereClause).toContain('person_id = $2');
        expect(whereClause).toContain('country_id = $3');
        expect(whereClause).toContain('year >= $4');
        expect(whereClause).toContain('year <= $5');
        expect(params).toEqual(['%history%', 'person-123', 'country-456', 1900, 2000]);
      });
    });
  });

  // ============================================================================
  // buildFilteredQuery Helper
  // ============================================================================

  describe('buildFilteredQuery', () => {
    it('should build query with filters', () => {
      const baseQuery = 'SELECT * FROM persons WHERE 1=1';
      const filters = { id: 'test-123', status: 'approved' };

      const { sql, params } = buildFilteredQuery(baseQuery, filters);

      expect(sql).toContain('WHERE');
      expect(sql).toContain('id = $1');
      expect(sql).toContain('status = $2');
      expect(params).toEqual(['test-123', 'approved']);
    });

    it('should handle empty filters', () => {
      const baseQuery = 'SELECT * FROM persons WHERE 1=1';
      const filters = {};

      const { sql, params } = buildFilteredQuery(baseQuery, filters);

      expect(sql).toContain('WHERE 1=1');
      expect(params).toEqual([]);
    });

    it('should skip null and undefined filters', () => {
      const baseQuery = 'SELECT * FROM persons WHERE 1=1';
      const filters = { id: 'test', status: null, category: undefined };

      const { sql, params } = buildFilteredQuery(baseQuery, filters);

      expect(sql).toContain('id = $1');
      expect(sql).not.toContain('status');
      expect(sql).not.toContain('category');
      expect(params).toEqual(['test']);
    });

    it('should handle search fields', () => {
      const baseQuery = 'SELECT * FROM persons WHERE 1=1';
      const filters = { status: 'approved' };
      const searchFields = { fields: ['name', 'description'], term: 'test' };

      const { sql, params } = buildFilteredQuery(baseQuery, filters, searchFields);

      expect(sql).toContain('ILIKE');
      expect(sql).toContain('status = $2');
      expect(params[0]).toBe('%test%');
      expect(params[1]).toBe('approved');
    });
  });
});
