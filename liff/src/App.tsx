import { useState } from 'react';
import {
  BrowserRouter,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import { useSession, type LiffDebug } from './state/session.js';
import { isProfileComplete } from './types/user.js';
import { ProfileForm } from './components/ProfileForm.js';
import { OnboardingSplash } from './components/OnboardingSplash.js';
import { LegalPage } from './components/LegalPage.js';
import { AppShell } from './components/AppShell.js';
import { AuthLoadingScreen } from './components/AuthLoadingScreen.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { PremiumPage } from './pages/PremiumPage.js';
import { TopupMethodPage } from './pages/TopupMethodPage.js';
import { ManualTopupPage } from './pages/ManualTopupPage.js';
import { ChatPage } from './pages/ChatPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { SupportPage } from './pages/SupportPage.js';
import { GiftsPage } from './pages/GiftsPage.js';
import { ClaimPage } from './pages/ClaimPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';

const StatusBadge = ({
  label,
  tone,
}: {
  label: string;
  tone: 'info' | 'success' | 'error' | 'warn';
}) => {
  const toneClass =
    tone === 'success'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'error'
        ? 'bg-rose-100 text-rose-700'
        : tone === 'warn'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-brand-100 text-brand-700';
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${toneClass}`}
    >
      {label}
    </span>
  );
};

const DebugBox = ({ debug }: { debug: LiffDebug }) => (
  <details className="mx-6 mb-4 mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
    <summary className="cursor-pointer select-none font-medium">
      LIFF debug
    </summary>
    <dl className="mt-2 space-y-1 font-mono">
      <div>
        <dt className="inline text-slate-500">inClient: </dt>
        <dd className="inline">{String(debug.inClient)}</dd>
      </div>
      <div>
        <dt className="inline text-slate-500">loggedIn: </dt>
        <dd className="inline">{String(debug.loggedIn)}</dd>
      </div>
      <div>
        <dt className="inline text-slate-500">os: </dt>
        <dd className="inline">{debug.os}</dd>
      </div>
      <div>
        <dt className="inline text-slate-500">version: </dt>
        <dd className="inline">{debug.version}</dd>
      </div>
      <div>
        <dt className="inline text-slate-500">liffId: </dt>
        <dd className="inline break-all">{debug.liffId}</dd>
      </div>
    </dl>
  </details>
);

const StandaloneShell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-brand-50/40">
    <header className="relative overflow-hidden px-6 pt-8 pb-5">
      <h1 className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-2xl font-bold text-transparent">
        Tina Diet
      </h1>
      <p className="mt-0.5 text-xs font-medium text-slate-500">
        Your AI Diet Coach for Thailand
      </p>
      <span
        aria-hidden
        className="pointer-events-none absolute -right-4 -top-4 text-3xl opacity-30 select-none"
      >
        🌸
      </span>
    </header>
    <main className="px-6 pb-12">{children}</main>
  </div>
);

const AuthGate = () => {
  const { status, triggerLogin, setUser } = useSession();
  const [forceEdit, setForceEdit] = useState(false);
  const [splashDismissed, setSplashDismissed] = useState(false);

  if (status.kind === 'idle' || status.kind === 'initializing') {
    return <AuthLoadingScreen message="Loading" />;
  }

  if (status.kind === 'needs_login') {
    const inLine = status.debug.inClient;
    return (
      <StandaloneShell>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <StatusBadge label="Login required" tone="warn" />
          <p className="mt-3 text-sm text-slate-600">
            {inLine
              ? 'คุณอยู่ใน LINE app แต่ยังไม่ได้ล็อกอิน แตะปุ่มด้านล่างเพื่อล็อกอิน'
              : 'เปิดหน้านี้ผ่าน LINE app เพื่อล็อกอินอัตโนมัติ หรือแตะปุ่มด้านล่างเพื่อล็อกอินผ่าน LINE OAuth'}
          </p>
          <button
            type="button"
            onClick={triggerLogin}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Login with LINE
          </button>
          <DebugBox debug={status.debug} />
        </div>
      </StandaloneShell>
    );
  }

  if (status.kind === 'authenticating') {
    return <AuthLoadingScreen message="Signing you in" />;
  }

  if (status.kind === 'error') {
    return (
      <StandaloneShell>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
          <StatusBadge label="Error" tone="error" />
          <p className="mt-3 text-sm font-medium text-rose-900">
            Failed to authenticate
          </p>
          <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-rose-700">
            {status.message}
          </pre>
          {status.debug !== undefined ? (
            <DebugBox debug={status.debug} />
          ) : null}
        </div>
      </StandaloneShell>
    );
  }

  const { user, debug } = status;
  const completed = isProfileComplete(user);

  if (!completed && !forceEdit && !splashDismissed) {
    return (
      <StandaloneShell>
        <OnboardingSplash
          displayName={user.display_name}
          onContinue={() => setSplashDismissed(true)}
        />
        <DebugBox debug={debug} />
      </StandaloneShell>
    );
  }

  if (!completed || forceEdit) {
    return (
      <StandaloneShell>
        <ProfileForm
          user={user}
          onSaved={(updated) => {
            setUser(updated);
            setForceEdit(false);
            setSplashDismissed(false);
          }}
        />
        <DebugBox debug={debug} />
      </StandaloneShell>
    );
  }

  return <Outlet context={{ debug }} />;
};

const ShellLayout = () => {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/privacy" element={<LegalPage document="privacy" />} />
        <Route path="/terms" element={<LegalPage document="terms" />} />
        <Route element={<AuthGate />}>
          <Route element={<ShellLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/premium" element={<PremiumPage />} />
            <Route path="/premium/topup" element={<TopupMethodPage />} />
            <Route
              path="/premium/topup/manual"
              element={<ManualTopupPage />}
            />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/gifts" element={<GiftsPage />} />
            <Route path="/claim/:token" element={<ClaimPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
