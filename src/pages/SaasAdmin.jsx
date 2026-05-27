import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Activity, KeyRound, Layers3, Loader2, RefreshCcw, Save, UploadCloud } from 'lucide-react';
import {
  activateSiteSaasOrder,
  getSitePackages,
  getSiteSaasAdminState,
  importSiteSaasCodes,
  updateSiteSaasAdminConfig,
} from '../api';
import {
  ConsoleBadge,
  ConsoleField,
  ConsoleFrame,
  ConsoleFrameHeader,
  ConsoleHero,
  ConsolePage,
  ConsoleSection,
  ConsoleStat,
} from '../components/ConsoleSurface';

const adminTokenKey = 'site_saas_admin_token';
const invalidTokenMessage = 'Invalid site admin token. Enter the current SITE_ADMIN_TOKEN from the site backend and reconnect.';

function fallbackPackagesFromState(data) {
  const packageIds = new Set([
    ...Object.keys(data?.config?.package_mappings || {}),
    ...(data?.code_stats || []).map((stat) => stat.package_id).filter(Boolean),
  ]);
  return [...packageIds].map((id) => ({
    id,
    name: id,
    enabled: true,
  }));
}

function emptyConfig() {
  return {
    creem_api_key: '',
    creem_api_base_url: 'https://api.creem.io',
    creem_checkout_path: '/v1/checkouts',
    creem_webhook_secret: '',
    subrouter_base_url: 'http://localhost:3000',
    public_api_base_url: '',
    subrouter_internal_token: '',
  };
}

