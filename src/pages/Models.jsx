import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Boxes, ExternalLink, Search, SlidersHorizontal } from 'lucide-react';
import CopyButton from '../components/CopyButton';
import ModelBadges from '../components/ModelBadges';
import ModelPrice from '../components/ModelPrice';
import {
  CossCard,
  CossCardFrame,
  CossEmptyState,
  CossPage,
  CossPageHeader,
  CossSearchInput,
  CossSection,
  CossSelect,
  CossStat,
  CossTabs,
} from '../components/public/CossLayout';
import { getPublicModelCatalog, readPublicModelCatalog } from '../utils/publicCatalog';
import {
  filterModels,
  formatCompactNumber,
  getModelCategory,
  getModelDisplayName,
  getModelId,
  getModelRoute,
  getModelSummary,
  getSupportedModes,
  sortModels,
} from '../utils/modelMeta';

const primaryCategories = ['Chat', 'Image', 'Audio', 'Video', 'Embedding', 'Rerank'];
const sortOptions = [
  { key: 'popular', label: 'Popular' },
  { key: 'price', label: 'Lowest price' },
  { key: 'name', label: 'Name' },
];

export default function Models() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cachedCatalog = useMemo(() => readPublicModelCatalog(), []);
  const [models, setModels] = useState(() => cachedCatalog?.models || []);
  const [loading, setLoading] = useState(() => !cachedCatalog);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'popular');
  const [dataSource, setDataSource] = useState(() => cachedCatalog?.dataSource || 'public');

  useEffect(() => {
    let cancelled = false;
    if (!cachedCatalog) setLoading(true);

    getPublicModelCatalog()
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

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set('q', search);
    if (category) next.set('category', category);
    if (sort !== 'popular') next.set('sort', sort);
    setSearchParams(next, { replace: true });
  }, [search, category, sort, setSearchParams]);

  const enabledModels = useMemo(() => models.filter((model) => model.enabled !== false), [models]);
  const categories = useMemo(() => (
    Array.from(new Set([...primaryCategories, ...enabledModels.map(getModelCategory)])).filter(Boolean)
  ), [enabledModels]);
  const modeCount = useMemo(() => new Set(enabledModels.flatMap((model) => getSupportedModes(model))).size, [enabledModels]);
  const filteredModels = useMemo(() => sortModels(filterModels(enabledModels, { search, category }), sort), [enabledModels, search, category, sort]);
  const categoryTabs = useMemo(() => [
    { key: '', label: 'All' },
    ...categories.map((item) => ({ key: item, label: item })),
  ], [categories]);

  return (
    <CossPage>
      <CossPageHeader
        eyebrow="Site catalog"
        icon={Boxes}
        title="Models"
        description="Browse the models listed on this site, compare site prices, and open any model directly in the playground."
        secondary="The model list is loaded from this site's distributor catalog. Public marketplace data is only used as a fallback when the site catalog is unavailable."
        stats={(
          <>
            <CossStat label="Models" value={formatCompactNumber(enabledModels.length)} />
            <CossStat label="Categories" value={formatCompactNumber(categories.length)} />
            <CossStat label="Modes" value={formatCompactNumber(modeCount)} />
          </>
        )}
      >
        <div className="mt-5 coss-chip">
          {loading ? 'Loading catalog' : dataSource === 'site' ? 'Live site catalog' : dataSource === 'public' ? 'Live public catalog' : 'Static fallback catalog'}
        </div>
      </CossPageHeader>

      <CossSection>
        <CossCardFrame className="mb-5 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
            <CossSearchInput
              aria-label="Search models"
              icon={Search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search model or capability"
            />
            <CossSelect label="Category" value={category} onChange={setCategory}>
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </CossSelect>
            <CossSelect label="Sort" value={sort} onChange={setSort} icon={ArrowUpDown}>
              {sortOptions.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </CossSelect>
          </div>
          <div className="mt-4">
            <CossTabs items={categoryTabs} value={category} onChange={setCategory} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal size={14} />
              {filteredModels.length} of {enabledModels.length} models shown
            </span>
            <span>{category || 'All categories'} / {sortOptions.find((item) => item.key === sort)?.label || 'Popular'}</span>
          </div>
        </CossCardFrame>

        {loading ? (
          <ModelListSkeleton />
        ) : filteredModels.length === 0 ? (
          <CossEmptyState title="No matching models" text="Adjust the search, category, or sort settings to view more listed models." />
        ) : (
          <>
            <CossCardFrame className="hidden overflow-hidden lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                    <th className="px-5 py-3 font-medium">Model</th>
                    <th className="px-5 py-3 font-medium">Category</th>
                    <th className="px-5 py-3 text-right font-medium">Site price</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModels.map((model) => (
                    <tr key={getModelId(model)} className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <Link to={getModelRoute(model)} className="font-semibold text-slate-950 hover:text-slate-700">
                          {getModelDisplayName(model)}
                        </Link>
                        <div className="mt-1 flex max-w-xl items-center gap-2">
                          <code className="truncate font-mono text-xs text-slate-500">{getModelId(model)}</code>
                          <CopyButton text={getModelId(model)} label="Copy id" iconOnly className="h-7 w-7 px-0 py-0" />
                        </div>
                        <p className="mt-2 line-clamp-2 max-w-2xl text-xs leading-5 text-slate-500">
                          {getModelSummary(model)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{getModelCategory(model)}</td>
                      <td className="px-5 py-4 text-right"><ModelPrice model={model} compact /></td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Link to={`/playground?model=${encodeURIComponent(getModelId(model))}`} className="coss-button-primary min-h-9 px-3 py-2 text-xs">
                            Try <ExternalLink size={13} />
                          </Link>
                          <Link to={getModelRoute(model)} className="coss-button-secondary min-h-9 px-3 py-2 text-xs">
                            Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CossCardFrame>

            <div className="grid gap-4 lg:hidden">
              {filteredModels.map((model) => (
                <CossCard key={getModelId(model)} as="article" className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={getModelRoute(model)} className="font-semibold text-slate-950">
                        {getModelDisplayName(model)}
                      </Link>
                      <p className="mt-1 break-all font-mono text-xs text-slate-500">{getModelId(model)}</p>
                    </div>
                    <CopyButton text={getModelId(model)} iconOnly className="h-8 w-8 shrink-0 px-0 py-0" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{getModelSummary(model)}</p>
                  <div className="mt-3"><ModelBadges model={model} limit={4} /></div>
                  <div className="mt-4"><ModelPrice model={model} /></div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link to={`/playground?model=${encodeURIComponent(getModelId(model))}`} className="coss-button-primary min-h-9 px-3 py-2 text-xs">
                      Try in playground
                    </Link>
                    <Link to={getModelRoute(model)} className="coss-button-secondary min-h-9 px-3 py-2 text-xs">
                      Details
                    </Link>
                  </div>
                </CossCard>
              ))}
            </div>
          </>
        )}
      </CossSection>
    </CossPage>
  );
}

function ModelListSkeleton() {
  return (
    <>
      <CossCardFrame className="hidden overflow-hidden lg:block">
        <table className="w-full text-sm">
          <tbody>
            {Array.from({ length: 8 }, (_, index) => (
              <tr key={index} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-4"><div className="h-4 w-64 animate-pulse rounded bg-slate-200" /></td>
                <td className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                <td className="px-5 py-4"><div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-100" /></td>
                <td className="px-5 py-4"><div className="ml-auto h-4 w-28 animate-pulse rounded bg-slate-100" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CossCardFrame>
      <div className="grid gap-4 lg:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <CossCard key={index} className="p-4">
            <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="mt-5 h-10 w-full animate-pulse rounded bg-slate-100" />
          </CossCard>
        ))}
      </div>
    </>
  );
}
