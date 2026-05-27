import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Clock3,
  RotateCcw,
  Search,
  Sigma,
  Wallet,
  Zap,
  ExternalLink,
  X,
} from 'lucide-react';
import { getUserLogs, getUserLogsStat, Q } from '../api';
import { useCurrency } from '../context/SiteContext';
import LogSubnav from '../components/LogSubnav';
import {
  ConsoleBadge,
  ConsoleEmpty,
  ConsoleHero,
  ConsolePage,
  ConsoleSection,
  ConsoleStat,
} from '../components/ConsoleSurface';

function formatTime(unix) {
  if (!unix) return '-';
  const d = new Date(unix * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDateTimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDatetimeLocal(value) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.floor(parsed / 1000);
}

function getLogOther(otherStr) {
  if (!otherStr) return null;
  try {
    return JSON.parse(otherStr);
  } catch {
    return null;
  }
}

function formatAmount(symbol, rate, amount) {
  const value = Number(amount || 0) * rate;
  return `${symbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
    maximumFractionDigits: 6,
  })}`;
}

function formatQuotaAmount(symbol, rate, quota, emptyZero = true) {
  const value = (Number(quota || 0) / Q) * rate;
  if (value <= 0 && emptyZero) return '-';
  return `${symbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
    maximumFractionDigits: 6,
  })}`;
}

function formatTokens(value) {
  return Number(value || 0).toLocaleString();
}

function getProviderSummary(other) {
  const providerNameField = ['provider', 'name'].join('_');
  const providerDescriptionField = ['provider', 'description'].join('_');
  if (!other?.[providerNameField]) return '';
  if (other[providerDescriptionField]) {
    return `${other[providerNameField]}: ${other[providerDescriptionField]}`;
  }
  return other[providerNameField];
}

function getBillingSourceLabel(other, t) {
  if (!other?.billing_source) return '';
  if (other.billing_source === 'subscription') {
    if (other.subscription_source === 'dist_package') return t('dashboard.packages');
    if (other.subscription_source === 'order') return 'Main-site subscription';
    if (other.subscription_source === 'admin') return 'Admin subscription';
    return 'Subscription';
  }
  if (other.billing_source === 'wallet') return 'Wallet';
  return '';
}

function getLogTypeLabel(type, t) {
  const labels = {
    1: t('logs.typeTopup'),
    2: t('logs.typeConsume'),
    3: t('logs.typeManage'),
    4: t('logs.typeSystem'),
    5: t('logs.typeError'),
    6: t('logs.typeRefund'),
  };
  return labels[type] || t('logs.typeUnknown');
}

function getSitePricingDetails(other, symbol, rate) {
  if (!other?.site_billing_mode) return [];

  if (other.site_billing_mode === 'per_call') {
    return [
      { key: 'Pricing mode', value: 'Per call' },
      { key: 'Price', value: formatAmount(symbol, rate, other.site_fixed_price) },
    ];
  }

  const details = [{ key: 'Pricing mode', value: 'Pay as you go' }];
  if (Number(other.site_input_price || 0) > 0) {
    details.push({ key: 'Input price', value: `${formatAmount(symbol, rate, other.site_input_price)} / 1M tokens` });
  }
  if (Number(other.site_output_price || 0) > 0) {
    details.push({ key: 'Output price', value: `${formatAmount(symbol, rate, other.site_output_price)} / 1M tokens` });
  }
  if (Number(other.site_cache_read_price || 0) > 0) {
    details.push({ key: 'Cache read price', value: `${formatAmount(symbol, rate, other.site_cache_read_price)} / 1M tokens` });
  }

  const cacheCreate5m = Number(other.site_cache_creation_price_5m || 0);
  const cacheCreate1h = Number(other.site_cache_creation_price_1h || 0);
  const cacheCreate = Number(other.site_cache_creation_price || 0);
  if (cacheCreate5m > 0 || cacheCreate1h > 0) {
    const parts = [];
    if (cacheCreate5m > 0) parts.push(`5m ${formatAmount(symbol, rate, cacheCreate5m)} / 1M tokens`);
    if (cacheCreate1h > 0) parts.push(`1h ${formatAmount(symbol, rate, cacheCreate1h)} / 1M tokens`);
    details.push({ key: 'Cache creation price', value: parts.join(' / ') });
  } else if (cacheCreate > 0) {
    details.push({ key: 'Cache creation price', value: `${formatAmount(symbol, rate, cacheCreate)} / 1M tokens` });
  }

  return details;
}

export default function Logs() {
  const { t } = useTranslation();
  const { symbol, rate } = useCurrency();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingStat, setLoadingStat] = useState(true);
  const [stat, setStat] = useState({ quota: 0, rpm: 0, tpm: 0, token: 0 });
  const [modelFilter, setModelFilter] = useState('');
  const [tokenFilter, setTokenFilter] = useState('');
  const [requestIdFilter, setRequestIdFilter] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [logType, setLogType] = useState('2');
  const [appliedFilters, setAppliedFilters] = useState({ type: '2' });
  const [expandedRows, setExpandedRows] = useState({});
  const [preview, setPreview] = useState(null);
  const pageSize = 20;

  const getAppliedParams = useCallback(() => {
    const params = { type: appliedFilters.type || '2' };
    if (appliedFilters.model_name) params.model_name = appliedFilters.model_name;
    if (appliedFilters.token_name) params.token_name = appliedFilters.token_name;
    if (appliedFilters.request_id) params.request_id = appliedFilters.request_id;
    if (appliedFilters.start_timestamp) params.start_timestamp = appliedFilters.start_timestamp;
    if (appliedFilters.end_timestamp) params.end_timestamp = appliedFilters.end_timestamp;
    return params;
  }, [appliedFilters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { p: page, page_size: pageSize, ...getAppliedParams() };
      const res = await getUserLogs(params);
      if (res.data.success) {
        setLogs(res.data.data?.items || []);
        setTotal(res.data.data?.total || 0);
      }
    } catch {
      /* interceptor */
    }
    setLoading(false);
  }, [getAppliedParams, page]);

  const loadStat = useCallback(async () => {
    setLoadingStat(true);
    try {
      const res = await getUserLogsStat(getAppliedParams());
      if (res.data.success) {
        setStat(res.data.data || { quota: 0, rpm: 0, tpm: 0, token: 0 });
      }
    } catch {
      /* interceptor */
    }
    setLoadingStat(false);
  }, [getAppliedParams]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStat(); }, [loadStat]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const applyFilters = useCallback(() => {
    setExpandedRows({});
    setPage(1);
    setAppliedFilters({
      type: logType,
      model_name: modelFilter.trim(),
      token_name: tokenFilter.trim(),
      request_id: requestIdFilter.trim(),
      start_timestamp: parseDatetimeLocal(startTime),
      end_timestamp: parseDatetimeLocal(endTime),
    });
  }, [endTime, logType, modelFilter, requestIdFilter, startTime, tokenFilter]);

  const resetFilters = useCallback(() => {
    setModelFilter('');
    setTokenFilter('');
    setRequestIdFilter('');
    setStartTime('');
    setEndTime('');
    setLogType('2');
    setExpandedRows({});
    setPage(1);
    setAppliedFilters({ type: '2' });
  }, []);

  const setQuickRange = useCallback((days) => {
    const now = new Date();
    const start = new Date(now);
    if (days === 0) start.setHours(0, 0, 0, 0);
    else start.setDate(start.getDate() - days);
    setStartTime(formatDateTimeLocal(start));
    setEndTime(formatDateTimeLocal(now));
  }, []);

  const toggleRow = (logId) => setExpandedRows((prev) => ({ ...prev, [logId]: !prev[logId] }));

  const getExpandData = useCallback((log) => {
    const other = getLogOther(log.other);
    if (!other) return [];

    const data = [];
    const billingSourceLabel = getBillingSourceLabel(other, t);
    const providerSummary = getProviderSummary(other);
    if (providerSummary) data.push({ key: 'Provider', value: providerSummary });
    if (billingSourceLabel) data.push({ key: 'Actual billing source', value: billingSourceLabel });
    if (log.content) data.push({ key: t('logs.content'), value: log.content });
    data.push(...getSitePricingDetails(other, symbol, rate));
    if (other.cache_tokens > 0) data.push({ key: 'Cache hit tokens', value: Number(other.cache_tokens).toLocaleString() });
    if (other.cache_creation_tokens > 0) data.push({ key: 'Cache creation tokens', value: Number(other.cache_creation_tokens).toLocaleString() });
    if (other.cache_creation_tokens_5m > 0) data.push({ key: 'Cache creation tokens (5m)', value: Number(other.cache_creation_tokens_5m).toLocaleString() });
    if (other.cache_creation_tokens_1h > 0) data.push({ key: 'Cache creation tokens (1h)', value: Number(other.cache_creation_tokens_1h).toLocaleString() });
    if (log.request_id) data.push({ key: 'Request ID', value: log.request_id });
    if (log.is_stream !== undefined) data.push({ key: 'Streaming', value: log.is_stream ? 'Yes' : 'No' });
    if (log.is_stream && other.frt) {
      const frtSeconds = (parseFloat(other.frt) / 1000.0).toFixed(1);
      data.push({ key: 'First token time', value: `${frtSeconds}s` });
    }
    return data;
  }, [rate, symbol, t]);

  const statCards = [
    <ConsoleStat key="cost" icon={Wallet} label={t('logs.totalCost')} value={formatQuotaAmount(symbol, rate, stat.quota, false)} helper="Aggregate cost for the current filter" tone="cyan" />,
    <ConsoleStat key="rpm" icon={Activity} label="RPM" value={formatTokens(stat.rpm)} helper="Requests per minute" tone="sky" />,
    <ConsoleStat key="tpm" icon={Zap} label="TPM" value={formatTokens(stat.tpm)} helper="Tokens per minute" tone="emerald" />,
    <ConsoleStat key="tokens" icon={Sigma} label={t('logs.totalTokens')} value={formatTokens(stat.token)} helper="Prompt + completion tokens" tone="amber" />,
  ];

  const rows = logs.map((log, i) => {
    const expandData = getExpandData(log);
    const hasExpandData = expandData.length > 0;
    const isExpanded = expandedRows[log.id];
    const billingSourceLabel = getBillingSourceLabel(getLogOther(log.other), t);
    return (
      <React.Fragment key={i}>
        <tr
          className={`border-b border-page-divider last:border-0 transition-colors ${hasExpandData ? 'cursor-pointer hover:bg-page-surface' : ''}`}
          onClick={() => hasExpandData && toggleRow(log.id)}
        >
          <td className="px-2 py-3 text-page-secondary">
            {hasExpandData && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
          </td>
          <td className="px-4 py-3 text-xs whitespace-nowrap text-page-secondary">{formatTime(log.created_at)}</td>
          <td className="px-4 py-3"><span className="font-mono text-xs text-page">{log.model_name || '-'}</span></td>
          <td className="px-4 py-3 text-xs text-page-secondary">{log.token_name || '-'}</td>
          <td className="px-4 py-3"><ConsoleBadge tone="slate">{getLogTypeLabel(log.type, t)}</ConsoleBadge></td>
          <td className="px-4 py-3 text-right font-mono text-xs text-page-label">{log.prompt_tokens?.toLocaleString() || '0'}</td>
          <td className="px-4 py-3 text-right font-mono text-xs text-page-label">{log.completion_tokens?.toLocaleString() || '0'}</td>
          <td className="px-4 py-3 text-right">
            <div className="flex flex-col items-end">
              <span className="font-mono text-xs text-page-warning">{formatQuotaAmount(symbol, rate, log.quota)}</span>
              {billingSourceLabel && <span className="mt-1 text-[10px] text-page-secondary">{billingSourceLabel}</span>}
            </div>
          </td>
          <td className="px-4 py-3 text-right text-xs text-page-secondary">{log.use_time > 0 ? `${log.use_time}s` : '-'}</td>
        </tr>
        {isExpanded && hasExpandData && (
          <tr className="border-b border-page-divider last:border-0 bg-page-surface/50">
            <td colSpan="9" className="px-4 py-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
                {expandData.map((item, idx) => (
                  <div key={idx} className="flex flex-col">
                    <span className="text-xs text-page-secondary">{item.key}</span>
                    <span className="text-sm font-medium text-page">{item.value}</span>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  });

  const mobileRows = logs.map((log, i) => {
    const expandData = getExpandData(log);
    const hasExpandData = expandData.length > 0;
    const isExpanded = expandedRows[log.id];
    const billingSourceLabel = getBillingSourceLabel(getLogOther(log.other), t);
    return (
      <div key={i} className="space-y-2 px-4 py-3">
        <div className={`flex items-start justify-between gap-3 ${hasExpandData ? 'cursor-pointer' : ''}`} onClick={() => hasExpandData && toggleRow(log.id)}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {hasExpandData && (isExpanded ? <ChevronDown className="h-4 w-4 text-page-secondary" /> : <ChevronRight className="h-4 w-4 text-page-secondary" />)}
              <span className="font-mono text-xs text-page font-medium">{log.model_name || '-'}</span>
              <ConsoleBadge tone="slate">{getLogTypeLabel(log.type, t)}</ConsoleBadge>
            </div>
            <div className="mt-1 text-[11px] text-page-secondary">{formatTime(log.created_at)}</div>
            {log.token_name && <div className="mt-1 text-[11px] text-page-muted">{log.token_name}</div>}
          </div>
          <div className="text-right">
            <div className="font-mono text-xs text-page-warning">{formatQuotaAmount(symbol, rate, log.quota)}</div>
            {billingSourceLabel && <div className="mt-1 text-[10px] text-page-secondary">{billingSourceLabel}</div>}
          </div>
        </div>
        <div className="text-[11px] text-page-secondary">
          {log.prompt_tokens || 0} prompt / {log.completion_tokens || 0} completion tokens
        </div>
        {isExpanded && hasExpandData && (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-page-divider/60 pt-3">
            {expandData.map((item, idx) => (
              <div key={idx} className="flex flex-col">
                <span className="text-[10px] text-page-secondary">{item.key}</span>
                <span className="text-xs font-medium text-page">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  });

  return (
    <ConsolePage>
      <ConsoleHero
        eyebrow="Usage logs"
        title={t('logs.title')}
        subtitle={t('logs.subtitle')}
        actions={[
          <button key="reset" type="button" onClick={resetFilters} className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5">
            <RotateCcw className="h-4 w-4" />
            {t('logs.clearFilter')}
          </button>,
        ]}
        stats={statCards}
      />

      <ConsoleSection
        className="mt-6"
        title="Filter logs"
        subtitle="Search by model, token, request ID, and time range."
      >
        <form onSubmit={(event) => { event.preventDefault(); applyFilters(); }} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input w-full" aria-label={t('logs.startTime')} />
            <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input w-full" aria-label={t('logs.endTime')} />
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-page-muted" />
              <input type="text" value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} className="input w-full pl-10" placeholder={t('logs.filterModel')} />
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-page-muted" />
              <input type="text" value={tokenFilter} onChange={(e) => setTokenFilter(e.target.value)} className="input w-full pl-10" placeholder={t('logs.filterToken')} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2fr]">
            <select value={logType} onChange={(e) => setLogType(e.target.value)} className="input w-full" aria-label={t('logs.type')}>
              <option value="0">{t('logs.typeAll')}</option>
              <option value="2">{t('logs.typeConsume')}</option>
              <option value="5">{t('logs.typeError')}</option>
              <option value="1">{t('logs.typeTopup')}</option>
              <option value="6">{t('logs.typeRefund')}</option>
              <option value="3">{t('logs.typeManage')}</option>
              <option value="4">{t('logs.typeSystem')}</option>
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-page-muted" />
              <input type="text" value={requestIdFilter} onChange={(e) => setRequestIdFilter(e.target.value)} className="input w-full pl-10" placeholder={t('logs.filterRequestId')} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setQuickRange(0)} className="btn-secondary flex-1 px-3 text-xs">{t('logs.today')}</button>
              <button type="button" onClick={() => setQuickRange(7)} className="btn-secondary flex-1 px-3 text-xs">{t('logs.last7Days')}</button>
              <button type="button" onClick={() => setQuickRange(30)} className="btn-secondary flex-1 px-3 text-xs">{t('logs.last30Days')}</button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="submit" className="btn-primary inline-flex items-center gap-2 px-4" disabled={loading}>
              <Search className="h-4 w-4" />
              {t('logs.search')}
            </button>
            <button type="button" onClick={resetFilters} className="btn-secondary inline-flex items-center gap-2 px-4">
              <RotateCcw className="h-4 w-4" />
              {t('logs.clearFilter')}
            </button>
          </div>
        </form>
      </ConsoleSection>

      <div className="mt-6">
        {loading ? (
          <div className="glass flex items-center justify-center rounded-2xl py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-500" />
          </div>
        ) : logs.length === 0 ? (
          <ConsoleEmpty
            icon={Activity}
            title={t('logs.noLogs')}
            description="Try a wider time range or clear the filters."
          />
        ) : (
          <div className="glass overflow-hidden rounded-2xl">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-page-divider bg-page-surface/40 text-left text-page-muted">
                    <th className="w-8" />
                    <th className="px-4 py-3 font-medium">{t('logs.time')}</th>
                    <th className="px-4 py-3 font-medium">{t('logs.model')}</th>
                    <th className="px-4 py-3 font-medium">{t('logs.token')}</th>
                    <th className="px-4 py-3 font-medium">{t('logs.type')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('logs.promptTokens')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('logs.completionTokens')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('logs.cost')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('logs.duration')}</th>
                  </tr>
                </thead>
                <tbody>{rows}</tbody>
              </table>
            </div>

            <div className="divide-y divide-page-divider md:hidden">
              {mobileRows}
            </div>
          </div>
        )}
      </div>

      {total > pageSize && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-sm text-page-muted">
            {t('logs.showing', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total), total })}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} className="btn-secondary px-3 disabled:opacity-40">
              {t('logs.prev')}
            </button>
            <span className="text-sm text-page-muted">{page} / {totalPages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading} className="btn-secondary px-3 disabled:opacity-40">
              {t('logs.next')}
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="relative max-h-[90vh] max-w-[92vw]" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="absolute -right-3 -top-3 z-10 rounded-full bg-white p-2 text-slate-900 shadow-lg" onClick={() => setPreview(null)}>
              <X className="h-4 w-4" />
            </button>
            {preview.type === 'video' && (
              <div className="rounded-2xl bg-black p-2 shadow-2xl">
                <video src={preview.url} controls autoPlay className="max-h-[82vh] max-w-[88vw] rounded-xl" />
                <a href={preview.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-white/80 hover:text-white">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('tasks.openNewTab')}
                </a>
              </div>
            )}
            {preview.type === 'image' && (
              <img src={preview.url} alt={t('tasks.previewImage')} className="max-h-[88vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl" onClick={() => window.open(preview.url, '_blank')} />
            )}
            {preview.type === 'text' && (
              <div className="max-h-[70vh] w-[min(760px,90vw)] overflow-auto rounded-2xl bg-white p-5 text-sm text-slate-800 shadow-2xl">
                <pre className="whitespace-pre-wrap break-words">{preview.text}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </ConsolePage>
  );
}
