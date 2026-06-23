import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Settings as SettingsIcon } from 'lucide-react';
import { settingsApi } from '../api/index.js';

type SettingsMap = Record<string, string>;

const FIELD_LABELS: Record<string, { label: string; hint: string; unit: string }> = {
  promptpay_id: {
    label: 'PromptPay ID',
    hint: 'Mobile number (10 digits) or Tax ID (13 digits). Will be displayed in QR codes user sees.',
    unit: '',
  },
  promptpay_id_type: {
    label: 'PromptPay ID Type',
    hint: 'mobile / nid / tax',
    unit: '',
  },
  promptpay_receiver_name: {
    label: 'Receiver Name',
    hint: 'Displayed below QR (e.g. "MS. TINA SOMTHAI" or company name)',
    unit: '',
  },
  price_1mo_credit: {
    label: '1 Month Premium',
    hint: 'Credit cost (1 credit = 1 THB)',
    unit: 'credit',
  },
  price_3mo_credit: {
    label: '3 Months Premium',
    hint: 'Credit cost',
    unit: 'credit',
  },
  price_6mo_credit: {
    label: '6 Months Premium',
    hint: 'Credit cost',
    unit: 'credit',
  },
  price_12mo_credit: {
    label: '12 Months Premium',
    hint: 'Credit cost',
    unit: 'credit',
  },
  high_value_threshold_satang: {
    label: 'High-value threshold',
    hint: 'Operators cannot approve amounts above this without superadmin (in satang, 100 satang = 1 THB)',
    unit: 'satang',
  },
  topup_min_satang: {
    label: 'Minimum top-up',
    hint: 'Smallest allowed top-up amount (satang)',
    unit: 'satang',
  },
  topup_max_satang: {
    label: 'Maximum top-up',
    hint: 'Largest allowed top-up amount (satang)',
    unit: 'satang',
  },
};

const SECTIONS: Array<{ title: string; keys: string[] }> = [
  {
    title: 'PromptPay Receiver',
    keys: ['promptpay_id', 'promptpay_id_type', 'promptpay_receiver_name'],
  },
  {
    title: 'Premium Pricing (in credit)',
    keys: [
      'price_1mo_credit',
      'price_3mo_credit',
      'price_6mo_credit',
      'price_12mo_credit',
    ],
  },
  {
    title: 'Top-up Limits & Safety',
    keys: ['topup_min_satang', 'topup_max_satang', 'high_value_threshold_satang'],
  },
];

export const SettingsPage = () => {
  const [values, setValues] = useState<SettingsMap>({});
  const [dirty, setDirty] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settingsApi.all();
      const map: SettingsMap = {};
      for (const s of res.settings) map[s.key] = s.value;
      setValues(map);
      setDirty({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChange = (key: string, value: string) => {
    setDirty((prev) => ({ ...prev, [key]: value }));
    setMsg(null);
  };

  const handleSave = async () => {
    if (Object.keys(dirty).length === 0) return;
    setSaving(true);
    setMsg(null);
    try {
      await settingsApi.update(dirty);
      setMsg('Saved!');
      void load();
    } catch (err) {
      const apiErr = err as { message?: string };
      setMsg(apiErr.message ?? 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const dirtyCount = Object.keys(dirty).length;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <SettingsIcon className="h-5 w-5" />
            System Settings
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Superadmin only — affects all users globally
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={dirtyCount === 0 || saving}
          className="flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save {dirtyCount > 0 ? `(${dirtyCount})` : ''}
        </button>
      </header>

      {msg !== null && (
        <div
          className={`rounded-lg p-3 text-sm ${
            msg === 'Saved!' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {msg}
        </div>
      )}

      {SECTIONS.map((section) => (
        <section key={section.title} className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            {section.title}
          </h3>
          <div className="mt-3 space-y-3">
            {section.keys.map((key) => {
              const meta = FIELD_LABELS[key];
              const currentValue = dirty[key] ?? values[key] ?? '';
              const isDirty = dirty[key] !== undefined;
              if (meta === undefined) return null;
              return (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-600">
                    {meta.label}
                    {isDirty && (
                      <span className="ml-1 text-[10px] font-semibold uppercase text-amber-600">
                        modified
                      </span>
                    )}
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={currentValue}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className={`flex-1 rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                        isDirty
                          ? 'border-amber-400 ring-amber-100 focus:border-amber-500 focus:ring-amber-200'
                          : 'border-slate-300 focus:border-brand-400 focus:ring-brand-100'
                      }`}
                    />
                    {meta.unit !== '' && (
                      <span className="text-xs font-medium text-slate-500">
                        {meta.unit}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">{meta.hint}</p>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
