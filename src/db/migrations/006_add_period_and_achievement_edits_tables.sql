-- Таблица для предложений изменений периодов
CREATE TABLE IF NOT EXISTS period_edits (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL,
  proposer_user_id INTEGER NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  review_comment TEXT,
  reviewed_by INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT period_edits_period_id_fkey FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT period_edits_proposer_user_id_fkey FOREIGN KEY (proposer_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT period_edits_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT period_edits_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_period_edits_status ON period_edits(status);
CREATE INDEX IF NOT EXISTS idx_period_edits_period_id ON period_edits(period_id);

-- Таблица для предложений изменений достижений
CREATE TABLE IF NOT EXISTS achievement_edits (
  id SERIAL PRIMARY KEY,
  achievement_id INTEGER NOT NULL,
  proposer_user_id INTEGER NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  review_comment TEXT,
  reviewed_by INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT achievement_edits_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT achievement_edits_proposer_user_id_fkey FOREIGN KEY (proposer_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT achievement_edits_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT achievement_edits_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_achievement_edits_status ON achievement_edits(status);
CREATE INDEX IF NOT EXISTS idx_achievement_edits_achievement_id ON achievement_edits(achievement_id);


