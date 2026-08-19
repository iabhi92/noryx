export default function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-xl p-sm flex flex-col gap-1">
      <span className="font-label-sm text-on-surface-variant uppercase tracking-wide text-xs">{label}</span>
      <span className="font-display text-headline-lg text-electric-blue">{value}</span>
    </div>
  );
}
