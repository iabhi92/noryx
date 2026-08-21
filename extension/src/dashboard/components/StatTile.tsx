export default function StatTile({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div className="glass-card rounded-xl p-sm flex flex-col gap-2 relative overflow-hidden group hover:-translate-y-0.5 hover:border-electric-blue/40 transition-all duration-300">
      <div className="holo-bracket tl" />
      <div className="holo-bracket tr" />
      <div className="holo-bracket bl" />
      <div className="holo-bracket br" />
      <div className="scanlines rounded-xl opacity-30" />
      <span className="relative z-20 font-label-sm text-on-surface-variant uppercase tracking-wide text-xs flex items-center gap-2">
        {icon && (
          <span className="w-5 h-5 rounded-sm bg-electric-blue/10 border border-electric-blue/30 flex items-center justify-center text-[11px] shrink-0">
            {icon}
          </span>
        )}
        {label}
      </span>
      <span className="relative z-20 font-display text-headline-lg text-electric-blue drop-shadow-[0_0_10px_rgba(0,240,255,0.4)]">
        {value}
      </span>
      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-electric-blue/10 rounded-full blur-2xl group-hover:bg-electric-blue/20 transition-all duration-700 z-10" />
    </div>
  );
}
