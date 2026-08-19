import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial/institutional feel per prd_lite.md §5: a serif for reading
// content (the masthead, generated answers, citation text), paired with the
// clean sans above for UI chrome (buttons, labels, nav) — not one typeface
// doing everything, which is what reads as "generic chatbot."
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Policy Lens",
  description: "Evidence synthesis and cross-document comparison for public-health research.",
  // CHECK.md item 10: link secrecy is this app's only protection (CLAUDE.md —
  // no auth by design), so nothing should invite a crawler to index the URL.
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
