ALTER TABLE lists
  ADD COLUMN moderation_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN public_description text NOT NULL DEFAULT '',
  ADD COLUMN moderation_requested_at timestamp without time zone,
  ADD COLUMN published_at timestamp without time zone,
  ADD COLUMN moderated_by integer,
  ADD COLUMN moderated_at timestamp without time zone,
  ADD COLUMN moderation_comment text,
  ADD COLUMN public_slug text;

ALTER TABLE lists
  ADD CONSTRAINT lists_moderation_status_check
  CHECK (moderation_status IN ('draft', 'pending', 'published', 'rejected'));

ALTER TABLE lists
  ADD CONSTRAINT lists_moderated_by_fkey
  FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lists_public_slug_unique
  ON lists (public_slug)
  WHERE public_slug IS NOT NULL;


