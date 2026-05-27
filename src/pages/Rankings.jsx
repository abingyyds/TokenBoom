import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, BarChart3, Database, Search, Trophy } from 'lucide-react';
import ModelPrice from '../components/ModelPrice';
import {
  CossCard,
  CossCardFrame,
  CossPage,
  CossPageHeader,
  CossSearchInput,
  CossSection,
  CossSelect,
  CossTabs,
  CossTableFrame,
} from '../components/public/CossLayout';
import { getRankedModelCatalog, readRankedModelCatalog } from '../utils/publicCatalog';
import {
  formatCompactNumber,
  formatTokenUsageValue,
  getModelCategory,
  getModelDisplayName,
  getModelId,
  getModelRoute,
  getRequestCount,
  sortModels,
} from '../utils/modelMeta';

const sortOptions = [
  { key: 'popular', label: 'Popular' },
  { key: 'price', label: 'Lowest price' },
  { key: 'name', label: 'Name' },
];

export default function Rankings() {
  const cachedCatalog = useMemo(() => readRankedModelCatalog(), []);
  const [models, setModels] = useState(() => cachedCatalog?.models || []);
  const [loading, setLoading] = useState(() => !cachedCatalog);
  const [sort, setSort] = useState('popular');
  const [search, setSearch] = useState('');
  const [dataSource, setDataSource] = useState(() => cachedCatalog?.dataSource || 'public');

  useEffect(() => {
    let cancelled = false;
    if (!cachedCatalog) setLoading(true);

    getRankedModelCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setModels(catalog.models);
        setDataSource(catalog.dataSource);
      })
      .catch(() => {
        if (!cancelled) {
          setModels([]);
          setDataSource('fallback');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cachedCatalog]);

  const enabledModels = useMemo(() => models.filter((model) => model.enabled !== false), [models]);
  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = query
      ? enabledModels.filter((model) => [
        getModelDisplayName(model),
        getModelId(model),
        getModelCategory(model),
        model.description,
      ].filter(Boolean).join(' ').toLowerCase().includes(query))
      : enabledModels;
    return sortModels(base, sort).slice(0, 100);
  }, [enabledModels, search, sort]);
  const activeSortLabel = sortOptions.find((item) => item.key === sort)?.label || 'Popular';

  return (
    <CossPage>
      <CossPageHeader
        eyebrow="Model rankings"
        icon={Trophy}
        title="Rankings"
        description="Rank this site's listed models by total marketplace token usage across all providers."
        secondary="The model set comes from this site. Token and request totals come from the main marketplace ranking feed when a matching model exists."
        actions={(
          <div className="space-y-3">
            <CossSearchInput
              aria-label="Search rankings"
              icon={Search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search rankings"
            />
            <div className="coss-chip">
              <Database size={13} />
              {loading ? 'Loading rankings' : dataSource === 'site_ranked' ? 'Site models + marketplace totals' : dataSource === 'site' ? 'Live site catalog' : dataSource === 'public' ? 'Live public catalog' : 'Static fallback catalog'}
            </div>
          </div>
        )}
      />

      <CossSection>
        <CossCardFrame className="mb-5 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CossTabs items={sortOptions} value={sort} onChange={setSort} />
            <CossSelect label="Sort" value={sort} onChange={setSort} icon={ArrowUpDown} className="w-full lg:w-[220px]">
              {sortOptions.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </CossSelect>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <BarChart3 size={14} />
              {filteredModels.length} models shown
            </span>
            <span>Only models listed on this site are shown</span>
          </div>
        </CossCardFrame>

        <CossTableFrame
          title={loading ? 'Loading ranked models' : `${filteredModels.length} ranked models`}
          meta={activeSortLabel}
        >
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-left text-slate-500">
                  <th className="px-5 py-3 font-medium">#</th>
                  <th className="px-5 py-3 font-medium">Model</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 text-right font-medium">Marketplace tokens</th>
                  <th className="px-5 py-3 text-right font-medium">Marketplace requests</th>
                  <th className="px-5 py-3 text-right font-medium">Site price</th>
                </tr>
              </thead>
              {loading ? (
                <RankingSkeletonRows />
              ) : (
                <tbody>
                  {filteredModels.map((model, index) => (
                    <tr key={getModelId(model)} className="border-b border-slate-100 align-middle last:border-0 hover:bg-slate-50/80">
                      <td className="px-5 py-4 font-mono text-slate-500">{index + 1}</td>
                      <td className="px-5 py-4">
                        <Link to={getModelRoute(model)} className="font-semibold text-slate-950 hover:text-slate-700">
                          {getModelDisplayName(model)}
                        </Link>
                        <p className="mt-1 truncate font-mono text-xs text-slate-500">{getModelId(model)}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{getModelCategory(model)}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-700">{formatTokenUsageValue(model)}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-700">{formatCompactNumber(getRequestCount(model))}</td>
                      <td className="px-5 py-4 text-right"><ModelPrice model={model} compact /></td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          <div className="divide-y divide-slate-100 md:hidden">
            {loading ? (
              Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="p-4">
                  <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
                </div>
              ))
            ) : (
              filteredModels.map((model, index) => (
                <Link key={getModelId(model)} to={getModelRoute(model)} className="block p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">#{index + 1}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {getModelCategory(model)}
                        </span>
                      </div>
                      <p className="mt-2 font-semibold text-slate-950">{getModelDisplayName(model)}</p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-500">{getModelId(model)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Marketplace tokens</p>
                      <p className="mt-1 font-mono text-xs text-slate-700">{formatTokenUsageValue(model)}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{formatCompactNumber(getRequestCount(model))} requests</p>
                      <div className="mt-2"><ModelPrice model={model} compact /></div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
          {!loading && filteredModels.length === 0 && (
            <CossCard className="m-4 p-8 text-center text-sm text-slate-600">
              No ranked models match the current search.
            </CossCard>
          )}
        </CossTableFrame>
      </CossSection>
    </CossPage>
  );
}

function RankingSkeletonRows() {
  return (
    <tbody>
      {Array.from({ length: 10 }, (_, index) => (
        <tr key={index} className="border-b border-slate-100 last:border-0">
          <td className="px-5 py-4"><div className="h-4 w-6 animate-pulse rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><div className="h-4 w-56 animate-pulse rounded bg-slate-200" /></td>
          <td className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-100" /></td>
          <td className="px-5 py-4"><div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-100" /></td>
        </tr>
      ))}
    </tbody>
  );
}
