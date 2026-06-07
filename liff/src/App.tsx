import { useSession } from './state/session.js';

const StatusBadge = ({ label, tone }: { label: string; tone: 'info' | 'success' | 'error' }) => {
  const toneClass =
    tone === 'success'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'error'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-sky-100 text-sky-700';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${toneClass}`}>
      {label}
    </span>
  );
};

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
  const { status } = useSession();

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
        </div>
      </Shell>
    );
  }

  const { user } = status;

  return (
    <Shell>
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <StatusBadge label="Authenticated" tone="success" />
        <h2 className="mt-4 text-xl font-semibold text-slate-900">
          Welcome{user.display_name ? `, ${user.display_name}` : ''} 👋
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Sprint 1 milestone 5 — end-to-end auth flow working.
        </p>

        <dl className="mt-6 divide-y divide-slate-100 text-sm">
          <div className="flex items-center justify-between py-3">
            <dt className="text-slate-500">DB user id</dt>
            <dd className="font-mono text-slate-900">#{user.id}</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-slate-500">LINE user id</dt>
            <dd className="font-mono text-xs text-slate-900">
              {user.line_user_id.slice(0, 8)}…{user.line_user_id.slice(-4)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-slate-500">Display name</dt>
            <dd className="text-slate-900">{user.display_name ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 rounded-xl bg-brand-500/5 border border-brand-500/10 p-6">
        <h3 className="font-semibold text-brand-900">What's next</h3>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          <li>• Profile form (gender, age, height, weight, goal)</li>
          <li>• Dashboard with daily kcal ring</li>
          <li>• Food logging (text + photo)</li>
          <li>• AI coach chat</li>
        </ul>
      </div>
    </Shell>
  );
};

export default App;
