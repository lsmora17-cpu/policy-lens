"use client";

import { useState } from "react";
import CitationCard from "@/app/components/CitationCard";
import LoadingIndicator from "@/app/components/LoadingIndicator";

type EvidenceAssessment = "sufficient" | "insufficient" | "ambiguous" | "conflicting";

type Citation = {
  documentTitle: string;
  pageNumber: number | null;
  snippet: string;
  verified: boolean;
};

type AnswerBlock = { type: "quote" | "synthesis"; text: string; citations: Citation[] };

type SynthesizeResult = {
  question: string;
  chunksUsed: number;
  evidenceAssessment: EvidenceAssessment;
  blocks: AnswerBlock[];
  citationCheck: { total: number; verified: number };
  relatedDocumentTitlePairs?: [string, string][];
};

const ASSESSMENT_NOTICE: Record<Exclude<EvidenceAssessment, "sufficient">, string> = {
  insufficient: "The evidence in your documents doesn't fully answer this question.",
  ambiguous: "The evidence touches on this question but is unclear or open to more than one reading.",
  conflicting: "Your documents contain conflicting information on this question — see below.",
};

function AnswerBlockView({ block }: { block: AnswerBlock }) {
  return (
    <div
      className={
        block.type === "quote"
          ? "border-l-2 border-gold pl-4 font-serif italic leading-relaxed text-navy"
          : "font-serif leading-relaxed text-navy"
      }
    >
      <p className="text-[15px]">{block.text}</p>
      {block.citations.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {block.citations.map((c, i) => (
            <CitationCard key={i} {...c} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EvidenceSynthesis() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SynthesizeResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Something went wrong.");
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      {/* Single-turn only (PRD.md §5) — no history is kept between questions. */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your uploaded documents…"
          rows={3}
          className="rounded border border-gray/40 bg-background p-3 text-sm text-navy outline-none focus:border-navy"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="self-start rounded bg-navy px-4 py-2 text-sm font-medium text-background transition-opacity disabled:opacity-40"
        >
          {loading ? "Synthesizing…" : "Ask"}
        </button>
      </form>

      {loading && <LoadingIndicator label="Reading through your documents…" />}

      {error && <p className="text-sm text-[#b45252]">{error}</p>}

      {result && (
        <div className="flex flex-col gap-5 border-t border-navy/10 pt-8">
          {result.evidenceAssessment !== "sufficient" && (
            <p className="rounded border border-gold bg-gold/10 px-3 py-2 text-sm text-navy">
              {ASSESSMENT_NOTICE[result.evidenceAssessment]}
            </p>
          )}
          {result.relatedDocumentTitlePairs && result.relatedDocumentTitlePairs.length > 0 && (
            <div className="rounded border border-gold bg-gold/10 px-3 py-2 text-sm text-navy">
              {result.relatedDocumentTitlePairs.map(([a, b], i) => (
                <p key={i}>
                  &ldquo;{a}&rdquo; and &ldquo;{b}&rdquo; appear to be different editions of the same
                  underlying report — treat their citations as one source, not independent
                  corroboration.
                </p>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-6">
            {result.blocks.map((block, i) => (
              <AnswerBlockView key={i} block={block} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
