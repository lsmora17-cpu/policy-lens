// Server-side only: these read `process.env` directly, which Next.js never exposes
// to the browser unless a variable is prefixed with NEXT_PUBLIC_. Per PRD.md, model
// names must be configurable, not hard-coded.
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
export const GENERATION_MODEL = process.env.GENERATION_MODEL ?? "gpt-4o-mini";

// Upload limits per PRD.md §8: reject outright at upload time, never truncate.
// Capped at ~4MB (not the original ~50MB target) because Vercel Functions cap
// inbound request bodies at 4.5MB — a larger app-level limit would just get
// rejected by the platform before this code ever runs. See CHECK.md item 1.
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 4 * 1024 * 1024);
export const MAX_UPLOAD_PAGES = Number(process.env.MAX_UPLOAD_PAGES ?? 300);

export const DOCUMENTS_BUCKET = "documents";

// Chunking per PRD.md §8: an initial MVP default, configurable rather than
// hard-coded so retrieval quality can be tuned later.
export const CHUNK_SIZE_TOKENS = Number(process.env.CHUNK_SIZE_TOKENS ?? 500);
export const CHUNK_OVERLAP_TOKENS = Number(process.env.CHUNK_OVERLAP_TOKENS ?? 50);

// Retrieval per PRD.md §8: top 8 across the whole collection for Evidence
// Synthesis, never padded with chunks below the relevance threshold.
export const EVIDENCE_SYNTHESIS_TOP_K = Number(process.env.EVIDENCE_SYNTHESIS_TOP_K ?? 8);
export const RETRIEVAL_SIMILARITY_THRESHOLD = Number(
  process.env.RETRIEVAL_SIMILARITY_THRESHOLD ?? 0.3
);

// Compare Documents selection + retrieval per PRD.md §5/§8.
export const COMPARE_MIN_DOCUMENTS = Number(process.env.COMPARE_MIN_DOCUMENTS ?? 2);
export const COMPARE_MAX_DOCUMENTS = Number(process.env.COMPARE_MAX_DOCUMENTS ?? 5);
export const COMPARE_CHUNKS_PER_DOCUMENT = Number(process.env.COMPARE_CHUNKS_PER_DOCUMENT ?? 4);
export const COMPARE_CHUNKS_TOTAL_CAP = Number(process.env.COMPARE_CHUNKS_TOTAL_CAP ?? 20);

// Same-report edition detection (CHECK.md item 5): a document counts as "the
// same underlying report" as another only if most of its chunks each have a
// near-duplicate chunk somewhere in that other document. Configurable rather
// than hard-coded, matching the retrieval thresholds above. 0.88 was picked
// empirically with text-embedding-3-small: a real draft/final pair of the same
// report (identical core paragraphs, different cover text) scored ~0.92, while
// unrelated same-domain reports scored 0.35-0.58 — 0.88 sits with margin above
// the false-positive range without demanding byte-for-byte identical text.
export const EDITION_CHUNK_SIMILARITY_THRESHOLD = Number(
  process.env.EDITION_CHUNK_SIMILARITY_THRESHOLD ?? 0.88
);
export const EDITION_MATCH_FRACTION_THRESHOLD = Number(
  process.env.EDITION_MATCH_FRACTION_THRESHOLD ?? 0.6
);

// Abuse guard (CHECK.md item 3): no auth exists by design, so an unbounded
// question/topic string is both a cost vector (arbitrarily large OpenAI calls)
// and a reliability bug (a string over the embedding model's input limit
// throws inside embedTexts with nothing to catch it). Rejecting oversized
// input server-side before it reaches OpenAI fixes both at once.
export const MAX_QUESTION_LENGTH = Number(process.env.MAX_QUESTION_LENGTH ?? 2000);
