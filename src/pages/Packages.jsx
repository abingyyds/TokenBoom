import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CreditCard,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/SiteContext';
import {
  CossCard,
  CossCardFrame,
  CossIconTile,
  CossMutedCard,
  CossPage,
  CossPageHeader,
  CossSection,
} from '../components/public/CossLayout';
import {
  getActiveSubscriptions,
  getSiteModels,
  getSitePackages,
  Q,
  subscribePackage,
  userRequestConfig,
} from '../api';
import { readPublicModelCatalog } from '../utils/publicCatalog';

const resetLabelKeys = {
  never: 'packages.resetNever',
  daily: 'packages.resetDaily',
  weekly: 'packages.resetWeekly',
  monthly: 'packages.resetMonthly',
};

function formatDate(value) {
  if (!value) return '—';
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? (numeric > 10000000000 ? new Date(numeric) : new Date(numeric * 1000))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function getPackageStatus(sub) {
  return String(sub.status || sub.subscription_status || 'active').toLowerCase();
}

function isBalanceError(message = '') {
  return /balance|余额|insufficient|不足|not enough|quota/i.test(String(message));
}

function BillingStep({ icon: Icon, title, desc }) {
  return (
    <CossCard className="p-5">
      <CossIconTile icon={Icon} />
      <h3 className="mt-4 text-sm font-semibold text-page">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-page-secondary">{desc}</p>
    </CossCard>
  );
}

export default function Packages() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { fmtPlanPrice, symbol, rate, code, usdRate } = useCurrency();
  const cachedCatalog = useMemo(() => readPublicModelCatalog(), []);

  const [packages, setPackages] = useState([]);
  const [models, setModels] = useState(() => cachedCatalog.models || []);
  const [activeSubs, setActiveSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(null);
  const [confirmBalancePkg, setConfirmBalancePkg] = useState(null);
  const [insufficientPkg, setInsufficientPkg] = useState(null);

  const getResetLabel = (period) => t(resetLabelKeys[period] || resetLabelKeys.never);

  const loadSubscriptions = useCallback(async () => {
    if (!user) {
      setActiveSubs([]);
      return;
    }
    const balanceRes = await getActiveSubscriptions(userRequestConfig(user, { skipErrorHandler: true })).catch(() => null);
    const balanceSubscriptions = (balanceRes?.data?.success ? balanceRes.data.data || [] : [])
      .map((item) => ({ ...item, billing_source: item.billing_source || 'balance' }));
    setActiveSubs(balanceSubscriptions);
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    getSitePackages()
      .then((r) => {
        if (!cancelled && r.data.success) setPackages(r.data.data || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    getSiteModels()
      .then((r) => {
        if (!cancelled && r.data.success) setModels(r.data.data || []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) {
        setActiveSubs([]);
        return;
      }
      try {
        await loadSubscriptions();
      } catch {
        if (!cancelled) setActiveSubs([]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, loadSubscriptions]);

  const enabledPackages = useMemo(
    () => packages.filter((pkg) => pkg.enabled !== false),
    [packages],
  );
  const enabledModels = useMemo(
    () => models.filter((model) => model.enabled !== false),
    [models],
  );

  const packageById = useMemo(() => {
    const map = new Map();
    enabledPackages.forEach((pkg) => map.set(String(pkg.id), pkg));
    return map;
  }, [enabledPackages]);

  const userBalance = ((user?.quota || 0) / Q) * rate;
  const formatBalancePrice = (pkg) => fmtPlanPrice(pkg.price, pkg.currency);
  const getPackageDisplayPrice = (pkg) => {
    const packageCurrency = String(pkg.currency || '').toUpperCase();
    const rawPrice = Number(pkg.price || 0);
    if (!Number.isFinite(rawPrice)) return 0;
    if (packageCurrency === 'USD') return rawPrice * rate;
    if (code === 'CNY') return rawPrice;
    return (rawPrice / usdRate) * rate;
  };

  const handleBalancePurchase = (pkg) => {
    if (!user) {
      navigate('/register');
      return;
    }

    const price = getPackageDisplayPrice(pkg);
    if (Number.isFinite(price) && userBalance < price) {
      setInsufficientPkg(pkg);
      return;
    }

    setConfirmBalancePkg(pkg);
  };

  const confirmBalancePurchase = async () => {
    if (!confirmBalancePkg) return;
    const pkg = confirmBalancePkg;
    setBalanceLoading(pkg.id);
    try {
      const res = await subscribePackage(pkg.id, userRequestConfig(user, { skipErrorHandler: true }));
      if (res.data.success) {
        toast.success(t('packages.subscribedSuccess'));
        setConfirmBalancePkg(null);
        await refreshUser({ skipErrorHandler: true }).catch(() => null);
        await loadSubscriptions();
      } else {
        const message = res.data.message || t('common.requestFailed');
        if (isBalanceError(message)) {
          setConfirmBalancePkg(null);
          setInsufficientPkg(pkg);
        } else {
          toast.error(message);
        }
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || t('common.requestFailed');
      if (isBalanceError(message)) {
        setConfirmBalancePkg(null);
        setInsufficientPkg(pkg);
      } else {
        toast.error(message);
      }
    } finally {
      setBalanceLoading(null);
    }
  };

  if (loading) {
    return (
      <CossPage className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-page-muted" size={28} />
      </CossPage>
    );
  }

  return (
    <CossPage>
      <CossPageHeader
        eyebrow="Packages"
        icon={RefreshCcw}
        title="Choose a balance package."
        description="Use your existing account balance to buy a package immediately. Top up first if your balance is not enough."
      />

      {activeSubs.length > 0 && (
        <CossSection>
          <CossCardFrame className="p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-page">{t('packages.mySubscriptions')}</h2>
                <p className="mt-1 text-sm text-page-muted">Your active packages and available credits are managed automatically.</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {activeSubs.map((sub) => {
                const pkg = packageById.get(String(sub.package_id));
                const total = sub.amount_total || sub.quota_amount || pkg?.quota_amount || 0;
                const used = sub.amount_used || sub.used_quota || 0;
                const remain = Math.max(0, total - used);
                const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
                const status = getPackageStatus(sub);

                return (
                  <CossMutedCard key={`${sub.billing_source || 'balance'}-${sub.id}`} className="p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-page">{pkg?.name || sub.package_name || t('packages.subscriptionId', { id: sub.id })}</p>
                        <p className="mt-1 text-xs text-page-muted">
                          Balance package #{sub.id}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        ['active', 'trialing'].includes(status)
                          ? 'bg-emerald-500/10 text-page-success'
                          : status.includes('cancel')
                            ? 'bg-amber-500/10 text-page-warning'
                            : 'bg-page-surface text-page-secondary'
                      }`}>
                        {status}
                      </span>
                    </div>
                    <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-page-muted">Expires</p>
                        <p className="mt-1 font-medium text-page">{formatDate(sub.end_time || sub.current_period_end)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-page-muted">Next reset</p>
                        <p className="mt-1 font-medium text-page">{formatDate(sub.next_reset_time)}</p>
                      </div>
                    </div>
                    <div className="mb-1 flex items-center justify-between text-xs text-page-muted">
                      <span>Credit used</span>
                      <span>{symbol}{(remain / Q * rate).toFixed(2)} remaining</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-page-inset">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </CossMutedCard>
                );
              })}
            </div>
          </CossCardFrame>
        </CossSection>
      )}

      <CossSection>
        {enabledPackages.length === 0 ? (
          <CossCardFrame className="p-10 text-center">
            <p className="text-page-secondary">{t('packages.noPackages')}</p>
            <Link to="/models?sort=price" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-page">
              {t('packages.checkPricing')} <ArrowRight size={16} />
            </Link>
          </CossCardFrame>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {enabledPackages.map((pkg, index) => {
              const resetPeriod = pkg.quota_reset_period || 'never';
              const monthlyCredit = pkg.quota_amount > 0 ? pkg.quota_amount / Q : 0;
              const creditLabel = monthlyCredit > 0
                ? resetPeriod === 'never'
                  ? t('packages.creditIncluded', { symbol, amount: (monthlyCredit * rate).toFixed(2) })
                  : t('packages.periodicQuota', { symbol, amount: (monthlyCredit * rate).toFixed(2), period: getResetLabel(resetPeriod) })
                : 'Custom credit allocation';
              const isFeatured = index === 1 || pkg.recommended || pkg.is_popular;
              return (
                <div
                  key={pkg.id}
                  className={`coss-card-frame relative flex flex-col p-5 sm:p-6 ${
                    isFeatured ? 'border-brand-500/50 shadow-lg shadow-brand-500/20' : ''
                  }`}
                >
                  {isFeatured && (
                    <span className="mb-5 inline-flex w-fit rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-[#0b061f]">
                      Recommended
                    </span>
                  )}
                  <div className="flex-1">
                    <h3 className="break-words text-lg font-semibold text-page sm:text-xl">{pkg.name}</h3>
                    {pkg.description && (
                      <p className="mt-2 min-h-[48px] text-sm leading-6 text-page-secondary">{pkg.description}</p>
                    )}

                    <div className="mt-6 flex items-end gap-2">
                      <span className="text-3xl font-semibold tracking-normal text-page sm:text-4xl">
                        {fmtPlanPrice(pkg.price, pkg.currency)}
                      </span>
                    </div>
                    {pkg.original_price > 0 && pkg.original_price > pkg.price && (
                      <p className="mt-1 text-sm text-page-muted line-through">
                        {fmtPlanPrice(pkg.original_price, pkg.currency)}
                      </p>
                    )}
                    {pkg.duration > 0 && (
                      <p className="mt-2 text-sm text-page-muted">{t('packages.daysAccess', { count: pkg.duration })}</p>
                    )}

                    <div className="mt-6 rounded-lg border border-page-divider bg-page-surface/50 p-4">
                      <div className="flex items-start gap-3">
                        <RefreshCcw className="mt-0.5 text-page-secondary" size={18} />
                        <div>
                          <p className="text-sm font-semibold text-page">
                            Balance purchase
                          </p>
                          <p className="mt-1 text-sm leading-6 text-page-secondary">
                            Pay from your account balance and activate this package immediately.
                          </p>
                        </div>
                      </div>
                    </div>

                    <ul className="mt-6 space-y-3 text-sm text-page-secondary">
                      <li className="flex items-start gap-2">
                        <BadgeCheck size={16} className="text-page-success" />
                        <span>{creditLabel}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <BadgeCheck size={16} className="text-page-success" />
                        <span>{enabledModels.length || 50}+ public models</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <BadgeCheck size={16} className="text-page-success" />
                        <span>Purchase uses your current account balance</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <BadgeCheck size={16} className="text-page-success" />
                        <span>OpenAI-compatible API keys</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-7 grid gap-2">
                    <button
                      type="button"
                      onClick={() => handleBalancePurchase(pkg)}
                      disabled={balanceLoading === pkg.id}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        isFeatured
                          ? 'bg-brand-500 text-[#0b061f] hover:bg-brand-400'
                          : 'bg-page-surface text-page hover:bg-page-surface-hover'
                      }`}
                    >
                      {balanceLoading === pkg.id ? (
                        <>
                          <Loader2 className="animate-spin" size={17} />
                          Processing
                        </>
                      ) : (
                        <>
                          {user ? 'Buy with balance' : t('packages.signUpToBuy')}
                          <ArrowRight size={17} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CossSection>

      <CossSection className="pb-14 pt-0">
        <div className="grid gap-4 md:grid-cols-4">
          <BillingStep
            icon={CreditCard}
            title="Balance purchase"
            desc="Use existing balance to activate a package immediately."
          />
          <BillingStep
            icon={ShieldCheck}
            title="Recharge if needed"
            desc="If balance is insufficient, top up first and return to the package."
          />
          <BillingStep
            icon={Sparkles}
            title="Package activated"
            desc="After confirmation, the package credits become available on your account."
          />
          <BillingStep
            icon={CalendarClock}
            title="Use until expiry"
            desc="Track remaining credits and reset windows from your active packages."
          />
        </div>
      </CossSection>

      {confirmBalancePkg && (
        <PackageModal
          title="Confirm balance purchase"
          onClose={() => {
            if (!balanceLoading) setConfirmBalancePkg(null);
          }}
          actions={(
            <>
              <button
                type="button"
                onClick={() => setConfirmBalancePkg(null)}
                disabled={Boolean(balanceLoading)}
                className="coss-button-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBalancePurchase}
                disabled={balanceLoading === confirmBalancePkg.id}
                className="coss-button-primary"
              >
                {balanceLoading === confirmBalancePkg.id ? 'Processing...' : 'Confirm purchase'}
              </button>
            </>
          )}
        >
          <p className="text-sm leading-6 text-page-secondary">
            Buy <span className="font-semibold text-page">{confirmBalancePkg.name}</span> with account balance for{' '}
            <span className="font-semibold text-page">{formatBalancePrice(confirmBalancePkg)}</span>.
          </p>
          <div className="mt-4 rounded-lg border border-page-divider bg-page-surface/50 p-3 text-sm text-page-secondary">
            Current balance: <span className="font-semibold text-page">{symbol}{userBalance.toFixed(2)}</span>
          </div>
        </PackageModal>
      )}

      {insufficientPkg && (
        <PackageModal
          title="Balance is not enough"
          onClose={() => setInsufficientPkg(null)}
          actions={(
            <>
              <button type="button" onClick={() => setInsufficientPkg(null)} className="coss-button-secondary">
                Not now
              </button>
              <Link to="/topup" className="coss-button-primary" onClick={() => setInsufficientPkg(null)}>
                Top up first
              </Link>
            </>
          )}
        >
          <p className="text-sm leading-6 text-page-secondary">
            Your current balance is <span className="font-semibold text-page">{symbol}{userBalance.toFixed(2)}</span>.
            Please recharge before buying <span className="font-semibold text-page">{insufficientPkg.name}</span> with balance.
          </p>
        </PackageModal>
      )}
    </CossPage>
  );
}

function PackageModal({ title, children, actions, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-md rounded-xl p-5 shadow-2xl shadow-cyan-950/30"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-page">{title}</h2>
        <div className="mt-3">{children}</div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {actions}
        </div>
      </div>
    </div>
  );
}
