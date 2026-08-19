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
  search_document TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', subject || ' ' || predicate || ' ' || value)
  ) STORED
);

CREATE INDEX IF NOT EXISTS memory_claims_companion_id_idx ON memory_claims(companion_id);
CREATE INDEX IF NOT EXISTS memory_claims_search_idx ON memory_claims USING GIN (search_document);

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
