import { slugify, slugifyIdFromName } from '../../utils/slug';

describe('slug utilities', () => {
  test('slugifyIdFromName transliterates Cyrillic and lowercases', () => {
    expect(slugifyIdFromName('Лев Толстой')).toBe('lev-tolstoy');
    expect(slugifyIdFromName('Александр Пушкин')).toBe('aleksandr-pushkin');
  });

  test('removes leading and trailing hyphens', () => {
    expect(slugifyIdFromName('---Александр---Пушкин---')).toBe('aleksandr-pushkin');
  });

  test('enforces max length of 64 by default', () => {
    const long = 'a'.repeat(70);
    expect(slugifyIdFromName(long)).toBe('a'.repeat(64));
  });

  test('slugify respects explicit max length and sanitizes', () => {
    expect(slugify('Привет, мир!', 20)).toBe('privet-mir');
    expect(slugify('Hello___World')).toBe('hello-world');
  });
});
