import { chunkPages } from "@/lib/chunking";
import { detectAndStoreRelatedDocuments } from "@/lib/document-relations";
import { embedTexts } from "@/lib/embeddings";
import {
  classifyExtractable,
  extractPdfPageText,
  hasMeaningfulText,
  type ExtractableStatus,
  type PageText,
} from "@/lib/pdf-extraction";
import { getSupabaseServerClient } from "@/lib/supabase";

export type ProcessResult = {
  extractableStatus: ExtractableStatus;
  pagesWithText: number;
  totalPages: number;
  chunkCount: number;
  embeddedCount: number;
};

// Shared by upload (app/api/documents/route.ts) and reprocess
// (app/api/documents/[id]/reprocess/route.ts) — CHECK.md item 14: a document
// could previously end up with extractable_status set but zero chunks (e.g. a
// transient chunk-insert or embedding failure), silently excluding it from
// retrieval with no way to fix it short of delete + re-upload. Reprocess
// re-runs this same pipeline against the document's already-stored PDF.
export async function processDocumentText(
  documentId: string,
  buffer: Buffer,
  pageCount: number
): Promise<ProcessResult> {
  const supabase = getSupabaseServerClient();

  // Text extraction + partial/scanned detection (PRD.md §5): a document is
  // 'full' only if every page has real text, 'unsupported' if none do, and
  // 'partial' for a mix — never silently treated as fully searchable either way.
  let pages: PageText[] = [];
  let pagesWithText = 0;
  let extractableStatus: ExtractableStatus = "unsupported";
  try {
    pages = await extractPdfPageText(buffer);
    pagesWithText = pages.filter(hasMeaningfulText).length;
    extractableStatus = classifyExtractable(pages);
  } catch {
    // Extraction failing entirely (e.g. a malformed content stream) is treated
    // the same as "no usable text" rather than left stuck on 'pending'.
    extractableStatus = "unsupported";
  }

  await supabase.from("documents").update({ extractable_status: extractableStatus }).eq("id", documentId);

  // Clear any existing chunks first — reprocessing must fully replace the old
  // (possibly incomplete/stale) set, never append to or duplicate it. A no-op
  // on a fresh upload, since no chunks exist yet for a brand-new document.
  await supabase.from("chunks").delete().eq("document_id", documentId);

  // Chunking: only chunk pages with real text — a partial document's
  // blank/scanned pages have nothing worth splitting.
  let chunkCount = 0;
  let embeddedCount = 0;
  if (extractableStatus !== "unsupported") {
    const chunks = chunkPages(pages.filter(hasMeaningfulText));
    if (chunks.length > 0) {
      const rows = chunks.map((c) => ({
        document_id: documentId,
        page_number: c.pageNumber,
        chunk_index: c.chunkIndex,
        text: c.text,
      }));
      const { data: insertedChunks, error: chunkError } = await supabase
        .from("chunks")
        .insert(rows)
        .select("id");

      if (!chunkError && insertedChunks) {
        chunkCount = insertedChunks.length;

        // Embeddings: same model at ingestion and query time (PRD.md §8). A
        // failure here leaves chunks with a null embedding rather than
        // failing the whole call — the document and its text are still saved.
        try {
          const vectors = await embedTexts(rows.map((r) => r.text));
          const results = await Promise.all(
            insertedChunks.map((chunk, i) =>
              supabase.from("chunks").update({ embedding: vectors[i] }).eq("id", chunk.id)
            )
          );
          embeddedCount = results.filter((r) => !r.error).length;

          // Edition/draft detection (CHECK.md item 5): only meaningful once
          // embeddings actually exist. Best-effort — never fails the call.
          if (embeddedCount > 0) {
            try {
              await detectAndStoreRelatedDocuments(documentId);
            } catch {
              // Detection is a nice-to-have flag, not a correctness requirement.
            }
          }
        } catch {
          embeddedCount = 0;
        }
      }
    }
  }

  return { extractableStatus, pagesWithText, totalPages: pageCount, chunkCount, embeddedCount };
}
