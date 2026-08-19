-- PLAN.md task 2 / PRD.md Development unit 1: documents + chunks schema, pgvector enabled.
-- Column shapes follow DESIGN.md's "Data model" section.

create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  filename text not null,
  file_hash text not null unique,
  storage_path text not null,
  page_count integer,
  extractable_status text not null default 'full'
    check (extractable_status in ('full', 'partial', 'unsupported')),
  uploaded_at timestamptz not null default now()
);

-- embedding uses OpenAI text-embedding-3-small's 1536 dimensions (see lib/config.ts
-- EMBEDDING_MODEL default); the dimension is a fixed DB constraint of whichever
-- embedding model is actually in use, not itself runtime-configurable.
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  page_number integer,
  chunk_index integer not null,
  text text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists chunks_document_id_idx on chunks (document_id);
create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops);
