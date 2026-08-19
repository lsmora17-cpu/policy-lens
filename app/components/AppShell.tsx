"use client";

import { useState } from "react";
import CompareDocuments from "@/app/components/CompareDocuments";
import DocumentLibrary from "@/app/components/DocumentLibrary";
import EvidenceSynthesis from "@/app/components/EvidenceSynthesis";

type Tab = "synthesis" | "compare";

const TABS: { id: Tab; label: string }[] = [
  { id: "synthesis", label: "Evidence Synthesis" },
  { id: "compare", label: "Compare Documents" },
];

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>("synthesis");

  return (
    <div className="flex h-screen flex-col">
      {/* Masthead: serif for the editorial/institutional feel (prd_lite.md §5),
          sans for the tab controls — content vs. chrome. */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-navy/15 px-8 py-4">
        <h1 className="font-serif text-2xl tracking-tight text-navy">Policy Lens</h1>
        <nav className="flex gap-1" role="tablist" aria-label="Mode">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.id ? "bg-navy text-background" : "text-navy hover:bg-navy/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Shared by both tabs, per DESIGN.md — doesn't belong to either mode. */}
        <DocumentLibrary />

        <main className="flex-1 overflow-y-auto px-12 py-10">
          {activeTab === "synthesis" ? <EvidenceSynthesis /> : <CompareDocuments />}
        </main>
      </div>
    </div>
  );
}
