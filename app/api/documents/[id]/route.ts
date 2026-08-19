import { DOCUMENTS_BUCKET } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (fetchError || !doc) {
    return errorResponse(404, "not-found", "That document doesn't exist.");
  }

  // Storage object deleted before the DB row (CHECK.md item 7): uploads are
  // confidential by default (CLAUDE.md), so a failure here must never leave
  // the PDF orphaned in Storage with no record pointing to it. If this fails,
  // the document row is left intact — nothing is silently lost, and the
  // delete can simply be retried.
  const { error: storageError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([doc.storage_path]);
  if (storageError) {
    return errorResponse(500, "delete-failed", "Could not delete the stored file. Please try again.");
  }

  // chunks (and their embeddings) cascade-delete via the FK constraint from
  // task 2's schema, so removing this row is enough to fully exclude the
  // document from future retrieval (PRD.md §7).
  const { error: deleteError } = await supabase.from("documents").delete().eq("id", id);
  if (deleteError) {
    return errorResponse(500, "delete-failed", "Could not delete the document. Please try again.");
  }

  return Response.json({ deleted: true, id });
}
