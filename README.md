# Policy Lens

Policy Lens is an AI research tool for public-health students, researchers, and early-career policy
professionals to synthesize and compare findings across their own uploaded PDF reports and articles —
with every claim traceable back to the exact source passage it came from.

It's a private, single-user tool with no accounts or login: the deployed link is meant to be used by
one person, not shared publicly.

## What it does

Two modes in one app:

- **Evidence Synthesis** — ask a question in plain language and get a cited answer synthesized from
  your uploaded documents. Direct quotes are visually distinguished from the AI's own interpretation,
  and every substantive claim carries a citation (document title, page number, and a supporting
  snippet). If the evidence is insufficient, ambiguous, or conflicting, the app says so explicitly
  instead of guessing.
- **Compare Documents** — select 2–5 documents and get their agreement, differences, and evidence
  gaps on a topic, grouped and cited the same way.

Answers are grounded **only** in what you've uploaded — there's no web search or outside knowledge
involved, and a lightweight citation-correspondence check flags any citation that doesn't actually
match the retrieved passage it claims to.

## How it works

```
PDF upload → text extraction → chunking → embeddings → pgvector retrieval → LLM generation → cited response
```

- PDFs are parsed for text, chunked paragraph-aware (~500 tokens, ~50 token overlap), and embedded
  with OpenAI's `text-embedding-3-small`.
- Chunks are stored in Postgres (Supabase) with the `pgvector` extension and retrieved by cosine
  similarity — top 8 across the collection for Evidence Synthesis, up to 4 per document (capped at
  20 total) for Compare Documents.
- Answers are generated with `gpt-4o-mini` under a strict JSON schema, so every citation is
  structured (title, page, snippet) rather than free text.
- A document that's substantially the same underlying report as another already in the library
  (e.g. a draft and its final version) is detected via chunk-embedding similarity and flagged, so
  the two are never presented as independent corroborating sources.
- Scanned or image-only PDFs are detected and flagged as not fully searchable rather than silently
  treated as such (OCR is out of scope).

## Tech stack

- **Framework**: Next.js (App Router), deployed to Vercel
- **Styling**: Tailwind CSS, no component library — deep navy / warm ivory / sage / gold editorial
  palette, desktop-first (~1024px+)
- **Database**: Supabase Postgres + `pgvector`
- **Models**: OpenAI `text-embedding-3-small` (embeddings) and `gpt-4o-mini` (generation)

## Running locally

```bash
npm install
npm run dev
```

Requires a `.env` file (not committed) with `OPENAI_API_KEY`, `SUPABASE_URL`, and
`SUPABASE_SERVICE_ROLE_KEY` at minimum — see `lib/config.ts` for the full list of configurable
values (chunking, retrieval, and upload limits all have sane defaults).

## Status

Built as a final project prototype. See `PRD.md`, `PLAN.md`, and `DESIGN.md` for the full spec and
design decisions, and `CHECK.md` for the pre-deployment verification log.
