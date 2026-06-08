import type { WeightLog } from '../types/weightLog.js';

type Props = {
  logs: WeightLog[];
  targetKg: number | null;
  width?: number;
  height?: number;
};

const PADDING = { top: 16, right: 12, bottom: 24, left: 36 };

export const WeightChart = ({
  logs,
  targetKg,
  width = 320,
  height = 180,
}: Props) => {
  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
        <p className="text-xs text-slate-400">
          ยังไม่มีบันทึกน้ำหนัก
          <br />
          พิมพ์ &quot;ชั่ง 60.5&quot; หรือ &quot;weight 60.5&quot; ที่แชต
        </p>
      </div>
    );
  }

  const ordered = [...logs].sort(
    (a, b) =>
      new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  );

  const weights = ordered.map((l) => l.weight_kg);
  if (targetKg !== null) weights.push(targetKg);
  const minW = Math.floor(Math.min(...weights) - 1);
  const maxW = Math.ceil(Math.max(...weights) + 1);
  const range = Math.max(maxW - minW, 1);

  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;

  const xAt = (i: number): number => {
    if (ordered.length === 1) return PADDING.left + plotW / 2;
    return PADDING.left + (i / (ordered.length - 1)) * plotW;
  };
  const yAt = (w: number): number => {
    return PADDING.top + ((maxW - w) / range) * plotH;
  };

  const pathD = ordered
    .map((log, i) => {
      const cmd = i === 0 ? 'M' : 'L';
      return `${cmd}${xAt(i).toFixed(1)} ${yAt(log.weight_kg).toFixed(1)}`;
    })
    .join(' ');

  const yTicks: number[] = [minW, Math.round((minW + maxW) / 2), maxW];

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  const firstLabel = formatDate(ordered[0]!.logged_at);
  const lastLabel = formatDate(ordered[ordered.length - 1]!.logged_at);

  const targetY = targetKg !== null ? yAt(targetKg) : null;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      role="img"
      aria-label="Weight trend chart"
    >
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PADDING.left}
            x2={width - PADDING.right}
            y1={yAt(tick)}
            y2={yAt(tick)}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
          <text
            x={PADDING.left - 6}
            y={yAt(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-slate-400 text-[10px]"
          >
            {tick}
          </text>
        </g>
      ))}

      {targetY !== null ? (
        <g>
          <line
            x1={PADDING.left}
            x2={width - PADDING.right}
            y1={targetY}
            y2={targetY}
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <text
            x={width - PADDING.right}
            y={targetY - 4}
            textAnchor="end"
            className="fill-emerald-600 text-[10px] font-medium"
          >
            target {targetKg}
          </text>
        </g>
      ) : null}

      <path
        d={pathD}
        fill="none"
        stroke="#0ea5e9"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {ordered.map((log, i) => (
        <circle
          key={log.id}
          cx={xAt(i)}
          cy={yAt(log.weight_kg)}
          r={3}
          fill="#0ea5e9"
        />
      ))}

      <text
        x={PADDING.left}
        y={height - 6}
        className="fill-slate-400 text-[10px]"
      >
        {firstLabel}
      </text>
      <text
        x={width - PADDING.right}
        y={height - 6}
        textAnchor="end"
        className="fill-slate-400 text-[10px]"
      >
        {lastLabel}
      </text>
    </svg>
  );
};
