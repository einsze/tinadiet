import { NavLink, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  History,
  Users as UsersIcon,
  Settings as SettingsIcon,
  ShieldCheck,
  LogOut,
  UserCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../state/auth.js';

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  superadminOnly?: boolean;
};

const NAV: NavItem[] = [
  { to: '/payments/pending', label: 'Pending Review', icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/payments/history', label: 'Payment History', icon: <History className="h-4 w-4" /> },
  { to: '/users', label: 'Users', icon: <UsersIcon className="h-4 w-4" /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon className="h-4 w-4" />, superadminOnly: true },
  { to: '/operators', label: 'Operators', icon: <ShieldCheck className="h-4 w-4" />, superadminOnly: true },
  { to: '/account', label: 'My Account', icon: <UserCircle className="h-4 w-4" /> },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { state, logout } = useAuth();
  const navigate = useNavigate();

  if (state.kind !== 'authenticated') return null;
  const admin = state.admin;
  const isSuperadmin = admin.role === 'superadmin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 px-2">
          <h1 className="text-lg font-bold text-slate-900">Tina Admin</h1>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            {admin.role}
          </p>
        </div>

        <nav className="flex-1 space-y-0.5">
          {NAV.filter((n) => !n.superadminOnly || isSuperadmin).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-brand-50 font-semibold text-brand-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="px-3 py-1 text-xs">
            <div className="font-medium text-slate-700">{admin.display_name}</div>
            <div className="truncate text-slate-500">{admin.email}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 md:hidden">
        <div>
          <h1 className="text-sm font-bold text-slate-900">Tina Admin</h1>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            {admin.role} · {admin.email}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md p-1 text-rose-600 hover:bg-rose-50"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="flex-1 overflow-x-hidden p-4 pt-16 md:p-8 md:pt-8">
        <div className="mx-auto max-w-5xl">
          {children}

          {/* Mobile bottom nav */}
          <nav className="fixed bottom-0 left-0 right-0 z-10 flex border-t border-slate-200 bg-white md:hidden">
            {NAV.filter((n) => !n.superadminOnly || isSuperadmin)
              .slice(0, 5)
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
                      isActive ? 'text-brand-700' : 'text-slate-500'
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.label.split(' ')[0]}</span>
                </NavLink>
              ))}
          </nav>
        </div>
      </main>
    </div>
  );
};
