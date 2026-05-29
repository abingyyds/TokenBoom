import React from 'react';
import { getAvailability, getModelTags } from '../utils/modelMeta';

const availabilityClasses = {
  success: 'border-emerald-500/25 bg-emerald-500/10 text-page-success',
  warning: 'border-amber-500/25 bg-amber-500/10 text-page-warning',
  info: 'border-sky-500/25 bg-sky-500/10 text-page-info',
  muted: 'border-page-divider bg-page-surface text-page-secondary',
};

const dotClasses = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
  muted: 'bg-slate-400',
};

export function AvailabilityBadge({ model }) {
  const availability = getAvailability(model);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${availabilityClasses[availability.tone] || availabilityClasses.muted}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[availability.tone] || dotClasses.muted}`} />
      {availability.label}
    </span>
  );
}

export default function ModelBadges({ model, limit = 4 }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {getModelTags(model).slice(0, limit).map((tag) => (
        <span key={tag} className="rounded-full border border-page-divider bg-page-surface px-2 py-0.5 text-[11px] font-medium text-page-secondary">
          {tag}
        </span>
      ))}
    </div>
  );
}
