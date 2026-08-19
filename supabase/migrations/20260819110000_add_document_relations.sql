-- CHECK.md item 5: detect when two uploaded documents are drafts/editions of the
-- same underlying report, so Evidence Synthesis can flag them as one source
-- instead of citing both as independent corroborating evidence. Detection reuses
-- the chunk embeddings already computed for retrieval — no separate model/pipeline.

create table if not exists document_relations (
  document_id_a uuid not null references documents(id) on delete cascade,
  document_id_b uuid not null references documents(id) on delete cascade,
  matched_fraction double precision not null,
  created_at timestamptz not null default now(),
  primary key (document_id_a, document_id_b),
  check (document_id_a < document_id_b)
);

alter table document_relations enable row level security;

-- For a newly-uploaded document, finds existing documents where most of its
-- chunks have a near-duplicate chunk (by embedding cosine similarity) somewhere
-- in that other document — i.e. substantially the same report, not just a
-- topically related one.
create or replace function find_related_documents(
  new_document_id uuid,
  chunk_similarity_threshold float,
  match_fraction_threshold float
)
returns table (document_id uuid, matched_fraction float)
language sql stable
as $$
  with new_chunks as (
    select id, embedding from chunks
    where document_id = new_document_id and embedding is not null
  ),
  best_match_per_chunk as (
    select nc.id as new_chunk_id, c.document_id as other_document_id,
           max(1 - (c.embedding <=> nc.embedding)) as best_similarity
    from new_chunks nc
    join chunks c
      on c.document_id <> new_document_id and c.embedding is not null
    group by nc.id, c.document_id
  ),
  per_document as (
    select other_document_id,
           count(*) filter (where best_similarity >= chunk_similarity_threshold) as matched_chunks,
           count(*) as total_chunks
    from best_match_per_chunk
    group by other_document_id
  )
  select other_document_id, matched_chunks::float / total_chunks
  from per_document
  where total_chunks > 0
    and matched_chunks::float / total_chunks >= match_fraction_threshold;
$$;
