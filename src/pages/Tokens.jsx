import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  Plus,
  Server,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  getTokens,
  createToken,
  updateToken,
  deleteToken,
  getSiteKeyGroups,
  getSiteKeyGroupPricing,
  getTokenSupportedModels,
} from '../api';
import CodeBlock from '../components/CodeBlock';
import ConfigExporter from '../components/ConfigExporter';
import DownloadCatalog from '../components/DownloadCatalog';
import { useCurrency, usePublicApiBaseUrl } from '../context/SiteContext';
import {
  ConsoleBadge,
  ConsoleEmpty,
  ConsoleField,
  ConsoleFrame,
  ConsoleFrameHeader,
  ConsoleHero,
  ConsoleModal,
  ConsolePage,
  ConsoleSection,
  ConsoleStat,
} from '../components/ConsoleSurface';
import { getDocsModelCatalog, SUBROUTER_API_BASE_URL } from '../utils/publicCatalog';
import { buildCurlSnippet, getModelDisplayName, getModelId } from '../utils/modelMeta';
import toast from 'react-hot-toast';

const providerNamesField = ['provider', 'names'].join('_');

export default function Tokens() {
  const { t } = useTranslation();
  const { symbol, rate } = useCurrency();
  const publicApiBaseUrl = usePublicApiBaseUrl() || SUBROUTER_API_BASE_URL;
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedTokens, setExpandedTokens] = useState({});
  const [tokenModels, setTokenModels] = useState({});
  const [siteModels, setSiteModels] = useState([]);
  const [quickstartModelId, setQuickstartModelId] = useState('');

  // Key groups
  const [keyGroups, setKeyGroups] = useState([]);
  const [activePricingGroup, setActivePricingGroup] = useState(null);
  const [groupPricingCache, setGroupPricingCache] = useState({});
  const [loadingGroupPricingId, setLoadingGroupPricingId] = useState(0);
  const [groupPricingSearch, setGroupPricingSearch] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(0);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tokensRes, groupsRes, modelsRes] = await Promise.all([
        getTokens(),
        getSiteKeyGroups().catch(() => ({ data: { success: false } })),
        getDocsModelCatalog().catch(() => ({ models: [] })),
      ]);
      if (tokensRes.data.success) setTokens(tokensRes.data.data || []);
      if (groupsRes.data.success) setKeyGroups(groupsRes.data.data || []);
      if (Array.isArray(modelsRes.models)) {
        const publicModels = modelsRes.models;
        setSiteModels(publicModels);
        setQuickstartModelId((current) => current || (publicModels[0] ? getModelId(publicModels[0]) : ''));
      }
    } catch (e) { /* interceptor */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group by vendor_category
  const groupedByVendor = useMemo(() => {
    const map = {};
    keyGroups.forEach((g) => {
      const cat = g.vendor_category || t('tokens.otherGroups');
      if (!map[cat]) map[cat] = [];
      map[cat].push(g);
    });
    return map;
  }, [keyGroups, t]);

  const openCreateFromGroup = (group) => {
    if (group.is_unavailable) return;
    setSelectedGroupId(group.id);
    setCreateName(group.name);
    setShowCreate(true);
  };

  const openCreateDefault = () => {
    setSelectedGroupId(0);
    setCreateName('');
    setShowCreate(true);
  };

  const openGroupPricing = async (group) => {
    setActivePricingGroup(group);
    setGroupPricingSearch('');
    if (groupPricingCache[group.id] || loadingGroupPricingId === group.id) {
      return;
    }
    setLoadingGroupPricingId(group.id);
    try {
      const res = await getSiteKeyGroupPricing(group.id);
      if (res.data.success) {
        setGroupPricingCache((prev) => ({
          ...prev,
          [group.id]: res.data.data || { items: [], summary: null, group },
        }));
      }
    } catch (e) { /* interceptor */ }
    setLoadingGroupPricingId(0);
  };

  const closeGroupPricing = () => {
    setActivePricingGroup(null);
    setGroupPricingSearch('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim()) {
      toast.error(t('tokens.enterName'));
      return;
    }
    setCreating(true);
    try {
      const payload = { name: createName.trim() };
      if (selectedGroupId > 0) payload.key_group_id = selectedGroupId;
      const res = await createToken(payload);
      if (res.data.success) {
        setCreateName('');
        setShowCreate(false);
        setSelectedGroupId(0);
        const createdKey = res.data.data?.key;
        if (createdKey) setNewKey(createdKey);
        await load();
      }
    } catch (e) { /* interceptor */ }
    setCreating(false);
  };

  const handleToggle = async (token) => {
    try {
      const res = await updateToken(token.id, {
        status: token.status === 1 ? 2 : 1,
      });
      if (res.data.success) {
        toast.success(token.status === 1 ? t('tokens.tokenDisabled') : t('tokens.tokenEnabled'));
        await load();
      }
    } catch (e) { /* interceptor */ }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await deleteToken(deleteConfirm.id);
      if (res.data.success) {
        toast.success(t('tokens.tokenDeleted'));
        setDeleteConfirm(null);
        await load();
      }
    } catch (e) { /* interceptor */ }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(text);
    toast.success(t('tokens.copiedToClipboard'));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const parseTags = (tagsStr) => {
    try { return JSON.parse(tagsStr || '[]'); } catch { return []; }
  };

  const handleToggleSupportedModels = async (tokenId) => {
    const isExpanded = !!expandedTokens[tokenId];
    setExpandedTokens((prev) => ({ ...prev, [tokenId]: !isExpanded }));
    if (isExpanded) return;

    setTokenModels((prev) => ({
      ...prev,
      [tokenId]: { loading: true, models: [], count: 0, [providerNamesField]: [], restricted_by_providers: false, restricted_by_models: false },
    }));

    try {
      const res = await getTokenSupportedModels(tokenId);
      if (res.data.success) {
        const data = res.data.data || {};
        setTokenModels((prev) => ({
          ...prev,
          [tokenId]: {
            loading: false,
            models: data.models || [],
            count: data.count || 0,
            [providerNamesField]: data[providerNamesField] || [],
            restricted_by_providers: Boolean(data.restricted_by_providers),
            restricted_by_models: Boolean(data.restricted_by_models),
          },
        }));
      } else {
        setTokenModels((prev) => ({
          ...prev,
          [tokenId]: { loading: false, error: true, models: [], count: 0, [providerNamesField]: [], restricted_by_providers: false, restricted_by_models: false },
        }));
      }
    } catch (e) {
      setTokenModels((prev) => ({
        ...prev,
        [tokenId]: { loading: false, error: true, models: [], count: 0, [providerNamesField]: [], restricted_by_providers: false, restricted_by_models: false },
      }));
    }
  };

  const hasGroups = keyGroups.length > 0;
  const activeGroupPricing = activePricingGroup
    ? groupPricingCache[activePricingGroup.id] || null
    : null;
  const filteredGroupPricingItems = useMemo(() => {
    const items = activeGroupPricing?.items || [];
    const keyword = groupPricingSearch.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
      const modelName = (item.model_name || '').toLowerCase();
      const displayName = (item.display_name || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      return (
        modelName.includes(keyword) ||
        displayName.includes(keyword) ||
        category.includes(keyword)
      );
    });
  }, [activeGroupPricing, groupPricingSearch]);

  const baseUrl = publicApiBaseUrl;
  const selectedQuickstartModelId = quickstartModelId || (siteModels[0] ? getModelId(siteModels[0]) : 'gpt-4o-mini');
  const quickstartCurl = buildCurlSnippet({
    baseUrl,
    modelId: selectedQuickstartModelId,
    prompt: 'Say hello from my SubRouter key.',
  });
  const selectedGroup = selectedGroupId > 0
    ? keyGroups.find((group) => group.id === selectedGroupId)
    : null;
  const heroStats = [
    <ConsoleStat
      key="keys"
      icon={KeyRound}
      label={t('tokens.myKeys')}
      value={tokens.length.toLocaleString()}
      helper="Keys in this account"
      tone="cyan"
    />,
    <ConsoleStat
      key="groups"
      icon={ShieldCheck}
      label="Access groups"
      value={hasGroups ? keyGroups.length.toLocaleString() : 'Default'}
      helper={hasGroups ? 'Choose group-scoped access when needed' : 'All available models'}
      tone="sky"
    />,
    <ConsoleStat
      key="models"
      icon={Server}
      label="Catalog models"
      value={siteModels.length ? siteModels.length.toLocaleString() : '-'}
      helper="Available for request snippets"
      tone="emerald"
    />,
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ConsolePage>
      <ConsoleHero
        eyebrow="API access"
        title={t('tokens.title')}
        subtitle="Create keys, choose access groups, and copy an OpenAI-compatible request using the public API base URL."
        actions={[
          <button key="create" type="button" onClick={openCreateDefault} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5">
            <Plus className="h-4 w-4" />
            {t('tokens.createApiKey')}
          </button>,
          <Link key="models" to="/models" className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5">
            <Server className="h-4 w-4" />
            Models
          </Link>,
          <Link key="docs" to="/docs/quickstart" className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5">
            <BookOpen className="h-4 w-4" />
            Docs
          </Link>,
        ]}
        stats={heroStats}
      />

      <ConsoleFrame className="mt-6">
        <ConsoleFrameHeader
          title="Quickstart"
          subtitle="Public API calls use the API base URL shown here, including its /v1 path."
        />
        <div className="p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-3">
            <EndpointTile label="Base URL">
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-page">{baseUrl}</code>
                <button
                  type="button"
                  onClick={() => handleCopy(baseUrl)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-page-divider bg-white text-page-muted hover:bg-page-surface-hover hover:text-page"
                  aria-label="Copy base URL"
                >
                  {copiedId === baseUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </EndpointTile>
            <EndpointTile label="Endpoint">
              <p className="truncate font-mono text-xs text-page">{baseUrl}/chat/completions</p>
            </EndpointTile>
            <EndpointTile label="Snippet model">
              <select
                value={selectedQuickstartModelId}
                onChange={(event) => setQuickstartModelId(event.target.value)}
                className="input mt-0 h-9 px-2 text-xs"
              >
                {siteModels.length > 0 ? siteModels.map((model) => (
                  <option key={getModelId(model)} value={getModelId(model)}>
                    {getModelDisplayName(model)}
                  </option>
                )) : (
                  <option value={selectedQuickstartModelId}>{selectedQuickstartModelId}</option>
                )}
              </select>
            </EndpointTile>
          </div>
          <div className="mt-4">
            <CodeBlock title="First request" language="bash" code={quickstartCurl} />
          </div>
        </div>
      </ConsoleFrame>

      <ConsoleSection
        className="mt-6"
        title={hasGroups ? t('tokens.selectGroup') : t('tokens.createApiKey')}
        subtitle={hasGroups ? t('tokens.selectGroupSubtitle') : 'Create a default API key with access to available models.'}
      >
        <div className="grid gap-3">
          <button
            type="button"
            onClick={openCreateDefault}
            className="group flex w-full items-center gap-3 rounded-2xl border border-page-divider bg-page-surface/40 p-4 text-left transition-colors hover:border-brand-500/40 hover:bg-page-surface"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-page-divider bg-white text-page">
              <Plus className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-page">{hasGroups ? t('tokens.defaultGroup') : t('tokens.newKey')}</span>
              {hasGroups && <span className="mt-0.5 block text-xs leading-5 text-page-secondary">{t('tokens.defaultGroupDesc')}</span>}
            </span>
            <span className="hidden items-center gap-1 text-xs font-semibold text-page-link sm:inline-flex">
              {t('tokens.create')}
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>

          {hasGroups && Object.entries(groupedByVendor).map(([vendor, groups]) => (
            <div key={vendor} className="rounded-2xl border border-page-divider bg-page-surface/30 p-3">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <h3 className="text-sm font-semibold text-page">{vendor}</h3>
                <ConsoleBadge tone="slate">{groups.length} {t('tokens.groupCount')}</ConsoleBadge>
              </div>
              <div className="grid gap-2">
                {groups.map((group) => (
                  <KeyGroupCard
                    key={group.id}
                    group={group}
                    parseTags={parseTags}
                    onSelect={openCreateFromGroup}
                    onViewPricing={openGroupPricing}
                    t={t}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ConsoleSection>

      {showCreate && (
        <ConsoleModal
          title={t('tokens.createApiKey')}
          onClose={() => { setShowCreate(false); setSelectedGroupId(0); }}
        >
          {selectedGroup && (
            <div className="mb-4 rounded-xl border border-page-divider bg-page-surface/50 p-3">
              <p className="text-xs text-page-muted">{t('tokens.selectedGroup')}</p>
              <p className="mt-1 text-sm font-medium text-page">{selectedGroup.name}</p>
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <ConsoleField label={t('tokens.name')}>
              <input
                type="text"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                className="input"
                placeholder={t('tokens.namePlaceholder')}
                autoFocus
                required
              />
            </ConsoleField>
            <div className="grid gap-2 sm:flex sm:justify-end sm:gap-3">
              <button type="button" onClick={() => { setShowCreate(false); setSelectedGroupId(0); }} className="btn-secondary">
                {t('tokens.cancel')}
              </button>
              <button type="submit" disabled={creating} className="btn-primary inline-flex items-center justify-center gap-2">
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                {creating ? t('tokens.creating') : t('tokens.create')}
              </button>
            </div>
          </form>
        </ConsoleModal>
      )}

      <GroupPricingModal
        open={!!activePricingGroup}
        group={activePricingGroup}
        pricingData={activeGroupPricing}
        items={filteredGroupPricingItems}
        loading={loadingGroupPricingId === activePricingGroup?.id}
        search={groupPricingSearch}
        onSearchChange={setGroupPricingSearch}
        onClose={closeGroupPricing}
        symbol={symbol}
        rate={rate}
        t={t}
      />

      {newKey && (
        <ConsoleModal title={t('tokens.newApiKey')} maxWidth="max-w-lg">
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.08] p-3">
            <p className="text-sm text-page-warning">{t('tokens.keyWarning')}</p>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-page-divider bg-page-inset p-4 sm:flex-row sm:items-center">
            <code className="flex-1 select-all break-all font-mono text-sm text-page-success">{newKey}</code>
            <button onClick={() => handleCopy(newKey)} className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2">
              {copiedId === newKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedId === newKey ? t('tokens.copied') : t('tokens.copy')}
            </button>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={() => setNewKey(null)} className="btn-secondary">
              {t('tokens.savedKey')}
            </button>
          </div>
        </ConsoleModal>
      )}

      {deleteConfirm && (
        <ConsoleModal
          title={t('tokens.deleteToken')}
          subtitle={t('tokens.deleteConfirm', { name: deleteConfirm.name })}
          onClose={() => setDeleteConfirm(null)}
          maxWidth="max-w-sm"
        >
          <div className="grid gap-2 sm:flex sm:justify-end sm:gap-3">
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">{t('tokens.cancel')}</button>
            <button onClick={handleDelete} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500">
              <Trash2 className="h-4 w-4" />
              {t('tokens.delete')}
            </button>
          </div>
        </ConsoleModal>
      )}

      <ConsoleFrame className="mt-6">
        <ConsoleFrameHeader title={t('tokens.myKeys')} subtitle="Manage key status, inspect supported models, and copy key material." />
        {tokens.length === 0 ? (
          <div className="p-4 sm:p-5">
            <ConsoleEmpty
              icon={KeyRound}
              title={t('tokens.noKeys')}
              description={t('tokens.noKeysHint')}
              action={<button type="button" onClick={openCreateDefault} className="btn-primary px-4 py-2">{t('tokens.createFirst')}</button>}
            />
          </div>
        ) : (
          <div className="divide-y divide-page-divider">
            {tokens.map((token) => (
              <TokenRow
                key={token.id}
                token={token}
                copiedId={copiedId}
                expanded={!!expandedTokens[token.id]}
                modelState={tokenModels[token.id]}
                providerNamesField={providerNamesField}
                onCopy={handleCopy}
                onDelete={() => setDeleteConfirm(token)}
                onToggle={() => handleToggle(token)}
                onToggleModels={() => handleToggleSupportedModels(token.id)}
                t={t}
              />
            ))}
          </div>
        )}
      </ConsoleFrame>

      <div className="mt-8">
        <ConfigExporter tokens={tokens} />
      </div>

      <div className="mt-10">
        <DownloadCatalog />
      </div>
    </ConsolePage>
  );
}

function EndpointTile({ label, children }) {
  return (
    <div className="rounded-xl border border-page-divider bg-page-surface/40 p-3">
      <p className="mb-2 text-xs font-medium text-page-muted">{label}</p>
      {children}
    </div>
  );
}

function TokenRow({
  token,
  copiedId,
  expanded,
  modelState,
  providerNamesField,
  onCopy,
  onDelete,
  onToggle,
  onToggleModels,
  t,
}) {
  const keyValue = token.key ? `sk-${token.key}` : '';
  const createdDate = token.created_time ? new Date(token.created_time * 1000).toLocaleDateString() : '';

  return (
    <div className="p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${token.status === 1 ? 'bg-page-success' : 'bg-page-muted'}`} />
            <p className="min-w-0 truncate text-sm font-semibold text-page">{token.name}</p>
            <ConsoleBadge tone={token.status === 1 ? 'emerald' : 'slate'}>
              {token.status === 1 ? t('tokens.enabled') : t('tokens.disabled')}
            </ConsoleBadge>
            {createdDate && <span className="text-xs text-page-muted">{createdDate}</span>}
          </div>
          {keyValue && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-page-divider bg-page-inset px-3 py-2">
              <code className="min-w-0 flex-1 select-all break-all font-mono text-xs text-page-secondary">{keyValue}</code>
              <button
                type="button"
                onClick={() => onCopy(keyValue)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-page-divider bg-white text-page-muted hover:bg-page-surface-hover hover:text-page"
                aria-label="Copy API key"
              >
                {copiedId === keyValue ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
          <button
            type="button"
            onClick={onToggleModels}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-page-divider px-2.5 py-2 text-xs font-medium text-page-secondary transition-colors hover:bg-page-surface-hover hover:text-page"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="truncate">{expanded ? t('tokens.hideSupportedModels') : t('tokens.viewSupportedModels')}</span>
          </button>
          <button
            type="button"
            onClick={onToggle}
            className={`inline-flex items-center justify-center rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
              token.status === 1
                ? 'border-emerald-500/30 text-page-success hover:bg-emerald-500/10'
                : 'border-page-divider text-page-secondary hover:bg-page-surface-hover'
            }`}
          >
            {token.status === 1 ? t('tokens.enabled') : t('tokens.disabled')}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/20 px-2.5 py-2 text-xs font-medium text-page-danger transition-colors hover:bg-rose-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('tokens.delete')}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 rounded-xl border border-page-divider bg-page-surface/50 px-4 py-3">
          {modelState?.loading ? (
            <div className="flex items-center gap-2 text-sm text-page-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('tokens.loadingSupportedModels')}</span>
            </div>
          ) : modelState?.error ? (
            <p className="text-sm text-page-danger">{t('tokens.loadSupportedModelsFailed')}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-page">
                  {t('tokens.supportedModels')} ({modelState?.count || 0})
                </p>
                {modelState?.restricted_by_models && <ConsoleBadge tone="brand">{t('tokens.restrictedByModels')}</ConsoleBadge>}
                {modelState?.restricted_by_providers && <ConsoleBadge tone="brand">{t('tokens.restrictedBySources')}</ConsoleBadge>}
              </div>
              {modelState?.[providerNamesField]?.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-page-muted">{t('tokens.supportedSources')}</span>
                  {modelState[providerNamesField].map((name) => (
                    <span key={name} className="rounded-full bg-page-inset px-2 py-0.5 text-[11px] text-page-secondary">
                      {name}
                    </span>
                  ))}
                </div>
              )}
              {modelState?.models?.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {modelState.models.map((modelName) => (
                    <code key={modelName} className="rounded-lg bg-page-inset px-2.5 py-1 font-mono text-[11px] text-page-secondary">
                      {modelName}
                    </code>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-page-muted">{t('tokens.noSupportedModels')}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ========== Key Group Card ========== */
function KeyGroupCard({ group, parseTags, onSelect, onViewPricing, t }) {
  const tags = parseTags(group.tags);
  const isUnavailable = group.is_unavailable;

  return (
    <div
      className={`rounded-xl border border-page-divider bg-white p-4 transition-colors ${
        isUnavailable
          ? 'opacity-75'
          : 'cursor-pointer hover:border-brand-500/40 hover:bg-page-surface/40 group'
      }`}
      onClick={() => !isUnavailable && onSelect(group)}
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          {/* Name + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-page">{group.name}</span>
            {group.is_recommended && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-500">
                {t('tokens.recommended')}
              </span>
            )}
            {isUnavailable && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-page-danger">
                {t('tokens.unavailable')}
              </span>
            )}
          </div>

          {/* Price + discount + tags */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {group.rmb_per_usd > 0 && (
              <span className="text-xs font-medium text-page">
                {group.rmb_per_usd} {t('tokens.rmbPerUsd')}
              </span>
            )}
            {group.discount_label && (
              <span className="text-[11px] font-semibold text-page-success">
                {group.discount_label}
              </span>
            )}
            {tags.map((tag, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-page-surface text-page-secondary">
                {tag}
              </span>
            ))}
          </div>

          {/* Description */}
          {group.description && (
            <p className="text-xs text-page-muted mt-1">{group.description}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onViewPricing(group);
            }}
            className="px-3 py-1.5 text-xs rounded-lg border border-page-divider text-page-secondary hover:bg-page-surface-hover hover:text-page transition-colors"
          >
            {t('tokens.viewGroupPricing')}
          </button>

          {!isUnavailable && (
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs font-medium text-page-link">{t('tokens.create')}</span>
              <ArrowRight className="h-4 w-4 text-page-link" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupPricingModal({
  open,
  group,
  pricingData,
  items,
  loading,
  search,
  onSearchChange,
  onClose,
  symbol,
  rate,
  t,
}) {
  if (!open || !group) {
    return null;
  }

  const displayGroup = pricingData?.group || group;
  const summary = pricingData?.summary;
  const hasItems = (pricingData?.items || []).length > 0;

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 py-4 border-b border-page-divider sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-lg font-heading font-semibold text-page sm:text-xl">
                {displayGroup.name} · {t('tokens.groupPricingTitle')}
              </h2>
              <p className="text-sm text-page-secondary mt-1 max-w-3xl">
                {t('tokens.groupPricingSubtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-lg border border-page-divider text-page-secondary hover:bg-page-surface-hover transition-colors"
            >
              {t('tokens.cancel')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            {displayGroup.discount_label && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-page-success">
                {displayGroup.discount_label}
              </span>
            )}
            {displayGroup.rmb_per_usd > 0 && (
              <span className="px-2.5 py-1 rounded-full text-xs bg-page-surface text-page-secondary">
                {displayGroup.rmb_per_usd} {t('tokens.rmbPerUsd')}
              </span>
            )}
            {summary && (
              <span className="px-2.5 py-1 rounded-full text-xs bg-page-surface text-page-secondary">
                {t('tokens.groupPricingAvailableLines')}: {summary.provider_count}
              </span>
            )}
            {summary && (
              <span className="px-2.5 py-1 rounded-full text-xs bg-page-surface text-page-secondary">
                {t('tokens.groupPricingAvailableModels')}: {summary.model_count}
              </span>
            )}
            {summary?.provider_limited && (
              <span className="px-2.5 py-1 rounded-full text-xs bg-page-surface text-page-secondary">
                {t('tokens.restrictedBySources')}
              </span>
            )}
            {summary?.model_limited && (
              <span className="px-2.5 py-1 rounded-full text-xs bg-page-surface text-page-secondary">
                {t('tokens.restrictedByModels')}
              </span>
            )}
          </div>

          {displayGroup.description && (
            <p className="text-sm text-page-secondary mt-3">
              {displayGroup.description}
            </p>
          )}
        </div>

        <div className="px-4 py-4 border-b border-page-divider bg-page-surface/40 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-page-secondary">
              {t('tokens.groupPricingNotice')}
            </p>
            <input
              type="text"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="input lg:max-w-xs"
              placeholder={t('tokens.groupPricingSearchPlaceholder')}
            />
          </div>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-4 py-5 sm:px-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-page-secondary">
              <div className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
              <span>{t('tokens.groupPricingLoading')}</span>
            </div>
          ) : !hasItems ? (
            <div className="text-sm text-page-secondary">
              {t('tokens.groupPricingNoData')}
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm text-page-secondary">
              {t('tokens.groupPricingNoMatch')}
            </div>
          ) : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm min-w-[860px]">
                <thead>
                  <tr className="border-b border-page-divider">
                    <th className="text-left px-4 py-3 font-medium text-page-secondary">{t('pricing.model')}</th>
                    <th className="text-left px-4 py-3 font-medium text-page-secondary">Pricing mode</th>
                    <th className="text-right px-4 py-3 font-medium text-page-secondary">{t('tokens.groupPricingReferencePrice')}</th>
                    <th className="text-right px-4 py-3 font-medium text-page-secondary">{t('pricing.outputPrice')}</th>
                    <th className="text-right px-4 py-3 font-medium text-page-secondary">{t('pricing.cacheReadPrice')}</th>
                    <th className="text-right px-4 py-3 font-medium text-page-secondary">{t('pricing.cacheCreationPrice')}</th>
                    <th className="text-center px-4 py-3 font-medium text-page-secondary">{t('tokens.groupPricingLines')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={`${item.model_name}:${item.billing_type}`} className="border-b border-page-divider last:border-0 align-top">
                      <td className="px-4 py-3.5">
                        <div className="min-w-0">
                          <div className="font-medium text-page">{item.display_name || item.model_name}</div>
                          {(item.display_name || item.model_name) !== item.model_name && (
                            <div className="text-xs text-page-muted font-mono mt-1">{item.model_name}</div>
                          )}
                          {item.category && (
                            <div className="text-xs text-page-muted mt-1 uppercase tracking-wide">{item.category}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-page-secondary">
                        {item.billing_type === 'per_call' ? t('pricing.perCall') : 'Pay as you go'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-page-label whitespace-nowrap">
                        {item.status !== 'healthy'
                          ? t('pricing.unknown')
                          : item.billing_type === 'per_call'
                            ? formatGroupPriceRange(item.fixed_price_min, item.fixed_price_max, symbol, rate, true, t)
                            : formatGroupPriceRange(item.input_price_min, item.input_price_max, symbol, rate, false, t)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-page-label whitespace-nowrap">
                        {item.status !== 'healthy'
                          ? '-'
                          : item.billing_type === 'per_call'
                            ? '-'
                            : formatGroupPriceRange(item.output_price_min, item.output_price_max, symbol, rate, false, t)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-page-label whitespace-nowrap">
                        {item.status !== 'healthy'
                          ? '-'
                          : item.billing_type === 'per_call'
                            ? '-'
                            : formatGroupPriceRange(item.cache_read_price_min, item.cache_read_price_max, symbol, rate, false, t)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-page-label whitespace-nowrap">
                        {item.status !== 'healthy'
                          ? '-'
                          : item.billing_type === 'per_call'
                            ? '-'
                            : formatGroupCachePriceRange(item, symbol, rate, t)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-page-surface text-page-secondary">
                          {formatRouteCount(item.route_count, item.has_range, t)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {items.map((item) => (
                <div key={`${item.model_name}:${item.billing_type}`} className="rounded-xl border border-page-divider bg-page-surface/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-page">{item.display_name || item.model_name}</p>
                      {(item.display_name || item.model_name) !== item.model_name && (
                        <p className="mt-1 break-all font-mono text-xs text-page-muted">{item.model_name}</p>
                      )}
                      {item.category && <p className="mt-1 text-xs uppercase tracking-wide text-page-muted">{item.category}</p>}
                    </div>
                    <span className="rounded-full bg-page-surface px-2 py-1 text-xs text-page-secondary">
                      {formatRouteCount(item.route_count, item.has_range, t)}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs">
                    <PriceLine label="Pricing mode" value={item.billing_type === 'per_call' ? t('pricing.perCall') : 'Pay as you go'} />
                    <PriceLine
                      label={t('tokens.groupPricingReferencePrice')}
                      value={item.status !== 'healthy'
                        ? t('pricing.unknown')
                        : item.billing_type === 'per_call'
                          ? formatGroupPriceRange(item.fixed_price_min, item.fixed_price_max, symbol, rate, true, t)
                          : formatGroupPriceRange(item.input_price_min, item.input_price_max, symbol, rate, false, t)}
                    />
                    {item.billing_type !== 'per_call' && item.status === 'healthy' && (
                      <>
                        <PriceLine label={t('pricing.outputPrice')} value={formatGroupPriceRange(item.output_price_min, item.output_price_max, symbol, rate, false, t)} />
                        <PriceLine label={t('pricing.cacheReadPrice')} value={formatGroupPriceRange(item.cache_read_price_min, item.cache_read_price_max, symbol, rate, false, t)} />
                        <PriceLine label={t('pricing.cacheCreationPrice')} value={formatGroupCachePriceRange(item, symbol, rate, t)} />
                      </>
                    )}
                  </dl>
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatGroupPriceRange(min, max, symbol, rate, perCall, t) {
  if (min == null && max == null) {
    return '-';
  }
  const low = Number(min ?? max ?? 0);
  const high = Number(max ?? min ?? 0);
  const factor = perCall ? rate : rate * 1000;
  const suffix = perCall ? `/${t('pricing.perCallUnit')}` : '';
  const lowText = `${symbol}${(low * factor).toFixed(4)}`;
  const highText = `${symbol}${(high * factor).toFixed(4)}`;
  if (Math.abs(low - high) <= 1e-9) {
    return `${lowText}${suffix}`;
  }
  return `${lowText} - ${highText}${suffix}`;
}

function formatGroupCachePriceRange(item, symbol, rate, t) {
  const base = formatGroupPriceRange(
    item.cache_creation_price_min,
    item.cache_creation_price_max,
    symbol,
    rate,
    false,
    t,
  );
  if (
    item.cache_creation_price_1h_min == null &&
    item.cache_creation_price_1h_max == null
  ) {
    return base;
  }
  const baseMin = Number(item.cache_creation_price_min ?? 0);
  const baseMax = Number(item.cache_creation_price_max ?? 0);
  const oneHourMin = Number(item.cache_creation_price_1h_min ?? 0);
  const oneHourMax = Number(item.cache_creation_price_1h_max ?? 0);
  if (
    Math.abs(baseMin - oneHourMin) <= 1e-9 &&
    Math.abs(baseMax - oneHourMax) <= 1e-9
  ) {
    return base;
  }
  const oneHour = formatGroupPriceRange(
    item.cache_creation_price_1h_min,
    item.cache_creation_price_1h_max,
    symbol,
    rate,
    false,
    t,
  );
  return `${t('pricing.cacheCreation5m')} ${base} / ${t('pricing.cacheCreation1h')} ${oneHour}`;
}

function PriceLine({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-page-muted">{label}</dt>
      <dd className="break-words text-right font-mono text-page-label">{value}</dd>
    </div>
  );
}

function formatRouteCount(routeCount, hasRange, t) {
  if (!routeCount) {
    return t('pricing.unknown');
  }
  if (routeCount === 1) {
    return `1 ${t('tokens.groupPricingLineUnitSingle')}`;
  }
  if (!hasRange) {
    return `${routeCount} ${t('tokens.groupPricingLineUnit')} · ${t('tokens.groupPricingSamePrice')}`;
  }
  return `${routeCount} ${t('tokens.groupPricingLineUnit')}`;
}
