import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { chatApi } from '../api/chat.js';
import type { ChatMessage, ChatQuota } from '../types/chatMessage.js';

type Props = {
  isPremium: boolean;
};

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; messages: ChatMessage[]; quota: ChatQuota }
  | { kind: 'error'; message: string };

const EXAMPLES_TH = [
  'กินไก่ทอดได้ไหม?',
  'ทำไมน้ำหนักไม่ลง',
  'ออกกำลังตอนเช้าดีกว่าเย็นไหม',
  'เนื้ออะไรโปรตีนสูงสุด',
];

const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user';
  const isRefusal = message.role === 'assistant' && message.refused;
  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-md bg-brand-500 text-white'
            : isRefusal
              ? 'rounded-bl-md bg-amber-50 text-amber-900'
              : 'rounded-bl-md bg-slate-100 text-slate-900'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
};

const TypingBubble = () => (
  <div className="flex justify-start">
    <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
      <span
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400"
        style={{ animationDelay: '120ms' }}
      />
      <span
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400"
        style={{ animationDelay: '240ms' }}
      />
    </div>
  </div>
);

export const ChatSection = ({ isPremium }: Props) => {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await chatApi.list(50);
      setState({ kind: 'ready', messages: res.messages, quota: res.quota });
    } catch (err) {
      const message =
        err !== null && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
      setState({ kind: 'error', message });
    }
  }, []);

  useEffect(() => {
    if (!isPremium) return;
    void load();
  }, [load, isPremium]);

  if (!isPremium) {
    return (
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              ถาม Tina · นักโภชนาการ
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              ฟีเจอร์ของ Premium · ปลดล็อกเพื่อใช้งาน
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
            ⭐ Premium
          </span>
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
          <div className="text-4xl">🔒</div>
          <p className="mt-3 text-sm text-slate-600">
            อัปเกรดเป็น Premium เพื่อถาม Tina เรื่องโภชนาการ
            <br />
            โดย Tina จะตอบโดยอิงเป้าหมายของคุณ
          </p>
          <p className="mt-2 text-xs text-slate-400">
            ดูตัวเลือกการอัปเกรดด้านบน
          </p>
        </div>
      </section>
    );
  }

  useEffect(() => {
    if (scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state, sending]);

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed.length === 0 || sending) return;
    if (state.kind !== 'ready') return;

    setSending(true);
    setSendError(null);

    const optimisticUser: ChatMessage = {
      id: -Date.now(),
      user_id: 0,
      role: 'user',
      content: trimmed,
      date: new Date().toISOString().slice(0, 10),
      refused: false,
      created_at: new Date().toISOString(),
    };
    setState({
      kind: 'ready',
      messages: [...state.messages, optimisticUser],
      quota: state.quota,
    });
    setInput('');

    try {
      const res = await chatApi.send(trimmed);
      setState((prev) => {
        if (prev.kind !== 'ready') return prev;
        const withoutOptimistic = prev.messages.filter(
          (m) => m.id !== optimisticUser.id
        );
        return {
          kind: 'ready',
          messages: [...withoutOptimistic, res.user_message, res.assistant_message],
          quota: res.quota,
        };
      });
    } catch (err) {
      setState((prev) => {
        if (prev.kind !== 'ready') return prev;
        return {
          kind: 'ready',
          messages: prev.messages.filter((m) => m.id !== optimisticUser.id),
          quota: prev.quota,
        };
      });
      const apiErr = err as { status?: number; code?: string; message?: string };
      if (apiErr.status === 429) {
        setSendError(
          apiErr.message ?? `วันนี้ถามครบโควต้าแล้วค่ะ พรุ่งนี้ถามได้ใหม่`
        );
      } else {
        setSendError(apiErr.message ?? 'ส่งไม่สำเร็จ ลองอีกครั้งนะคะ');
      }
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  const quota = state.kind === 'ready' ? state.quota : null;
  const messages = state.kind === 'ready' ? state.messages : [];
  const quotaReached = quota !== null && quota.remaining === 0;

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            ถาม Tina · นักโภชนาการ
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            ถามเรื่องอาหาร โภชนาการ หรือเป้าหมายของคุณ
          </p>
        </div>
        {quota !== null ? (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              quotaReached
                ? 'bg-rose-100 text-rose-700'
                : 'bg-slate-100 text-slate-600'
            }`}
            aria-label={`${quota.remaining} questions remaining`}
          >
            {quota.remaining}/{quota.limit}
          </span>
        ) : null}
      </div>

      {state.kind === 'loading' ? (
        <p className="mt-3 text-sm text-slate-500">Loading…</p>
      ) : null}

      {state.kind === 'error' ? (
        <p className="mt-3 text-sm text-rose-700">Error: {state.message}</p>
      ) : null}

      {state.kind === 'ready' ? (
        <>
          <div
            ref={scrollRef}
            className="mt-4 max-h-[440px] min-h-[180px] space-y-2.5 overflow-y-auto rounded-lg bg-slate-50/60 p-3"
          >
            {messages.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-500">
                  ยังไม่มีการสนทนา · ลองถามตัวอย่างด้านล่าง
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {EXAMPLES_TH.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setInput(ex)}
                      disabled={quotaReached || sending}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} />)
            )}
            {sending ? <TypingBubble /> : null}
          </div>

          {sendError !== null ? (
            <p className="mt-2 text-xs text-rose-700">{sendError}</p>
          ) : null}

          <form onSubmit={handleSend} className="mt-3 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
              rows={1}
              maxLength={1000}
              disabled={sending || quotaReached}
              placeholder={
                quotaReached
                  ? 'ครบโควต้าวันนี้แล้ว · พรุ่งนี้ถามได้ใหม่'
                  : 'พิมพ์คำถาม… (Enter เพื่อส่ง)'
              }
              className="min-h-[40px] flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              type="submit"
              disabled={sending || quotaReached || input.trim().length === 0}
              className="shrink-0 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? '...' : 'ส่ง'}
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
};
