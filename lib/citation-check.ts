import type { AnswerBlock, Citation } from "@/lib/generation";
import type { RetrievedChunk } from "@/lib/retrieval";

export type CheckedCitation = Citation & { verified: boolean };
export type CheckedAnswerBlock = Omit<AnswerBlock, "citations"> & { citations: CheckedCitation[] };
export type CheckedFinding = { text: string; citations: CheckedCitation[] };

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

// Lightweight, not full fact-checking (PRD.md §5): confirms a citation's
// snippet genuinely traces back to one of the chunks actually retrieved and
// handed to the model — not whether the surrounding claim is true.
function snippetCorresponds(snippet: string, chunkText: string): boolean {
  const normSnippet = normalize(snippet);
  const normChunk = normalize(chunkText);
  if (!normSnippet) return false;
  if (normChunk.includes(normSnippet)) return true;

  // Fallback for near-verbatim snippets (e.g. the model trimmed a clause or
  // added "..."): most of the snippet's words should still appear in the chunk.
  const snippetWords = normSnippet.split(" ").filter(Boolean);
  if (snippetWords.length === 0) return false;
  const chunkWords = new Set(normChunk.split(" ").filter(Boolean));
  const overlap = snippetWords.filter((w) => chunkWords.has(w)).length;
  return overlap / snippetWords.length >= 0.8;
}

function verifyCitation(citation: Citation, chunks: RetrievedChunk[]): boolean {
  const match = chunks.find(
    (c) => c.documentTitle === citation.documentTitle && c.pageNumber === citation.pageNumber
  );
  if (!match) return false;
  return snippetCorresponds(citation.snippet, match.text);
}

// Flags each citation rather than silently dropping or rewriting the answer —
// this is meant to surface possible mismatches to the user (task 16's UI),
// not to police or block the model's output.
export function verifyAnswerCitations(
  blocks: AnswerBlock[],
  chunks: RetrievedChunk[]
): CheckedAnswerBlock[] {
  return blocks.map((block) => ({
    ...block,
    citations: block.citations.map((citation) => ({
      ...citation,
      verified: verifyCitation(citation, chunks),
    })),
  }));
}

// Same check as verifyAnswerCitations (CHECK.md item 6): Compare Documents'
// findings (agreement/differences/evidenceGaps) use a {text, citations} shape
// without AnswerBlock's "type" field, so they need their own mapper.
export function verifyFindings(
  findings: { text: string; citations: Citation[] }[],
  chunks: RetrievedChunk[]
): CheckedFinding[] {
  return findings.map((finding) => ({
    ...finding,
    citations: finding.citations.map((citation) => ({
      ...citation,
      verified: verifyCitation(citation, chunks),
    })),
  }));
}
