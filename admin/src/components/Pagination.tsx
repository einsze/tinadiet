import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  total: number;
  limit: number;
  offset: number;
  onChange: (nextOffset: number) => void;
  label?: string;
};

export const Pagination = ({
  total,
  limit,
  offset,
  onChange,
  label = 'baris',
}: Props) => {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1 text-xs text-slate-600">
      <div>
        Menampilkan <span className="font-semibold text-slate-900">{from}</span>
        –<span className="font-semibold text-slate-900">{to}</span> dari{' '}
        <span className="font-semibold text-slate-900">{total}</span> {label}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, offset - limit))}
          disabled={!canPrev}
          className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 font-medium text-slate-700">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onChange(offset + limit)}
          disabled={!canNext}
          className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