export default function SaasAdmin() {
  const [token, setToken] = useState(() => localStorage.getItem(adminTokenKey) || '');
  const [accessError, setAccessError] = useState('');
  const [state, setState] = useState(null);
  const [packages, setPackages] = useState([]);
  const [config, setConfig] = useState(emptyConfig());
  const [mappings, setMappings] = useState({});
  const [selectedPackage, setSelectedPackage] = useState('');
  const [codesInput, setCodesInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [activatingOrder, setActivatingOrder] = useState('');

  const enabledPackages = useMemo(
    () => packages.filter((pkg) => pkg.enabled !== false),
    [packages],
  );

  const loadPackages = async () => {
    const res = await getSitePackages().catch(() => null);
    if (res?.data?.success) {
      const data = res.data.data || [];
      setPackages(data);
      setSelectedPackage((current) => current || data[0]?.id || '');
    }
  };

  const loadState = async (nextToken = token) => {
    setLoading(true);
    setAccessError('');
    const adminToken = String(nextToken || '').trim();
    if (adminToken) {
      localStorage.setItem(adminTokenKey, adminToken);
    } else {
      localStorage.removeItem(adminTokenKey);
    }
    setToken(adminToken);

    const res = await getSiteSaasAdminState(adminToken).catch((error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem(adminTokenKey);
        setToken('');
        setAccessError(invalidTokenMessage);
        setState(null);
        toast.error(invalidTokenMessage);
        return null;
      }
      const message = error.response?.data?.message || 'Unable to load SaaS admin state';
      setAccessError(message);
      toast.error(message);
      return null;
    });
    if (res?.data?.success) {
      const data = res.data.data;
      setAccessError('');
      setState(data);
      setConfig((current) => ({
        ...current,
        creem_api_base_url: data.config?.creem_api_base_url || current.creem_api_base_url,
        creem_checkout_path: data.config?.creem_checkout_path || current.creem_checkout_path,
        subrouter_base_url: data.config?.subrouter_base_url || current.subrouter_base_url,
        public_api_base_url: data.config?.public_api_base_url ?? current.public_api_base_url,
      }));
      setMappings(data.config?.package_mappings || {});
      setPackages((current) => (current.length ? current : fallbackPackagesFromState(data)));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPackages();
  }, []);

  useEffect(() => {
    loadState();
  }, []);

  const updateMapping = (packageId, value) => {
    setMappings((current) => ({
      ...current,
      [packageId]: {
        ...(current[packageId] || {}),
        creem_product_id: value,
      },
    }));
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    const adminToken = token.trim();
    const payload = {
      creem_api_base_url: config.creem_api_base_url,
      creem_checkout_path: config.creem_checkout_path,
      subrouter_base_url: config.subrouter_base_url,
      public_api_base_url: config.public_api_base_url,
      package_mappings: mappings,
    };
    if (config.creem_api_key.trim()) payload.creem_api_key = config.creem_api_key.trim();
    if (config.creem_webhook_secret.trim()) payload.creem_webhook_secret = config.creem_webhook_secret.trim();
    if (config.subrouter_internal_token.trim()) payload.subrouter_internal_token = config.subrouter_internal_token.trim();

    const res = await updateSiteSaasAdminConfig(adminToken, payload).catch((error) => {
      toast.error(error.response?.data?.message || 'Failed to save SaaS config');
      return null;
    });
    if (res?.data?.success) {
      toast.success('SaaS billing config saved');
      setConfig((current) => ({
        ...current,
        creem_api_key: '',
        creem_webhook_secret: '',
        subrouter_internal_token: '',
      }));
      setState(res.data.data);
      setPackages((current) => (current.length ? current : fallbackPackagesFromState(res.data.data)));
    }
    setSaving(false);
  };

  const handleImportCodes = async () => {
    if (!selectedPackage || !codesInput.trim()) {
      toast.error('Select a target package and paste internal activation codes first');
      return;
    }
    setImporting(true);
    const adminToken = token.trim();
    const res = await importSiteSaasCodes(adminToken, {
      package_id: selectedPackage,
      codes: codesInput,
    }).catch((error) => {
      toast.error(error.response?.data?.message || 'Failed to import codes');
      return null;
    });
    if (res?.data?.success) {
      toast.success(`Imported ${res.data.data.imported} new codes`);
      setCodesInput('');
      setState(res.data.data.state);
      setPackages((current) => (current.length ? current : fallbackPackagesFromState(res.data.data.state)));
    }
    setImporting(false);
  };

  const handleActivateOrder = async (orderId) => {
    const adminToken = token.trim();
    if (!adminToken && token) setToken(adminToken);
    setActivatingOrder(orderId);
    const res = await activateSiteSaasOrder(adminToken, orderId).catch((error) => {
      toast.error(error.response?.data?.message || 'Failed to activate order');
      return null;
    });
    if (res?.data?.success) {
      toast.success('Order activated');
      setState(res.data.state || res.data.data?.state || state);
      await loadState(adminToken);
    } else if (res?.data?.data?.message || res?.data?.data) {
      toast.error(res.data.data?.message || 'Activation needs attention');
      await loadState(adminToken);
    }
    setActivatingOrder('');
  };

  return (
    <ConsolePage>
      <ConsoleHero
        eyebrow="Site-owned SaaS backend"
        title="SaaS Billing Admin"
        subtitle="Configure Creem, map SubRouter packages to Creem products, and upload the internal code pool used to activate subscriptions after payment."
        actions={[
          <button
            key="refresh"
            type="button"
            onClick={() => loadState()}
            disabled={loading}
            className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Refresh
          </button>,
        ]}
        stats={[
          <ConsoleStat key="packages" icon={Layers3} label="Packages" value={enabledPackages.length.toLocaleString()} helper="Enabled package mappings" tone="cyan" />,
          <ConsoleStat key="codes" icon={KeyRound} label="Code pools" value={(state?.code_stats || []).length.toLocaleString()} helper="Packages with imported codes" tone="sky" />,
          <ConsoleStat key="events" icon={Activity} label="Events" value={(state?.events || []).length.toLocaleString()} helper="Recent backend events" tone="emerald" />,
        ]}
      />

      <ConsoleSection className="mt-6" title="Admin access" subtitle="Set SITE_ADMIN_TOKEN on the site backend in production. If it is empty, local development allows access without a token.">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-page-muted" />
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              type="password"
              className="input pl-10"
              placeholder="SITE_ADMIN_TOKEN"
            />
          </div>
          <button type="button" onClick={() => loadState()} disabled={loading} className="btn-primary inline-flex items-center justify-center px-4 py-2.5 disabled:opacity-60">
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
        {accessError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {accessError}
          </p>
        )}
      </ConsoleSection>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <ConsoleFrame>
          <ConsoleFrameHeader title="Payment and backend settings" subtitle="Secrets can be left blank to keep the configured production value." />
          <div className="p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Creem API key" value={config.creem_api_key} onChange={(value) => setConfig({ ...config, creem_api_key: value })} placeholder={state?.config?.creem_api_key_configured ? 'Configured. Leave blank to keep.' : 'Enter API key'} secret />
              <Field label="Creem webhook secret" value={config.creem_webhook_secret} onChange={(value) => setConfig({ ...config, creem_webhook_secret: value })} placeholder={state?.config?.creem_webhook_secret_configured ? 'Configured. Leave blank to keep.' : 'Webhook signing secret'} secret />
              <Field label="Creem API base URL" value={config.creem_api_base_url} onChange={(value) => setConfig({ ...config, creem_api_base_url: value })} />
              <Field label="Checkout path" value={config.creem_checkout_path} onChange={(value) => setConfig({ ...config, creem_checkout_path: value })} />
              <Field label="SubRouter API base URL" value={config.subrouter_base_url} onChange={(value) => setConfig({ ...config, subrouter_base_url: value })} />
              <Field label="Public API base URL" value={config.public_api_base_url} onChange={(value) => setConfig({ ...config, public_api_base_url: value })} placeholder="Leave blank to use frontend default /v1" />
              <Field label="SubRouter internal token" value={config.subrouter_internal_token} onChange={(value) => setConfig({ ...config, subrouter_internal_token: value })} placeholder={state?.config?.subrouter_internal_token_configured ? 'Configured. Leave blank to keep.' : 'Optional'} secret />
            </div>

            <div className="mt-8">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-page-muted">Package to Creem product mapping</h3>
                <ConsoleBadge tone="slate">{enabledPackages.length} packages</ConsoleBadge>
              </div>
              <div className="overflow-hidden rounded-xl border border-page-divider">
                {enabledPackages.length === 0 ? (
                  <p className="p-4 text-sm text-page-muted">No SubRouter packages loaded. Add package mappings after the public package API is available.</p>
                ) : (
                  enabledPackages.map((pkg) => (
                    <div key={pkg.id} className="grid gap-3 border-b border-page-divider p-4 last:border-0 md:grid-cols-[1fr_1.2fr] md:items-center">
                      <div className="min-w-0">
                        <p className="font-medium text-page">{pkg.name}</p>
                        <p className="mt-1 break-all font-mono text-xs text-page-muted">{pkg.id}</p>
                      </div>
                      <input
                        value={mappings[pkg.id]?.creem_product_id || pkg.creem_product_id || ''}
                        onChange={(event) => updateMapping(pkg.id, event.target.value)}
                        className="input"
                        placeholder="prod_xxx"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={saving}
              className="btn-primary mt-5 inline-flex items-center gap-2 px-4 py-2.5 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save settings
            </button>
          </div>
        </ConsoleFrame>

        <ConsoleFrame>
          <ConsoleFrameHeader title="Internal code pool" subtitle="Paste one code per line. Codes are grouped by target package and consumed after payment confirmation." />
          <div className="p-4 sm:p-5">
            <ConsoleField label="Target package">
              <select value={selectedPackage} onChange={(event) => setSelectedPackage(event.target.value)} className="input">
                {enabledPackages.length === 0 ? (
                  <option value="">No packages loaded</option>
                ) : (
                  enabledPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>{pkg.name} ({pkg.id})</option>
                  ))
                )}
              </select>
            </ConsoleField>
            <ConsoleField label="Activation codes" className="mt-4">
              <textarea
                value={codesInput}
                onChange={(event) => setCodesInput(event.target.value)}
                rows={9}
                className="input resize-y px-3 py-2"
                placeholder={'code_1\ncode_2\ncode_3'}
              />
            </ConsoleField>
            <button
              type="button"
              onClick={handleImportCodes}
              disabled={importing}
              className="btn-primary mt-3 inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 disabled:opacity-60"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Import codes
            </button>

            <CodeStats stats={state?.code_stats || []} />
          </div>
        </ConsoleFrame>
      </div>

      <ConsoleFrame className="mt-6">
        <ConsoleFrameHeader title="Recent orders" subtitle="Manual activation is available for paid orders when a webhook did not complete the internal redemption flow." />
        <div className="divide-y divide-page-divider">
          {(state?.orders || []).length === 0 ? (
            <p className="p-4 text-sm text-page-muted">No orders yet.</p>
          ) : (
            state.orders.slice(0, 8).map((order) => {
              const canActivate = order.status !== 'activated';
              return (
                <div key={order.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[180px_120px_1fr_180px] lg:items-center">
                  <span className="text-page-muted">{new Date(order.created_at).toLocaleString()}</span>
                  <span className="font-semibold text-page">{order.status || 'pending'}</span>
                  <div className="min-w-0">
                    <p className="break-all font-mono text-xs text-page-secondary">{order.id}</p>
                    <p className="mt-1 text-xs text-page-muted">Package {order.package_id} · User {order.user_id}</p>
                    {order.error && <p className="mt-1 break-all text-xs text-page-danger">{order.error}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleActivateOrder(order.id)}
                    disabled={!canActivate || activatingOrder === order.id}
                    className="btn-secondary inline-flex items-center justify-center gap-2 px-3 py-2 text-xs disabled:opacity-50"
                  >
                    {activatingOrder === order.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                    Activate
                  </button>
                </div>
              );
            })
          )}
        </div>
      </ConsoleFrame>

      <ConsoleFrame className="mt-6">
        <ConsoleFrameHeader title="Recent backend events" subtitle="Latest SaaS checkout, code redemption, and subscription events." />
        <div className="divide-y divide-page-divider">
          {(state?.events || []).length === 0 ? (
            <p className="p-4 text-sm text-page-muted">No events yet.</p>
          ) : (
            state.events.slice(0, 12).map((event) => (
              <div key={event.id} className="grid gap-2 p-4 text-sm md:grid-cols-[180px_180px_1fr]">
                <span className="text-page-muted">{new Date(event.created_at).toLocaleString()}</span>
                <span className="font-semibold text-page">{event.type}</span>
                <code className="break-all rounded-lg bg-page-surface px-2 py-1 text-xs text-page-secondary">{JSON.stringify(event.detail || {})}</code>
              </div>
            ))
          )}
        </div>
      </ConsoleFrame>
    </ConsolePage>
  );
}

function Field({ label, value, onChange, placeholder, secret = false }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-page-label">{label}</span>
      <input
        type={secret ? 'password' : 'text'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input"
      />
    </label>
  );
}

function CodeStats({ stats }) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-page-divider">
      <div className="hidden grid-cols-5 bg-page-surface/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-page-muted sm:grid">
        <span>Package</span>
        <span>Total</span>
        <span>Free</span>
        <span>Activated</span>
        <span>Failed</span>
      </div>
      {stats.length === 0 ? (
        <p className="p-4 text-sm text-page-muted">No codes imported yet.</p>
      ) : (
        stats.map((stat) => (
          <div key={stat.package_id} className="grid gap-2 border-t border-page-divider px-3 py-3 text-sm sm:grid-cols-5 sm:py-2">
            <span className="truncate font-mono text-xs text-page-secondary">{stat.package_id}</span>
            <MetricValue label="Total" value={stat.total} />
            <MetricValue label="Free" value={stat.available} className="text-page-success" />
            <MetricValue label="Activated" value={stat.subscribed} />
            <MetricValue label="Failed" value={stat.failed} className="text-page-danger" />
          </div>
        ))
      )}
    </div>
  );
}

function MetricValue({ label, value, className = '' }) {
  return (
    <span className={className}>
      <span className="text-xs text-page-muted sm:hidden">{label} </span>
      {value}
    </span>
  );
}
