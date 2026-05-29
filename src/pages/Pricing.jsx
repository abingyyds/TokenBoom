import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CreditCard, Search } from 'lucide-react';
import ModelPrice from '../components/ModelPrice';
import { getPublicModelCatalog, readPublicModelCatalog } from '../utils/publicCatalog';
import {
  filterModels,
  getModelCategory,
  getModelDisplayName,
  getModelId,
  getModelRoute,
  sortModels,
} from '../utils/modelMeta';

export default function Pricing() {
  const { t } = useTranslation();
  const cachedCatalog = useMemo(() => readPublicModelCatalog(), []);
  const [models, setModels] = useState(() => cachedCatalog?.models || []);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(() => !cachedCatalog);

  useEffect(() => {
    let cancelled = false;
    if (!cachedCatalog) setLoading(true);

    getPublicModelCatalog()
      .then((catalog) => {
        if (!cancelled) setModels(catalog.models);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cachedCatalog]);

  const enabledModels = useMemo(() => models.filter((model) => model.enabled !== false), [models]);
  const filtered = useMemo(() => (
    sortModels(filterModels(enabledModels, { search }), 'price')
  ), [enabledModels, search]);

  return (
    <div className="min-h-screen bg-page px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-lg border border-page-divider bg-page-surface/50 p-5 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-page-link">
              <CreditCard size={15} />
              Official pricing
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-page sm:text-4xl">{t('pricing.title')}</h1>
            <p className="mt-4 text-base leading-7 text-page-secondary">
              Public prices are merged from the official pricing feed and shown by model family. Route-specific marketplace prices are not displayed.
            </p>
          </div>
        </div>

        <div className="mb-6 max-w-md">
          <label className="relative block">
            <span className="sr-only">{t('pricing.searchPlaceholder')}</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-page-muted" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input h-11 w-full pl-10 pr-4 text-sm"
              placeholder={t('pricing.searchPlaceholder')}
            />
          </label>
        </div>

        {loading ? (
          <PricingSkeleton />
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-page-divider bg-page-surface/50 py-12 text-center text-page-secondary">
            {search ? t('pricing.noMatch') : t('pricing.noModels')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-page-divider bg-page-surface/50 shadow-sm">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-page-divider bg-page-surface/40 text-left text-page-muted">
                    <th className="px-5 py-3.5 font-medium">{t('pricing.model')}</th>
                    <th className="px-5 py-3.5 font-medium">Category</th>
                    <th className="px-5 py-3.5 text-right font-medium">Official price</th>
                    <th className="px-5 py-3.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((model) => (
                    <tr key={getModelId(model)} className="border-b border-page-divider last:border-0 hover:bg-page-surface-hover">
                      <td className="px-5 py-4">
                        <Link to={getModelRoute(model)} className="font-semibold text-page hover:text-page-link">
                          {getModelDisplayName(model)}
                        </Link>
                        <p className="mt-1 truncate font-mono text-xs text-page-muted">{getModelId(model)}</p>
                      </td>
                      <td className="px-5 py-4 text-page-secondary">{getModelCategory(model)}</td>
                      <td className="px-5 py-4 text-right"><ModelPrice model={model} compact /></td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Link to={`/playground?model=${encodeURIComponent(getModelId(model))}`} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-[#0b061f] hover:bg-brand-400">
                            Try
                          </Link>
                          <Link to={getModelRoute(model)} className="rounded-lg border border-page-divider bg-page-surface/50 px-3 py-1.5 text-xs font-semibold text-page-secondary hover:bg-page-surface-hover hover:text-page">
                            Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-page-divider md:hidden">
              {filtered.map((model) => (
                <div key={getModelId(model)} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={getModelRoute(model)} className="font-semibold text-page hover:text-page-link">
                        {getModelDisplayName(model)}
                      </Link>
                      <p className="mt-1 break-all font-mono text-xs text-page-muted">{getModelId(model)}</p>
                      <p className="mt-2 text-xs text-page-secondary">{getModelCategory(model)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <ModelPrice model={model} compact />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link to={`/playground?model=${encodeURIComponent(getModelId(model))}`} className="flex-1 rounded-lg bg-brand-500 px-3 py-2 text-center text-xs font-semibold text-[#0b061f]">
                      Try
                    </Link>
                    <Link to={getModelRoute(model)} className="flex-1 rounded-lg border border-page-divider bg-page-surface/50 px-3 py-2 text-center text-xs font-semibold text-page-secondary">
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PricingSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-page-divider bg-page-surface/50 shadow-sm">
      <table className="w-full text-sm">
        <tbody>
          {Array.from({ length: 8 }, (_, row) => (
            <tr key={row} className="border-b border-page-divider last:border-0">
              <td className="px-5 py-4"><div className="h-4 w-56 animate-pulse rounded bg-page-surface-hover" /></td>
              <td className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-page-surface" /></td>
              <td className="px-5 py-4"><div className="ml-auto h-4 w-24 animate-pulse rounded bg-page-surface" /></td>
              <td className="px-5 py-4"><div className="ml-auto h-4 w-28 animate-pulse rounded bg-page-surface" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
