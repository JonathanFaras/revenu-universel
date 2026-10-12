export function DemoBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium tracking-wide text-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Démonstration locale — pas de synchro entre téléphones
    </div>
  );
}
