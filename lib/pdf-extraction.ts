import { extractText, getDocumentProxy } from "unpdf";

export type PageText = { pageNumber: number; text: string };
export type ExtractableStatus = "full" | "partial" | "unsupported";

// A page counts as "having text" above this length, to ignore stray artifacts
// (page numbers, watermarks) that aren't real extractable content.
const MEANINGFUL_TEXT_LENGTH = 20;

// Pure PDF-buffer-in, per-page-text-out extraction. Called both at upload time
// (to classify extractable_status) and later at chunking time (task 7) — the
// original PDF in Storage is the source of truth, so extracted text isn't
// persisted separately until it's actually chunked.
export async function extractPdfPageText(buffer: Buffer): Promise<PageText[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((pageText, index) => ({
    pageNumber: index + 1,
    text: pageText.trim(),
  }));
}

export function hasMeaningfulText(page: PageText): boolean {
  return page.text.length >= MEANINGFUL_TEXT_LENGTH;
}

// PLAN.md task 6 / PRD.md §5: a document isn't just "searchable" or "not" — some
// pages may be real text while others are scanned/image-only, and that must be
// surfaced rather than silently treated as fully searchable.
export function classifyExtractable(pages: PageText[]): ExtractableStatus {
  if (pages.length === 0) return "unsupported";
  const withText = pages.filter(hasMeaningfulText).length;
  if (withText === 0) return "unsupported";
  if (withText === pages.length) return "full";
  return "partial";
}
