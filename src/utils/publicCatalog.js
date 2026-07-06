import { getMarketplaceModels, getPublicPricing, getSiteModels, getSitePricing } from '../api';
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
const CATALOG_FALLBACK_CACHE_TTL_MS = 15 * 1000;
const CATALOG_STALE_TTL_MS = 24 * 60 * 60 * 1000;
const CATALOG_STORAGE_PREFIX = 'public-model-catalog-cache:v3:';
const catalogCache = new Map();
const rankedCatalogCache = new Map();
const RANKED_METRICS_MODEL_LIMIT = 24;
const RANKED_METRICS_PAGE_LIMIT = 2;
const RANKED_METRICS_CONCURRENCY = 4;

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
  model?.model,
  model?.upstream_model,
  model?.canonical,
  model?.canonical_model_name,
  model?.display_name,
  model?.name,
  model?.id,
].map(normalizeModelKey).filter(Boolean);

const SITE_PRICING_FIELDS = [
  'billing_expr',
  'billing_type',
  'billing_mode',
  'is_per_call',
  'is_tiered_expr',
  'input_price',
  'prompt_price',
  'site_input_price',
  'output_price',
  'completion_price',
  'site_output_price',
  'fixed_price',
  'price',
  'call_price',
  'cache_read_price',
  'cache_read',
  'cache_read_price_5m',
  'cache_creation_price',
  'cache_write_price',
  'cache_creation',
  'cache_creation_price_5m',
  'cache_creation_price_1h',
  'price_multiplier',
  'price_currency',
];

const pickSitePricingFields = (row) => Object.fromEntries(
  SITE_PRICING_FIELDS
    .filter((field) => row?.[field] !== null && row?.[field] !== undefined && row?.[field] !== '')
    .map((field) => [field, row[field]]),
);

const buildSitePricingIndex = (pricingResponse) => {
  const index = new Map();
  extractPricingRows(pricingResponse).forEach((row) => {
    const pricing = pickSitePricingFields(row);
    if (Object.keys(pricing).length === 0) return;
    modelKeyCandidates(row).forEach((key) => {
      if (!index.has(key)) index.set(key, pricing);
    });
  });
  return index;
};

const mergeMissingSitePricing = (model, pricing = {}) => {
  const merged = { ...model };
  Object.entries(pricing).forEach(([field, value]) => {
    if (merged[field] === null || merged[field] === undefined || merged[field] === '') {
      merged[field] = value;
    }
  });
  return merged;
};

const normalizeSiteCatalog = (catalogResponse, pricingResponse) => {
  const pricingIndex = buildSitePricingIndex(pricingResponse);
  return sortModels(
    extractCollection(catalogResponse, ['models'])
      .filter((model) => model && model.enabled !== false && getModelId(model))
      .map((model, index) => {
        const pricing = modelKeyCandidates(model).map((key) => pricingIndex.get(key)).find(Boolean);
        const pricedModel = mergeMissingSitePricing(model, pricing);
        return {
          ...pricedModel,
          id: pricedModel.id || pricedModel.model_name || pricedModel.name || pricedModel.display_name,
          enabled: pricedModel.enabled !== false,
          public_rank: pricedModel.public_rank ?? pricedModel.rank ?? pricedModel.sort_order ?? pricedModel.position ?? pricedModel.order ?? index,
          data_source: 'site',
        };
      }),
    'popular',
  );
};

const readModelsFrom = (catalogResponse, pricingResponse, dataSource) => {
  const models = normalizeCatalog(catalogResponse, pricingResponse);
  if (models.length === 0) return null;
  return { models, dataSource };
};

