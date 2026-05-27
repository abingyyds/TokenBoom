import { PUBLIC_API_BASE_URL } from '../constants/api';

const REQUEST_FIELDS = ['call_count', 'calls', 'request_count', 'requests', 'total_requests', 'usage_count'];
const TOKEN_FIELDS = ['token_usage', 'total_tokens', 'tokens_used', 'usage_tokens', 'billable_tokens', 'used_tokens'];
const RATING_FIELDS = ['rating', 'quality_score', 'user_rating', 'stars'];
const PRICE_FIELDS = [
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
];
const VIDEO_PRICE_PARAM_NAMES = new Set([
  'size',
  'resolution',
  'ratio',
  'width',
  'height',
  'seconds',
  'duration',
  'duration_seconds',
]);
const NUMBER_PATTERN = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?';
const vendorNameField = ['vendor', 'name'].join('_');
const providerNameField = ['provider', 'name'].join('_');
const providerSlugField = ['provider', 'slug'].join('_');
const channelNameField = ['channel', 'name'].join('_');

const normalizeText = (value) => String(value ?? '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const uniqueText = (values) => {
  const seen = new Set();
  return values
    .map(normalizeText)
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
  });
};

const primaryModeOrder = ['chat', 'image', 'video', 'audio'];
const textLikeCategories = ['Chat', 'Reasoning', 'Coding', 'Embedding', 'Rerank'];
const internalPromoTerms = [
  '\u53f7\u6c60',
  '\u9ad8\u53ef\u7528\u5206\u7ec4',
  '\u6df7\u5408\u53f7\u6c60',
  '\u5206\u7ec4',
  '\u5907\u7528',
  ['codex', 'plus'].join(''),
];
const internalPromoPattern = new RegExp(`${internalPromoTerms.join('|')}|@\\w|merchant|route|routing|\\b(provider|vendor|channel)\\b`, 'i');
const internalPromoStripPattern = new RegExp(`(?:${internalPromoTerms.join('|')}|merchant|route|routing|\\bprovider\\b|\\bvendor\\b|\\bchannel\\b).*$`, 'i');
const categorySummaries = {
  Chat: 'General-purpose chat model for text generation, assistants, and conversation.',
  Reasoning: 'Reasoning-focused model for complex analysis, planning, and multi-step tasks.',
  Coding: 'Coding model for software development, debugging, and code explanation.',
  Image: 'Image-capable model for visual understanding or generation workflows.',
  Video: 'Video-capable model for generation or analysis workflows.',
  Audio: 'Audio-capable model for speech, transcription, and voice workflows.',
  Embedding: 'Embedding model for search, retrieval, and semantic matching.',
  Rerank: 'Rerank model for improving retrieval result ordering.',
};

const categoryIntros = {
  Chat: 'A general-purpose language model for conversational assistants, drafting, summarization, and structured text generation. Use it when you need flexible natural-language output from a standard chat-completions request.',
  Reasoning: 'A reasoning-oriented language model for harder prompts that benefit from analysis, planning, and careful instruction following. It is a good fit for complex question answering, evaluation, and agentic workflows.',
  Coding: 'A coding-focused language model for software development tasks such as implementation help, refactoring, debugging, test generation, and code explanation.',
  Image: 'An image-capable model for visual workflows. Depending on the selected endpoint and model support, it can help with image understanding, prompt-based image creation, or design asset iteration.',
  Video: 'A video-capable model for generation or analysis workflows. Use it for prompts that involve motion, scenes, storyboards, or other video-first outputs.',
  Audio: 'An audio-capable model for speech and voice workflows such as transcription, text-to-speech, spoken dialogue, or audio understanding.',
  Embedding: 'An embedding model that converts text into vectors for semantic search, retrieval, clustering, recommendation, and similarity matching.',
  Rerank: 'A rerank model that scores candidate documents or passages so retrieval systems can return the most relevant results first.',
};

const modelFamilySummaries = {
  openai: 'GPT-family model for chat, coding help, instruction following, and structured generation.',
  claude: 'Claude-family assistant model for writing, analysis, coding help, and careful instruction following.',
  gemini: 'Gemini-family multimodal model for reasoning, coding, writing, and tasks that combine text with visual context.',
  deepseek: 'DeepSeek-family model for analytical chat, coding assistance, and reasoning-heavy prompts.',
  qwen: 'Qwen-family model for multilingual chat, coding assistance, and structured reasoning.',
};

const modelFamilyIntros = {
  openai: 'A GPT-family model suited to general assistant experiences, coding help, summarization, extraction, and structured response generation. It works well for applications that need predictable chat-completions behavior across a broad range of tasks.',
  claude: 'A Claude-family model designed for high-quality writing, analysis, coding support, and nuanced instruction following. It is useful for document-heavy tasks, careful transformations, and assistant workflows that need clear responses.',
  gemini: 'A Gemini-family model for broad multimodal and language tasks, including reasoning, coding, writing, and visual-context prompts when supported by the selected model.',
  deepseek: 'A DeepSeek-family model focused on practical chat, coding, and reasoning workloads. It is a good option for technical assistance, analytical prompts, and cost-conscious production use.',
  qwen: 'A Qwen-family model with strong multilingual coverage for chat, coding, structured extraction, and reasoning workflows across general-purpose applications.',
};

