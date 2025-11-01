import { SimpleCache } from '../../utils/cache';

describe('SimpleCache', () => {
  let cache: SimpleCache;

  beforeEach(() => {
    cache = new SimpleCache();
  });

  afterEach(() => {
    cache.clearAll();
  });

  describe('set and get', () => {
    it('should set and get value', () => {
      cache.set('key1', 'value1', 1000);

      const result = cache.get('key1');
      expect(result).toBe('value1');
    });

    it('should set and get object value', () => {
      const obj = { name: 'Test', age: 25 };
      cache.set('key1', obj, 1000);

      const result = cache.get('key1');
      expect(result).toEqual(obj);
    });

    it('should set and get array value', () => {
      const arr = [1, 2, 3, 4, 5];
      cache.set('key1', arr, 1000);

      const result = cache.get('key1');
      expect(result).toEqual(arr);
    });

    it('should set and get number value', () => {
      cache.set('key1', 12345, 1000);

      const result = cache.get('key1');
      expect(result).toBe(12345);
    });

    it('should set and get boolean value', () => {
      cache.set('key1', true, 1000);

      const result = cache.get('key1');
      expect(result).toBe(true);
    });

    it('should return null for non-existent key', () => {
      const result = cache.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should overwrite existing key', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key1', 'value2', 1000);

      const result = cache.get('key1');
      expect(result).toBe('value2');
    });
  });

  describe('TTL expiration', () => {
    it('should return null after TTL expires', () => {
      jest.useFakeTimers();

      cache.set('key1', 'value1', 1000); // 1 second TTL

      // Value should exist immediately
      expect(cache.get('key1')).toBe('value1');

      // Fast-forward time by 1001ms
      jest.advanceTimersByTime(1001);

      // Value should be expired
      expect(cache.get('key1')).toBeNull();

      jest.useRealTimers();
    });

    it('should keep value within TTL', () => {
      jest.useFakeTimers();

      cache.set('key1', 'value1', 5000); // 5 seconds TTL

      // Fast-forward by 3 seconds
      jest.advanceTimersByTime(3000);

      // Value should still exist
      expect(cache.get('key1')).toBe('value1');

      jest.useRealTimers();
    });

    it('should delete expired item when accessed', () => {
      jest.useFakeTimers();

      cache.set('key1', 'value1', 1000);

      // Fast-forward past expiration
      jest.advanceTimersByTime(1500);

      // Access expired item
      cache.get('key1');

      // Check that item was deleted
      const stats = cache.getStats();
      expect(stats.keys).not.toContain('key1');

      jest.useRealTimers();
    });
  });

  describe('clear', () => {
    it('should clear specific key', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 1000);

      const result = cache.clear('key1');

      expect(result).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should return false when clearing non-existent key', () => {
      const result = cache.clear('nonexistent');

      expect(result).toBe(false);
    });

    it('should handle clearing already cleared key', () => {
      cache.set('key1', 'value1', 1000);
      cache.clear('key1');

      const result = cache.clear('key1');
      expect(result).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should clear all keys', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 1000);
      cache.set('key3', 'value3', 1000);

      cache.clearAll();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
    });

    it('should work on empty cache', () => {
      cache.clearAll();

      expect(cache.size()).toBe(0);
    });

    it('should reset size to zero', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 1000);

      cache.clearAll();

      expect(cache.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return 0 for empty cache', () => {
      expect(cache.size()).toBe(0);
    });

    it('should return correct size', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 1000);
      cache.set('key3', 'value3', 1000);

      expect(cache.size()).toBe(3);
    });

    it('should exclude expired items from size', () => {
      jest.useFakeTimers();

      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 5000);

      // Fast-forward to expire key1 but not key2
      jest.advanceTimersByTime(1500);

      expect(cache.size()).toBe(1);

      jest.useRealTimers();
    });

    it('should update size after clearing key', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 1000);

      expect(cache.size()).toBe(2);

      cache.clear('key1');

      expect(cache.size()).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return empty stats for empty cache', () => {
      const stats = cache.getStats();

      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);
    });

    it('should return correct stats', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 1000);
      cache.set('key3', 'value3', 1000);

      const stats = cache.getStats();

      expect(stats.size).toBe(3);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
      expect(stats.keys).toContain('key3');
    });

    it('should exclude expired items from stats', () => {
      jest.useFakeTimers();

      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 5000);

      // Fast-forward to expire key1
      jest.advanceTimersByTime(1500);

      const stats = cache.getStats();

      expect(stats.size).toBe(1);
      expect(stats.keys).not.toContain('key1');
      expect(stats.keys).toContain('key2');

      jest.useRealTimers();
    });

    it('should cleanup expired items when getting stats', () => {
      jest.useFakeTimers();

      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 1000);

      // Expire both keys
      jest.advanceTimersByTime(1500);

      const stats = cache.getStats();

      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);

      jest.useRealTimers();
    });
  });

  describe('edge cases', () => {
    it('should handle setting null value', () => {
      cache.set('key1', null, 1000);

      const result = cache.get('key1');
      expect(result).toBeNull();
    });

    it('should handle setting undefined value', () => {
      cache.set('key1', undefined, 1000);

      const result = cache.get('key1');
      expect(result).toBeUndefined();
    });

    it('should handle very short TTL', () => {
      jest.useFakeTimers();

      cache.set('key1', 'value1', 1); // 1ms TTL

      expect(cache.get('key1')).toBe('value1');

      jest.advanceTimersByTime(2);

      expect(cache.get('key1')).toBeNull();

      jest.useRealTimers();
    });

    it('should handle very long TTL', () => {
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      cache.set('key1', 'value1', oneYear);

      expect(cache.get('key1')).toBe('value1');
    });

    it('should handle multiple keys with different TTLs', () => {
      jest.useFakeTimers();

      cache.set('short', 'value1', 1000);
      cache.set('medium', 'value2', 5000);
      cache.set('long', 'value3', 10000);

      // After 1.5 seconds
      jest.advanceTimersByTime(1500);
      expect(cache.get('short')).toBeNull();
      expect(cache.get('medium')).toBe('value2');
      expect(cache.get('long')).toBe('value3');

      // After 6 seconds total
      jest.advanceTimersByTime(4500);
      expect(cache.get('medium')).toBeNull();
      expect(cache.get('long')).toBe('value3');

      // After 11 seconds total
      jest.advanceTimersByTime(5000);
      expect(cache.get('long')).toBeNull();

      jest.useRealTimers();
    });
  });
});
