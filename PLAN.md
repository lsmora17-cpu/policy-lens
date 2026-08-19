# PLAN.md

## Cycle goal

Build the Policy Lens MVP end to end: a private, single-user Next.js app where a shared PDF library powers two citation-grounded features, Evidence Synthesis and Cross-Document Comparison, per `PRD.md`.

## Success criteria

- Evidence Synthesis answers a normal query in under ~30s; Cross-Document Comparison handles 2–5 documents in under ~60s. *(Aspirational MVP targets per PRD §3 — not validated SLAs or promises to end users; a miss is a signal to investigate during manual QA, not a build failure.)*
- The library supports a working collection of ~20 PDFs without being hard-capped.
- At least 95% of substantive claims carry a traceable citation — document title + page number when available + a short snippet; page is omitted (never guessed or shown as "page unknown") for sources without a reliable page number — verified by manual QA.
- Both features correctly handle their required edge cases (insufficient/conflicting evidence, zero results, duplicate uploads and same-report drafts/editions, oversized/partial/scanned PDFs, out-of-range document selection, absence-not-disagreement).
- The app is deployed to Vercel and reachable only via its private link (no auth surface added).

## Tasks (build order)

Each task below is annotated with its matching `PRD.md` "Development unit" number where one exists, since task 1 (project scaffolding) isn't in the PRD's own numbered list and shifts every later number by one.

1. Scaffold the Next.js + Tailwind project, including `.env`-based config for API keys and model names (gitignored, read server-side only) — this doesn't exist yet and everything below depends on it.
2. Set up the Supabase schema: `documents` and `chunks` tables, with the `pgvector` extension enabled. *(PRD unit 1)*
3. Build the PDF upload API route: accepts a file, enforces the ~50MB/~300-page limit (reject over-limit files at upload time with a clear message — never silently truncate), and stores both the original file and its metadata. *(PRD unit 2)*
4. Add a file-hash duplicate check on upload; prevent or clearly flag exact duplicate files, and avoid treating a differently-named draft/edition of the same report as an independent source. *(PRD unit 3)*
5. Implement PDF text extraction in the upload pipeline. *(PRD unit 4)*
6. Detect partial/scanned (image-only) pages and flag the document as partially extractable or unsupported. *(PRD unit 5)*
7. Implement text chunking (paragraph-aware, ~500 tokens/~50 overlap by default, configurable via server-side config, not hard-coded) and store chunk-to-page mapping. *(PRD unit 6)*
8. Generate embeddings for each chunk via the OpenAI API — model name read from server-side config, not hard-coded — and store them in Supabase (`pgvector`). *(PRD unit 7)*
9. Build the document library UI: upload control, document list, delete action. *(PRD unit 8)*
10. Implement document deletion: remove the document (including its stored original file), its chunks, and its embeddings, and exclude it from future retrieval. *(PRD unit 9)*
11. Build the shared two-tab app shell: "Evidence Synthesis" and "Compare Documents". *(PRD unit 10)*
12. Implement retrieval: vector similarity search over chunks for a given question, applying a relevance threshold rather than padding results to hit a fixed count. *(PRD unit 11)*
13. Build Evidence Synthesis answer generation: single-turn LLM call (no conversation memory across queries; model name from server-side config), grounded only in retrieved chunks, with citation formatting (title + page when available + snippet, page omitted rather than guessed otherwise) and a clear visual/textual distinction between direct quotes and the AI's own synthesized interpretation. *(PRD unit 12)*
14. Handle Evidence Synthesis edge cases: insufficient/ambiguous/conflicting evidence and zero-relevant-passages responses. *(PRD unit 13)*
15. Add the lightweight citation-correspondence check for Evidence Synthesis answers. *(PRD unit 14)*
16. Build the Evidence Synthesis UI: question input, answer display with citations. *(PRD unit 15)*
17. Build the document-selection UI for Compare Documents, enforcing the 2–5 selection rule: block the run and clearly explain the requirement if the count is out of range — never silently disable, clamp, or truncate the selection. *(PRD unit 16)*
18. Implement retrieval across the selected documents for Compare Documents (up to 4 relevance-thresholded chunks per document, capped at 20 total). *(PRD unit 17)*
19. Build Cross-Document Comparison generation: agreement, differences, and evidence-gap synthesis with per-finding citations in the same title + page-if-available + snippet format. *(PRD unit 18)*
20. Handle Compare Documents edge cases: absence-not-disagreement rule, conflicting sources presented as conflicting (never reconciled into an invented resolution), no-meaningful-comparison case. *(PRD unit 19)*
21. Build the Compare Documents UI: results display grouped by agreement/differences/gaps with citations. *(PRD unit 20)*
22. Apply the visual design (navy/ivory/sage/gold palette, editorial/typography-focused layout) across both modes. *(PRD unit 21)*
23. Run a manual QA pass against the aspirational MVP targets — response time, citation coverage, citation correspondence — treating them as evaluation targets, not enforced SLAs. *(PRD unit 22)*
24. Deploy to Vercel, authenticating via the Vercel CLI with `VERCEL_TOKEN` from `.env`. *(PRD unit 23)*
