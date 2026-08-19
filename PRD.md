# Policy Lens Service Plan (PRD)

- Author: Laura Sofia
- Date: 2026-08-18

---

## 1. Background (problem definition)
*Who, in what work, experiences what inconvenience.*

Public-health students, researchers, and early-career policy professionals need to review multiple lengthy reports and articles to identify recurring findings, differences in recommendations, and gaps in the evidence. Manually cross-referencing findings and recommendations across many lengthy documents to spot patterns, differences, and gaps is slow and error-prone, making it hard to build a reliable, well-grounded picture of the evidence landscape.

---

## 2. Current approach and its limits
*How this is handled now, and what falls short.*

Today this review is done by hand: reading each PDF in full, taking notes or highlighting passages, and manually cross-referencing findings across documents in a spreadsheet or notes document.

This falls short because:
- It is time-consuming for anything beyond a handful of documents.
- Recurring themes and subtle contradictions buried in long text are easy to miss.
- Once findings are summarized in notes, they are rarely traceable back to their exact source passage.
- Comparing more than two or three documents at once becomes unmanageable without tooling.

---

## 3. Goals and expected impact (success criteria)
*In measurable numbers (processing time, number of inquiries, accuracy, etc.).*

**These are ASPIRATIONAL MVP TARGETS for evaluating the prototype during development — not validated SLAs, and not promises made to end users.**

- Evidence Synthesis response: ideally under 30 seconds for a normal query.
- Cross-Document Comparison: ideally under 60 seconds for 2–5 selected documents.
- Support a working collection of approximately 20 uploaded PDFs. This is a soft performance target, not an enforced hard cap — the app does not block uploads beyond this number; if scale becomes a real problem it will surface during manual QA (see Development unit 22).
- At least 95% of substantive claims in manual evaluation should have traceable citations.
- Citation correspondence should be checked during manual QA.

---

## 4. Users and the usage flow
*Who uses it and the order of use (with arrows).*

Users: public-health students, researchers, and early-career policy professionals.

Interface: a single application with one shared document library and two clearly distinguishable modes/tabs — **Evidence Synthesis** and **Compare Documents**. Not two separate apps, and not complicated navigation.

Flow:
- Upload text-extractable PDFs into the shared library → open the **Evidence Synthesis** tab → ask a question → review the synthesized answer with citations
- From the same shared library → open the **Compare Documents** tab → select 2–5 documents → request a comparison → review agreement, differences, and evidence gaps with citations

---

## 5. Key features (split into must / nice)

**Must-have**

### 1) Evidence Synthesis
- Description: Users upload text-extractable PDFs and ask questions about them. The app retrieves relevant passages from the user's uploaded collection and produces a concise, evidence-grounded synthesized answer.
- Rules the AI must follow:
  - Must use only the user's uploaded documents as the knowledge base — no external knowledge sources (web search, PubMed, WHO APIs, news APIs, or other outside data). Existing project infrastructure (OpenAI, Supabase, Vercel) is not an "external source" and may be used freely.
  - Each question is treated as an independent, single-turn query — no conversation memory or follow-up context is carried across queries for the MVP.
  - Every substantive synthesized claim must be supported by at least one retrieved passage.
  - Each citation must include document title, page number (when available), and a short supporting quotation/snippet. If a document has no reliable page number (e.g., a web-published article or fact sheet), the citation falls back to document title + snippet only — omit the page number rather than guessing or showing a placeholder like "page unknown."
  - Must clearly distinguish direct source statements (quotes) from the AI's own synthesized interpretation.
  - If retrieved evidence is insufficient, ambiguous, or conflicting, the app must state this explicitly rather than filling the gap with general knowledge.
  - If no relevant passages are found anywhere in the collection for a question, this is a distinct, explicit outcome: the app must clearly state that no relevant evidence was found in the uploaded documents, and must not answer from general knowledge. Where helpful, it may suggest the user rephrase the question or upload additional relevant documents, without retrieving outside information.
  - Must not introduce factual claims that cannot be traced to retrieved document content, and must not claim certainty beyond what the evidence supports.
  - Where technically feasible, include a lightweight check that the cited document/page/snippet actually corresponds to retrieved source content (not a full fact-checking system).
  - A PDF is considered supported only if sufficient usable text can be extracted from it for reliable retrieval. If a PDF contains a mix of text-extractable and image-only/scanned pages, the app must not silently treat the whole document as fully searchable — where feasible, it should flag the document as partially extractable and warn the user that some content may not be searchable; if reliable detection of partial extractability isn't feasible, the simpler acceptable fallback is to warn that scanned/image-only content is unsupported. OCR is out of scope for this MVP.
  - The app should avoid treating obvious duplicate uploads as independent evidence where possible. At minimum, exact duplicate files should be identified using a reliable file-level mechanism such as a file hash; if the exact same document is uploaded twice, the app should prevent duplicate ingestion or clearly identify it as already present. Sophisticated semantic detection of different editions/drafts of the same report is not required for the MVP — a draft and a final version may remain separate documents, but the app should not claim they are independent sources simply because they have different filenames.

