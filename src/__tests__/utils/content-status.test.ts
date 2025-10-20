import {
  determineContentStatus,
  canApproveDirectly,
  canModerateContent,
  buildInsertWithStatus,
  User,
} from '../../utils/content-status';

describe('content-status utils', () => {
  // ============================================================================
  // determineContentStatus() tests
  // ============================================================================

  describe('determineContentStatus', () => {
    it('should return "draft" when saveAsDraft is true for any user', () => {
      const adminUser: User = { sub: 1, role: 'admin' };
      const moderatorUser: User = { sub: 2, role: 'moderator' };
      const regularUser: User = { sub: 3, role: 'user' };

      expect(determineContentStatus(adminUser, true)).toBe('draft');
      expect(determineContentStatus(moderatorUser, true)).toBe('draft');
      expect(determineContentStatus(regularUser, true)).toBe('draft');
    });

    it('should return "approved" for admin when not saving as draft', () => {
      const user: User = { sub: 1, role: 'admin' };
      expect(determineContentStatus(user, false)).toBe('approved');
      expect(determineContentStatus(user)).toBe('approved'); // default saveAsDraft=false
    });

    it('should return "approved" for moderator when not saving as draft', () => {
      const user: User = { sub: 2, role: 'moderator' };
      expect(determineContentStatus(user, false)).toBe('approved');
    });

    it('should return "pending" for regular user when not saving as draft', () => {
      const user: User = { sub: 3, role: 'user' };
      expect(determineContentStatus(user, false)).toBe('pending');
      expect(determineContentStatus(user)).toBe('pending'); // default
    });
  });

  // ============================================================================
  // canApproveDirectly() tests
  // ============================================================================

  describe('canApproveDirectly', () => {
    it('should return true for admin', () => {
      const user: User = { sub: 1, role: 'admin' };
      expect(canApproveDirectly(user)).toBe(true);
    });

    it('should return true for moderator', () => {
      const user: User = { sub: 2, role: 'moderator' };
      expect(canApproveDirectly(user)).toBe(true);
    });

    it('should return false for regular user', () => {
      const user: User = { sub: 3, role: 'user' };
      expect(canApproveDirectly(user)).toBe(false);
    });

    it('should return false for unknown role', () => {
      const user = { sub: 4, role: 'guest' as any } as User;
      expect(canApproveDirectly(user)).toBe(false);
    });
  });

  // ============================================================================
  // canModerateContent() tests
  // ============================================================================

  describe('canModerateContent', () => {
    it('should return true for admin', () => {
      const user: User = { sub: 1, role: 'admin' };
      expect(canModerateContent(user)).toBe(true);
    });

    it('should return true for moderator', () => {
      const user: User = { sub: 2, role: 'moderator' };
      expect(canModerateContent(user)).toBe(true);
    });

    it('should return false for regular user', () => {
      const user: User = { sub: 3, role: 'user' };
      expect(canModerateContent(user)).toBe(false);
    });

    it('should return false for unknown role', () => {
      const user = { sub: 4, role: 'contributor' as any } as User;
      expect(canModerateContent(user)).toBe(false);
    });
  });

  // ============================================================================
  // buildInsertWithStatus() tests
  // ============================================================================

  describe('buildInsertWithStatus', () => {
    it('should build INSERT query with approved status for admin', () => {
      const user: User = { sub: 1, role: 'admin' };
      const fields = {
        id: 'person-1',
        name: 'Test Person',
        birth_year: 1900,
      };

      const result = buildInsertWithStatus('persons', fields, user, false);

      expect(result.sql).toContain('INSERT INTO persons');
      expect(result.sql).toContain('id, name, birth_year, status, created_by');
      expect(result.values).toEqual(['person-1', 'Test Person', 1900, 'approved', 1]);
    });

    it('should build INSERT query with pending status for user', () => {
      const user: User = { sub: 3, role: 'user' };
      const fields = {
        id: 'person-2',
        name: 'Person 2',
      };

      const result = buildInsertWithStatus('achievements', fields, user, false);

      expect(result.sql).toContain('INSERT INTO achievements');
      expect(result.values).toContain('pending');
      expect(result.values).toContain(3); // created_by
    });

    it('should build INSERT query with draft status when saveAsDraft=true', () => {
      const user: User = { sub: 1, role: 'admin' };
      const fields = {
        title: 'My Achievement',
        year: 2000,
      };

      const result = buildInsertWithStatus('achievements', fields, user, true);

      expect(result.values).toContain('draft');
      expect(result.values).toContain(1); // created_by
    });

    it('should generate correct placeholders and values', () => {
      const user: User = { sub: 2, role: 'moderator' };
      const fields = {
        field1: 'value1',
        field2: 'value2',
        field3: 123,
      };

      const result = buildInsertWithStatus('test_table', fields, user);

      expect(result.sql).toMatch(/\$1, \$2, \$3, \$4, \$5/); // 5 placeholders
      expect(result.values).toHaveLength(5); // 3 fields + status + created_by
      expect(result.values[3]).toBe('approved'); // status for moderator
      expect(result.values[4]).toBe(2); // created_by
    });

    it('should preserve field order', () => {
      const user: User = { sub: 1, role: 'user' };
      const fields = {
        a: 1,
        b: 2,
        c: 3,
      };

      const result = buildInsertWithStatus('table', fields, user);

      // Fields: a, b, c, status, created_by
      expect(result.values).toEqual([1, 2, 3, 'pending', 1]);
    });

    it('should handle null values in fields', () => {
      const user: User = { sub: 1, role: 'admin' };
      const fields = {
        name: 'Test',
        optional_field: null,
      };

      const result = buildInsertWithStatus('table', fields, user);

      expect(result.values).toContain(null);
      expect(result.values).toContain('approved');
    });
  });
});
