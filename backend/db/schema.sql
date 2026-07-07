-- Docs RAG Assistant — database schema
-- Run this once against a Postgres database that has the pgvector extension available
-- (e.g. `psql $DATABASE_URL -f backend/db/schema.sql`)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id          BIGSERIAL PRIMARY KEY,
  content     TEXT NOT NULL,
  source      TEXT NOT NULL,               -- original filename, used for citations
  embedding   VECTOR(768) NOT NULL,        -- gemini-embedding-001 output
  session_id  TEXT,                        -- NULL for the seed docs loaded by ingest.js
  content_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scopes both vector and keyword search to a single upload session
CREATE INDEX IF NOT EXISTS idx_documents_session_id ON documents (session_id);

-- Full-text keyword search (used by the keyword half of hybrid search)
CREATE INDEX IF NOT EXISTS idx_documents_content_tsv ON documents USING GIN (content_tsv);

-- Approximate nearest-neighbor search on the embedding (cosine distance, matches `<=>` in retrieval.js).
-- HNSW builds incrementally as rows are inserted, unlike ivfflat, so no post-load ANALYZE/retrain step is needed.
CREATE INDEX IF NOT EXISTS idx_documents_embedding
  ON documents USING hnsw (embedding vector_cosine_ops);
