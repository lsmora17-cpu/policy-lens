import type { RetrievedChunk } from "@/lib/retrieval";

// CHECK.md item 9: passage content comes from user-uploaded PDFs and must be
// treated as untrusted data, never as instructions. This only neutralizes an
// attempt to forge a fake <passage>/</passage> tag boundary — it deliberately
// leaves ordinary "<"/">" usage (e.g. "p < 0.05", common in health literature)
// untouched, so the citation-correspondence check (lib/citation-check.ts,
// which matches against the original unescaped chunk text) still matches
// verbatim quotes correctly.
function neutralizePassageTags(text: string): string {
  return text.replace(/<(\/?passage\b)/gi, "&lt;$1");
}

// Shared by both system prompts (Evidence Synthesis + Compare Documents) so
// the two can't drift out of sync on this mitigation.
export function formatPassagesForPrompt(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const title = neutralizePassageTags(c.documentTitle);
      const page = c.pageNumber ?? "unknown";
      const text = neutralizePassageTags(c.text);
      return `<passage id="${i + 1}" document="${title}" page="${page}">\n${text}\n</passage>`;
    })
    .join("\n\n");
}
