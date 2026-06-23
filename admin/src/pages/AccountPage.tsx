import { useState } from 'react';
import { UserCircle, Loader2, KeyRound } from 'lucide-react';
import { authApi } from '../api/index.js';
import { useAuth } from '../state/auth.js';

export const AccountPage = () => {
  const { state, refreshMe } = useAuth();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  );

  if (state.kind !== 'authenticated') return null;
  const admin = state.admin;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPw.length < 8) {
      setMsg({ kind: 'err', text: 'New password must be at least 8 characters' });
      return;
    }
    if (newPw !== confirmPw) {
      setMsg({ kind: 'err', text: 'New password confirmation does not match' });
      return;
    }
    setPending(true);
    try {
      await authApi.changePassword(currentPw, newPw);
      setMsg({ kind: 'ok', text: 'Password changed successfully' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      void refreshMe();
    } catch (err) {
      const apiErr = err as { message?: string };
      setMsg({ kind: 'err', text: apiErr.message ?? 'Failed' });
    } finally {
      setPending(false);
    }
  };

  const formatDate = (iso: string | null): string => {
    if (iso === null) return '—';
    return new Date(iso).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <UserCircle className="h-5 w-5" />
          My Account
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Your admin profile and password
        </p>
      </header>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Profile
        </h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium">{admin.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Display name</dt>
            <dd className="font-medium">{admin.display_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Role</dt>
            <dd>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  admin.role === 'superadmin'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {admin.role}
              </span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Last login</dt>
            <dd className="text-xs">{formatDate(admin.last_login_at)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Created</dt>
            <dd className="text-xs">{formatDate(admin.created_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <KeyRound className="h-4 w-4" />
          Change Password
        </h3>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Current password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              New password (min 8 chars)
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Confirm new password
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {msg !== null && (
            <div
              className={`rounded-lg p-2.5 text-xs ${
                msg.kind === 'ok'
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Change password'
            )}
          </button>
        </form>
      </section>
    </div>
  );
};
