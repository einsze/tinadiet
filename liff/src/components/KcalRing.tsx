type Props = {
  consumed: number;
  goal: number;
  size?: number;
  stroke?: number;
};

export const KcalRing = ({
  consumed,
  goal,
  size = 160,
  stroke = 14,
}: Props) => {
  const safeGoal = goal > 0 ? goal : 1;
  const ratio = Math.min(consumed / safeGoal, 1);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);
  const remaining = Math.max(goal - consumed, 0);
  const over = consumed > goal;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 transform"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="white"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 400ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <div className="text-3xl font-bold tabular-nums">{consumed}</div>
        <div className="text-xs text-white/80">of {goal} kcal</div>
        <div className="mt-1 text-xs font-medium">
          {over ? `+${consumed - goal} over` : `${remaining} left`}
        </div>
      </div>
    </div>
  );
};
