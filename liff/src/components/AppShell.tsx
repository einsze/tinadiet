import { Link, NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  ChevronLeft,
  Crown,
  Home,
  LifeBuoy,
  MessageCircleHeart,
  Settings as SettingsIcon,
  Sparkles,
  UserCog,
  type LucideIcon,
} from 'lucide-react';

type NavItem = {
  to: string;
  label: string;
  Icon: LucideIcon;
};

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/chat', label: 'Ask Tina', Icon: MessageCircleHeart },
  { to: '/premium', label: 'Premium', Icon: Crown },
  { to: '/profile', label: 'Profile', Icon: UserCog },
  { to: '/support', label: 'Support', Icon: LifeBuoy },
];

type SubpageMeta = {
  title: string;
  Icon: LucideIcon;
  tagline: string;
};

const SUBPAGE_META: Record<string, SubpageMeta> = {
  '/chat': {
    title: 'Ask Tina',
    Icon: MessageCircleHeart,
    tagline: 'ปรึกษานักโภชนาการส่วนตัวของคุณ',
  },
  '/premium': {
    title: 'Premium',
    Icon: Crown,
    tagline: 'ปลดล็อกทุกฟีเจอร์ของ Tina',
  },
  '/profile': {
    title: 'Profile',
    Icon: UserCog,
    tagline: 'ข้อมูลและเป้าหมายของคุณ',
  },
  '/settings': {
    title: 'Settings',
    Icon: SettingsIcon,
    tagline: 'จัดการบัญชีและความเป็นส่วนตัว',
  },
  '/support': {
    title: 'Support',
    Icon: LifeBuoy,
    tagline: 'ติดปัญหา? เราช่วยได้ค่ะ',
  },
};

const RootHeader = () => (
  <header className="relative overflow-hidden px-6 pt-6 pb-3 text-center">
    <span
      aria-hidden
      className="pointer-events-none absolute left-4 top-3 text-base opacity-30 select-none"
    >
      🌸
    </span>
    <span
      aria-hidden
      className="pointer-events-none absolute right-4 top-3 text-base opacity-30 select-none"
    >
      💕
    </span>
    <Link
      to="/"
      className="relative inline-flex items-center justify-center gap-2"
    >
      <Sparkles className="h-5 w-5 text-brand-400" strokeWidth={2} />
      <h1 className="bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
        Your AI Diet Coach
      </h1>
      <Sparkles className="h-5 w-5 text-brand-400" strokeWidth={2} />
    </Link>
  </header>
);

const SubpageHeader = ({ meta }: { meta: SubpageMeta }) => (
  <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/95 backdrop-blur-md">
    <div className="flex items-center justify-between px-4 pt-2.5">
      <Link
        to="/"
        className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 transition hover:text-brand-700"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
        <span>Home</span>
      </Link>
      <span aria-hidden className="w-12" />
    </div>
    <div className="relative px-4 pb-3 pt-1 text-center">
      <span
        aria-hidden
        className="pointer-events-none absolute left-6 top-1 text-xs opacity-25 select-none"
      >
        ✨
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute right-6 top-1 text-xs opacity-25 select-none"
      >
        ✨
      </span>
      <h1 className="inline-flex items-center gap-2 text-xl font-extrabold tracking-tight">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200/70 shadow-sm ring-1 ring-brand-200">
          <meta.Icon className="h-[18px] w-[18px] text-brand-600" strokeWidth={2.4} />
        </span>
        <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 bg-clip-text text-transparent">
          {meta.title}
        </span>
      </h1>
      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
        {meta.tagline}
      </p>
    </div>
  </header>
);

const BottomNav = () => (
  <nav className="sticky bottom-0 z-10 border-t border-brand-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
    <ul className="mx-auto flex max-w-md items-stretch justify-around px-1.5 py-1.5">
      {NAV_ITEMS.map((item) => (
        <li key={item.to} className="flex-1">
          <NavLink
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] transition ${
                isActive ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-br from-brand-100 to-brand-200/70 text-brand-600 shadow-sm ring-1 ring-brand-200'
                      : 'text-slate-500'
                  }`}
                >
                  <item.Icon
                    className={`transition-transform ${isActive ? 'h-[18px] w-[18px] scale-110' : 'h-[18px] w-[18px]'}`}
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                </span>
                <span
                  className={`tracking-tight ${isActive ? 'font-semibold' : 'font-medium'}`}
                >
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

const FALLBACK_SUBPAGE_META: SubpageMeta = {
  title: 'Tina Diet',
  Icon: Home,
  tagline: '',
};

export const AppShell = ({ children, showBottomNav = true }: Props) => {
  const location = useLocation();
  const isRoot = location.pathname === '/' || location.pathname === '';
  const meta = SUBPAGE_META[location.pathname] ?? FALLBACK_SUBPAGE_META;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-50 via-white to-brand-50/40">
      {isRoot ? <RootHeader /> : <SubpageHeader meta={meta} />}
      <main className="flex-1 px-5 pb-28 pt-2">{children}</main>
      {showBottomNav ? <BottomNav /> : null}
    </div>
  );
};
