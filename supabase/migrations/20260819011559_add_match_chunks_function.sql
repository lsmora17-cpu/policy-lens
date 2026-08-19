-- PLAN.md task 12: vector similarity search over ALL chunks in the collection,
-- with a relevance threshold rather than always returning match_count rows
-- (PRD.md §8 — never pad with low-relevance chunks to hit a target).
create or replace function match_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  document_id uuid,
  page_number integer,
  chunk_index integer,
  text text,
  similarity float
)
language sql stable
as $$
  select
    chunks.id,
    chunks.document_id,
    chunks.page_number,
    chunks.chunk_index,
    chunks.text,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  where chunks.embedding is not null
    and 1 - (chunks.embedding <=> query_embedding) >= match_threshold
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;