const isInternalPromoText = (value) => internalPromoPattern.test(normalizeText(value));

const stripInternalNameText = (value) => normalizeText(value)
  .replace(/@[\w.-]+/g, '')
  .replace(internalPromoStripPattern, '')
  .replace(/\s+/g, ' ')
  .trim();

const pickPublicName = (values) => {
  for (const value of values) {
    const cleaned = stripInternalNameText(value);
    if (cleaned && !isInternalPromoText(cleaned)) return cleaned;
  }
  return '';
};

const routeLeaf = (value) => {
  const text = stripInternalNameText(value);
  if (!text.includes('/')) return '';
  return normalizeText(text.split('/').filter(Boolean).pop());
};

const getModelFamily = (model) => {
  const haystack = normalizeLower([
    model?.upstream_model,
    model?.canonical,
    model?.canonical_model_name,
    model?.model_name,
    model?.id,
    stripInternalNameText(model?.display_name),
    stripInternalNameText(model?.name),
  ].filter(Boolean).join(' '));

  if (/\b(gpt|chatgpt|openai|codex)\b|(^|[^a-z0-9])o[1345]([^a-z0-9]|$)/.test(haystack)) return 'openai';
  if (/\b(claude|anthropic|sonnet|haiku|opus)\b/.test(haystack)) return 'claude';
  if (/\b(gemini|gemma|google)\b/.test(haystack)) return 'gemini';
  if (/\b(deepseek|deepseek-chat|deepseek-reasoner|deepseek-r1)\b/.test(haystack)) return 'deepseek';
  if (/\b(qwen|qwq|qvq|tongyi)\b/.test(haystack)) return 'qwen';
  return 'generic';
};

const getGeneratedModelText = (model, intro = false) => {
  const category = getModelCategory(model);
  if (['Image', 'Video', 'Audio', 'Embedding', 'Rerank'].includes(category)) {
    return intro
      ? categoryIntros[category]
      : categorySummaries[category];
  }

  const family = getModelFamily(model);
  if (intro && modelFamilyIntros[family]) return modelFamilyIntros[family];
  if (!intro && modelFamilySummaries[family]) return modelFamilySummaries[family];

  return intro
    ? categoryIntros[category] || categoryIntros.Chat
    : categorySummaries[category] || categorySummaries.Chat;
};

export const PUBLIC_MODEL_FIELDS = [
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
  'billing_expr',
  'billing_type',
  'billing_mode',
  'is_per_call',
  'is_tiered_expr',
  'fixed_price',
  'price_multiplier',
  'price_currency',
  'supported_endpoint_types',
  'context_length',
  'context_window',
  'max_context_tokens',
  'max_context',
  'max_tokens',
  'max_input_tokens',
  'enabled',
  'public_rank',
  'rank',
  'sort_order',
  'position',
  'order',
  ...REQUEST_FIELDS,
  ...TOKEN_FIELDS,
].join(',');

export const asNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const firstNumber = (item, fields) => {
  for (const field of fields) {
    const value = asNumber(item?.[field]);
    if (value !== null) return value;
  }
  return null;
};

export const extractResponseData = (response) => {
  const payload = response?.data ?? response;
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data;
  return payload;
};

export const extractCollection = (response, preferredKeys = []) => {
  const data = extractResponseData(response);
  if (Array.isArray(data)) return data;

  const keys = [
    ...preferredKeys,
    'models',
    'providers',
    'items',
    'results',
    'records',
    'list',
    'rows',
    'data',
  ];

  for (const key of keys) {
    const value = data?.[key];
    if (Array.isArray(value)) return value;
  }

  return [];
};

export const extractPricingRows = (response) => {
  const data = extractResponseData(response);
  const rows = extractCollection(response, ['pricing', 'prices', 'models']);
  if (rows.length > 0) return rows;

  const pricingMap = data?.pricing || data?.prices || data?.models || data;
  if (!pricingMap || Array.isArray(pricingMap) || typeof pricingMap !== 'object') return [];

  return Object.entries(pricingMap)
    .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
    .map(([modelName, value]) => ({
      model_name: value.model_name || value.model || value.name || modelName,
      ...value,
    }));
};

export const hasAnyField = (items, fields) =>
  items.some((item) => fields.some((field) => item?.[field] !== null && item?.[field] !== undefined && item?.[field] !== ''));

export const getChannels = (model) => (Array.isArray(model?.channels) ? model.channels : []);

export const getInputPrice = (item) => firstNumber(item, ['input_price', 'prompt_price', 'site_input_price', 'input']);

export const getOutputPrice = (item) => firstNumber(item, ['output_price', 'completion_price', 'site_output_price', 'output']);

export const getFixedPrice = (item) => firstNumber(item, ['fixed_price', 'price', 'call_price']);

export const getCacheReadPrice = (item) => firstNumber(item, ['cache_read_price', 'cache_read', 'cache_read_price_5m']);

export const getCacheCreationPrice = (item) => firstNumber(item, ['cache_creation_price', 'cache_write_price', 'cache_creation', 'cache_creation_price_5m']);

