-- Dynsense database initialization
-- Extensions required: uuid-ossp (UUIDs), vector (pgvector RAG), pg_trgm (full-text search)
-- Ref: FR-500, design-doc §5.1

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
