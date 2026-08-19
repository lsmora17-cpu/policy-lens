# QA Report — Manual QA Pass (PLAN.md task 23)

Run against the live app (Next.js dev server + real Supabase/OpenAI) on 2026-08-19, evaluating against the aspirational MVP targets in `PRD.md` §3. These are evaluation targets, not enforced SLAs.

## Response time

| Feature | Target | Samples | Result |
|---|---|---|---|
| Evidence Synthesis | < 30s | 6.76s, 4.96s, 5.34s | ✅ well under target (~5.7s avg) |
| Compare Documents | < 60s | 5.46s, 6.55s | ✅ well under target |

All timings measured end-to-end (embedding the query, vector search, OpenAI generation, response) against the real deployed logic — not a mock. Compare Documents was only tested with 2 documents (the current library size); timing would need re-checking once more documents/chunks exist, since it scales with chunk count.

## Citation coverage

Across 3 real Evidence Synthesis queries (9 answer blocks total) and 2 real Compare Documents queries (agreement + differences findings), **every substantive claim carried at least one citation** — 100% coverage in this sample, comfortably above the ≥95% target. `evidenceGaps` findings correctly have no citations, since they describe an absence, not a claim.

This is partly structural: the response schema requires every `quote`/`synthesis` block and every `agreement`/`differences` finding to include a `citations` array, so near-100% coverage is expected by construction rather than something that could silently degrade — the model isn't given a citation-free path for a substantive claim.

## Citation correspondence

- **Evidence Synthesis**: has an automated lightweight check (task 15). Across the 3 sample queries: **12/12 citations verified** by `citationCheck`.
- **Compare Documents**: has no automated check (a deliberate scope decision in task 19 — PRD only requires this explicitly for Feature 1). Manually spot-checked 2 citations by pulling the actual stored chunk text from Supabase and comparing verbatim: both were exact substring matches to the cited snippet. Small sample, but no mismatches found.

## Edge cases

Spot-checked against the live app in this pass:

- **Deleted document excluded from future retrieval**: uploaded a test document, confirmed a targeted question correctly cited it, deleted it, re-ran the *same* question — it no longer appeared, and the answer correctly reported insufficient evidence rather than silently reusing stale content. ✅

The remaining required edge cases were already verified end-to-end with real data during their respective build tasks (not re-run here, to avoid redundant OpenAI calls) — noted here for completeness of the QA record:

| Edge case | Verified in |
|---|---|
| Zero relevant passages (both features) | Tasks 13, 19 |
| Insufficient / ambiguous / conflicting evidence | Task 14 |
| Conflicting sources across different documents, presented as conflicting | Task 20 |
| Absence-not-disagreement / no-meaningful-comparison | Task 20 |
| Exact-duplicate upload blocked | Task 3 |
| Partial/scanned PDF flagged, not silently treated as searchable | Tasks 5–6 |
| Out-of-range document selection blocked (UI *and* API) | Tasks 17–18 |

## Not exercised in this pass

- **Oversized file (~50MB) / >300-page rejection**: verified by code review of `app/api/documents/route.ts`'s size/page checks (unchanged since task 3), not by generating an actual 50MB+ file — that felt like a disproportionate cost for this pass.
- **Collection at ~20 documents**: the library currently holds 2 real documents. Performance and retrieval quality at the ~20-document soft target haven't been observed under real conditions yet.

## Overall

Both features meet their aspirational response-time and citation-coverage targets by a wide margin on this sample. The main honest gap is **sample size** — this is a handful of queries against a 2-document library, not the ~20-document collection PRD describes as the target working size. I'd treat this pass as "no red flags found," not "proven at scale."
