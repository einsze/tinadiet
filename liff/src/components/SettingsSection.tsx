import { useState, type FormEvent } from 'react';
import { accountApi } from '../api/account.js';

type DeleteState =
  | { kind: 'idle' }
  | { kind: 'confirming'; input: string }
  | { kind: 'submitting' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

const SettingsButton = ({
  icon,
  label,
  description,
  onClick,
  disabled,
  tone = 'default',
}: {
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) => {
  const toneClass =
    tone === 'danger'
      ? 'border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50'
      : 'border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  );
};

export const SettingsSection = () => {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>({ kind: 'idle' });

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await accountApi.exportData();
    } catch (err) {
      const apiErr = err as { message?: string };
      setExportError(apiErr.message ?? 'Export failed. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (deleteState.kind !== 'confirming') return;
    if (deleteState.input.trim() !== 'DELETE') {
      setDeleteState({
        kind: 'error',
        message: 'You must type DELETE (uppercase) to confirm.',
      });
      return;
    }
    setDeleteState({ kind: 'submitting' });
    try {
      await accountApi.deleteAccount('DELETE');
      setDeleteState({ kind: 'done' });
    } catch (err) {
      const apiErr = err as { message?: string };
      setDeleteState({
        kind: 'error',
        message: apiErr.message ?? 'Delete failed. Try again.',
      });
    }
  };

  if (deleteState.kind === 'done') {
    return (
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Account Deleted</h3>
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
          <div className="text-3xl">🌱</div>
          <p className="mt-3 text-sm font-medium text-emerald-900">
            ลบบัญชีสำเร็จแล้วค่ะ
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            ข้อมูลทั้งหมดของคุณถูกลบออกจากระบบเรียบร้อย ปิดหน้านี้ได้เลยค่ะ
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Settings & Privacy</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        ข้อมูลส่วนตัวและการจัดการบัญชี
      </p>

      <div className="mt-4 space-y-2">
        <SettingsButton
          icon="📄"
          label="Privacy Policy"
          description="วิธี Tina จัดการข้อมูลของคุณ"
          onClick={() => window.open('/privacy', '_blank', 'noopener')}
        />
        <SettingsButton
          icon="📄"
          label="Terms of Service"
          description="ข้อกำหนดการใช้งาน"
          onClick={() => window.open('/terms', '_blank', 'noopener')}
        />
        <SettingsButton
          icon="📥"
          label={exporting ? 'Exporting…' : 'Export My Data'}
          description="ดาวน์โหลดข้อมูลทั้งหมดของคุณเป็นไฟล์ JSON"
          onClick={() => void handleExport()}
          disabled={exporting}
        />
        <SettingsButton
          icon="🗑️"
          label="Delete Account"
          description="ลบบัญชีและข้อมูลทั้งหมดถาวร"
          onClick={() => setDeleteState({ kind: 'confirming', input: '' })}
          tone="danger"
          disabled={
            deleteState.kind === 'confirming' ||
            deleteState.kind === 'submitting'
          }
        />
      </div>

      {exportError !== null ? (
        <p className="mt-2 text-xs text-rose-700">{exportError}</p>
      ) : null}

      {deleteState.kind === 'confirming' ||
      deleteState.kind === 'submitting' ||
      deleteState.kind === 'error' ? (
        <form
          onSubmit={handleDeleteSubmit}
          className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4"
        >
          <h4 className="text-sm font-semibold text-rose-900">
            ⚠️ ยืนยันการลบบัญชี
          </h4>
          <p className="mt-1 text-xs text-rose-800">
            การกระทำนี้ไม่สามารถยกเลิกได้
            ข้อมูลทั้งหมด (โปรไฟล์, บันทึกอาหาร, น้ำหนัก, แชต, การสมัครสมาชิก)
            จะถูกลบถาวร และจะยกเลิก Premium subscription ทันทีโดยไม่มีการคืนเงิน
          </p>
          <p className="mt-3 text-xs font-medium text-rose-900">
            พิมพ์ <code className="rounded bg-rose-100 px-1.5 py-0.5 font-mono">DELETE</code>{' '}
            (ตัวพิมพ์ใหญ่ทั้งหมด) เพื่อยืนยัน:
          </p>
          <input
            type="text"
            value={
              deleteState.kind === 'confirming' ? deleteState.input : ''
            }
            onChange={(e) =>
              setDeleteState({ kind: 'confirming', input: e.target.value })
            }
            disabled={deleteState.kind === 'submitting'}
            autoFocus
            placeholder="DELETE"
            className="mt-2 w-full rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
          {deleteState.kind === 'error' ? (
            <p className="mt-2 text-xs text-rose-700">{deleteState.message}</p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setDeleteState({ kind: 'idle' })}
              disabled={deleteState.kind === 'submitting'}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={deleteState.kind === 'submitting'}
              className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteState.kind === 'submitting' ? 'กำลังลบ…' : 'ลบถาวร'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
};
