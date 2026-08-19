import { verifyFindings } from "@/lib/citation-check";
import { generateComparison } from "@/lib/comparison";
import { COMPARE_MAX_DOCUMENTS, COMPARE_MIN_DOCUMENTS, MAX_QUESTION_LENGTH } from "@/lib/config";
import { retrieveChunksForDocuments } from "@/lib/retrieval";

export const runtime = "nodejs";
// Vercel's default function timeout (10s Hobby / 15s Pro) is under PRD's own
// 60s target for this endpoint (retrieval across up to 5 documents + LLM
// generation). See CHECK.md item 2.
export const maxDuration = 60;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const rawDocumentIds: unknown[] = Array.isArray(body?.documentIds) ? body.documentIds : [];
  const documentIds: string[] = [
    ...new Set(rawDocumentIds.filter((id): id is string => typeof id === "string")),
  ];

  if (!question) {
    return errorResponse(400, "missing-question", "Please provide a topic or question to compare.");
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return errorResponse(
      400,
      "question-too-long",
      `Please keep your topic/question under ${MAX_QUESTION_LENGTH} characters.`
    );
  }

  // CHECK.md item 8: a malformed id previously reached the Postgres RPC
  // uncaught (invalid input syntax for type uuid), producing an unhandled 500
  // with an unparseable body instead of a clean error. Caught here, before the
  // count check, so a bad id is reported precisely rather than folded into a
  // generic "wrong number of documents" message.
  if (documentIds.some((id) => !UUID_PATTERN.test(id))) {
    return errorResponse(
      400,
      "invalid-document-id",
      "One or more selected documents have an invalid id. Please refresh and try again."
    );
  }

  // Enforced server-side too, not just by the UI (task 17) — PRD.md §5: the
  // app must block and explain out-of-range selections, never clamp them.
  if (documentIds.length < COMPARE_MIN_DOCUMENTS || documentIds.length > COMPARE_MAX_DOCUMENTS) {
    return errorResponse(
      400,
      "invalid-selection-count",
      `Please select between ${COMPARE_MIN_DOCUMENTS} and ${COMPARE_MAX_DOCUMENTS} documents to compare (received ${documentIds.length}).`
    );
  }

  let chunks;
  try {
    chunks = await retrieveChunksForDocuments(question, documentIds);
  } catch {
    // Defense in depth (CHECK.md item 8): a valid-looking request can still
    // fail at the DB/embedding layer for other reasons (e.g. a document
    // deleted mid-request) — never let that surface as an unhandled 500.
    return errorResponse(
      500,
      "retrieval-failed",
      "Could not retrieve passages for the selected documents. Please try again."
    );
  }

  // Same guarantee as Evidence Synthesis (task 13): zero relevant passages
  // never reaches the LLM, so there's no chance of falling back to general
  // knowledge.
  if (chunks.length === 0) {
    return Response.json({
      question,
      documentIds,
      comparisonAssessment: "insufficient",
      agreement: [],
      differences: [],
      evidenceGaps: [
        {
          text: "No relevant passages were found in the selected documents for this topic.",
          citations: [],
        },
      ],
    });
  }

  let comparison;
  try {
    comparison = await generateComparison(question, chunks);
  } catch {
    return errorResponse(500, "generation-failed", "Could not generate the comparison. Please try again.");
  }

  // Lightweight citation-correspondence check (CHECK.md item 6): Evidence
  // Synthesis already applies this (task 15); Compare Documents skipped it,
  // letting a fabricated or mismatched citation render as fully trustworthy.
  const checkedComparison = {
    ...comparison,
    agreement: verifyFindings(comparison.agreement, chunks),
    differences: verifyFindings(comparison.differences, chunks),
    evidenceGaps: verifyFindings(comparison.evidenceGaps, chunks),
  };

  return Response.json({ question, documentIds, ...checkedComparison });
}
