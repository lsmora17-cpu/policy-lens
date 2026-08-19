import {
  COMPARE_CHUNKS_PER_DOCUMENT,
  COMPARE_CHUNKS_TOTAL_CAP,
  EVIDENCE_SYNTHESIS_TOP_K,
  RETRIEVAL_SIMILARITY_THRESHOLD,
} from "@/lib/config";
import { embedTexts } from "@/lib/embeddings";
import { getSupabaseServerClient } from "@/lib/supabase";

export type RetrievedChunk = {
  id: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  text: string;
  similarity: number;
};

type MatchChunkRow = {
  id: string;
  document_id: string;
  page_number: number | null;
  chunk_index: number;
  text: string;
  similarity: number;
};

// Vector similarity search across the WHOLE collection (Compare Documents'
// per-document scoping is task 18, not this). Uses the same embedding model
// as ingestion (embedTexts), and never pads results below the relevance
// threshold just to reach EVIDENCE_SYNTHESIS_TOP_K (PRD.md §8).
export async function retrieveRelevantChunks(question: string): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await embedTexts([question]);
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: RETRIEVAL_SIMILARITY_THRESHOLD,
    match_count: EVIDENCE_SYNTHESIS_TOP_K,
  });

  if (error) {
    throw new Error(`Retrieval failed: ${error.message}`);
  }

  return attachDocumentTitles((data ?? []) as MatchChunkRow[], supabase);
}

// Vector similarity search scoped to only the given documents (Compare
// Documents) — up to COMPARE_CHUNKS_PER_DOCUMENT relevance-thresholded chunks
// per document. With the 2–5 document selection rule (task 17) this can never
// exceed 20 total, but the cap is still applied explicitly in case either
// limit changes independently later (PRD.md §8).
export async function retrieveChunksForDocuments(
  question: string,
  documentIds: string[]
): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await embedTexts([question]);
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc("match_chunks_for_documents", {
    query_embedding: queryEmbedding,
    match_threshold: RETRIEVAL_SIMILARITY_THRESHOLD,
    document_ids: documentIds,
    per_document_limit: COMPARE_CHUNKS_PER_DOCUMENT,
  });

  if (error) {
    throw new Error(`Retrieval failed: ${error.message}`);
  }

  const rows = ((data ?? []) as MatchChunkRow[])
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, COMPARE_CHUNKS_TOTAL_CAP);

  return attachDocumentTitles(rows, supabase);
}

async function attachDocumentTitles(
  rows: MatchChunkRow[],
  supabase: ReturnType<typeof getSupabaseServerClient>
): Promise<RetrievedChunk[]> {
  if (rows.length === 0) return [];

  const documentIds = [...new Set(rows.map((r) => r.document_id))];
  const { data: docs } = await supabase.from("documents").select("id, title").in("id", documentIds);
  const titleById = new Map((docs ?? []).map((d) => [d.id, d.title as string]));

  return rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    documentTitle: titleById.get(r.document_id) ?? "Unknown document",
    pageNumber: r.page_number,
    text: r.text,
    similarity: r.similarity,
  }));
}
