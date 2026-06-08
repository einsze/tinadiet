import { useCallback, useEffect, useState } from 'react';
import { weightLogsApi, type WeightLogsListResponse } from '../api/weightLogs.js';
import { WeightChart } from './WeightChart.js';

type Props = { refreshKey?: number };

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: WeightLogsListResponse }
  | { kind: 'error'; message: string };

export const WeightSection = ({ refreshKey }: Props) => {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const data = await weightLogsApi.listRecent(30);
      setState({ kind: 'ready', data });
    } catch (err) {
      const message =
        err !== null && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
      setState({ kind: 'error', message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Weight trend</h3>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          Refresh
        </button>
      </div>

      {state.kind === 'loading' ? (
        <p className="mt-3 text-sm text-slate-500">Loading…</p>
      ) : null}

      {state.kind === 'error' ? (
        <p className="mt-3 text-sm text-rose-700">Error: {state.message}</p>
      ) : null}

      {state.kind === 'ready' ? (
        <>
          <div className="mt-3">
            <WeightChart
              logs={state.data.logs}
              targetKg={state.data.target_weight_kg}
            />
          </div>

          {state.data.latest !== null ? (
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Latest</div>
                <div className="mt-0.5 text-base font-semibold text-slate-900">
                  {state.data.latest.weight_kg}
                  <span className="ml-0.5 text-xs font-normal text-slate-500">
                    kg
                  </span>
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Target</div>
                <div className="mt-0.5 text-base font-semibold text-slate-900">
                  {state.data.target_weight_kg ?? '—'}
                  {state.data.target_weight_kg !== null ? (
                    <span className="ml-0.5 text-xs font-normal text-slate-500">
                      kg
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <p className="mt-3 text-xs text-slate-400">
            พิมพ์ &quot;ชั่ง 60.5&quot; หรือ &quot;weight 60.5&quot; ที่แชต TinaDiet
            เพื่อบันทึก
          </p>
        </>
      ) : null}
    </section>
  );
};