### 2) Cross-Document Comparison
- Description: Users select 2–5 uploaded documents and ask the AI to compare how those documents address a given issue. The app identifies agreement, differences, and evidence gaps across only the selected documents.
- Rules the AI must follow:
  - The user must explicitly select which documents to compare (2–5 documents); the app must not automatically compare the entire library.
  - If the user selects fewer than 2 or more than 5 documents, the app must prevent the comparison from running and clearly explain the requirement, rather than silently clamping, truncating, or modifying the selection.
  - Findings must be attributed to their source document(s), using the same citation format as Feature 1 (document title + page number + snippet).
  - Must identify areas of agreement, meaningful differences (e.g., in recommendations, priorities, populations, implementation approaches, or conclusions), and evidence gaps or topics covered inconsistently across the selected documents.
  - Absence of a topic from a document must not be interpreted as disagreement.
  - Must not invent a resolution when sources conflict — conflicting evidence must be presented as conflicting, not reconciled.
  - If the selected documents do not support a meaningful comparison, the app must state this explicitly.

**Nice-to-have**
- None for this MVP.

---

## 6. Scope and out-of-scope
*What will / won't be built in this exercise.*

**In scope**
- Evidence Synthesis (see Key Features above)
- Cross-Document Comparison (see Key Features above)
- Document library management (upload, view, delete) as supporting infrastructure for the two core features — not a separate core feature

**Out of scope**
- Web search or any external knowledge APIs (PubMed, WHO, news, etc.) — uploaded documents are the sole evidence base
- Automatic source reliability/quality assessment
- Medical advice or policy decision-making
- Prediction or statistical analysis
- Automatic updates to previously generated answers
- Full report/article generation
- User accounts, authentication, or collaboration/sharing features
- Complex dashboards
- Mobile apps
- OCR, or scanned/image-only PDF support
- Visual highlighting or precise text-offset mapping inside PDFs; automatic navigation/highlighting to an exact sentence
- Sophisticated fact-checking or hallucination-detection systems (only the lightweight citation-correspondence check described in Feature 1, if feasible)
- Sophisticated document version history or recovery of deleted documents
- Sophisticated semantic detection of different editions/drafts of the same report (see Feature 1 duplicate-handling rule)
- Public/multi-user access — this is a private, single-user research/demo tool; the deployed link should not be distributed publicly

---

## 7. Security and privacy review
*The confidentiality level of the documents used, whether personal data is involved, how API keys are managed.*