function splitTopLevelMultiply(expr = '') {
  const parts = [];
  let start = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < expr.length; i += 1) {
    const char = expr[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (char === '*' && depth === 0) {
      parts.push(expr.slice(start, i).trim());
      start = i + 1;
    }
  }

  parts.push(expr.slice(start).trim());
  return parts.filter(Boolean);
}

function stripExprVersion(expr = '') {
  const match = String(expr).match(/^v\d+:([\s\S]*)$/);
  return match ? match[1] : String(expr || '');
}

function unwrapParens(expr = '') {
  let current = String(expr).trim();
  while (current.startsWith('(') && current.endsWith(')')) {
    let depth = 0;
    let valid = true;

    for (let i = 0; i < current.length; i += 1) {
      if (current[i] === '(') depth += 1;
      if (current[i] === ')') depth -= 1;
      if (depth === 0 && i < current.length - 1) {
        valid = false;
        break;
      }
    }

    if (!valid) break;
    current = current.slice(1, -1).trim();
  }
  return current;
}

function getTierBody(expr = '') {
  const body = stripExprVersion(expr).trim();
  const match = body.match(/^tier\("[^"]*",\s*([\s\S]+)\)$/);
  return match ? match[1] : '';
}

function deriveTieredPriceLabel(context, index) {
  const quoted = [...String(context).matchAll(/"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => value && !VIDEO_PRICE_PARAM_NAMES.has(value));
  const preferred = quoted
    .slice()
    .reverse()
    .find((value) => /^\d{2,5}[x*]\d{2,5}$/i.test(value) || /^\d{3,4}p$/i.test(value));
  if (preferred) return preferred.replace('*', 'x');

  const sizeMatch = String(context).match(/param\("width"\)\s*==\s*(\d{2,5})\s*&&\s*param\("height"\)\s*==\s*(\d{2,5})/);
  if (sizeMatch) return `${sizeMatch[1]}x${sizeMatch[2]}`;

  return `tier ${index + 1}`;
}

export const parseTieredSecondPricing = (expr = '') => {
  const tierBody = getTierBody(expr);
  if (!tierBody) return [];

  const parts = splitTopLevelMultiply(tierBody);
  const millionIndex = parts.findIndex((part) => /^1000000(?:\.0+)?$/.test(part));
  if (millionIndex <= 0) return [];

  const priceExpr = unwrapParens(parts[millionIndex - 1]);
  if (!priceExpr) return [];

  const rows = [];
  const priceRe = new RegExp(`\\?\\s*(${NUMBER_PATTERN})\\s*:`, 'g');
  let match;
  while ((match = priceRe.exec(priceExpr)) !== null) {
    const price = Number(match[1]);
    if (!Number.isFinite(price) || price <= 0) continue;
    rows.push({
      label: deriveTieredPriceLabel(priceExpr.slice(Math.max(0, match.index - 260), match.index), rows.length),
      price,
    });
  }

  const fallbackMatch = priceExpr.match(new RegExp(`:\\s*(${NUMBER_PATTERN})\\s*\\)*$`));
  const fallback = fallbackMatch ? Number(fallbackMatch[1]) : Number(priceExpr);
  if (Number.isFinite(fallback) && fallback > 0) {
    const hasSame = rows.some((row) => Math.abs(row.price - fallback) < 1e-12);
    if (!hasSame || rows.length === 0) {
      rows.push({ label: rows.length === 0 ? 'video' : 'default', price: fallback });
    }
  }

  return rows;
};

export const isTieredExprModel = (model) =>
  Boolean(
    model?.is_tiered_expr ||
    String(model?.billing_type || '').toLowerCase() === 'tiered_expr' ||
    String(model?.billing_mode || '').toLowerCase() === 'tiered_expr' ||
    parseTieredSecondPricing(model?.billing_expr).length > 0
  );

export const hasSitePricing = (model) =>
  getInputPrice(model) !== null ||
  getOutputPrice(model) !== null ||
  getFixedPrice(model) !== null ||
  isTieredExprModel(model);

export const getSitePriceValue = (model) => {
  const tieredRows = parseTieredSecondPricing(model?.billing_expr);
  if (isTieredExprModel(model) && tieredRows.length > 0) {
    const rawMultiplier = firstNumber(model, ['price_multiplier']);
    const multiplier = rawMultiplier && rawMultiplier > 0 ? rawMultiplier : 1;
    return Math.min(...tieredRows.map((row) => row.price * multiplier));
  }

  const input = getInputPrice(model);
  const output = getOutputPrice(model);
  const fixed = getFixedPrice(model);
  if (model?.billing_type === 'per_call' || model?.is_per_call || (fixed !== null && input === null && output === null)) {
    return fixed;
  }
  return input ?? output ?? fixed;
};

export const getOfficialPricing = (model) => {
  const pricing = model?.officialPricing || model?.official_pricing || model?.pricing;
  if (!pricing || typeof pricing !== 'object') return null;
  if (pricing.type === 'per_call' && asNumber(pricing.modelPrice) !== null) return pricing;
  if (
    pricing.type === 'token' &&
    (
      asNumber(pricing.inputPrice) !== null ||
      asNumber(pricing.outputPrice) !== null ||
      asNumber(pricing.inputRatio) !== null ||
      asNumber(pricing.outputRatio) !== null
    )
  ) {
    return pricing;
  }
  return null;
};

const getOfficialPriceValue = (model) => {
  const pricing = getOfficialPricing(model);
  if (!pricing) return Number.POSITIVE_INFINITY;
  if (pricing.type === 'per_call') return asNumber(pricing.modelPrice) ?? Number.POSITIVE_INFINITY;
  return asNumber(pricing.inputPrice) ?? asNumber(pricing.outputPrice) ?? asNumber(pricing.inputRatio) ?? asNumber(pricing.outputRatio) ?? Number.POSITIVE_INFINITY;
};

export const formatOfficialNumber = (value) => {
  const number = asNumber(value);
  if (number === null) return '-';
  const abs = Math.abs(number);
  const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : abs >= 0.0001 ? 6 : 8;
  return number.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
};

export const formatOfficialRatio = (value) => {
  const formatted = formatOfficialNumber(value);
  return formatted === '-' ? '-' : `${formatted}x`;
};

export const formatOfficialUsd = (value) => {
  const formatted = formatOfficialNumber(value);
  return formatted === '-' ? '-' : `$${formatted}`;
};

export const formatOfficialTokenPrice = (value) => formatOfficialUsd(value);

export const formatOfficialTokenPair = (inputPrice, outputPrice) => {
  const input = formatOfficialTokenPrice(inputPrice);
  const output = formatOfficialTokenPrice(outputPrice);
  if (input === '-' && output === '-') return '-';
  if (input === '-') return `${output} out`;
  if (output === '-') return `${input} in`;
  return `${input} in / ${output} out`;
};

export const formatOfficialPerCall = (value) => {
  const formatted = formatOfficialUsd(value);
  return formatted === '-' ? '-' : `${formatted} / call`;
};

export const getModelId = (model) =>
  normalizeText(model?.model_name || model?.id || model?.name || model?.display_name || 'model');

export const getEncodedModelId = (modelOrId) => encodeURIComponent(
  typeof modelOrId === 'string' ? modelOrId : getModelId(modelOrId),
);

export const getModelDisplayName = (model) =>
  pickPublicName([
    model?.display_name,
    model?.name,
    model?.upstream_model,
    model?.canonical,
    model?.canonical_model_name,
    routeLeaf(model?.model_name),
    model?.model_name,
  ]) || stripInternalNameText(model?.model_name) || `Model ${model?.id || ''}`.trim();

export const getModelRoute = (model) => `/models/${encodeURIComponent(getModelId(model))}`;

export const getProviderFields = (model) => uniqueText([
  model?.[vendorNameField],
  model?.vendor,
  model?.[providerNameField],
  model?.provider,
  model?.[providerSlugField],
  model?.[channelNameField],
  ...getChannels(model).flatMap((channel) => [
    channel?.[providerNameField],
    channel?.[providerSlugField],
    channel?.[channelNameField],
  ]),
]);

export const getProviderName = (model) => {
  const fields = getProviderFields(model);
  return fields[0] || 'Multi-provider';
};

export const getProviderSlug = (name) =>
  String(name || 'provider').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const isPerCallModel = (model) =>
  Boolean(
    getOfficialPricing(model)?.type === 'per_call' ||
    model?.is_per_call ||
    model?.billing_type === 'per_call' ||
    (getFixedPrice(model) !== null && getInputPrice(model) === null && getOutputPrice(model) === null)
  );

export const getModelCategory = (model) => {
  const explicit = model?.category || model?.type || model?.vendor_category || model?.modality || model?.mode;
  const explicitText = normalizeLower(explicit);

  if (/video|text-to-video|image-to-video|i2v|t2v/.test(explicitText)) return 'Video';
  if (/audio|speech|voice|tts|transcription|whisper/.test(explicitText)) return 'Audio';
  if (/image|vision|text-to-image|dall-e|flux|stable|sdxl|midjourney/.test(explicitText)) return 'Image';
  if (/embed|embedding/.test(explicitText)) return 'Embedding';
  if (/rerank|re-rank/.test(explicitText)) return 'Rerank';
  if (/reason|thinking/.test(explicitText)) return 'Reasoning';
  if (/code|coder/.test(explicitText)) return 'Coding';
  if (/chat|text|llm|language|completion/.test(explicitText)) return 'Chat';
  if (explicit) return String(explicit);

  const endpoints = (Array.isArray(model?.supported_endpoint_types) ? model.supported_endpoint_types : []).join(' ').toLowerCase();
  if (/openai-video|video/.test(endpoints)) return 'Video';
  if (/image-generation|image/.test(endpoints)) return 'Image';
  if (/embeddings|embedding/.test(endpoints)) return 'Embedding';
  if (/rerank|re-rank/.test(endpoints)) return 'Rerank';

  const name = `${model?.model_name || ''} ${model?.display_name || ''}`.toLowerCase();
  if (isTieredExprModel(model) || /video|text-to-video|image-to-video|i2v|t2v|seedance|kling|runway|hailuo|luma|sora|veo|jimeng/.test(name)) return 'Video';
  if (/audio|tts|whisper|speech|voice|transcription/.test(name)) return 'Audio';
  if (/embed|embedding|text-embedding/.test(name)) return 'Embedding';
  if (/rerank|re-rank/.test(name)) return 'Rerank';
  if (/image|vision|dall-e|midjourney|mj-|flux|stable|sdxl/.test(name)) return 'Image';
  if (/reason|thinking|o1|o3|o4|grok|r1/.test(name)) return 'Reasoning';
  if (/code|coder|codex|devstral/.test(name)) return 'Coding';
  return 'Chat';
};

export const getModelSummary = (model) => {
  return getGeneratedModelText(model, false);
};

export const getModelIntro = (model) => {
  return getGeneratedModelText(model, true);
};

export const getAvailability = (model) => {
  if (model?.enabled === false) {
    return { label: 'Disabled', tone: 'muted', score: 0 };
  }
  const status = String(model?.status || model?.availability || '').toLowerCase();
  if (['healthy', 'online', 'available', 'active', 'enabled', 'ok'].some((word) => status.includes(word))) {
    return { label: 'Online', tone: 'success', score: 3 };
  }
  if (['limited', 'degraded', 'busy', 'partial'].some((word) => status.includes(word))) {
    return { label: 'Limited', tone: 'warning', score: 2 };
  }
  if (status) {
    return { label: model.status || model.availability, tone: 'muted', score: 1 };
  }
  return { label: 'Listed', tone: 'info', score: 1 };
};

export const getModelTags = (model) => {
  const tags = new Set([getModelCategory(model)]);
  const name = `${model?.model_name || ''} ${model?.display_name || ''}`.toLowerCase();
  const officialPricing = getOfficialPricing(model);
  const input = officialPricing?.type === 'token' ? asNumber(officialPricing.inputRatio) : null;
  const output = officialPricing?.type === 'token' ? asNumber(officialPricing.outputRatio) : null;
  const context = firstNumber(model, ['context_length', 'context_window', 'max_context_tokens', 'max_context', 'max_tokens', 'max_input_tokens']) || 0;

  if (isPerCallModel(model)) tags.add('Per call');
  if (input !== null && input > 0 && input <= 1) tags.add('Low ratio');
  if (output !== null && output > 0 && output <= 1) tags.add('Low output');
  if (context >= 100000 || /128k|200k|1m|long/.test(name)) tags.add('Long context');
  if (isTieredExprModel(model) || /video|text-to-video|image-to-video|sora|seedance|kling|runway|luma|veo|jimeng/.test(name)) tags.add('Video');
  if (/audio|tts|speech|voice|whisper/.test(name)) tags.add('Audio');
  if (/vision|image|dall-e|multimodal|omni/.test(name)) tags.add('Vision');
  if (/code|coder|codex/.test(name)) tags.add('Coding');
  if (/reason|thinking|r1|o1|o3|o4/.test(name)) tags.add('Reasoning');

  return Array.from(tags).slice(0, 5);
};

export const getSupportedModes = (model) => {
  const category = getModelCategory(model);
  const rawValues = [
    category,
    model?.category,
    model?.type,
    model?.modality,
    model?.mode,
    model?.model_name,
    model?.display_name,
    model?.description,
    model?.endpoint,
    model?.api_type,
    ...(Array.isArray(model?.supported_endpoint_types) ? model.supported_endpoint_types : []),
    ...(Array.isArray(model?.modalities) ? model.modalities : []),
    ...(Array.isArray(model?.capabilities) ? model.capabilities : []),
    ...(Array.isArray(model?.input_modalities) ? model.input_modalities : []),
    ...(Array.isArray(model?.output_modalities) ? model.output_modalities : []),
    ...(Array.isArray(model?.tags) ? model.tags : []),
  ];
  const haystack = rawValues.filter(Boolean).join(' ').toLowerCase();
  const modes = new Set();

  if (textLikeCategories.includes(category) || /chat|text|completion|reason|code|llm|language|message|embedding|rerank/.test(haystack)) {
    modes.add('chat');
  }
  if (category === 'Image' || /image|vision|dall-e|midjourney|flux|stable|sdxl|text-to-image|image-generation/.test(haystack)) {
    modes.add('image');
  }
  if (category === 'Video' || isTieredExprModel(model) || /video|text-to-video|image-to-video|i2v|t2v|sora|seedance|kling|runway|luma|veo|jimeng/.test(haystack)) {
    modes.add('video');
  }
  if (category === 'Audio' || /audio|speech|voice|tts|whisper|transcription|sound/.test(haystack)) {
    modes.add('audio');
  }

  if (modes.size === 0) modes.add('chat');
  return primaryModeOrder.filter((mode) => modes.has(mode));
};

export const getPreferredMode = (model) => {
  const category = getModelCategory(model);
  if (category === 'Image') return 'image';
  if (category === 'Video') return 'video';
  if (category === 'Audio') return 'audio';
  return 'chat';
};

const getCanonicalModelName = (model) => normalizeText(
  routeLeaf(model?.upstream_model) ||
  routeLeaf(model?.canonical) ||
  routeLeaf(model?.canonical_model_name) ||
  routeLeaf(model?.model_name) ||
  stripInternalNameText(model?.upstream_model) ||
  stripInternalNameText(model?.canonical) ||
  stripInternalNameText(model?.canonical_model_name) ||
  stripInternalNameText(model?.model_name) ||
  stripInternalNameText(model?.display_name) ||
  stripInternalNameText(model?.name) ||
  model?.id,
);

const getPublicDisplayName = (model) => normalizeText(
  pickPublicName([
    model?.display_name,
    model?.name,
    model?.upstream_model,
    model?.canonical,
    model?.canonical_model_name,
    routeLeaf(model?.model_name),
    model?.model_name,
  ]) ||
  model?.id,
);

const uniqueByKey = (items, keyFn) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const mergeUsage = (current, next) => {
  const currentValue = asNumber(current);
  const nextValue = asNumber(next);
  if (currentValue === null && nextValue === null) return null;
  return (currentValue ?? 0) + (nextValue ?? 0);
};

export const getModelFamilyKey = (model) => {
  const raw = getCanonicalModelName(model);
  return normalizeLower(raw);
};

const getPricingKeyCandidates = (item) => uniqueText([
  item?.model_name,
  item?.model,
  item?.name,
  item?.display_name,
  item?.upstream_model,
  item?.canonical,
  item?.canonical_model_name,
  item?.id,
].flatMap((value) => [value, routeLeaf(value)])).map(normalizeLower).filter(Boolean);

const normalizeOfficialPricingRow = (row) => {
  if (!row || typeof row !== 'object') return null;

  const quotaType = asNumber(row.quota_type);
  const inputRatio = firstNumber(row, ['model_ratio', 'input_ratio', 'prompt_ratio']);
  const completionRatio = firstNumber(row, ['completion_ratio', 'output_multiplier', 'completion_multiplier']);
  const explicitOutputRatio = firstNumber(row, ['output_ratio', 'completion_model_ratio']);
  const outputRatio = explicitOutputRatio ?? (
    inputRatio !== null && completionRatio !== null ? inputRatio * completionRatio : null
  );
  const modelPrice = firstNumber(row, ['model_price', 'call_price', 'fixed_price']);

  if (quotaType === 1 || (quotaType !== 0 && modelPrice !== null && inputRatio === null)) {
    return {
      type: 'per_call',
      modelPrice,
      source: 'public_pricing',
    };
  }

  if (quotaType === 0 || inputRatio !== null || outputRatio !== null) {
    if (inputRatio === null && outputRatio === null) return null;
    return {
      type: 'token',
      inputRatio,
      completionRatio,
      outputRatio,
      source: 'public_pricing',
    };
  }

  return null;
};

const buildOfficialPricingIndex = (pricingRows = []) => {
  const index = new Map();

  pricingRows.forEach((row) => {
    const pricing = normalizeOfficialPricingRow(row);
    if (!pricing) return;

    getPricingKeyCandidates(row).forEach((key) => {
      if (!index.has(key)) index.set(key, pricing);
    });
  });

  return index;
};

const stripMerchantPricing = (model) => {
  const next = { ...model };
  PRICE_FIELDS.forEach((field) => {
    if (field in next) delete next[field];
  });
  return next;
};

export const mergeModelCatalog = (models = []) => {
  const groups = new Map();

  models.forEach((model, index) => {
    if (!model || model.enabled === false) return;
    const key = getModelFamilyKey(model) || normalizeLower(getModelId(model));
    const publicModelName = getCanonicalModelName(model) || getModelId(model);
    const displayName = getPublicDisplayName(model) || publicModelName;
    const category = getModelCategory(model);
    const publicRank = firstNumber(model, ['public_rank', 'rank', 'sort_order', 'position', 'order']) ?? index;

    if (!groups.has(key)) {
      groups.set(key, {
        id: publicModelName,
        model_name: publicModelName,
        display_name: displayName,
        description: getGeneratedModelText(model, false),
        category,
        type: model?.type,
        modality: model?.modality,
        mode: model?.mode,
        modalities: Array.isArray(model?.modalities) ? model.modalities : [],
        capabilities: Array.isArray(model?.capabilities) ? model.capabilities : [],
        input_modalities: Array.isArray(model?.input_modalities) ? model.input_modalities : [],
        output_modalities: Array.isArray(model?.output_modalities) ? model.output_modalities : [],
        tags: Array.isArray(model?.tags) ? model.tags : [],
        context_length: firstNumber(model, ['context_length', 'context_window', 'max_context_tokens', 'max_context', 'max_input_tokens']),
        max_tokens: firstNumber(model, ['max_tokens']),
        enabled: true,
        public_rank: publicRank,
        usage_count: null,
        request_count: null,
        total_requests: null,
        token_usage: null,
        total_tokens: null,
      });
    }

    const group = groups.get(key);
    const requestUsage = getUsageCount(model);
    const tokenUsage = getTokenUsageValue(model);

    group.enabled = group.enabled || model?.enabled !== false;
    group.description = getGeneratedModelText(group, false);
    group.usage_count = mergeUsage(group.usage_count, requestUsage);
    group.request_count = group.usage_count;
    group.total_requests = group.usage_count;
    group.token_usage = mergeUsage(group.token_usage, tokenUsage);
    group.total_tokens = group.token_usage;

    group.public_rank = Math.min(group.public_rank, publicRank);
    group.modalities = uniqueText([...(group.modalities || []), ...(Array.isArray(model?.modalities) ? model.modalities : [])]);
    group.capabilities = uniqueText([...(group.capabilities || []), ...(Array.isArray(model?.capabilities) ? model.capabilities : [])]);
    group.input_modalities = uniqueText([...(group.input_modalities || []), ...(Array.isArray(model?.input_modalities) ? model.input_modalities : [])]);
    group.output_modalities = uniqueText([...(group.output_modalities || []), ...(Array.isArray(model?.output_modalities) ? model.output_modalities : [])]);
    group.context_length = Math.max(group.context_length || 0, firstNumber(model, ['context_length', 'context_window', 'max_context_tokens', 'max_context', 'max_input_tokens']) || 0) || null;
    group.max_tokens = Math.max(group.max_tokens || 0, firstNumber(model, ['max_tokens']) || 0) || null;

    if (!group.display_name || group.display_name === group.model_name) {
      group.display_name = displayName || group.display_name;
    }

    const currentTags = Array.isArray(group.tags) ? group.tags : [];
    const nextTags = Array.isArray(model?.tags) ? model.tags : [];
    group.tags = uniqueText([...currentTags, ...nextTags]);
  });

  return Array.from(groups.values()).sort((a, b) => a.public_rank - b.public_rank);
};

export const mergeOfficialPricingIntoModels = (models = [], pricingRows = []) => {
  const index = buildOfficialPricingIndex(pricingRows);

  return models.map((model) => {
    const cleanModel = stripMerchantPricing(model);
    const keys = getPricingKeyCandidates(cleanModel);
    const officialPricing = keys.map((key) => index.get(key)).find(Boolean);

    if (!officialPricing) {
      const { official_pricing: _officialPricing, ...withoutPricing } = cleanModel;
      return withoutPricing;
    }

    return {
      ...cleanModel,
      official_pricing: officialPricing,
    };
  });
};

export const mergePublicModelCatalog = (models = [], pricingRows = []) =>
  mergeOfficialPricingIntoModels(mergeModelCatalog(models), pricingRows);

export const hasUsageMetrics = (models) =>
  models.some((model) =>
    REQUEST_FIELDS.some((key) => model?.[key] != null) ||
    TOKEN_FIELDS.some((key) => model?.[key] != null)
  );

export const getUsageCount = (model) =>
  firstNumber(model, REQUEST_FIELDS);

export const getRequestCount = (model) =>
  getUsageCount(model) ?? 0;

export const getTokenUsageValue = (model) =>
  firstNumber(model, TOKEN_FIELDS);

export const getTokenUsage = (model) =>
  getTokenUsageValue(model) ?? 0;

export const getRating = (model) => {
  return firstNumber(model, RATING_FIELDS);
};

export const getPriceValue = (model) => {
  return getSitePriceValue(model) ?? getOfficialPriceValue(model);
};

export const getMarketplaceScore = (model) => {
  const availability = getAvailability(model).score * 1000;
  const channelScore = Array.isArray(model?.channels) ? Math.min(model.channels.length, 10) * 25 : 0;
  const price = getPriceValue(model);
  const priceScore = Number.isFinite(price) ? Math.max(0, 500 - price * 100) : 0;
  return availability + channelScore + priceScore;
};

const getPublicRank = (model) => firstNumber(model, ['public_rank', 'rank', 'sort_order', 'position', 'order']);

export const sortModels = (models, sortKey = 'popular') => {
  const list = [...models];
  return list.sort((a, b) => {
    if (sortKey === 'price') return getPriceValue(a) - getPriceValue(b);
    if (sortKey === 'availability') return getAvailability(b).score - getAvailability(a).score;
    if (sortKey === 'name') return getModelDisplayName(a).localeCompare(getModelDisplayName(b));
    if (sortKey === 'requests') return getRequestCount(b) - getRequestCount(a);
    if (sortKey === 'tokens') return getTokenUsage(b) - getTokenUsage(a);
    if (sortKey === 'rating') return (getRating(b) || 0) - (getRating(a) || 0);
    const tokenUsageA = getTokenUsageValue(a);
    const tokenUsageB = getTokenUsageValue(b);
    if (tokenUsageA !== null || tokenUsageB !== null) {
      const tokenUsageDelta = (tokenUsageB ?? -1) - (tokenUsageA ?? -1);
      if (tokenUsageDelta) return tokenUsageDelta;
    }
    const usageA = getUsageCount(a);
    const usageB = getUsageCount(b);
    if (usageA !== null || usageB !== null) {
      const usageDelta = (usageB ?? -1) - (usageA ?? -1);
      if (usageDelta) return usageDelta;
    }
    const rankA = getPublicRank(a);
    const rankB = getPublicRank(b);
    if (rankA !== null || rankB !== null) {
      return (rankA ?? Number.POSITIVE_INFINITY) - (rankB ?? Number.POSITIVE_INFINITY);
    }
    return getMarketplaceScore(b) - getMarketplaceScore(a) || getModelDisplayName(a).localeCompare(getModelDisplayName(b));
  });
};

export const matchesProvider = (model, provider) => {
  if (!provider) return true;
  const target = provider.toLowerCase();
  const names = getProviderFields(model).map((value) => String(value).toLowerCase());
  return names.some((name) => name === target || getProviderSlug(name) === getProviderSlug(target));
};

export const filterModels = (models, { search = '', provider = '', category = '', status = '' } = {}) => {
  const query = search.trim().toLowerCase();
  return models.filter((model) => {
    if (model.enabled === false) return false;
    if (provider && !matchesProvider(model, provider)) return false;
    if (category && getModelCategory(model).toLowerCase() !== category.toLowerCase()) return false;
    if (status && getAvailability(model).label.toLowerCase() !== status.toLowerCase()) return false;
    if (!query) return true;
    const haystack = [
      model.id,
      model.name,
      model.model_name,
      model.display_name,
      model.description,
      getModelCategory(model),
      ...(Array.isArray(model.tags) ? model.tags : []),
      ...(Array.isArray(model.capabilities) ? model.capabilities : []),
      ...(Array.isArray(model.modalities) ? model.modalities : []),
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query);
  });
};

export const getProviderGroups = (models) => {
  const groups = new Map();

  models.filter((model) => model.enabled !== false).forEach((model) => {
    const names = getProviderFields(model);
    if (names.length === 0) names.push('Multi-provider');

    names.forEach((name) => {
      const key = getProviderSlug(name);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name,
          models: [],
          channels: [],
        });
      }
      const group = groups.get(key);
      if (!group.models.some((item) => getModelId(item) === getModelId(model))) {
        group.models.push(model);
      }
      if (getChannels(model).length > 0) {
        group.channels.push(...getChannels(model).filter((channel) =>
          [channel?.[providerNameField], channel?.[providerSlugField]].filter(Boolean).some((value) => getProviderSlug(value) === key)
        ));
      }
    });
  });

  return Array.from(groups.values()).sort((a, b) => b.models.length - a.models.length || a.name.localeCompare(b.name));
};

