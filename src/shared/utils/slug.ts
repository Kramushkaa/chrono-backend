const MAX_SLUG_LENGTH = 64

export function slugifyIdFromName(name: string, maxLength = MAX_SLUG_LENGTH): string {
  const transliterated = Array.from(name || '')
    .map(ch => translitMap[ch as keyof typeof translitMap] ?? ch)
    .join('');

  const sanitized = transliterated
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s_-]/g, ' ')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

  const effectiveMax = Math.min(maxLength, MAX_SLUG_LENGTH);
  const trimmed = sanitized.slice(0, effectiveMax).replace(/-+$/g, '');

  return trimmed.replace(/^-+/, '');
}
