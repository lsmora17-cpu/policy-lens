import { DOCUMENTS_BUCKET } from "@/lib/config";
import { processDocumentText } from "@/lib/document-processing";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
// Same rationale as the upload route (CHECK.md item 2): re-running
// extraction/chunking/embedding across up to 300 pages can exceed Vercel's
// default function timeout.
export const maxDuration = 60;

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

// CHECK.md item 14: a document can end up with extractable_status set but
// zero chunks (e.g. a transient chunk-insert or embedding failure at upload
// time), silently excluding it from retrieval with no way to fix it short of
// deleting and re-uploading. This re-runs the same processing pipeline
// against the document's already-stored PDF — no re-upload needed.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("id, page_count, storage_path")
    .eq("id", id)
    .single();

  if (fetchError || !doc) {
    return errorResponse(404, "not-found", "That document doesn't exist.");
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(doc.storage_path);

  if (downloadError || !fileData) {
    return errorResponse(
      500,
      "reprocess-failed",
      "Could not read the stored file for this document. Please try again."
    );
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const extraction = await processDocumentText(doc.id, buffer, doc.page_count ?? 0);

  const { data: updated, error: updateError } = await supabase
    .from("documents")
    .select("id, title, filename, page_count, extractable_status, uploaded_at")
    .eq("id", id)
    .single();

  if (updateError || !updated) {
    return errorResponse(500, "reprocess-failed", "Reprocessing completed but the document could not be reloaded.");
  }

  return Response.json({ document: updated, extraction });
}
