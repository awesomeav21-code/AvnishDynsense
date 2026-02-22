-- Dynsense database initialization
-- Extensions required: uuid-ossp (UUIDs), vector (pgvector RAG), pg_trgm (full-text search)
-- Ref: FR-500, design-doc §5.1

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Ref: FR-142 — Immutable audit_log (UPDATE/DELETE blocked at DB level via trigger)
-- Any attempt to UPDATE or DELETE an audit_log row raises an exception.
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable: % operations are not permitted', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_immutable();
