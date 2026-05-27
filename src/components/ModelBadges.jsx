import React from 'react';
import { getAvailability, getModelTags } from '../utils/modelMeta';

const availabilityClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  muted: 'border-slate-200 bg-slate-100 text-slate-600',
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
        <span key={tag} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {tag}
        </span>
      ))}
    </div>
  );
}
