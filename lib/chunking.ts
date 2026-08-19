import { encode } from "gpt-tokenizer";
import { CHUNK_OVERLAP_TOKENS, CHUNK_SIZE_TOKENS } from "@/lib/config";
import type { PageText } from "@/lib/pdf-extraction";

export type Chunk = { pageNumber: number; chunkIndex: number; text: string };

function countTokens(text: string): number {
  return encode(text).length;
}

function splitIntoParagraphs(text: string): string[] {
  let parts = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  // PDF text extraction often loses blank-line breaks entirely; fall back to
  // single newlines so we still have paragraph-ish units to work with.
  if (parts.length <= 1) {
    parts = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  }
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

function splitIntoSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [text];
}

// Splits units so none individually exceeds the chunk budget — a paragraph
// that's too long on its own gets broken at sentence boundaries instead
// (PRD.md §8: "if a paragraph substantially exceeds the target size, it may
// be split as needed").
function toSizedUnits(paragraphs: string[], maxTokens: number): string[] {
  const units: string[] = [];
  for (const paragraph of paragraphs) {
    if (countTokens(paragraph) <= maxTokens) {
      units.push(paragraph);
    } else {
      units.push(...splitIntoSentences(paragraph));
    }
  }
  return units;
}

// Chunks a single page's text, never crossing into another page — chunks
// carry a single page_number for citations, per DESIGN.md's data model.
function chunkPageText(
  text: string,
  chunkSizeTokens: number,
  overlapTokens: number
): string[] {
  const units = toSizedUnits(splitIntoParagraphs(text), chunkSizeTokens);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const unit of units) {
    const unitTokens = countTokens(unit);
    if (current.length > 0 && currentTokens + unitTokens > chunkSizeTokens) {
      chunks.push(current.join(" "));

      // Carry trailing units into the next chunk for overlap.
      const overlapUnits: string[] = [];
      let overlapTokenCount = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const t = countTokens(current[i]);
        if (overlapTokenCount + t > overlapTokens) break;
        overlapUnits.unshift(current[i]);
        overlapTokenCount += t;
      }
      current = overlapUnits;
      currentTokens = overlapTokenCount;
    }
    current.push(unit);
    currentTokens += unitTokens;
  }
  if (current.length > 0) chunks.push(current.join(" "));

  return chunks;
}

export function chunkPages(
  pages: PageText[],
  opts?: { chunkSizeTokens?: number; overlapTokens?: number }
): Chunk[] {
  const chunkSizeTokens = opts?.chunkSizeTokens ?? CHUNK_SIZE_TOKENS;
  const overlapTokens = opts?.overlapTokens ?? CHUNK_OVERLAP_TOKENS;

  const chunks: Chunk[] = [];
  let chunkIndex = 0;
  for (const page of pages) {
    if (!page.text) continue;
    for (const text of chunkPageText(page.text, chunkSizeTokens, overlapTokens)) {
      chunks.push({ pageNumber: page.pageNumber, chunkIndex: chunkIndex++, text });
    }
  }
  return chunks;
}
