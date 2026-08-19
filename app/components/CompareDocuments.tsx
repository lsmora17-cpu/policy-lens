"use client";

import { useEffect, useState } from "react";
import CitationCard from "@/app/components/CitationCard";
import LoadingIndicator from "@/app/components/LoadingIndicator";

type Document = {
  id: string;
  title: string;
  extractable_status: "pending" | "full" | "partial" | "unsupported";
};

type Finding = {
  text: string;
  citations: { documentTitle: string; pageNumber: number | null; snippet: string; verified?: boolean }[];
};

type ComparisonResult = {
  comparisonAssessment: "meaningful" | "insufficient";
  agreement: Finding[];
  differences: Finding[];
  evidenceGaps: Finding[];
};

const MIN_SELECTION = 2;
const MAX_SELECTION = 5;

function FindingSection({ title, findings }: { title: string; findings: Finding[] }) {
  if (findings.length === 0) return null;
  return (
    <div>
      <h3 className="border-b border-navy/15 pb-2 font-sans text-sm font-semibold uppercase tracking-wider text-navy">
        {title}
      </h3>
      <div className="mt-4 flex flex-col gap-5">
        {findings.map((finding, i) => (
          <div key={i} className="font-serif text-[15px] leading-relaxed text-navy">
            <p>{finding.text}</p>
            {finding.citations.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {finding.citations.map((c, j) => (
                  <CitationCard key={j} {...c} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CompareDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [topic, setTopic] = useState("");
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/documents");
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Could not load documents.");
        setDocuments(body.documents ?? []);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Could not load documents.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const count = selected.size;
  // Checkboxes are NEVER disabled or auto-clamped here — only the Compare
  // button gets blocked, with an explanation, per DESIGN.md and PRD.md §5:
  // out-of-range selections must be blocked and explained, never silently
  // modified.
  const isValidSelection = count >= MIN_SELECTION && count <= MAX_SELECTION;
  const rangeMessage =
    count === 0
      ? `Select ${MIN_SELECTION}–${MAX_SELECTION} documents to compare.`
      : count < MIN_SELECTION
        ? `Select at least ${MIN_SELECTION - count} more document${MIN_SELECTION - count > 1 ? "s" : ""} (${MIN_SELECTION}–${MAX_SELECTION} total).`
        : count > MAX_SELECTION
          ? `You've selected ${count} documents — please select at most ${MAX_SELECTION}.`
          : null;

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidSelection || !topic.trim() || comparing) return;

    setComparing(true);
    setCompareError(null);
    setResult(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: topic, documentIds: [...selected] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Something went wrong.");
      setResult(body);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setComparing(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h2 className="font-serif text-xl text-navy">Select documents to compare</h2>
        <p className="mt-1 text-sm text-gray">
          Choose {MIN_SELECTION}–{MAX_SELECTION} documents from your library.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray">Loading…</p>
      ) : loadError ? (
        <p className="text-sm text-[#b45252]">{loadError}</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-gray">No documents in your library yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li key={doc.id}>
              <label className="flex items-center gap-2 rounded border border-gray/20 px-3 py-2 text-sm text-navy hover:bg-navy/5">
                <input
                  type="checkbox"
                  className="accent-navy"
                  checked={selected.has(doc.id)}
                  onChange={() => toggle(doc.id)}
                />
                {doc.title}
              </label>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-gray">
        {count} of {MIN_SELECTION}–{MAX_SELECTION} selected
      </p>
      {rangeMessage && (
        <p className="rounded border border-gold bg-gold/10 px-3 py-2 text-sm text-navy">
          {rangeMessage}
        </p>
      )}

      {/* Single-turn only (PRD.md §5) — no history is kept between comparisons. */}
      <form onSubmit={handleCompare} className="flex flex-col gap-2">
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What topic or question should the comparison focus on?"
          rows={2}
          className="rounded border border-gray/40 bg-background p-3 text-sm text-navy outline-none focus:border-navy"
        />
        <button
          type="submit"
          disabled={!isValidSelection || !topic.trim() || comparing}
          className="self-start rounded bg-navy px-4 py-2 text-sm font-medium text-background transition-opacity disabled:opacity-40"
        >
          {comparing ? "Comparing…" : "Compare"}
        </button>
      </form>

      {comparing && <LoadingIndicator label="Comparing your selected documents…" />}

      {compareError && <p className="text-sm text-[#b45252]">{compareError}</p>}

      {result && (
        <div className="flex flex-col gap-8 border-t border-navy/10 pt-8">
          {result.comparisonAssessment === "insufficient" && (
            <p className="rounded border border-gold bg-gold/10 px-3 py-2 text-sm text-navy">
              The selected documents don&apos;t support a meaningful comparison for this topic —
              see notes below.
            </p>
          )}
          <FindingSection title="Agreement" findings={result.agreement} />
          <FindingSection title="Differences" findings={result.differences} />
          <FindingSection title="Evidence Gaps" findings={result.evidenceGaps} />
        </div>
      )}
    </div>
  );
}