export const formatTokenPrice = (price, symbol = '$', rate = 1, decimals = 4) => {
  const value = asNumber(price);
  if (value === null) return '-';
  return `${symbol}${(value * 1000 * rate).toFixed(decimals)}`;
};

export const formatPerCallPrice = (price, symbol = '$', rate = 1) => {
  const value = asNumber(price);
  if (value === null) return '-';
  return `${symbol}${(value * rate).toFixed(value >= 1 ? 2 : 4)}/call`;
};

export const formatTieredSecondPrice = (price, item = {}, { symbol = '$', rate = 1, code = 'USD', usdRate = 7 } = {}) => {
  const value = asNumber(price);
  if (value === null) return '-';

  const rawMultiplier = asNumber(item?.price_multiplier);
  const multiplier = rawMultiplier && rawMultiplier > 0 ? rawMultiplier : 1;
  const sourceCurrency = String(item?.price_currency || 'USD').toUpperCase();
  let converted = value * multiplier;

  if (sourceCurrency === 'CNY') {
    converted = code === 'CNY' ? converted : (converted / (usdRate || 1)) * rate;
  } else {
    converted *= rate;
  }

  return `${symbol}${converted.toFixed(4)}/s`;
};

export const formatCompactNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '0';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
};

export const formatUsageValue = (modelOrValue) => {
  const value = typeof modelOrValue === 'object' ? getUsageCount(modelOrValue) : asNumber(modelOrValue);
  return value === null ? '-' : formatCompactNumber(value);
};

