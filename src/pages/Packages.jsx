import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  createSiteSaasCheckout,
  getActiveSubscriptions,
  getSiteSaasSubscriptions,
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

function normalizeInterval(pkg) {
  const interval = pkg.billing_interval || pkg.interval || pkg.period || '';
  if (interval) return String(interval).replace(/^every_/, '');
  if (pkg.duration >= 365) return 'year';
  if (pkg.duration >= 90) return 'quarter';
  return 'month';
}

function getSubscriptionStatus(sub) {
  return String(sub.status || sub.subscription_status || 'active').toLowerCase();
}

function isBalanceError(message = '') {
  return /balance|余额|insufficient|不足|not enough|quota/i.test(String(message));
}

function BillingStep({ icon: Icon, title, desc }) {
  return (
    <CossCard className="p-5">
      <CossIconTile icon={Icon} />
      <h3 className="mt-4 text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
    </CossCard>
  );
}

export default function Packages() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const { fmtPlanPrice, symbol, rate, code, usdRate } = useCurrency();
  const cachedCatalog = useMemo(() => readPublicModelCatalog(), []);

  const [packages, setPackages] = useState([]);
  const [models, setModels] = useState(() => cachedCatalog.models || []);
  const [activeSubs, setActiveSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(null);
  const [confirmBalancePkg, setConfirmBalancePkg] = useState(null);
  const [insufficientPkg, setInsufficientPkg] = useState(null);

  const getResetLabel = (period) => t(resetLabelKeys[period] || resetLabelKeys.never);

  const loadSubscriptions = async () => {
    if (!user) {
      setActiveSubs([]);
      return;
    }
    const [siteRes, balanceRes] = await Promise.all([
      getSiteSaasSubscriptions(userRequestConfig(user, { skipErrorHandler: true })).catch(() => null),
      getActiveSubscriptions(userRequestConfig(user, { skipErrorHandler: true })).catch(() => null),
    ]);
    const siteSubscriptions = (siteRes?.data?.success ? siteRes.data.data || [] : [])
      .map((item) => ({ ...item, billing_source: item.billing_source || 'subscription' }));
    const balanceSubscriptions = (balanceRes?.data?.success ? balanceRes.data.data || [] : [])
      .map((item) => ({ ...item, billing_source: item.billing_source || 'balance' }));
    setActiveSubs([...siteSubscriptions, ...balanceSubscriptions]);
  };

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
    loadSubscriptions();
  }, [user]);

  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout_status') || searchParams.get('status') || searchParams.get('payment');
    if (!user || !checkoutStatus) return;

    const sync = async () => {
      if (checkoutStatus === 'success' || checkoutStatus === 'return') {
        toast.success('Checkout completed. Your subscription will activate automatically after payment confirmation.');
      } else if (checkoutStatus === 'cancelled' || checkoutStatus === 'cancel') {
        toast.error('Checkout was cancelled.');
      }
      await Promise.all([refreshUser({ skipErrorHandler: true }), loadSubscriptions()]);
      setSearchParams({}, { replace: true });
    };

    sync();
  }, [user, searchParams, setSearchParams, refreshUser]);

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

  const handleSubscribe = async (pkg) => {
    if (!user) {
      navigate('/register');
      return;
    }

    setCheckoutLoading(pkg.id);
    try {
      const returnUrl = `${window.location.origin}/packages?checkout_status=success`;
      const res = await createSiteSaasCheckout({
        package_id: pkg.id,
        package_name: pkg.name,
        billing_interval: normalizeInterval(pkg),
        return_url: returnUrl,
      }, userRequestConfig(user));

      const checkoutUrl = res.data?.data?.checkout_url || res.data?.data?.pay_link || res.data?.checkout_url;
      if ((res.data?.success || res.data?.message === 'success') && checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        toast.error(res.data?.message || 'Site SaaS billing is not configured yet.');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Site SaaS billing is not configured yet.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <CossPage className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </CossPage>
    );
  }

  return (
    <CossPage>
      <CossPageHeader
        eyebrow="Packages"
        icon={RefreshCcw}
        title="Choose balance purchase or subscription."
        description="Use your existing account balance for a one-time package purchase, or start a recurring subscription through the SaaS checkout flow."
      />

      {activeSubs.length > 0 && (
        <CossSection>
          <CossCardFrame className="p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{t('packages.mySubscriptions')}</h2>
                <p className="mt-1 text-sm text-slate-500">Your active plans, renewal windows, and available credits are managed automatically.</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {activeSubs.map((sub) => {
                const pkg = packageById.get(String(sub.package_id));
                const total = sub.amount_total || sub.quota_amount || pkg?.quota_amount || 0;
                const used = sub.amount_used || sub.used_quota || 0;
                const remain = Math.max(0, total - used);
                const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
                const status = getSubscriptionStatus(sub);

                return (
                  <CossMutedCard key={`${sub.billing_source || 'subscription'}-${sub.id}`} className="p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{pkg?.name || sub.package_name || t('packages.subscriptionId', { id: sub.id })}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {sub.billing_source === 'balance' ? 'Balance package' : 'Site subscription'} #{sub.id}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        ['active', 'trialing'].includes(status)
                          ? 'bg-emerald-50 text-emerald-700'
                          : status.includes('cancel')
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-200 text-slate-700'
                      }`}>
                        {status}
                      </span>
                    </div>
                    <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">Current period ends</p>
                        <p className="mt-1 font-medium text-slate-950">{formatDate(sub.current_period_end || sub.end_time)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Next renewal</p>
                        <p className="mt-1 font-medium text-slate-950">{formatDate(sub.next_renewal_time || sub.next_reset_time || sub.current_period_end)}</p>
                      </div>
                    </div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>Credit used</span>
                      <span>{symbol}{(remain / Q * rate).toFixed(2)} remaining</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-slate-950" style={{ width: `${pct}%` }} />
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
            <p className="text-slate-600">{t('packages.noPackages')}</p>
            <Link to="/models?sort=price" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              {t('packages.checkPricing')} <ArrowRight size={16} />
            </Link>
          </CossCardFrame>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {enabledPackages.map((pkg, index) => {
              const resetPeriod = pkg.quota_reset_period || 'monthly';
              const isSubscription = resetPeriod !== 'never' || pkg.creem_product_id || pkg.billing_interval;
              const monthlyCredit = pkg.quota_amount > 0 ? pkg.quota_amount / Q : 0;
              const interval = normalizeInterval(pkg);
              const isFeatured = index === 1 || pkg.recommended || pkg.is_popular;
              return (
                <div
                  key={pkg.id}
                  className={`coss-card-frame relative flex flex-col p-5 sm:p-6 ${
                    isFeatured ? 'border-slate-950 shadow-lg shadow-slate-200' : ''
                  }`}
                >
                  {isFeatured && (
                    <span className="mb-5 inline-flex w-fit rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                      Recommended
                    </span>
                  )}
                  <div className="flex-1">
                    <h3 className="break-words text-lg font-semibold text-slate-950 sm:text-xl">{pkg.name}</h3>
                    {pkg.description && (
                      <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">{pkg.description}</p>
                    )}

                    <div className="mt-6 flex items-end gap-2">
                      <span className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                        {fmtPlanPrice(pkg.price, pkg.currency)}
                      </span>
                      <span className="pb-1 text-sm text-slate-500">/ {interval}</span>
                    </div>
                    {pkg.original_price > 0 && pkg.original_price > pkg.price && (
                      <p className="mt-1 text-sm text-slate-400 line-through">
                        {fmtPlanPrice(pkg.original_price, pkg.currency)}
                      </p>
                    )}

                    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <RefreshCcw className="mt-0.5 text-slate-700" size={18} />
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                           Balance purchase or subscription
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            Pay from account balance now, or use SaaS checkout for recurring subscription activation.
                          </p>
                        </div>
                      </div>
                    </div>

                    <ul className="mt-6 space-y-3 text-sm text-slate-600">
                      <li className="flex items-start gap-2">
                        <BadgeCheck size={16} className="text-emerald-600" />
                        <span>{monthlyCredit > 0 ? `${symbol}${(monthlyCredit * rate).toFixed(2)} ${getResetLabel(resetPeriod)} credit` : 'Custom credit allocation'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <BadgeCheck size={16} className="text-emerald-600" />
                        <span>{enabledModels.length || 50}+ public models</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <BadgeCheck size={16} className="text-emerald-600" />
                        <span>Balance purchase uses your current account balance</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <BadgeCheck size={16} className="text-emerald-600" />
                        <span>Subscription checkout renews through the SaaS billing flow</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <BadgeCheck size={16} className="text-emerald-600" />
                        <span>OpenAI-compatible API keys</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-7 grid gap-2">
                    <button
                      type="button"
                      onClick={() => handleBalancePurchase(pkg)}
                      disabled={balanceLoading === pkg.id || checkoutLoading === pkg.id}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        isFeatured
                          ? 'bg-slate-950 text-white hover:bg-slate-800'
                          : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      {balanceLoading === pkg.id ? (
                        <>
                          <Loader2 className="animate-spin" size={17} />
                          Processing
                        </>
                      ) : (
                        <>
                          {user ? 'Buy with balance' : t('packages.signUpToSubscribe')}
                          <ArrowRight size={17} />
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubscribe(pkg)}
                      disabled={checkoutLoading === pkg.id || balanceLoading === pkg.id}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {checkoutLoading === pkg.id ? (
                        <>
                          <Loader2 className="animate-spin" size={17} />
                          Creating checkout
                        </>
                      ) : (
                        <>
                          {user ? 'Subscribe' : t('packages.signUpToSubscribe')}
                          <RefreshCcw size={16} />
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
            title="Subscription"
            desc="Use SaaS checkout when you want recurring billing."
          />
          <BillingStep
            icon={CalendarClock}
            title="Renewal applied"
            desc="Successful subscription renewals keep the plan active automatically."
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
          <p className="text-sm leading-6 text-slate-600">
            Buy <span className="font-semibold text-slate-950">{confirmBalancePkg.name}</span> with account balance for{' '}
            <span className="font-semibold text-slate-950">{formatBalancePrice(confirmBalancePkg)}</span>.
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Current balance: <span className="font-semibold text-slate-950">{symbol}{userBalance.toFixed(2)}</span>
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
          <p className="text-sm leading-6 text-slate-600">
            Your current balance is <span className="font-semibold text-slate-950">{symbol}{userBalance.toFixed(2)}</span>.
            Please recharge before buying <span className="font-semibold text-slate-950">{insufficientPkg.name}</span> with balance.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            You can also choose Subscribe to use the SaaS subscription checkout flow.
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
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/20"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <div className="mt-3">{children}</div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {actions}
        </div>
      </div>
    </div>
  );
}
