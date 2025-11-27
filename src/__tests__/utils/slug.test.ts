import { slugify, slugifyIdFromName } from '../../utils/slug';

describe('slug utilities', () => {
  describe('slugifyIdFromName', () => {
    it('should transliterate Russian characters', () => {
      expect(slugifyIdFromName('Пётр Первый')).toBe('petr-pervyy');
      expect(slugifyIdFromName('Екатерина Великая')).toBe('ekaterina-velikaya');
      expect(slugifyIdFromName('Александр Пушкин')).toBe('aleksandr-pushkin');
      expect(slugifyIdFromName('Лев Толстой')).toBe('lev-tolstoy');
    });

    it('should handle Latin characters', () => {
      expect(slugifyIdFromName('John Smith')).toBe('john-smith');
      expect(slugifyIdFromName('Marie Curie')).toBe('marie-curie');
    });

    it('should convert to lowercase', () => {
      expect(slugifyIdFromName('NAPOLEON')).toBe('napoleon');
      expect(slugifyIdFromName('MixedCase')).toBe('mixedcase');
    });

    it('should replace spaces with hyphens', () => {
      expect(slugifyIdFromName('Isaac Newton')).toBe('isaac-newton');
      expect(slugifyIdFromName('Albert   Einstein')).toBe('albert-einstein');
    });

    it('should replace underscores with hyphens', () => {
      expect(slugifyIdFromName('test_name_here')).toBe('test-name-here');
    });

    it('should remove special characters', () => {
      expect(slugifyIdFromName('Name#@!$%^&*()')).toBe('name');
      expect(slugifyIdFromName('Test, Name: Here')).toBe('test-name-here');
    });

    it('should trim whitespace', () => {
      expect(slugifyIdFromName('  Trimmed  ')).toBe('trimmed');
    });

    it('should handle empty string', () => {
      expect(slugifyIdFromName('')).toBe('');
    });

    it('should handle strings with only special characters', () => {
      expect(slugifyIdFromName('!@#$%^&*()')).toBe('');
    });

    it('should limit length to 64 characters', () => {
      const longName = 'a'.repeat(100);
      const result = slugifyIdFromName(longName);
      expect(result.length).toBe(64);
    });

    it('should enforce max length of 64 by default', () => {
      const long = 'a'.repeat(70);
      expect(slugifyIdFromName(long)).toBe('a'.repeat(64));
    });

    it('should remove leading and trailing hyphens', () => {
      expect(slugifyIdFromName('---Александр---Пушкин---')).toBe('aleksandr-pushkin');
    });

    it('should handle mixed Russian and Latin', () => {
      expect(slugifyIdFromName('Петр Peter')).toBe('petr-peter');
    });

    it('should preserve hyphens in input', () => {
      expect(slugifyIdFromName('Jean-Paul Sartre')).toBe('jean-paul-sartre');
    });

    it('should handle Ё and Ъ correctly', () => {
      expect(slugifyIdFromName('Сёмка')).toBe('semka');
      expect(slugifyIdFromName('объект')).toBe('obekt');
    });
  });

  describe('slugify', () => {
    it('should transliterate Cyrillic and sanitize', () => {
      expect(slugify('Привет, мир!', 20)).toBe('privet-mir');
      expect(slugify('Hello___World')).toBe('hello-world');
    });

    it('should respect explicit max length', () => {
      const long = 'a'.repeat(100);
      expect(slugify(long, 50).length).toBe(50);
    });

    it('should handle empty string', () => {
      expect(slugify('')).toBe('');
    });

    it('should remove leading and trailing hyphens', () => {
      expect(slugify('---test---')).toBe('test');
    });
  });
});