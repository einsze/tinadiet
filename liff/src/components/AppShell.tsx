import { Link, NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

type NavItem = {
  to: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/chat', label: 'Ask Tina', icon: '💬' },
  { to: '/premium', label: 'Premium', icon: '⭐' },
  { to: '/profile', label: 'Profile', icon: '👤' },
  { to: '/support', label: 'Support', icon: '🆘' },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/chat': 'Ask Tina',
  '/premium': 'Premium',
  '/profile': 'Profile',
  '/settings': 'Settings',
  '/support': 'Support',
};

const RootHeader = ({ subtitle }: { subtitle?: string }) => (
  <header className="relative overflow-hidden px-6 pt-8 pb-5">
    <Link to="/" className="relative block">
      <h1 className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-2xl font-bold text-transparent">
        Tina Diet
      </h1>
      {subtitle !== undefined ? (
        <p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p>
      ) : null}
    </Link>
    <span
      aria-hidden
      className="pointer-events-none absolute -right-4 -top-4 text-3xl opacity-30 select-none"
    >
      🌸
    </span>
  </header>
);

const SubpageHeader = ({ title }: { title: string }) => (
  <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/90 px-5 py-3 backdrop-blur-md">
    <div className="flex items-center justify-between gap-3">
      <Link
        to="/"
        className="flex items-center gap-1 text-sm font-medium text-brand-600 transition hover:text-brand-700"
      >
        <span aria-hidden>←</span>
        <span>Home</span>
      </Link>
      <h1 className="text-sm font-semibold tracking-tight text-slate-900">
        {title}
      </h1>
      <span aria-hidden className="w-14" />
    </div>
  </header>
);

const BottomNav = () => (
  <nav className="sticky bottom-0 z-10 border-t border-brand-100 bg-white/95 backdrop-blur-md">
    <ul className="mx-auto flex max-w-md items-stretch justify-around px-1.5 py-1.5">
      {NAV_ITEMS.map((item) => (
        <li key={item.to} className="flex-1">
          <NavLink
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] transition ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`text-lg leading-none transition-transform ${
                    isActive ? 'scale-110' : 'opacity-70'
                  }`}
                  aria-hidden
                >
                  {item.icon}
                </span>
                <span className={`font-semibold tracking-tight ${isActive ? '' : 'font-medium'}`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);

type Props = {
  children: ReactNode;
  showBottomNav?: boolean;
};

export const AppShell = ({ children, showBottomNav = true }: Props) => {
  const location = useLocation();
  const isRoot = location.pathname === '/' || location.pathname === '';
  const title = PAGE_TITLES[location.pathname] ?? 'Tina Diet';

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-50 via-white to-brand-50/40">
      {isRoot ? (
        <RootHeader subtitle="Your AI Diet Coach for Thailand" />
      ) : (
        <SubpageHeader title={title} />
      )}
      <main className="flex-1 px-5 pb-28 pt-2">{children}</main>
      {showBottomNav ? <BottomNav /> : null}
    </div>
  );
};
