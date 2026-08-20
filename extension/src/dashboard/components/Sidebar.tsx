type View = 'dashboard' | 'sessions' | 'analytics' | 'roadmap' | 'review' | 'settings';

const NAV_ITEMS: Array<{ icon: string; label: string; view: View | null }> = [
  { icon: 'dashboard', label: 'Dashboard', view: 'dashboard' },
  { icon: 'map', label: 'Roadmap', view: 'roadmap' },
  { icon: 'history_edu', label: 'Review', view: 'review' },
  { icon: 'code_blocks', label: 'Sessions', view: 'sessions' },
  { icon: 'insights', label: 'Analytics', view: 'analytics' },
  { icon: 'settings', label: 'Settings', view: 'settings' },
];

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
}

export default function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <nav className="glass-card hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 border-r border-white/5 p-md gap-2 z-50">
      <div className="mb-lg pt-2 flex flex-col items-start border-b border-white/5 pb-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-electric-blue shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
          <h1 className="font-code-md text-sm font-semibold tracking-wider text-on-surface">NORYX</h1>
        </div>
        <p className="font-code-md text-[10px] text-on-surface-variant uppercase tracking-widest pl-5">
          sys.status: optimal
        </p>
      </div>
      <ul className="flex flex-col gap-1 flex-grow font-code-md text-xs uppercase tracking-wider">
        {NAV_ITEMS.map((item) => {
          const enabled = item.view !== null;
          const active = enabled && item.view === activeView;
          return (
            <li key={item.label}>
              <a
                className={
                  active
                    ? 'flex items-center gap-4 py-3 px-4 bg-white/5 text-electric-blue border-l-2 border-electric-blue transition-colors'
                    : enabled
                      ? 'flex items-center gap-4 py-3 px-4 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors border-l-2 border-transparent cursor-pointer'
                      : 'flex items-center gap-4 py-3 px-4 text-on-surface-variant/40 border-l-2 border-transparent cursor-not-allowed'
                }
                href={enabled ? '#' : undefined}
                aria-disabled={!enabled}
                title={enabled ? undefined : 'Coming soon'}
                onClick={(e) => {
                  e.preventDefault();
                  if (item.view) onNavigate(item.view);
                }}
              >
                <span className="material-symbols-outlined text-[18px] opacity-80">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
