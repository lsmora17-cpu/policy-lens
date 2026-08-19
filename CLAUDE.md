# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working rules for Claude Code in this repo

- Write all explanations and code comments in English.
- Only create new files inside this `my-app/` folder — never write outside it.
- Tech stack is fixed to Next.js, deployed to Vercel, as decided in the PRD. Do not switch to another framework or suggest migrating away from it.
- Follow the verification loop below for every code change (see "Workflow (verification loop)").
- Keep `.env` and `node_modules/` listed in `.gitignore` and never commit them.
- If a task needs authentication to an external service, don't ask the user for the token or print it in chat — read and use the value already in `.env`. E.g. for Supabase work, install the Supabase CLI and authenticate with `SUPABASE_ACCESS_TOKEN`; for Vercel work (deployment, etc.), install the Vercel CLI and authenticate with `VERCEL_TOKEN`.
- Don't delete files outright. Move them into a `trash/` folder at the repo root instead, and let the user review and delete them later.
- Actively use the already-installed subagents whenever a task matches their specialty.
- If a task conflicts with an explicit rule elsewhere in this file (e.g. an "Explicitly out of scope" item), stop and ask the user before proceeding rather than resolving it yourself; if they approve an exception, update this file to record it, not just the code.
- Don't guess numeric thresholds (similarity cutoffs, confidence scores, rate limits, etc.) — calibrate them against real test data before calling the work done, and if live verification shows a guess was wrong, fix the value, not just note the discrepancy.

## Workflow (verification loop)

For every code change, repeat this loop until it passes — don't report a task done after step 1:

1. **Make the change.**
2. **Check the result yourself.** Run the app and exercise the change directly — open it in a browser for UI work, call the endpoint for an API route, run the relevant script for a data/pipeline change. Don't rely on "it should work" or on type-checking/build success alone as a stand-in for actually running it.
3. **Review your own code.** Re-read the diff against the rules in this file — architecture, product rules, security/privacy, scope — not just "does it run."
4. **If there's a problem, fix it and go back to step 1.**
5. Once it passes, summarize in one line what you changed and why.

## Project status

This repository currently contains only planning documents (`PRD.md`, full spec; `prd_lite.md`, condensed version) and a `.env` with API keys. No code has been written yet — no `package.json`, no app scaffold. When implementation starts, initialize a Next.js + Tailwind project per the stack below and update this file with real build/lint/test commands once they exist.

## What this app is

**Policy Lens** — an AI tool for public-health students, researchers, and early-career policy professionals to synthesize and compare findings across their own uploaded PDF reports/articles, with every claim traceable to a source passage. Private, single-user, no auth — the deployed link is not meant to be shared publicly.

Two modes in one app (not separate apps): **Evidence Synthesis** (ask a question, get a cited answer from the uploaded library) and **Compare Documents** (select 2–5 documents, get agreement/differences/gaps across just those).

## Architecture

RAG pipeline: `PDF upload → text extraction → chunking → embeddings → pgvector retrieval → LLM generation → cited response`

- **Framework**: Next.js (screens + API routes in one project), deployed to Vercel.
- **Styling**: Tailwind CSS utility classes only — no component library. Palette: deep navy + warm ivory background, muted sage/gray, restrained gold accent. Editorial/institutional feel, desktop-first (min ~1024px viewport), not mobile-optimized.
- **Storage**: Supabase Postgres with the `pgvector` extension. Two core tables: `documents` and `chunks` (chunks carry page number + document title/metadata for citations).
- **PDF parsing**: lightweight Node PDF-text library inside a Next.js API route. Upload limits ~4MB / ~300 pages (lowered from an original ~50MB target — Vercel Functions cap request bodies at 4.5MB; see CHECK.md item 1), rejected outright at upload (never silently truncated).
- **Chunking**: paragraph-aware, ~500 tokens with ~50 token overlap, values configurable (not hard-coded).
- **Embeddings**: OpenAI `text-embedding-3-small`, model name from server-side env/config, used consistently for both ingestion and query time.
- **Generation**: OpenAI `gpt-4o-mini`, model name from server-side env/config.
- **Retrieval** (configurable, ranked by relevance, never padded to hit a count):
  - Evidence Synthesis: top 8 chunks across the whole collection.
  - Compare Documents: up to 4 chunks per selected document, capped at 20 total across the 2–5 documents.