export const formatTokenUsageValue = (modelOrValue) => {
  const value = typeof modelOrValue === 'object' ? getTokenUsageValue(modelOrValue) : asNumber(modelOrValue);
  return value === null ? '-' : formatCompactNumber(value);
};

const jsonString = (value) => JSON.stringify(String(value));

export const buildCurlSnippet = ({
  baseUrl = PUBLIC_API_BASE_URL,
  apiKey = '$SUBROUTER_API_KEY',
  modelId,
  prompt = 'Explain quantum computing in one paragraph.',
  temperature,
  maxTokens,
}) => {
  const optionalLines = [
    temperature != null ? `    "temperature": ${Number(temperature)},` : '',
    maxTokens != null ? `    "max_tokens": ${Number(maxTokens)},` : '',
  ].filter(Boolean).join('\n');

  return `curl ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "${modelId}",
${optionalLines ? `${optionalLines}\n` : ''}    "messages": [
      {"role": "user", "content": ${jsonString(prompt)}}
    ]
  }'`;
};

export const buildJsSnippet = ({ baseUrl = PUBLIC_API_BASE_URL, apiKey = 'process.env.SUBROUTER_API_KEY', modelId }) => `const response = await fetch("${baseUrl}/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": \`Bearer \${${apiKey}}\`
  },
  body: JSON.stringify({
    model: "${modelId}",
    messages: [{ role: "user", content: "Hello from SubRouter" }]
  })
});

const data = await response.json();
console.log(data.choices?.[0]?.message?.content);`;

export const buildPythonSnippet = ({ baseUrl = PUBLIC_API_BASE_URL, apiKey = 'os.environ["SUBROUTER_API_KEY"]', modelId }) => `import os
from openai import OpenAI

client = OpenAI(
    api_key=${apiKey},
    base_url="${baseUrl}"
)

response = client.chat.completions.create(
    model="${modelId}",
    messages=[{"role": "user", "content": "Hello from SubRouter"}]
)

print(response.choices[0].message.content)`;
