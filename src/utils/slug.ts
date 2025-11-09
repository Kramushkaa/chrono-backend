const translitMap: Record<string, string> = {
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'G',
  Д: 'D',
  Е: 'E',
  Ё: 'E',
  Ж: 'Zh',
  З: 'Z',
  И: 'I',
  Й: 'Y',
  К: 'K',
  Л: 'L',
  М: 'M',
  Н: 'N',
  О: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  У: 'U',
  Ф: 'F',
  Х: 'H',
  Ц: 'Ts',
  Ч: 'Ch',
  Ш: 'Sh',
  Щ: 'Sch',
  Ъ: '',
  Ы: 'Y',
  Ь: '',
  Э: 'E',
  Ю: 'Yu',
  Я: 'Ya',
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

const MAX_SLUG_LENGTH = 64;

/**
 * Convert arbitrary text (including Cyrillic) to a URL-friendly slug.
 */
export function slugify(raw: string, maxLength = MAX_SLUG_LENGTH): string {
  const transliterated = Array.from(raw || '')
    .map(ch => translitMap[ch] ?? ch)
    .join('');

  const sanitized = transliterated
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s_-]/g, ' ')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

  const trimmed = sanitized.slice(0, maxLength).replace(/^-+/, '').replace(/-+$/, '');

  return trimmed || '';
}

/**
 * Canonical helper used across the codebase to generate slugs from names.
 * Uses MAX_SLUG_LENGTH=64 unless explicitly overridden.
 */
export function slugifyIdFromName(name: string, maxLength = MAX_SLUG_LENGTH): string {
  const slug = slugify(name, Math.min(maxLength, MAX_SLUG_LENGTH));
  return slug.replace(/^-+/, '');
}
