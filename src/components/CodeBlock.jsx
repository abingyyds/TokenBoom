import React from 'react';
import CopyButton from './CopyButton';

export default function CodeBlock({ title, language, code, className = '' }) {
  return (
    <div className={`min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-sm ${className}`}>
      {(title || language) && (
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-3 py-2.5 sm:px-4">
          <div className="min-w-0">
            {title && <p className="truncate text-sm font-semibold text-white">{title}</p>}
            {language && <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">{language}</p>}
          </div>
          <CopyButton
            text={code}
            className="shrink-0 border-white/10 bg-white/10 text-slate-100 hover:bg-white/15 hover:text-white"
          />
        </div>
      )}
      <pre className="max-h-[520px] max-w-full overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words p-3 text-[11px] leading-5 text-slate-100 [overflow-wrap:anywhere] sm:p-4 sm:text-sm md:break-normal md:[overflow-wrap:normal]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
