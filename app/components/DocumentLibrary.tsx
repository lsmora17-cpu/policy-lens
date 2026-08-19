"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ExtractableStatus = "pending" | "full" | "partial" | "unsupported";

type Document = {
  id: string;
  title: string;
  filename: string;
  page_count: number | null;
  extractable_status: ExtractableStatus;
  uploaded_at: string;
  chunkCount: number;
};

const STATUS_LABEL: Record<ExtractableStatus, string> = {
  pending: "Processing…",
  full: "Searchable",
  partial: "Partially searchable",
  unsupported: "Not searchable (scanned)",
};

const STATUS_CLASS: Record<ExtractableStatus, string> = {
  pending: "text-gray",
  full: "text-sage",
  partial: "text-gold",
  unsupported: "text-gray",
};

export default function DocumentLibrary() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documents");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not load the library.");
      setDocuments(body.documents ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Upload failed.");
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleReprocess(doc: Document) {
    setReprocessingId(doc.id);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/reprocess`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Reprocessing failed.");
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reprocessing failed.");
    } finally {
      setReprocessingId(null);
    }
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.title}"? This can't be undone.`)) return;

    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Delete failed.");
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <aside className="flex h-full w-80 flex-shrink-0 flex-col border-r border-navy/15 bg-background px-6 py-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-navy">Document Library</h2>

      <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded border border-gold px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-gold/10">
        {uploading ? "Uploading…" : "Upload PDF"}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={uploading}
          onChange={handleFileChange}
        />
      </label>

      {error && <p className="mt-3 text-sm text-[#b45252]">{error}</p>}

      <div className="mt-6 flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-gray">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-gray">No documents yet — upload a PDF to get started.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {documents.map((doc) => {
              // CHECK.md item 14: extractable_status says this document should
              // be searchable, but it has zero chunks — a state that used to
              // be invisible and only fixable by deleting and re-uploading.
              const needsReprocessing =
                doc.extractable_status !== "unsupported" && doc.chunkCount === 0;

              return (
                <li key={doc.id} className="flex items-start justify-between gap-2 border-b border-gray/20 pb-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy" title={doc.title}>
                      {doc.title}
                    </p>
                    <p
                      className={`text-xs ${needsReprocessing ? "text-[#b45252]" : STATUS_CLASS[doc.extractable_status]}`}
                    >
                      {needsReprocessing ? "No chunks — needs reprocessing" : STATUS_LABEL[doc.extractable_status]}
                      {doc.page_count ? ` · ${doc.page_count} pages` : ""}
                    </p>
                    {needsReprocessing && (
                      <button
                        onClick={() => handleReprocess(doc)}
                        disabled={reprocessingId === doc.id}
                        className="mt-1 text-xs font-medium text-gold underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        {reprocessingId === doc.id ? "Reprocessing…" : "Reprocess"}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(doc)}
                    aria-label={`Delete ${doc.title}`}
                    className="flex-shrink-0 text-gray transition-colors hover:text-[#b45252]"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
