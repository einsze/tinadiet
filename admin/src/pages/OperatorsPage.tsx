import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  Plus,
  Loader2,
  Trash2,
  Edit3,
  Save,
  X,
} from 'lucide-react';
import { operatorsApi } from '../api/index.js';
import type { AdminUserPublic, AdminRole } from '../types/index.js';
import { useAuth } from '../state/auth.js';

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

type EditState = {
  id: number;
  display_name: string;
  role: AdminRole;
  is_active: boolean;
  password: string;
};

export const OperatorsPage = () => {
  const { state: auth } = useAuth();
  const myId = auth.kind === 'authenticated' ? auth.admin.id : -1;

  const [operators, setOperators] = useState<AdminUserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPw, setCreatePw] = useState('');
  const [createName, setCreateName] = useState('');
  const [createRole, setCreateRole] = useState<AdminRole>('operator');
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await operatorsApi.list();
      setOperators(res.operators);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (createEmail.length === 0 || createPw.length < 8 || createName.length === 0) {
      setMsg('Email, password (≥8 chars), display name required');
      return;
    }
    setPending(true);
    try {
      await operatorsApi.create({
        email: createEmail,
        password: createPw,
        display_name: createName,
        role: createRole,
      });
      setMsg('Operator created.');
      setCreating(false);
      setCreateEmail('');
      setCreatePw('');
      setCreateName('');
      setCreateRole('operator');
      void load();
    } catch (err) {
      const apiErr = err as { message?: string };
      setMsg(apiErr.message ?? 'Failed');
    } finally {
      setPending(false);
    }
  };

  const handleUpdate = async () => {
    if (editing === null) return;
    setPending(true);
    try {
      const body: {
        display_name?: string;
        role?: AdminRole;
        is_active?: boolean;
        password?: string;
      } = {
        display_name: editing.display_name,
        role: editing.role,
        is_active: editing.is_active,
      };
      if (editing.password.length > 0) body.password = editing.password;
      await operatorsApi.update(editing.id, body);
      setMsg('Updated.');
      setEditing(null);
      void load();
    } catch (err) {
      const apiErr = err as { message?: string };
      setMsg(apiErr.message ?? 'Failed');
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (op: AdminUserPublic) => {
    if (!window.confirm(`Delete ${op.email}? This cannot be undone.`)) return;
    setPending(true);
    try {
      await operatorsApi.delete(op.id);
      setMsg('Deleted.');
      void load();
    } catch (err) {
      const apiErr = err as { message?: string };
      setMsg(apiErr.message ?? 'Failed');
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <ShieldCheck className="h-5 w-5" />
            Operators
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Manage admin accounts (superadmin only)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </header>

      {msg !== null && (
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          {msg}
        </div>
      )}

      {creating && (
        <section className="rounded-xl bg-white p-4 shadow-sm ring-2 ring-brand-200">
          <h3 className="text-sm font-semibold text-slate-900">
            Create new operator
          </h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input
              type="email"
              placeholder="Email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <input
              type="password"
              placeholder="Password (≥8 chars)"
              value={createPw}
              onChange={(e) => setCreatePw(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="Display name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <select
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value as AdminRole)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="operator">Operator</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={pending}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Last login</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {operators.map((op) => {
              const isEditing = editing !== null && editing.id === op.id;
              const isSelf = op.id === myId;
              if (isEditing && editing !== null) {
                return (
                  <tr key={op.id} className="bg-amber-50">
                    <td className="px-4 py-2 text-xs">{op.email}</td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editing.display_name}
                        onChange={(e) =>
                          setEditing({ ...editing, display_name: e.target.value })
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={editing.role}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            role: e.target.value as AdminRole,
                          })
                        }
                        disabled={isSelf}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="operator">Operator</option>
                        <option value="superadmin">Superadmin</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={editing.is_active}
                          disabled={isSelf}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              is_active: e.target.checked,
                            })
                          }
                        />
                        Active
                      </label>
                      <input
                        type="password"
                        placeholder="New password (optional)"
                        value={editing.password}
                        onChange={(e) =>
                          setEditing({ ...editing, password: e.target.value })
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-[10px]"
                      />
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {formatDate(op.last_login_at)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => void handleUpdate()}
                          disabled={pending}
                          className="rounded bg-emerald-600 p-1 text-white hover:bg-emerald-700"
                          title="Save"
                        >
                          <Save className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="rounded bg-slate-200 p-1 text-slate-600 hover:bg-slate-300"
                          title="Cancel"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={op.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs">
                    {op.email}
                    {isSelf && (
                      <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">
                        you
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{op.display_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        op.role === 'superadmin'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {op.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {op.is_active ? (
                      <span className="text-xs text-emerald-700">Active</span>
                    ) : (
                      <span className="text-xs text-slate-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(op.last_login_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            id: op.id,
                            display_name: op.display_name,
                            role: op.role,
                            is_active: op.is_active,
                            password: '',
                          })
                        }
                        className="rounded p-1 text-slate-600 hover:bg-slate-200"
                        title="Edit"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(op)}
                          disabled={pending}
                          className="rounded p-1 text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
