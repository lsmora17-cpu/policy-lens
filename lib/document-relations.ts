import {
  EDITION_CHUNK_SIMILARITY_THRESHOLD,
  EDITION_MATCH_FRACTION_THRESHOLD,
} from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase";

// CHECK.md item 5: after a document's chunks are embedded, check whether it's
// substantially the same underlying report as one already in the library (a
// draft/final pair, a reprint, etc.), so citations from both can later be
// flagged as one source rather than independent corroborating evidence.
// Best-effort: detection failing must never fail the upload itself.
export async function detectAndStoreRelatedDocuments(documentId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("find_related_documents", {
    new_document_id: documentId,
    chunk_similarity_threshold: EDITION_CHUNK_SIMILARITY_THRESHOLD,
    match_fraction_threshold: EDITION_MATCH_FRACTION_THRESHOLD,
  });

  if (error || !data || data.length === 0) return;

  const rows = (data as { document_id: string; matched_fraction: number }[]).map((match) => ({
    document_id_a: documentId < match.document_id ? documentId : match.document_id,
    document_id_b: documentId < match.document_id ? match.document_id : documentId,
    matched_fraction: match.matched_fraction,
  }));

  await supabase
    .from("document_relations")
    .upsert(rows, { onConflict: "document_id_a,document_id_b" });
}

// Among a given set of cited document ids, returns the pairs already flagged as
// the same underlying report (both ends must be in documentIds).
export async function findRelatedDocumentPairs(
  documentIds: string[]
): Promise<{ documentIdA: string; documentIdB: string }[]> {
  if (documentIds.length < 2) return [];
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("document_relations")
    .select("document_id_a, document_id_b")
    .in("document_id_a", documentIds)
    .in("document_id_b", documentIds);

  return ((data ?? []) as { document_id_a: string; document_id_b: string }[]).map((row) => ({
    documentIdA: row.document_id_a,
    documentIdB: row.document_id_b,
  }));
}
