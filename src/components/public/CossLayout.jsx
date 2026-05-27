import React from 'react';

const join = (...classes) => classes.filter(Boolean).join(' ');

export function CossPage({ children, className = '', ...props }) {
  return (
    <div {...props} className={join('coss-page', className)}>
      {children}
    </div>
  );
}

export function CossContainer({ children, className = '', ...props }) {
  return (
    <div {...props} className={join('coss-container', className)}>
      {children}
    </div>
  );
}

export function CossPageHeader({
  eyebrow,
  icon: Icon,
  title,
  description,
  secondary,
  actions,
  stats,
  children,
}) {
  return (
    <section className="coss-page-header">
      <CossContainer className="py-8 sm:py-10 lg:py-12">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            {(eyebrow || Icon) && (
              <div className="coss-chip mb-4">
                {Icon && <Icon size={15} />}
                {eyebrow}
              </div>
            )}
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                {description}
              </p>
            )}
            {secondary && (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                {secondary}
              </p>
            )}
            {children}
          </div>
          {(actions || stats) && (
            <div className="min-w-0 lg:min-w-[360px]">
              {actions}
              {stats && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                  {stats}
                </div>
              )}
            </div>
          )}
        </div>
      </CossContainer>
    </section>
  );
}

export function CossSection({ children, className = '', ...props }) {
  return (
    <section {...props} className={join('coss-container py-8 sm:py-10', className)}>
      {children}
    </section>
  );
}

export function CossCard({ children, className = '', as: Component = 'div', ...props }) {
  return (
    <Component {...props} className={join('coss-card', className)}>
      {children}
    </Component>
  );
}

export function CossCardFrame({ children, className = '', as: Component = 'div', ...props }) {
  return (
    <Component {...props} className={join('coss-card-frame', className)}>
      {children}
    </Component>
  );
}

export function CossMutedCard({ children, className = '', as: Component = 'div', ...props }) {
  return (
    <Component {...props} className={join('coss-card-muted', className)}>
      {children}
    </Component>
  );
}

export function CossStat({ label, value, detail }) {
  return (
    <CossMutedCard className="min-w-0 px-3 py-3 sm:px-4">
      <p className="truncate text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 break-words text-xl font-semibold text-slate-950 sm:text-2xl">{value}</p>
      {detail && <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>}
    </CossMutedCard>
  );
}

export function CossIconTile({ icon: Icon, className = '' }) {
  return (
    <span className={join('coss-icon-tile', className)}>
      <Icon size={17} />
    </span>
  );
}

export function CossEmptyState({ title, text, action }) {
  return (
    <CossCard className="px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      {text && <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </CossCard>
  );
}

export function CossSearchInput({ icon: Icon, className = '', ...props }) {
  return (
    <label className={join('relative block', className)}>
      {props['aria-label'] && <span className="sr-only">{props['aria-label']}</span>}
      {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
      <input
        {...props}
        className={join('coss-input h-10', Icon ? 'pl-10' : '', props.className)}
      />
    </label>
  );
}

export function CossSelect({ label, value, onChange, children, icon: Icon, className = '' }) {
  return (
    <label className={join('min-w-0', className)}>
      <span className="sr-only">{label}</span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={join('coss-input h-10 appearance-none pr-8', Icon ? 'pl-10' : '')}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          v
        </span>
      </div>
    </label>
  );
}

export function CossTabs({ items, value, onChange, getLabel = (item) => item.label, getValue = (item) => item.key }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
      {items.map((item) => {
        const itemValue = getValue(item);
        const active = value === itemValue;
        return (
          <button
            key={itemValue || 'all'}
            type="button"
            onClick={() => onChange(itemValue)}
            className={join('coss-tab', active && 'coss-tab-active')}
          >
            {getLabel(item)}
          </button>
        );
      })}
    </div>
  );
}

export function CossTableFrame({ title, meta, children, className = '' }) {
  return (
    <CossCardFrame className={join('overflow-hidden', className)}>
      {(title || meta) && (
        <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          {title && <p className="text-sm font-semibold text-slate-950">{title}</p>}
          {meta && <p className="text-xs font-medium text-slate-500">{meta}</p>}
        </div>
      )}
      {children}
    </CossCardFrame>
  );
}

export function CossButtonLike({ children, variant = 'secondary', className = '', as: Component = 'span', ...props }) {
  const base = variant === 'primary'
    ? 'coss-button-primary'
    : variant === 'ghost'
      ? 'coss-button-ghost'
      : 'coss-button-secondary';
  return (
    <Component {...props} className={join(base, className)}>
      {children}
    </Component>
  );
}
