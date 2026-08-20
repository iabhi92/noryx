type View = 'dashboard' | 'sessions' | 'analytics' | 'roadmap' | 'settings';

const NAV_ITEMS: Array<{ icon: string; label: string; view: View | null }> = [
  { icon: 'dashboard', label: 'Dashboard', view: 'dashboard' },
  { icon: 'map', label: 'Roadmap', view: 'roadmap' },
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
    <nav className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-lowest border-r border-white/5 shadow-2xl py-margin px-xs z-50">
      <div className="mb-lg px-sm">
        <h1 className="font-display text-headline-md font-bold text-electric-blue">Noryx</h1>
        <p className="font-label-sm text-on-surface-variant">Your AI coding coach</p>
      </div>
      <ul className="flex flex-col gap-xs flex-grow">
        {NAV_ITEMS.map((item) => {
          const enabled = item.view !== null;
          const active = enabled && item.view === activeView;
          return (
            <li key={item.label}>
              <a
                className={
                  active
                    ? 'flex items-center gap-sm px-sm py-xs rounded-r-full text-electric-blue font-bold border-r-2 border-electric-blue bg-glow-blue transition-all duration-300'
                    : enabled
                      ? 'flex items-center gap-sm px-sm py-xs rounded-r-full text-on-surface-variant hover:text-on-surface transition-all duration-300 cursor-pointer'
                      : 'flex items-center gap-sm px-sm py-xs rounded-r-full text-on-surface-variant/40 cursor-not-allowed'
                }
                href={enabled ? '#' : undefined}
                aria-disabled={!enabled}
                title={enabled ? undefined : 'Coming soon'}
                onClick={(e) => {
                  e.preventDefault();
                  if (item.view) onNavigate(item.view);
                }}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-body-md">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
