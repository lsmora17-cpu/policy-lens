type CitationCardProps = {
  documentTitle: string;
  pageNumber: number | null;
  snippet: string;
  verified?: boolean;
};

export default function CitationCard({ documentTitle, pageNumber, snippet, verified }: CitationCardProps) {
  return (
    <div className="border-l-2 border-sage bg-sage/5 px-4 py-2.5 text-xs">
      <p className="font-sans font-medium tracking-wide text-navy">
        {documentTitle}
        {pageNumber ? `, p.${pageNumber}` : ""}
      </p>
      <p className="mt-1 font-serif text-[13px] italic leading-relaxed text-navy/70">
        &ldquo;{snippet}&rdquo;
      </p>
      {verified === false && (
        <p className="mt-1 font-sans text-[#b45252]">
          Could not be automatically confirmed against the source.
        </p>
      )}
    </div>
  );
}
