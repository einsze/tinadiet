type Props = {
  message?: string;
};

const Decoration = ({
  emoji,
  className,
  delay = '0s',
}: {
  emoji: string;
  className: string;
  delay?: string;
}) => (
  <span
    aria-hidden
    className={`pointer-events-none absolute select-none animate-soft-float ${className}`}
    style={{ animationDelay: delay }}
  >
    {emoji}
  </span>
);

export const AuthLoadingScreen = ({ message = 'Loading' }: Props) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-brand-50 via-white to-brand-50/40">
      <Decoration
        emoji="✨"
        className="left-[12%] top-[18%] text-2xl opacity-50"
        delay="0s"
      />
      <Decoration
        emoji="💖"
        className="right-[14%] top-[24%] text-xl opacity-40"
        delay="0.4s"
      />
      <Decoration
        emoji="🌸"
        className="left-[18%] bottom-[28%] text-xl opacity-40"
        delay="0.9s"
      />
      <Decoration
        emoji="✨"
        className="right-[10%] bottom-[20%] text-2xl opacity-50"
        delay="1.3s"
      />
      <Decoration
        emoji="💕"
        className="left-[8%] top-[42%] text-lg opacity-30"
        delay="1.8s"
      />
      <Decoration
        emoji="🌷"
        className="right-[8%] bottom-[42%] text-lg opacity-30"
        delay="2.2s"
      />

      <div className="relative z-10 flex flex-col items-center px-6">
        <div className="relative">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-brand-300/40 blur-2xl animate-pulse-ring"
          />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-brand-200/50 blur-xl"
          />
          <img
            src="/tinadiet-mascot.png"
            alt="Tina Diet"
            className="relative h-40 w-40 rounded-full object-cover shadow-xl ring-4 ring-white animate-wiggle-float sm:h-48 sm:w-48"
            draggable={false}
          />
        </div>

        <h1 className="mt-8 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 bg-clip-text text-center text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
          Tina Diet
        </h1>
        <p className="mt-1.5 text-center text-sm font-medium text-slate-500">
          Your AI Diet Coach
        </p>

        <div className="mt-10 flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
            {message}
          </span>
          <span className="flex items-end gap-1" aria-hidden>
            <span
              className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce-dot"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce-dot"
              style={{ animationDelay: '180ms' }}
            />
            <span
              className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce-dot"
              style={{ animationDelay: '360ms' }}
            />
          </span>
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-300">
          tinadiet.com
        </p>
      </div>
    </div>
  );
};
