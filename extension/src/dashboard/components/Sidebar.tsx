const NAV_ITEMS = [
  { icon: 'dashboard', label: 'Dashboard', enabled: true },
  { icon: 'map', label: 'Roadmap', enabled: false },
  { icon: 'code_blocks', label: 'Sessions', enabled: false },
  { icon: 'insights', label: 'Analytics', enabled: false },
  { icon: 'settings', label: 'Settings', enabled: false },
];

export default function Sidebar() {
  return (
    <nav className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-lowest border-r border-white/5 shadow-2xl py-margin px-xs z-50">
      <div className="mb-lg px-sm">
        <h1 className="font-display text-headline-md font-bold text-electric-blue">Noryx</h1>
        <p className="font-label-sm text-on-surface-variant">Your AI coding coach</p>
      </div>
      <ul className="flex flex-col gap-xs flex-grow">
        {NAV_ITEMS.map((item) => (
          <li key={item.label}>
            <a
              className={
                item.enabled
                  ? 'flex items-center gap-sm px-sm py-xs rounded-r-full text-electric-blue font-bold border-r-2 border-electric-blue bg-glow-blue transition-all duration-300'
                  : 'flex items-center gap-sm px-sm py-xs rounded-r-full text-on-surface-variant/40 cursor-not-allowed'
              }
              href={item.enabled ? '#' : undefined}
              aria-disabled={!item.enabled}
              title={item.enabled ? undefined : 'Coming soon'}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-body-md">{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
