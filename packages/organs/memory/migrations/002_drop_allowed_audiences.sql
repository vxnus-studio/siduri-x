-- Migration 002: Drop allowed_audiences partition column for single-owner architecture
ALTER TABLE memory_claims DROP COLUMN IF EXISTS allowed_audiences;
