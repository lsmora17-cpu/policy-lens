-- PLAN.md task 18: vector similarity search scoped to a specific set of
-- documents (Compare Documents), up to per_document_limit relevance-
-- thresholded chunks per document — unlike match_chunks (task 12), which
-- searches the whole collection.
create or replace function match_chunks_for_documents(
  query_embedding vector(1536),
  match_threshold float,
  document_ids uuid[],
  per_document_limit int
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
  select ranked.id, ranked.document_id, ranked.page_number, ranked.chunk_index,
         ranked.text, ranked.similarity
  from unnest(document_ids) as doc(id)
  cross join lateral (
    select
      chunks.id,
      chunks.document_id,
      chunks.page_number,
      chunks.chunk_index,
      chunks.text,
      1 - (chunks.embedding <=> query_embedding) as similarity
    from chunks
    where chunks.document_id = doc.id
      and chunks.embedding is not null
      and 1 - (chunks.embedding <=> query_embedding) >= match_threshold
    order by chunks.embedding <=> query_embedding
    limit per_document_limit
  ) as ranked;
$$;
