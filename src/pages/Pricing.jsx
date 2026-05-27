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
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-cyan-700">
              <CreditCard size={15} />
              Official pricing
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">{t('pricing.title')}</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Public prices are merged from the official pricing feed and shown by model family. Route-specific marketplace prices are not displayed.
            </p>
          </div>
        </div>

        <div className="mb-6 max-w-md">
          <label className="relative block">
            <span className="sr-only">{t('pricing.searchPlaceholder')}</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              placeholder={t('pricing.searchPlaceholder')}
            />
          </label>
        </div>

        {loading ? (
          <PricingSkeleton />
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white py-12 text-center text-slate-600">
            {search ? t('pricing.noMatch') : t('pricing.noModels')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                    <th className="px-5 py-3.5 font-medium">{t('pricing.model')}</th>
                    <th className="px-5 py-3.5 font-medium">Category</th>
                    <th className="px-5 py-3.5 text-right font-medium">Official price</th>
                    <th className="px-5 py-3.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((model) => (
                    <tr key={getModelId(model)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <Link to={getModelRoute(model)} className="font-semibold text-slate-950 hover:text-cyan-700">
                          {getModelDisplayName(model)}
                        </Link>
                        <p className="mt-1 truncate font-mono text-xs text-slate-500">{getModelId(model)}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{getModelCategory(model)}</td>
                      <td className="px-5 py-4 text-right"><ModelPrice model={model} compact /></td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Link to={`/playground?model=${encodeURIComponent(getModelId(model))}`} className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                            Try
                          </Link>
                          <Link to={getModelRoute(model)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 md:hidden">
              {filtered.map((model) => (
                <div key={getModelId(model)} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={getModelRoute(model)} className="font-semibold text-slate-950 hover:text-cyan-700">
                        {getModelDisplayName(model)}
                      </Link>
                      <p className="mt-1 break-all font-mono text-xs text-slate-500">{getModelId(model)}</p>
                      <p className="mt-2 text-xs text-slate-600">{getModelCategory(model)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <ModelPrice model={model} compact />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link to={`/playground?model=${encodeURIComponent(getModelId(model))}`} className="flex-1 rounded-lg bg-slate-950 px-3 py-2 text-center text-xs font-semibold text-white">
                      Try
                    </Link>
                    <Link to={getModelRoute(model)} className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700">
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
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <tbody>
          {Array.from({ length: 8 }, (_, row) => (
            <tr key={row} className="border-b border-slate-100 last:border-0">
              <td className="px-5 py-4"><div className="h-4 w-56 animate-pulse rounded bg-slate-200" /></td>
              <td className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
              <td className="px-5 py-4"><div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-100" /></td>
              <td className="px-5 py-4"><div className="ml-auto h-4 w-28 animate-pulse rounded bg-slate-100" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
