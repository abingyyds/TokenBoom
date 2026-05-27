import React from 'react';
import { ArrowRight, X } from 'lucide-react';

const toneStyles = {
  brand: 'border-brand-500/20 bg-brand-500/10 text-brand-500',
  cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-500',
  sky: 'border-sky-500/20 bg-sky-500/10 text-sky-500',
  emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
  amber: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
  rose: 'border-rose-500/20 bg-rose-500/10 text-rose-500',
  slate: 'border-page-divider bg-page-surface text-page-secondary',
};

export function ConsolePage({ children, className = '' }) {
  return (
    <div className={`mx-auto min-w-0 max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}

export function ConsoleHero({
  eyebrow,
  title,
  subtitle,
  actions,
  stats,
  footer,
  className = '',
}) {
  return (
    <section className={`glass relative min-w-0 max-w-full overflow-hidden border border-page-divider p-4 shadow-sm sm:p-5 lg:p-6 ${className}`}>
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-page-muted">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 break-words text-2xl font-heading font-semibold tracking-normal text-page sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-page-secondary">
              {subtitle}
            </p>
          )}
          {actions && <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap sm:gap-3">{actions}</div>}
        </div>
        {stats && stats.length > 0 && (
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {stats}
          </div>
        )}
      </div>
      {footer && <div className="relative mt-6">{footer}</div>}
    </section>
  );
}

export function ConsoleStat({ icon: Icon, label, value, helper, tone = 'brand' }) {
  const toneClass = toneStyles[tone] || toneStyles.brand;

  return (
    <div className="rounded-2xl border border-page-divider bg-page-surface/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-page-muted">
            {label}
          </p>
          <div className="mt-2 break-words text-xl font-semibold tracking-tight text-page sm:text-2xl">
            {value}
          </div>
          {helper && <p className="mt-1 break-words text-xs leading-5 text-page-secondary [overflow-wrap:anywhere]">{helper}</p>}
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}

export function ConsoleSection({
  title,
  subtitle,
  action,
  children,
  className = '',
}) {
  return (
    <section className={`glass border border-page-divider p-4 shadow-sm sm:p-5 ${className}`}>
      {(title || subtitle || action) && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-page sm:text-lg">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm leading-6 text-page-secondary">{subtitle}</p>}
          </div>
          {action && <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function ConsoleEmpty({
  icon: Icon = ArrowRight,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-page-divider bg-page-surface/40 px-4 py-10 text-center sm:px-6 sm:py-14 ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-page-divider bg-page-surface text-page-muted">
        <Icon size={20} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-page">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-page-secondary">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ConsoleBadge({ tone = 'slate', children, className = '' }) {
  const toneClass = toneStyles[tone] || toneStyles.slate;

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass} ${className}`}>
      {children}
    </span>
  );
}

export function ConsoleFrame({ children, className = '' }) {
  return (
    <div className={`glass min-w-0 max-w-full overflow-hidden border border-page-divider shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function ConsoleFrameHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`border-b border-page-divider bg-page-surface/40 px-4 py-3 sm:px-5 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {title && <h2 className="text-sm font-semibold text-page sm:text-base">{title}</h2>}
          {subtitle && <p className="mt-1 text-xs leading-5 text-page-secondary sm:text-sm">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function ConsoleField({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-sm font-medium text-page-label">{label}</span>}
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-5 text-page-muted">{hint}</span>}
    </label>
  );
}

export function ConsoleModal({
  title,
  subtitle,
  onClose,
  children,
  className = '',
  maxWidth = 'max-w-md',
}) {
  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`glass max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-2xl p-5 shadow-2xl sm:p-6 ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || subtitle || onClose) && (
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              {title && <h3 className="text-base font-semibold text-page sm:text-lg">{title}</h3>}
              {subtitle && <p className="mt-1 text-sm leading-6 text-page-secondary">{subtitle}</p>}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-page-divider bg-page-surface/40 text-page-muted transition-colors hover:bg-page-surface-hover hover:text-page"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