- All secrets (`OPENAI_API_KEY`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`, `GITHUB_TOKEN`) live in `.env` (gitignored) and are used server-side only, never exposed to the client.

Build order for these pieces is laid out as 23 "development units" at the end of `PRD.md` — follow that sequence when implementing from scratch.

## Success criteria (aspirational MVP targets)

These are targets for evaluating the prototype during development, not validated SLAs or promises to end users — but design toward them, don't ignore them:

- Evidence Synthesis: aim for under 30 seconds for a normal query.
- Cross-Document Comparison: aim for under 60 seconds for 2–5 selected documents.
- Support a working collection of ~20 uploaded PDFs. This is a soft target, not an enforced cap — don't block uploads beyond it; if scale becomes a real problem it should surface during manual QA (development unit 22), not from an artificial limit in the code.
- At least 95% of substantive claims should have traceable citations, and citation correspondence should hold up under manual QA.

## Security and privacy

- This is a private, single-user research/demo tool with no accounts or authentication. Its only protection is link secrecy — do not add a login system, password gate, or any other auth-adjacent surface (session handling, secret management for user credentials, etc.). If the tool is ever shared more broadly, a minimal passphrase gate may be added later as a deliberate, separate follow-up — don't build it preemptively.
- Uploaded documents may include pre-publication drafts or internally-shared research — treat them as confidential by default. Never send document content anywhere outside the configured OpenAI/Supabase infrastructure.
- The app is not designed to handle personal or patient-identifiable data, and doesn't collect personal data about its users (there are no accounts). Don't build features that assume or require personal data.
- The document library persists across sessions (single shared library, no per-user scoping needed). When a user deletes a document, it and its chunks/embeddings must be removed and excluded from all future retrieval immediately — no version history or recovery needed for the MVP.

## Product rules the AI must follow (non-negotiable)

These come directly from the PRD and are load-bearing for the product's core promise (grounded, traceable answers) — don't relax them for convenience during implementation:

- Answers use **only** the user's uploaded documents. No web search, PubMed, WHO APIs, news APIs, or other external knowledge — but existing infra (OpenAI, Supabase, Vercel) is fine to use.
- Every substantive claim needs at least one retrieved-passage citation: document title + page number (omit page, don't guess/placeholder, if none exists) + short supporting snippet.
- Distinguish direct quotes from the AI's own synthesized interpretation.
- If evidence is insufficient/ambiguous/conflicting, say so explicitly rather than filling gaps with general knowledge. Zero relevant passages found is a distinct, explicit outcome (may suggest rephrasing or uploading more docs — never answer from general knowledge).
- Include a lightweight citation-correspondence check (cited doc/page/snippet actually matches retrieved content) where technically feasible — not full fact-checking.
- Each query is single-turn/independent — no conversation memory across queries in the MVP.
- PDFs are only "supported" if enough text is extractable; partially scanned docs should be flagged as partially extractable (or, if that detection isn't feasible, flagged as scanned/unsupported) rather than silently treated as fully searchable. OCR is out of scope.
- Exact duplicate uploads (by file hash) must be prevented or clearly flagged — don't treat duplicate files as independent evidence.
- Compare Documents requires an explicit user selection of 2–5 documents; out-of-range selections must be blocked with an explanation, never silently clamped/truncated. Never auto-compare the whole library.
- Absence of a topic in a document is not disagreement. Conflicting sources must be presented as conflicting, never reconciled into an invented resolution. If the selection doesn't support a meaningful comparison, say so explicitly.
- Deleted documents must immediately stop being used as evidence for future queries/comparisons (previously generated answers don't need retroactive revalidation).

## Explicitly out of scope

Don't add these even if they seem like natural extensions: external knowledge APIs, automatic source-reliability scoring, medical/policy advice, prediction or statistical analysis, auto-updating past answers, full report generation, user accounts/auth/collaboration, complex dashboards, mobile apps, OCR, precise in-PDF text-offset highlighting, sophisticated fact-checking beyond the lightweight citation check, document version history/recovery, or any public/multi-user access.

Note: a lightweight, chunk-embedding-based detection of same-report drafts/editions (reusing existing retrieval embeddings, not a new model) was added to Evidence Synthesis to fix CHECK.md item 5 — this is a deliberate, narrowly-scoped exception to "no semantic detection of editions/drafts", not a reversal of the general rule. Don't build on it into a broader document-similarity/versioning feature without a similar explicit decision.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
