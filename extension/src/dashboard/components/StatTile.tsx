export default function StatTile({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div className="glass-card rounded-xl p-sm flex flex-col gap-1 hover:-translate-y-0.5 transition-all duration-200">
      <span className="font-label-sm text-on-surface-variant uppercase tracking-wide text-xs flex items-center gap-1">
        {icon && <span>{icon}</span>} {label}
      </span>
      <span className="font-display text-headline-lg text-electric-blue drop-shadow-[0_0_10px_rgba(14,165,233,0.4)]">
        {value}
      </span>
    </div>
  );
}
