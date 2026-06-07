import { useState } from 'react';
import { useSession, type LiffDebug } from './state/session.js';
import { isProfileComplete } from './types/user.js';
import { ProfileForm } from './components/ProfileForm.js';
import { Dashboard } from './components/Dashboard.js';

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
          : 'bg-sky-100 text-sky-700';
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${toneClass}`}
    >
      {label}
    </span>
  );
};

const DebugBox = ({ debug }: { debug: LiffDebug }) => (
  <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
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

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
    <header className="px-6 pt-8 pb-4">
      <h1 className="text-2xl font-bold text-brand-900">Tina Diet</h1>
      <p className="text-sm text-slate-500">AI Nutrition Coach for Thailand</p>
    </header>
    <main className="px-6 pb-12">{children}</main>
  </div>
);

const App = () => {
  const { status, triggerLogin, setUser } = useSession();
  const [forceEdit, setForceEdit] = useState(false);

  if (status.kind === 'idle' || status.kind === 'initializing') {
    return (
      <Shell>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <StatusBadge label="Initializing LIFF…" tone="info" />
          <p className="mt-3 text-sm text-slate-500">
            Loading session from LINE…
          </p>
        </div>
      </Shell>
    );
  }

  if (status.kind === 'needs_login') {
    const inLine = status.debug.inClient;
    return (
      <Shell>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <StatusBadge label="Login required" tone="warn" />
          <p className="mt-3 text-sm text-slate-600">
            {inLine
              ? 'Anda di dalam LINE app tapi belum login. Tap tombol di bawah untuk login.'
              : 'Buka halaman ini dari LINE app untuk auto-login. Atau tap tombol di bawah untuk login via LINE OAuth.'}
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
      </Shell>
    );
  }

  if (status.kind === 'authenticating') {
    return (
      <Shell>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <StatusBadge label="Authenticating…" tone="info" />
          <p className="mt-3 text-sm text-slate-500">
            Exchanging LIFF token for session…
          </p>
        </div>
      </Shell>
    );
  }

  if (status.kind === 'error') {
    return (
      <Shell>
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
      </Shell>
    );
  }

  const { user, debug } = status;
  const completed = isProfileComplete(user);

  if (!completed || forceEdit) {
    return (
      <Shell>
        <ProfileForm
          user={user}
          onSaved={(updated) => {
            setUser(updated);
            setForceEdit(false);
          }}
        />
        <DebugBox debug={debug} />
      </Shell>
    );
  }

  return (
    <Shell>
      <Dashboard user={user} onEditProfile={() => setForceEdit(true)} />
      <DebugBox debug={debug} />
    </Shell>
  );
};

export default App;
