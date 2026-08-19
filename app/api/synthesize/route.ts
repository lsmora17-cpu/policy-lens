import { verifyAnswerCitations } from "@/lib/citation-check";
import { MAX_QUESTION_LENGTH } from "@/lib/config";
import { findRelatedDocumentPairs } from "@/lib/document-relations";
import { generateSynthesisAnswer } from "@/lib/generation";
import { retrieveRelevantChunks } from "@/lib/retrieval";

export const runtime = "nodejs";
// Vercel's default function timeout (10s Hobby / 15s Pro) is under PRD's own
// 30s target for this endpoint (embedding + retrieval + LLM generation).
// See CHECK.md item 2.
export const maxDuration = 60;

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!question) {
    return errorResponse(400, "missing-question", "Please provide a question.");
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return errorResponse(
      400,
      "question-too-long",
      `Please keep your question under ${MAX_QUESTION_LENGTH} characters.`
    );
  }

  const chunks = await retrieveRelevantChunks(question);

  // Zero relevant passages is a distinct outcome (PRD.md §5) — answered here
  // without ever calling the LLM, so there's no chance of it falling back to
  // general knowledge.
  if (chunks.length === 0) {
    return Response.json({
      question,
      chunksUsed: 0,
      evidenceAssessment: "insufficient",
      blocks: [
        {
          type: "synthesis",
          text: "No relevant passages were found in your uploaded documents for this question. Try rephrasing your question, or upload additional documents that might cover this topic.",
          citations: [],
        },
      ],
    });
  }

  // The insufficient/ambiguous/conflicting cases where SOME evidence exists but
  // doesn't clearly settle the question (task 14) are the model's judgment call
  // via evidenceAssessment — see lib/generation.ts's system prompt.
  const { evidenceAssessment, blocks } = await generateSynthesisAnswer(question, chunks);

  // Lightweight citation-correspondence check (task 15, PRD.md §5): flags each
  // citation rather than blocking the answer — not a full fact-checking system.
  const checkedBlocks = verifyAnswerCitations(blocks, chunks);
  const allCitations = checkedBlocks.flatMap((b) => b.citations);
  const citationCheck = {
    total: allCitations.length,
    verified: allCitations.filter((c) => c.verified).length,
  };

  // Same-report edition detection (CHECK.md item 5): if the citations actually
  // used span two documents already flagged as the same underlying report
  // (e.g. a draft and a final version), say so explicitly rather than letting
  // them read as independent corroborating sources.
  const titleToDocumentId = new Map(chunks.map((c) => [c.documentTitle, c.documentId]));
  const citedDocumentIds = [
    ...new Set(
      allCitations
        .map((c) => titleToDocumentId.get(c.documentTitle))
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const relatedPairs = await findRelatedDocumentPairs(citedDocumentIds);
  const idToTitle = new Map(chunks.map((c) => [c.documentId, c.documentTitle]));
  const relatedDocumentTitlePairs = relatedPairs.map((p) => [
    idToTitle.get(p.documentIdA) ?? "Unknown document",
    idToTitle.get(p.documentIdB) ?? "Unknown document",
  ]);

  return Response.json({
    question,
    chunksUsed: chunks.length,
    evidenceAssessment,
    blocks: checkedBlocks,
    citationCheck,
    relatedDocumentTitlePairs,
  });
}
