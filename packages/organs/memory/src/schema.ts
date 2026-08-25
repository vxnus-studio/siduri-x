export const UP_MIGRATION = `
CREATE TABLE IF NOT EXISTS memory_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  companion_id VARCHAR NOT NULL,
  subject VARCHAR NOT NULL,
  predicate VARCHAR NOT NULL,
  value VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  scope VARCHAR NOT NULL,
  evidence JSONB,
  provenance VARCHAR NOT NULL DEFAULT 'siduri_y_memory',
  source_event_id VARCHAR,
  claim_type VARCHAR NOT NULL DEFAULT 'semantic',
  authority VARCHAR NOT NULL DEFAULT 'user_explicit',
  user_confirmation VARCHAR NOT NULL DEFAULT 'none',
  sensitivity VARCHAR NOT NULL DEFAULT 'private',
  allowed_audiences JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence REAL NOT NULL DEFAULT 1,
  asserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  supersedes UUID,
  replaces UUID,
  search_document TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', subject || ' ' || predicate || ' ' || value)
  ) STORED
);

CREATE INDEX IF NOT EXISTS memory_claims_companion_id_idx ON memory_claims(companion_id);
CREATE INDEX IF NOT EXISTS memory_claims_search_idx ON memory_claims USING GIN (search_document);

CREATE TABLE IF NOT EXISTS memory_source_events (
  id VARCHAR PRIMARY KEY,
  companion_id VARCHAR NOT NULL,
  source_type VARCHAR NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS memory_source_events_companion_idx ON memory_source_events(companion_id);

CREATE TABLE IF NOT EXISTS memory_claim_history (
  id BIGSERIAL PRIMARY KEY,
  claim_id UUID NOT NULL,
  companion_id VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason VARCHAR NOT NULL,
  snapshot JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS memory_claim_history_lookup_idx
  ON memory_claim_history(companion_id, claim_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS memory_directives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  companion_id VARCHAR NOT NULL,
  directive VARCHAR NOT NULL,
  scope_matcher JSONB NOT NULL,
  priority INTEGER NOT NULL,
  status VARCHAR NOT NULL,
  supersedes_id UUID
);

CREATE INDEX IF NOT EXISTS memory_directives_companion_id_idx ON memory_directives(companion_id);
`;
