import { Pool } from 'pg';

export type PersonPayload = {
  name?: string;
  birthYear?: number;
  deathYear?: number;
  category?: string;
  description?: string;
  imageUrl?: string;
  wikiLink?: string;
};

const allowedPersonFields = new Set([
  'name',
  'birthYear',
  'deathYear',
  'category',
  'description',
  'imageUrl',
  'wikiLink',
]);

export function sanitizePayload(raw: unknown): Partial<PersonPayload> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== 'object') return out;
  const rawObj = raw as Record<string, unknown>;
  for (const key of Object.keys(rawObj)) {
    if (allowedPersonFields.has(key)) {
      out[key] = rawObj[key];
    }
  }
  return out as Partial<PersonPayload>;
}

export async function applyPayloadToPerson(
  pool: Pool,
  id: string,
  payload: Partial<PersonPayload>,
  reviewerUserId: number
): Promise<void> {
  // Map camelCase -> snake_case
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  let idx = 1;
  const mapping: Record<string, string> = {
    name: 'name',
    birthYear: 'birth_year',
    deathYear: 'death_year',
    category: 'category',
    description: 'description',
    imageUrl: 'image_url',
    wikiLink: 'wiki_link',
  };
  for (const [k, v] of Object.entries(payload)) {
    const column = mapping[k];
    if (!column) continue;
    fields.push(`${column} = $${idx++}`);
    values.push(v as string | number | null);
  }
  // Always update audit/status on approve
  fields.push(`status = 'approved'`);
  fields.push(`updated_by = $${idx++}`);
  values.push(reviewerUserId);
  const sql = `UPDATE persons SET ${fields.join(', ')} WHERE id = $${idx}`;
  values.push(id);
  await pool.query(sql, values);
}