const readSiteModelsFrom = (catalogResponse, pricingResponse) => {
  const models = normalizeSiteCatalog(catalogResponse, pricingResponse);
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

  for (let page = 1; page <= RANKED_METRICS_PAGE_LIMIT; page += 1) {
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
  const entries = [];
  const models = siteModels.slice(0, RANKED_METRICS_MODEL_LIMIT);

  for (let index = 0; index < models.length; index += RANKED_METRICS_CONCURRENCY) {
    const batch = models.slice(index, index + RANKED_METRICS_CONCURRENCY);
    const batchEntries = await Promise.all(batch.map(async (siteModel) => {
      const rows = await fetchMarketplaceRowsForSiteModel(siteModel, query);
      return [getModelId(siteModel), summarizeMarketplaceRows(rows, siteModel)];
    }));
    entries.push(...batchEntries);
  }

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

const storageKeyFor = (query) => `${CATALOG_STORAGE_PREFIX}${cacheKeyFor(query)}`;

const readStoredCatalog = (query) => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(storageKeyFor(query)) || 'null');
    if (!cached?.result || !cached.cachedAt || Date.now() - cached.cachedAt > CATALOG_STALE_TTL_MS) return null;
    if (cached.result.dataSource === 'fallback') return null;
    return cached.result;
  } catch {
    return null;
  }
};

const writeStoredCatalog = (query, result) => {
  if (typeof window === 'undefined' || !result?.models?.length || result.dataSource === 'fallback') return;
  try {
    window.localStorage.setItem(storageKeyFor(query), JSON.stringify({
      result,
      cachedAt: Date.now(),
    }));
  } catch {
    // Storage pressure should not break catalog loading.
  }
};

const FALLBACK_MODELS = [
  { id: 'gpt-4o-mini', model_name: 'gpt-4o-mini', display_name: 'GPT-4o Mini', category: 'Chat', enabled: true, data_source: 'fallback' },
  { id: 'claude-sonnet-4-5', model_name: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5', category: 'Chat', enabled: true, data_source: 'fallback' },
  { id: 'gemini-2.5-pro', model_name: 'gemini-2.5-pro', display_name: 'Gemini 2.5 Pro', category: 'Multimodal', enabled: true, data_source: 'fallback' },
  { id: 'deepseek-chat', model_name: 'deepseek-chat', display_name: 'DeepSeek Chat', category: 'Chat', enabled: true, data_source: 'fallback' },
  { id: 'qwen-max', model_name: 'qwen-max', display_name: 'Qwen Max', category: 'Chat', enabled: true, data_source: 'fallback' },
  { id: 'grok-4', model_name: 'grok-4', display_name: 'Grok 4', category: 'Chat', enabled: true, data_source: 'fallback' },
  { id: 'claude-haiku-4-5', model_name: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5', category: 'Chat', enabled: true, data_source: 'fallback' },
  { id: 'gpt-5-mini', model_name: 'gpt-5-mini', display_name: 'GPT-5 Mini', category: 'Chat', enabled: true, data_source: 'fallback' },
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
  const sitePricingPromise = getSitePricing().catch(() => null);

  try {
    const catalogResponse = await getSiteModels();
    const siteCatalog = readSiteModelsFrom(catalogResponse, await sitePricingPromise);
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

  return readStoredCatalog(query) || fallbackCatalog;
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
      const ttl = result.dataSource === 'fallback' ? CATALOG_FALLBACK_CACHE_TTL_MS : CATALOG_CACHE_TTL_MS;
      catalogCache.set(key, {
        result,
        expiresAt: Date.now() + ttl,
      });
      writeStoredCatalog(query, result);
      return result;
    })
    .catch((error) => {
      catalogCache.delete(key);
      throw error;
    });

  catalogCache.set(key, { promise });
  return promise;
};

export const readPublicModelCatalog = (query = PUBLIC_CATALOG_QUERY) => readCatalogCache(query) || readStoredCatalog(query) || fallbackCatalog;

export const getRankedModelCatalog = async (query = PUBLIC_CATALOG_QUERY) => {
  const key = `ranked:${cacheKeyFor(query)}`;
  const cached = rankedCatalogCache.get(key);
  if (cached?.result && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  if (cached?.promise) return cached.promise;

  const promise = Promise.all([
    getSiteModels(),
    getSitePricing().catch(() => null),
  ])
    .then(async ([siteResponse, sitePricingResponse]) => {
      const siteCatalog = readSiteModelsFrom(siteResponse, sitePricingResponse);
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
