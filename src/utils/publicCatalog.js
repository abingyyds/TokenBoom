import { getMarketplaceModels, getPublicPricing, getSiteModels } from '../api';
import { PUBLIC_API_BASE_URL } from '../constants/api';
import {
  extractCollection,
  extractPricingRows,
  getModelId,
  mergePublicModelCatalog,
  PUBLIC_MODEL_FIELDS,
  sortModels,
} from './modelMeta';

export const SUBROUTER_API_BASE_URL = PUBLIC_API_BASE_URL;

export const PUBLIC_CATALOG_QUERY = Object.freeze({
  sort: 'popular',
  page: 1,
  page_size: 200,
  fields: PUBLIC_MODEL_FIELDS,
});

export const DOCS_CATALOG_FIELDS = [
  'id',
  'name',
  'model_name',
  'display_name',
  'upstream_model',
  'canonical',
  'canonical_model_name',
  'description',
  'summary',
  'category',
  'type',
  'modality',
  'mode',
  'modalities',
  'capabilities',
  'input_modalities',
  'output_modalities',
  'tags',
  'enabled',
  'public_rank',
  'rank',
  'sort_order',
  'position',
  'order',
].join(',');

export const DOCS_CATALOG_QUERY = Object.freeze({
  sort: 'popular',
  page: 1,
  page_size: 40,
  fields: DOCS_CATALOG_FIELDS,
});

const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
const catalogCache = new Map();
const rankedCatalogCache = new Map();

const stableCacheKey = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableCacheKey).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${key}:${stableCacheKey(value[key])}`).join(',')}}`;
  }
  return String(value);
};

const normalizeCatalog = (catalogResponse, pricingResponse) =>
  sortModels(
    mergePublicModelCatalog(
      extractCollection(catalogResponse, ['models']),
      extractPricingRows(pricingResponse),
    ).filter((model) => model.enabled !== false && getModelId(model)),
    'popular',
  );

const normalizeModelKey = (value) => String(value || '').trim().toLowerCase();

const modelKeyCandidates = (model) => [
  model?.model_name,
  model?.upstream_model,
  model?.canonical,
  model?.canonical_model_name,
  model?.display_name,
  model?.name,
].map(normalizeModelKey).filter(Boolean);

const normalizeSiteCatalog = (catalogResponse) =>
  sortModels(
    extractCollection(catalogResponse, ['models'])
      .filter((model) => model && model.enabled !== false && getModelId(model))
      .map((model, index) => ({
        ...model,
        id: model.id || model.model_name || model.name || model.display_name,
        enabled: model.enabled !== false,
        public_rank: model.public_rank ?? model.rank ?? model.sort_order ?? model.position ?? model.order ?? index,
        data_source: 'site',
      })),
    'popular',
  );

const readModelsFrom = (catalogResponse, pricingResponse, dataSource) => {
  const models = normalizeCatalog(catalogResponse, pricingResponse);
  if (models.length === 0) return null;
  return { models, dataSource };
};

const readSiteModelsFrom = (catalogResponse) => {
  const models = normalizeSiteCatalog(catalogResponse);
  if (models.length === 0) return null;
  return { models, dataSource: 'site' };
};

const isSameModelName = (row, siteModel) => {
  const siteKeys = new Set(modelKeyCandidates(siteModel));
  return modelKeyCandidates(row).some((key) => siteKeys.has(key));
};

const summarizeMarketplaceRows = (rows = [], siteModel) => {
  const matchedRows = rows.filter((row) => isSameModelName(row, siteModel));
  if (matchedRows.length === 0) return null;

  return matchedRows.reduce((summary, row, rowIndex) => {
    const totalTokens = Number(row?.total_tokens ?? row?.token_usage ?? row?.tokens_used ?? 0) || 0;
    const totalRequests = Number(row?.total_requests ?? row?.request_count ?? row?.requests ?? 0) || 0;
    const rank = Number(row?.public_rank ?? row?.rank ?? rowIndex + 1) || rowIndex + 1;

    summary.total_tokens += totalTokens;
    summary.total_requests += totalRequests;
    summary.marketplace_provider_count += 1;
    summary.marketplace_rank = Math.min(summary.marketplace_rank, rank);
    if (!summary.best_marketplace_model || totalTokens > (Number(summary.best_marketplace_model?.total_tokens) || 0)) {
      summary.best_marketplace_model = row;
    }
    return summary;
  }, {
    total_tokens: 0,
    total_requests: 0,
    marketplace_provider_count: 0,
    marketplace_rank: Number.POSITIVE_INFINITY,
    best_marketplace_model: null,
  });
};

