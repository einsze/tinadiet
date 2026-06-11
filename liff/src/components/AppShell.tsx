import { Link, NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

type NavItem = {
  to: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { to: '/', label: 'หน้าแรก', icon: '🏠' },
  { to: '/chat', label: 'ถาม Tina', icon: '💬' },
  { to: '/premium', label: 'Premium', icon: '⭐' },
  { to: '/profile', label: 'โปรไฟล์', icon: '👤' },
  { to: '/support', label: 'ช่วยเหลือ', icon: '🆘' },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/chat': 'ถาม Tina',
  '/premium': 'Premium',
  '/profile': 'โปรไฟล์',
  '/settings': 'Settings',
  '/support': 'Support',
};

const RootHeader = ({ subtitle }: { subtitle?: string }) => (
  <header className="px-6 pt-8 pb-4">
    <Link to="/" className="block">
      <h1 className="text-2xl font-bold text-brand-900">Tina Diet</h1>
      {subtitle !== undefined ? (
        <p className="text-sm text-slate-500">{subtitle}</p>
      ) : null}
    </Link>
  </header>
);

const SubpageHeader = ({ title }: { title: string }) => (
  <header className="border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
    <div className="flex items-center justify-between gap-3">
      <Link
        to="/"
        className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
      >
        ← หน้าแรก
      </Link>
      <h1 className="text-sm font-semibold text-slate-900">{title}</h1>
      <span className="w-16" />
    </div>
  </header>
);

const BottomNav = () => (
  <nav className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
    <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
      {NAV_ITEMS.map((item) => (
        <li key={item.to} className="flex-1">
          <NavLink
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] transition ${
                isActive
                  ? 'text-brand-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`text-xl leading-none ${isActive ? '' : 'opacity-70'}`}>
                  {item.icon}
                </span>
                <span className="font-medium">{item.label}</span>
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
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-sky-50 to-white">
      {isRoot ? (
        <RootHeader subtitle="AI Nutrition Coach for Thailand" />
      ) : (
        <SubpageHeader title={title} />
      )}
      <main className="flex-1 px-6 pb-24">{children}</main>
      {showBottomNav ? <BottomNav /> : null}
    </div>
  );
};
