export default function LoadingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 text-sm text-navy/70">
      <span
        aria-hidden="true"
        className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-navy/20 border-t-gold"
      />
      <span className="font-serif italic">{label}</span>
    </div>
  );
}
