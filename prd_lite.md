# Policy Lens Service Plan (PRD_lite)

- Author: Laura Sofia
- Date: 2026-08-18

---

## 1. In one line, what is this app?
- Answer: Policy Lens is an AI-powered evidence analysis tool that helps public-health researchers synthesize and compare findings and policy recommendations across their uploaded reports and articles, with every insight grounded in and traceable to its source documents.

---

## 2. Who uses it, and why? (just one line each!)
- Who uses it?
  - Answer: Public-health students, researchers, and early-career policy professionals who need to review many lengthy documents efficiently.
- What inconvenience does it solve?
  - Answer: Manually cross-referencing findings and recommendations across multiple lengthy reports to spot patterns, differences, and gaps is slow and error-prone.

---

## 3. Core features to build (exactly 2!)
> 💡 If you try to build too many features, the AI tangles up the code.
> Pick just the 2 most important features and give the AI their "rules."

### 1) Evidence Synthesis
- Description: Users upload text-extractable PDFs and ask questions about them. The app retrieves relevant passages from the user's uploaded collection and produces a concise, evidence-grounded synthesized answer.
- Rules the AI must follow:
  - Must use only the user's uploaded documents as the knowledge base — no external knowledge sources (web search, PubMed, WHO APIs, news APIs, or other outside data). Existing project infrastructure (OpenAI, Supabase, Vercel) is not an "external source" and may be used freely.
  - Every substantive synthesized claim must be supported by at least one retrieved passage.
  - Each citation must include document title, page number (when available), and a short supporting quotation/snippet.
  - Must clearly distinguish direct source statements (quotes) from the AI's own synthesized interpretation.
  - If retrieved evidence is insufficient, ambiguous, or conflicting, the app must state this explicitly rather than filling the gap with general knowledge.
  - Must not introduce factual claims that cannot be traced to retrieved document content, and must not claim certainty beyond what the evidence supports.
  - Where technically feasible, include a lightweight check that the cited document/page/snippet actually corresponds to retrieved source content (not a full fact-checking system).
  - Only text-extractable PDFs are supported. If a scanned or image-only PDF is uploaded, the app must show a clear message that it cannot be processed rather than producing unreliable output.

### 2) Cross-Document Comparison
- Description: Users select 2–5 uploaded documents and ask the AI to compare how those documents address a given issue. The app identifies agreement, differences, and evidence gaps across only the selected documents.
- Rules the AI must follow:
  - The user must explicitly select which documents to compare (2–5 documents); the app must not automatically compare the entire library.
  - Findings must be attributed to their source document(s), using the same citation format as Feature 1 (document title + page number + snippet).
  - Must identify areas of agreement, meaningful differences (e.g., in recommendations, priorities, populations, implementation approaches, or conclusions), and evidence gaps or topics covered inconsistently across the selected documents.
  - Absence of a topic from a document must not be interpreted as disagreement.
  - Must not invent a resolution when sources conflict — conflicting evidence must be presented as conflicting, not reconciled.
  - If the selected documents do not support a meaningful comparison, the app must state this explicitly.

---

## 4. Features you will definitely NOT build this time (let go of extras)
> 💡 Declaring "I won't build this" to the AI up front keeps it from coding the wrong things.
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
- Public/multi-user access — this is a private, single-user research/demo tool; the deployed link should not be distributed publicly

---

## 5. Design feel and colors
- Overall mood: Editorial, institutional, intelligent, calm, research-oriented — should feel like a modern policy research platform, not a generic chatbot. Prioritize whitespace, typography, source visibility, and clear evidence attribution.
- Main color: Deep navy (primary) and warm ivory/off-white (background), with muted sage green, soft gray, and restrained muted-gold as accent colors.
- Screen-size constraints: Desktop/laptop-first web app, optimized for wide screens (min viewport ~1024px) to support side-by-side document/citation views; not optimized for mobile.