const fetchMarketplaceRowsForSiteModel = async (siteModel, query) => {
  const keyword = getModelId(siteModel);
  const pageSize = 200;
  const rows = [];

  for (let page = 1; page <= 10; page += 1) {
    const response = await getMarketplaceModels({
      ...query,
      keyword,
      page,
      page_size: pageSize,
    }).catch(() => null);
    const pageRows = response ? extractCollection(response, ['models']) : [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }

  return rows;
};

const fetchMarketplaceMetricsForSiteModels = async (siteModels, query) => {
  const requests = siteModels.map(async (siteModel) => {
    const rows = await fetchMarketplaceRowsForSiteModel(siteModel, query);
    return [getModelId(siteModel), summarizeMarketplaceRows(rows, siteModel)];
  });
  const entries = await Promise.all(requests);
  return new Map(entries.filter(([, metrics]) => metrics));
};

const mergeSiteModelsWithMetricsMap = (siteModels, metricsMap) =>
  sortModels(siteModels.map((model, index) => {
    const metrics = metricsMap.get(getModelId(model));
    if (!metrics) {
      return {
        ...model,
        data_source: 'site_ranked',
        public_rank: model.public_rank ?? index + 100000,
      };
    }

    return {
      ...model,
      data_source: 'site_ranked',
      total_tokens: metrics.total_tokens,
      token_usage: metrics.total_tokens,
      total_requests: metrics.total_requests,
      request_count: metrics.total_requests,
      usage_count: metrics.total_requests,
      public_rank: metrics.marketplace_rank,
      marketplace_provider_count: metrics.marketplace_provider_count,
      marketplace_model_name: metrics.best_marketplace_model?.model_name || metrics.best_marketplace_model?.upstream_model || '',
      marketplace_probe_score: metrics.best_marketplace_model?.probe_score,
      marketplace_rating: metrics.best_marketplace_model?.rating,
    };
  }), 'popular');

const cacheKeyFor = (query) => stableCacheKey(query);

const FALLBACK_MODELS = [
  { id: 'gpt-4o-mini', model_name: 'gpt-4o-mini', display_name: 'GPT-4o Mini', category: 'Chat', enabled: true },
  { id: 'claude-sonnet-4-5', model_name: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5', category: 'Chat', enabled: true },
  { id: 'gemini-2.5-pro', model_name: 'gemini-2.5-pro', display_name: 'Gemini 2.5 Pro', category: 'Multimodal', enabled: true },
  { id: 'deepseek-chat', model_name: 'deepseek-chat', display_name: 'DeepSeek Chat', category: 'Chat', enabled: true },
  { id: 'qwen-max', model_name: 'qwen-max', display_name: 'Qwen Max', category: 'Chat', enabled: true },
  { id: 'grok-4', model_name: 'grok-4', display_name: 'Grok 4', category: 'Chat', enabled: true },
  { id: 'claude-haiku-4-5', model_name: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5', category: 'Chat', enabled: true },
  { id: 'gpt-5-mini', model_name: 'gpt-5-mini', display_name: 'GPT-5 Mini', category: 'Chat', enabled: true },
];

export const fallbackCatalog = {
  models: FALLBACK_MODELS,
  dataSource: 'fallback',
};

const readCatalogCache = (query) => {
  const cached = catalogCache.get(cacheKeyFor(query));
  if (!cached?.result || cached.expiresAt <= Date.now()) return null;
  return cached.result;
};

const fetchCatalog = async (query) => {
  const publicPricingPromise = getPublicPricing().catch(() => null);

  try {
    const catalogResponse = await getSiteModels();
    const siteCatalog = readSiteModelsFrom(catalogResponse);
    if (siteCatalog) return siteCatalog;
  } catch (siteError) {
    // Fall through to the public marketplace catalog.
  }

  try {
    const catalogResponse = await getMarketplaceModels(query);
    const marketplaceCatalog = readModelsFrom(catalogResponse, await publicPricingPromise, 'public');
    if (marketplaceCatalog) return marketplaceCatalog;
  } catch (marketplaceError) {
    // Fall through to static fallback models.
  }

  return fallbackCatalog;
};

export const getPublicModelCatalog = (query = PUBLIC_CATALOG_QUERY) => {
  const key = cacheKeyFor(query);
  const cached = catalogCache.get(key);
  if (cached?.result && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.result);
  }
  if (cached?.promise) {
    return cached.promise;
  }

  const promise = fetchCatalog(query)
    .then((result) => {
      catalogCache.set(key, {
        result,
        expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
      });
      return result;
    })
    .catch((error) => {
      catalogCache.delete(key);
      throw error;
    });

  catalogCache.set(key, { promise });
  return promise;
};

export const readPublicModelCatalog = (query = PUBLIC_CATALOG_QUERY) => readCatalogCache(query) || fallbackCatalog;

export const getRankedModelCatalog = async (query = PUBLIC_CATALOG_QUERY) => {
  const key = `ranked:${cacheKeyFor(query)}`;
  const cached = rankedCatalogCache.get(key);
  if (cached?.result && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  if (cached?.promise) return cached.promise;

  const promise = Promise.all([
    getSiteModels(),
  ])
    .then(async ([siteResponse]) => {
      const siteCatalog = readSiteModelsFrom(siteResponse);
      if (!siteCatalog) return fallbackCatalog;
      const metricsMap = await fetchMarketplaceMetricsForSiteModels(siteCatalog.models, query);
      const result = {
        models: mergeSiteModelsWithMetricsMap(siteCatalog.models, metricsMap),
        dataSource: 'site_ranked',
      };
      rankedCatalogCache.set(key, {
        result,
        expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
      });
      return result;
    })
    .catch(async () => {
      const siteCatalog = await getPublicModelCatalog(query).catch(() => fallbackCatalog);
      return {
        ...siteCatalog,
        dataSource: siteCatalog.dataSource === 'site' ? 'site' : siteCatalog.dataSource,
      };
    });

  rankedCatalogCache.set(key, { promise });
  return promise;
};

export const readRankedModelCatalog = (query = PUBLIC_CATALOG_QUERY) => {
  const cached = rankedCatalogCache.get(`ranked:${cacheKeyFor(query)}`);
  if (!cached?.result || cached.expiresAt <= Date.now()) return null;
  return cached.result;
};

export const getDocsModelCatalog = () => getPublicModelCatalog(DOCS_CATALOG_QUERY);

export const readDocsModelCatalog = () => readPublicModelCatalog(DOCS_CATALOG_QUERY);
