import { useMemo } from 'react';
import { marked } from 'marked';
import privacyMarkdown from '../legal/privacy.md?raw';
import termsMarkdown from '../legal/terms.md?raw';

type Props = {
  document: 'privacy' | 'terms';
};

marked.setOptions({ gfm: true, breaks: false });

export const LegalPage = ({ document }: Props) => {
  const source = document === 'privacy' ? privacyMarkdown : termsMarkdown;
  const title = document === 'privacy' ? 'Privacy Policy' : 'Terms of Service';
  const html = useMemo(() => marked.parse(source) as string, [source]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <a
            href="/"
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            ← Back to Tina Diet
          </a>
          <h1 className="mt-1 text-xl font-bold text-slate-900">{title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">tinadiet.com</p>
        </div>
      </header>
      <main className="px-6 py-8">
        <article
          className="mx-auto max-w-3xl space-y-4 rounded-xl bg-white p-8 text-slate-800 shadow-sm legal-prose"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-slate-400">
          © Tina Diet · tinadiet.com
        </p>
      </main>
    </div>
  );
};
