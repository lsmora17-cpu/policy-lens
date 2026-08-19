# DESIGN.md

Based on `PLAN.md` and `PRD.md` (visual/design guidance and the ~1024px viewport minimum come from `prd_lite.md` §5, the project's condensed design brief).

## Screen layout

One app, one page shell — a persistent left sidebar plus a main area that switches with the active tab.

```
┌─────────────────────────────────────────────────────────┐
│  Policy Lens                    [Evidence Synthesis | Compare Documents] │
├───────────────┬─────────────────────────────────────────┤
│ Document       │  Main area (changes with active tab)     │
│ Library         │                                          │
│ (sidebar)      │                                          │
│                │                                          │
│ [Upload PDF]   │                                          │
│ - doc-1.pdf ✕  │                                          │
│ - doc-2.pdf ✕  │                                          │
│ - doc-3.pdf ⚠ │                                          │
│   (partial)    │                                          │
└───────────────┴─────────────────────────────────────────┘
```

- **Left sidebar (always visible, shared by both tabs)**: upload control (rejects files over ~4MB/~300 pages at upload time, with a clear message — the size limit is lower than PRD's original ~50MB target because Vercel Functions cap request bodies at 4.5MB; see CHECK.md item 1), document list, delete (✕) per document, a warning badge (⚠) on partially-extractable/unsupported PDFs. This is the "one shared library" from the PRD — it doesn't belong to either tab.
- **Top tab switcher**: "Evidence Synthesis" and "Compare Documents" — one app, two clearly distinguishable modes, not separate pages.
- **Evidence Synthesis (main area)**: a question input box at top (single-turn — no chat history shown or retained); below it, the answer, with direct quotes visually distinguished from the AI's own synthesized interpretation, and each citation shown as a small card (document title, page number when available, snippet — page is omitted rather than guessed when a source has none).
- **Compare Documents (main area)**: a document checklist at top for the 2–5 selection rule — selecting outside that range does not disable or clamp the checkboxes, it simply blocks the "Compare" button and shows an explanation of the requirement; below it, results grouped into three labeled sections — Agreement, Differences, Evidence Gaps — each finding carrying its own citation card(s) in the same format as Evidence Synthesis.
- Desktop/laptop-first layout (~1024px+ minimum), navy/ivory/sage/gold palette, generous whitespace — not optimized for mobile web, and native mobile apps are out of scope per the PRD.

## Data flow

**Ingestion (shared by both features, runs once per upload):**

```
PDF upload
  → validate size/page count (~4MB / ~300 pages) — reject over-limit files at upload time with a clear message, never truncate or partially process
  → file-hash duplicate check (block/flag if the exact file is already in the library; a differently-named draft/edition of the same report is still stored, just never presented as an independent source)
  → store the original file (e.g. Supabase Storage) alongside its metadata
  → text extraction
  → partial/scanned-page detection (flag document if needed)
  → paragraph-aware chunking (default ~500 tokens / ~50 overlap — configurable via server-side config, not hard-coded; keeps page number per chunk)
  → embed each chunk (OpenAI embeddings model — name read from a server-side env var, not hard-coded; default `text-embedding-3-small`)
  → store chunks + embeddings in Supabase (pgvector)
  → document appears in the library list
```

**Evidence Synthesis (per question):**

```
user question (single-turn — no conversation history carried across queries)
  → embed the question (same embedding model as ingestion)
  → vector similarity search across ALL chunks (top 8, relevance-thresholded — never padded with low-relevance chunks to reach 8)
  → LLM call (generation model — name read from a server-side env var, not hard-coded; default `gpt-4o-mini`) grounded only in those chunks, instructed to cite and to label direct quotes separately from its own synthesized interpretation
  → lightweight citation-correspondence check
  → answer + citations rendered in the UI (page number shown only when available, never guessed or placeholder-filled)
```

**Compare Documents (per comparison request):**

```
user selects 2–5 documents + a topic/question (out-of-range selection blocks the run with an explanation, rather than being clamped)
  → vector similarity search scoped to only the selected documents
    (up to 4 relevance-thresholded chunks per document, capped at 20 total)
  → LLM call (same configurable generation model as above) grouping findings into agreement / differences / gaps, instructed to cite, to treat topic absence as "not covered" rather than disagreement, and to never invent a resolution when sources conflict
  → results + citations rendered in the UI, grouped by section
```

**Deletion:**

```
user deletes a document
  → document row, its stored original file, its chunks, and its embeddings all removed from Supabase
  → excluded from all retrieval from that point on (no retroactive updates to previously generated answers)
```

## Data model (Supabase Postgres)

**`documents`**
- `id`, `title`, `filename`, `file_hash` (dedup key), `storage_path` (original PDF location), `page_count`, `extractable_status` (`full` / `partial` / `unsupported`), `uploaded_at`

**`chunks`**
- `id`, `document_id` (FK → `documents`), `page_number` (nullable — a document may lack reliable page numbers), `text`, `embedding` (`pgvector`), `chunk_index`

## API endpoints (Next.js API routes)

- `POST /api/documents` — upload a PDF (validates size/pages, dedup check, extraction, chunking, embedding)
- `GET /api/documents` — list the library
- `DELETE /api/documents/:id` — delete a document, its stored file, chunks, and embeddings
- `POST /api/synthesize` — Evidence Synthesis query (single question in, cited answer out)
- `POST /api/compare` — Cross-Document Comparison (2–5 document ids + a topic/question in, grouped findings out)

## Error handling

API errors return a consistent JSON shape: `{ "error": { "code": "...", "message": "..." } }`. Actual codes in use: `missing-file`, `invalid-file-type`, `file-too-large`, `invalid-pdf`, `too-many-pages`, `duplicate-file`, `upload-failed` (upload); `list-failed` (list); `not-found`, `delete-failed` (delete); `missing-question`, `question-too-long` (both query endpoints); `invalid-document-id`, `invalid-selection-count`, `retrieval-failed`, `generation-failed` (Compare Documents only).

Deliberately **not** error codes (CHECK.md item 12 — this file previously documented them as `unsupported-file`, `no-evidence-found`, `insufficient-evidence`, which never matched the code): zero relevant passages, insufficient/ambiguous/conflicting evidence, and a scanned/partial-text PDF are all normal `200` responses, not errors. Zero-passage and evidence-quality outcomes surface via the `evidenceAssessment` (`/api/synthesize`) / `comparisonAssessment` (`/api/compare`) field; extraction quality surfaces via `documents.extractable_status` (`full` / `partial` / `unsupported`) set at upload time. This is intentional per PRD.md §5 — these are expected, explicit outcomes to show the user, not failures.

## Test plan (brief)

- Manual QA pass (PLAN task 23 / PRD unit 22) against the aspirational response-time targets, ≥95% citation coverage, and citation correspondence.
- Spot-check each required edge case: zero-relevant-passages, conflicting evidence, exact-duplicate upload, same-report draft/edition upload, oversized file, partial/scanned PDF, out-of-range document selection, and confirming a deleted document is excluded from new answers.

## Tech choices

Base is fixed to **Next.js** (screens + API routes together, deploys straight to Vercel) — this was already decided and isn't up for reconsideration. On top of that, the app needs a few more pieces to actually work. In plain terms:

| Tech | What it's for, in one line |
|---|---|
| **Tailwind CSS** | Utility classes only for styling (no separate component library like shadcn/ui) — enough to encode the navy/ivory/sage/gold palette without adding another UI dependency. |
| **Supabase Postgres + `pgvector`** | The database — stores your uploaded documents' metadata and a special "searchable by meaning" version of their text (an embedding), so the app can find relevant passages even if they don't share exact keywords. |
| **Supabase Storage** | Where the original uploaded PDF files themselves are kept (separate from the searchable text/embeddings), so a document can be fully removed — file included — when you delete it. |
| **OpenAI API — embeddings** | Turns a chunk of document text (or your question) into that "searchable by meaning" numeric form. The exact model is set in server config (default `text-embedding-3-small`), not hard-coded, so it can be changed later without a rebuild. |
| **OpenAI API — chat/generation** | The part that actually writes the synthesized answer or comparison, using only the passages retrieved from your documents. The exact model is set in server config (default `gpt-4o-mini`), not hard-coded. |
| **A PDF text-extraction library** | A small add-on that reads the words out of an uploaded PDF so they can be searched — runs quietly inside the app's own server code, no separate service to manage. |
| **Node's built-in file hashing** | Computes a fingerprint of each uploaded file's contents to catch exact duplicate uploads — already included with Next.js, nothing new to install. |
| **`.env` + server-side environment variables** | Where all API keys and the two configurable model names live. Read only by server-side code (API routes) — the browser never sees them — and the file is excluded from version control. |
| **Vercel** | Where the finished app is hosted/deployed, as planned for Part 5. |

No other infrastructure is introduced — everything above exists only to serve the two core features, matching the PRD's "no new infrastructure beyond what's configured" constraint.