- **Document confidentiality:** uploaded reports and articles may include pre-publication drafts or internally-shared research and should be treated as confidential by default. Since the app has no authentication, it must remain a private, single-user tool, and the deployed link must not be shared publicly. For the MVP, protection relies on link secrecy only — no password/access-code gate is built, since that would add auth-adjacent surface area (secret management, login UI, sessions) to a tool explicitly scoped as private/demo-only. A minimal access-gate (e.g., a single shared passphrase, not full accounts) may be added later as a deliberate follow-up if the tool is ever shared more broadly — it is not part of this MVP.
- **Personal data:** the app is not designed to handle personal or patient-identifiable data. Users should not upload documents containing personal data. The app itself does not collect or store personal data about its users, since there are no accounts.
- **API key management:** all secrets (`OPENAI_API_KEY`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`, `GITHUB_TOKEN`) are stored in `.env`, which is excluded from version control via `.gitignore`, and are only ever used server-side (API routes) — never exposed to the client/browser.
- **Persistence:** since there are no user accounts, authentication, or multi-user features, this is a single persistent document library for the private/demo instance. Uploaded documents remain available across sessions unless explicitly deleted by the user. There is no need for per-user libraries, accounts, collaboration, or sharing.
- **Document retention and deletion:**
  - Users can delete uploaded documents from the library.
  - Once deleted, a document must no longer be used as evidence for future queries or comparisons.
  - Previously generated answers do not need to be permanently preserved or revalidated after a source document is deleted.
  - No sophisticated version history or document recovery is needed for the MVP.

---

## 8. Technology stack
- Next.js — handles the screen and the server-side code (API) in one project
- Reason it's fixed: it's the same setup used in the Part 1–2 practice, and we'll deploy to Vercel in Part 5, so this keeps everything continuous
- Styling: Tailwind CSS only — no separate component library (e.g., shadcn/ui) for the MVP. The screens are simple enough (upload list, question box, answer display, comparison view) that Tailwind utility classes are sufficient to encode the editorial navy/ivory/sage/gold palette from `prd_lite.md` without adding another UI dependency.

**High-level RAG architecture:**
PDF upload → text extraction → chunking → embeddings/vector representation → retrieval → LLM generation → cited response

**Recommended implementation within the existing stack** (simplest technically appropriate option — no new infrastructure beyond what's already configured):
- PDF parsing/text extraction: a lightweight Node PDF-text library run in a Next.js API route.
- Upload limits (initial MVP configuration, configurable): cap uploads at ~4MB and/or ~300 pages per PDF — lowered from an original ~50MB target because Vercel Functions cap request bodies at 4.5MB (see CHECK.md item 1; raising this back toward 50MB would require a direct-to-storage upload flow, deliberately not built for the MVP); a file exceeding either limit must be rejected at upload time with a clear message, not silently truncated or partially processed.
- Chunking: paragraph-aware chunking with a target size of ~500 tokens and ~50 tokens of overlap — prefer paragraph boundaries and avoid splitting sentences mid-way where reasonably possible; keep related paragraphs together while avoiding excessively large chunks; if a paragraph substantially exceeds the target size, it may be split as needed. Each chunk preserves page number, document title/name, and other useful source metadata for citation purposes. The 500/50 values are an initial MVP configuration, not fixed requirements, and should be configurable (not hard-coded) so retrieval quality can be evaluated and adjusted later. No sophisticated semantic chunking or document-specific chunking strategies for the MVP.
- Embeddings: OpenAI embeddings API (already configured). Default embedding model for the MVP: `text-embedding-3-small` — an appropriate balance of retrieval quality, speed, cost, and storage for a ~20-document collection; `text-embedding-3-large`'s extra capacity isn't needed at this stage. Used consistently for both document chunk embeddings at ingestion and query embeddings at retrieval time. The model name must be set via a server-side environment variable/config value, not hard-coded, so it can be changed later if retrieval evaluation warrants it. No multiple-embedding-model support or model-selection interface for the MVP.
- Vector storage/retrieval: Supabase Postgres with the `pgvector` extension (already-configured infrastructure) — avoids introducing a separate vector database.
- Retrieval parameters (initial MVP configuration, ranked by semantic relevance, configurable rather than hard-coded):
  - Evidence Synthesis: retrieve up to the top 8 most relevant chunks across the whole collection; do not pad with low-relevance chunks to reach 8.
  - Cross-Document Comparison: retrieve up to 4 of the most relevant chunks per selected document (fewer if a document lacks sufficiently relevant chunks), capped at 20 total chunks across the 2–5 selected documents — this per-document limit keeps any single document from dominating the comparison.
  - All retrieved chunks must meet a reasonable relevance threshold rather than being included purely to hit a numeric target, and must carry document title and page metadata for citation.
  - No retrieval from outside the uploaded document collection, and no reranking/hybrid search for the MVP unless already trivially supported by the chosen architecture.
- LLM generation: OpenAI chat/completions API (already configured), prompted with retrieved chunks and instructed to cite them. Default generation model for the MVP: `gpt-4o-mini` — the task is focused, evidence-grounded synthesis/comparison over retrieved passages rather than complex autonomous reasoning, so this prioritizes speed and cost within the 30s/60s targets; the model is not a source of evidence itself, only the retrieved passages are. The model name must be set via a server-side environment variable/config value, not hard-coded, so it can be changed later without restructuring the app.

No additional external knowledge sources or APIs are introduced. These implementation choices exist only to serve the two core features above, and should stay subordinate to them — no major features, authentication, OCR, sophisticated versioning, or complex evaluation infrastructure should be added beyond what's described here.

---

## Development units
*Core features broken into small, build-friendly units, sorted in build order.*

1. Set up the Supabase schema: `documents` table and `chunks` table, with the `pgvector` extension enabled
2. Build the PDF upload API route that accepts a file and stores it
3. Add a file-hash duplicate check on upload; prevent or clearly flag exact duplicate files
4. Implement PDF text extraction in the upload pipeline
5. Detect partial/scanned (image-only) pages and flag the document as partially extractable or unsupported
6. Implement text chunking (fixed-size/paragraph-based, with overlap) and store chunk-to-page mapping
7. Generate embeddings for each chunk via the OpenAI API and store them in Supabase (`pgvector`)
8. Build the document library UI: upload control, document list, delete action
9. Implement document deletion: remove the document, its chunks, and embeddings, and exclude it from future retrieval
10. Build the shared two-tab app shell: "Evidence Synthesis" and "Compare Documents"
11. Implement retrieval: vector similarity search over chunks for a given question
12. Build Evidence Synthesis answer generation: LLM call grounded in retrieved chunks, with citation formatting (title + page + snippet)
13. Handle Evidence Synthesis edge cases: insufficient/ambiguous/conflicting evidence and zero-relevant-passages responses
14. Add the lightweight citation-correspondence check for Evidence Synthesis answers
15. Build the Evidence Synthesis UI: question input, answer display with citations
16. Build the document-selection UI for Compare Documents, enforcing the 2–5 selection rule (block and explain if out of range)
17. Implement retrieval across the selected documents for Compare Documents
18. Build Cross-Document Comparison generation: agreement, differences, and evidence-gap synthesis with per-finding citations
19. Handle Compare Documents edge cases: absence-not-disagreement rule, conflicting sources, no-meaningful-comparison case
20. Build the Compare Documents UI: results display grouped by agreement/differences/gaps with citations
21. Apply the visual design (navy/ivory/sage/gold palette, editorial/typography-focused layout) across both modes
22. Run a manual QA pass against the aspirational MVP targets (response time, citation coverage, citation correspondence)
23. Deploy to Vercel
