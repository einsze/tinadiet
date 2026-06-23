import type { ManualPaymentStatus } from '../types/index.js';
import { STATUS_BADGE_CLASS, formatStatusLabel } from '../types/index.js';

export const StatusBadge = ({ status }: { status: ManualPaymentStatus }) => (
  <span
    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_CLASS[status]}`}
  >
    {formatStatusLabel(status)}
  </span>
);
