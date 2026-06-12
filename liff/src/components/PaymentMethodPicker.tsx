import { QrCode, Wallet } from 'lucide-react';
import type { PaymentMethod } from '../types/billing.js';

type Props = {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
};

type MethodOption = {
  method: PaymentMethod;
  label: string;
  hint: string;
  Icon: typeof QrCode;
};

const OPTIONS: ReadonlyArray<MethodOption> = [
  {
    method: 'promptpay',
    label: 'PromptPay',
    hint: 'สแกน QR ผ่านแอปธนาคาร',
    Icon: QrCode,
  },
  {
    method: 'truemoney',
    label: 'TrueMoney',
    hint: 'ชำระผ่านแอป TrueMoney',
    Icon: Wallet,
  },
];

export const PaymentMethodPicker = ({ value, onChange, disabled }: Props) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTIONS.map(({ method, label, hint, Icon }) => {
        const active = method === value;
        return (
          <button
            key={method}
            type="button"
            onClick={() => onChange(method)}
            disabled={disabled}
            className={[
              'flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
              active
                ? 'border-brand-500 bg-gradient-to-br from-brand-50 to-white shadow-sm ring-1 ring-brand-200'
                : 'border-slate-200 bg-white hover:border-brand-300',
            ].join(' ')}
            aria-pressed={active}
          >
            <span
              className={[
                'flex h-10 w-10 items-center justify-center rounded-full',
                active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500',
              ].join(' ')}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
            </span>
            <div className="text-center">
              <div
                className={[
                  'text-sm font-semibold',
                  active ? 'text-brand-700' : 'text-slate-800',
                ].join(' ')}
              >
                {label}
              </div>
              <div className="mt-0.5 text-[10px] leading-tight text-slate-500">
                {hint}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
