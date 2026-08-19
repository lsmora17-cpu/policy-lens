import { createHash } from "crypto";
import { PDFDocument } from "pdf-lib";
import { DOCUMENTS_BUCKET, MAX_UPLOAD_BYTES, MAX_UPLOAD_PAGES } from "@/lib/config";
import { processDocumentText } from "@/lib/document-processing";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
// Vercel's default function timeout (10s Hobby / 15s Pro) can be too short
// for the full upload pipeline (extraction + chunking + embedding across up
// to 300 pages). See CHECK.md item 2.
export const maxDuration = 60;

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, filename, page_count, extractable_status, uploaded_at, chunks(count)")
    .order("uploaded_at", { ascending: false });

  if (error) {
    return errorResponse(500, "list-failed", "Could not load the document library.");
  }

  // chunkCount (CHECK.md item 14) lets the UI detect a document whose
  // extractable_status says it should be searchable but which ended up with
  // zero chunks (e.g. a transient chunk-insert/embedding failure) — otherwise
  // this state is invisible and the only fix was deleting and re-uploading.
  const documents = (data ?? []).map((d) => {
    const { chunks, ...rest } = d as typeof d & { chunks: { count: number }[] | null };
    return { ...rest, chunkCount: chunks?.[0]?.count ?? 0 };
  });

  return Response.json({ documents });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return errorResponse(400, "missing-file", "No file was provided under the 'file' field.");
  }

  const looksLikePdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) {
    return errorResponse(400, "invalid-file-type", "Only PDF files are supported.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const maxMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    return errorResponse(
      400,
      "file-too-large",
      `This file is too large. The limit is ${maxMb}MB; please upload a smaller file.`
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let pageCount: number;
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    pageCount = pdfDoc.getPageCount();
  } catch {
    return errorResponse(
      400,
      "invalid-pdf",
      "This file couldn't be read as a PDF. It may be corrupted or not a real PDF."
    );
  }

  if (pageCount > MAX_UPLOAD_PAGES) {
    return errorResponse(
      400,
      "too-many-pages",
      `This PDF has ${pageCount} pages, which is over the ${MAX_UPLOAD_PAGES}-page limit.`
    );
  }

  const fileHash = createHash("sha256").update(buffer).digest("hex");
  const storagePath = `${fileHash}.pdf`;
  const title = file.name.replace(/\.pdf$/i, "");

  const supabase = getSupabaseServerClient();

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    if (/already exists/i.test(uploadError.message)) {
      return errorResponse(
        409,
        "duplicate-file",
        "This exact file has already been uploaded to the library."
      );
    }
    return errorResponse(500, "upload-failed", "Could not store the file. Please try again.");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("documents")
    .insert({
      title,
      filename: file.name,
      file_hash: fileHash,
      storage_path: storagePath,
      page_count: pageCount,
    })
    .select("id, title, filename, page_count, extractable_status, uploaded_at")
    .single();

  if (insertError) {
    // Roll back the stored file so we never leave an orphaned upload behind.
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);

    if (insertError.code === "23505") {
      return errorResponse(
        409,
        "duplicate-file",
        "This exact file has already been uploaded to the library."
      );
    }
    return errorResponse(500, "upload-failed", "Could not save the document. Please try again.");
  }

  const extraction = await processDocumentText(inserted.id, buffer, pageCount);

  const { data: updated, error: updateError } = await supabase
    .from("documents")
    .select("id, title, filename, page_count, extractable_status, uploaded_at")
    .eq("id", inserted.id)
    .single();

  const document = updateError ? inserted : updated;

  return Response.json({ document, extraction }, { status: 201 });
}
