import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Banknote,
  CreditCard,
  KeyRound,
  Link2,
  Repeat2,
  Sparkles,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  getUserUsage,
  redeemCode,
  getAffCode,
  transferAffQuota,
  getAffEarnings,
  requestAffWithdraw,
  getDistKolStatus,
  submitDistKolApply,
  Q,
} from '../api';
import { useCurrency, useSite } from '../context/SiteContext';
import CountUp from '../components/bits/CountUp';
import {
  ConsoleBadge,
  ConsoleHero,
  ConsolePage,
  ConsoleSection,
  ConsoleStat,
} from '../components/ConsoleSurface';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { symbol, rate } = useCurrency();
  const { site } = useSite();
  const [usage, setUsage] = useState(null);
  const [redeemInput, setRedeemInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const [affLink, setAffLink] = useState('');
  const [affEarnings, setAffEarnings] = useState([]);
  const [showAffEarnings, setShowAffEarnings] = useState(false);
  const [affEarningsLoading, setAffEarningsLoading] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('');
  const [withdrawRemark, setWithdrawRemark] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [distKolStatus, setDistKolStatus] = useState(null);
  const [showKolApplyModal, setShowKolApplyModal] = useState(false);
  const [kolApplyLoading, setKolApplyLoading] = useState(false);
  const [socialLink, setSocialLink] = useState('');
  const [followers, setFollowers] = useState('');
  const [promotionPlan, setPromotionPlan] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [usageRes, affRes, kolRes] = await Promise.all([
        getUserUsage(),
        getAffCode().catch(() => null),
        getDistKolStatus().catch(() => null),
      ]);
      if (usageRes.data.success) setUsage(usageRes.data.data);
      if (affRes?.data?.success && affRes.data.data) {
        setAffLink(`${window.location.origin}/register?aff=${affRes.data.data}`);
      }
      if (kolRes?.data?.success) {
        setDistKolStatus(kolRes.data.data || null);
      }
    } catch (e) {
      /* interceptor */
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!redeemInput.trim()) return;
    setRedeeming(true);
    try {
      const res = await redeemCode(redeemInput.trim());
      if (res.data.success) {
        toast.success(t('dashboard.redeemSuccess'));
        setRedeemInput('');
        await Promise.all([loadData(), refreshUser()]);
      }
    } catch (err) {
      /* interceptor */
    }
    setRedeeming(false);
  };

  const loadAffEarnings = async () => {
    setAffEarningsLoading(true);
    try {
      const res = await getAffEarnings({ page: 1, page_size: 20 });
      if (res.data.success && res.data.data) {
        setAffEarnings(res.data.data);
      }
    } catch (e) {
      /* interceptor */
    }
    setAffEarningsLoading(false);
  };

  const handleCopyAffLink = () => {
    if (!affLink) return;
    navigator.clipboard.writeText(affLink).then(() => {
      toast.success(t('topup.copied'));
    }).catch(() => {
      toast.error('Copy failed');
    });
  };

  const handleTransfer = async () => {
    const val = parseInt(transferAmount);
    if (!val || val <= 0) {
      toast.error(t('topup.enterAmount'));
      return;
    }
    setTransferring(true);
    try {
      const res = await transferAffQuota({ quota: val });
      if (res.data.success) {
        toast.success(res.data.message || t('topup.transferSuccess'));
        setTransferAmount('');
        await Promise.all([loadData(), refreshUser()]);
      }
    } catch (e) {
      /* interceptor */
    }
    setTransferring(false);
  };

  const resetWithdrawForm = () => {
    setWithdrawAmount('');
    setWithdrawMethod('');
    setWithdrawRemark('');
  };

  const handleOpenWithdraw = () => {
    resetWithdrawForm();
    setShowWithdrawModal(true);
  };

  const handleCloseWithdraw = () => {
    if (withdrawing) return;
    resetWithdrawForm();
    setShowWithdrawModal(false);
  };

  const resetKolApplyForm = () => {
    setSocialLink('');
    setFollowers('');
    setPromotionPlan('');
    setContactInfo('');
  };

  const handleOpenKolApply = () => {
    resetKolApplyForm();
    setShowKolApplyModal(true);
  };

  const handleCloseKolApply = () => {
    if (kolApplyLoading) return;
    resetKolApplyForm();
    setShowKolApplyModal(false);
  };

  const quota = usage?.quota ?? user?.quota ?? 0;
  const usedQuota = usage?.used_quota ?? user?.used_quota ?? 0;
  const packageUsedQuota = usage?.package_used_quota ?? user?.package_used_quota ?? 0;
  const requestCount = usage?.request_count ?? user?.request_count ?? 0;
  const balanceDollars = (quota / Q) * rate;
  const availableAffAmount = ((user?.aff_quota || 0) / Q) * rate;
  const defaultCommissionRate = Number(user?.default_commission_rate ?? 0.05);
  const currentCommissionRate = Number(user?.commission_rate ?? defaultCommissionRate);
  const hasCustomCommissionRate = currentCommissionRate > defaultCommissionRate + 1e-8;

  const handleWithdraw = async () => {
    const amount = Number.parseFloat(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t('topup.invalidWithdrawAmount'));
      return;
    }
    if (amount - availableAffAmount > 1e-8) {
      toast.error(t('topup.withdrawExceedsBalance'));
      return;
    }
    if (!withdrawMethod.trim()) {
      toast.error(t('topup.enterWithdrawMethod'));
      return;
    }

    setWithdrawing(true);
    try {
      const res = await requestAffWithdraw({
        amount: amount / rate,
        payment_method: withdrawMethod.trim(),
        remark: withdrawRemark.trim(),
      });
      if (res.data.success) {
        toast.success(res.data.message || t('topup.withdrawSuccess'));
        setShowWithdrawModal(false);
        resetWithdrawForm();
        await Promise.all([loadData(), refreshUser()]);
      }
    } catch (err) {
      /* interceptor */
    }
    setWithdrawing(false);
  };

  const handleKolApply = async () => {
    if (!socialLink.trim()) {
      toast.error(t('topup.kolSocialRequired'));
      return;
    }
    setKolApplyLoading(true);
    try {
      const res = await submitDistKolApply({
        social_link: socialLink.trim(),
        followers: followers.trim(),
        promotion_plan: promotionPlan.trim(),
        contact_info: contactInfo.trim(),
      });
      if (res.data.success) {
        toast.success(res.data.message || t('topup.kolApplySuccess'));
        setShowKolApplyModal(false);
        resetKolApplyForm();
        await Promise.all([loadData(), refreshUser()]);
      }
    } catch (err) {
      /* interceptor */
    }
    setKolApplyLoading(false);
  };

  const renderCommissionApplicationPanel = () => {
    if (distKolStatus?.status === 0) {
      return (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-page">{t('topup.kolPendingTitle')}</p>
              <p className="mt-1 text-xs text-page-secondary">{t('topup.kolPendingDesc')}</p>
            </div>
            <ConsoleBadge tone="amber">{t('topup.kolPendingBadge')}</ConsoleBadge>
          </div>
        </div>
      );
    }

    if (distKolStatus?.status === 1 || hasCustomCommissionRate) {
      return (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-page">{t('topup.kolApprovedTitle')}</p>
              <p className="mt-1 text-xs text-page-secondary">{t('topup.kolApprovedDesc')}</p>
            </div>
            <ConsoleBadge tone="emerald">{(currentCommissionRate * 100).toFixed(1)}%</ConsoleBadge>
          </div>
          {distKolStatus?.admin_remark && (
            <p className="mt-3 text-xs text-page-muted">
              {t('topup.kolRemarkLabel')}
              {distKolStatus.admin_remark}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-brand-500/20 bg-brand-500/[0.08] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-page">{t('topup.kolApplyTitle')}</p>
            <p className="mt-1 text-xs text-page-secondary">
              {t('topup.kolApplyDesc', {
                rate: (defaultCommissionRate * 100).toFixed(1),
              })}
            </p>
          </div>
          <button type="button" onClick={handleOpenKolApply} className="btn-primary whitespace-nowrap px-4 py-2 text-sm">
            {t('topup.kolApplyAction')}
          </button>
        </div>
        {distKolStatus?.status === 2 && (
          <p className="mt-3 text-xs text-red-400">
            {t('topup.kolRejectedLabel')}
            {distKolStatus.admin_remark || t('topup.kolRejectedFallback')}
          </p>
        )}
      </div>
    );
  };

  const heroStats = [
    <ConsoleStat
      key="balance"
      icon={Wallet}
      label={t('dashboard.balance')}
      value={<span>{symbol}<CountUp from={0} to={balanceDollars} duration={1.4} decimals={2} /></span>}
      helper={t('dashboard.quotaUnits', { count: quota.toLocaleString() })}
      tone="cyan"
    />,
    <ConsoleStat
      key="used"
      icon={BarChart3}
      label={t('dashboard.used')}
      value={<span>{symbol}<CountUp from={0} to={(usedQuota / Q) * rate} duration={1.4} decimals={2} /></span>}
      helper={t('dashboard.quotaUnits', { count: usedQuota.toLocaleString() })}
      tone="sky"
    />,
    <ConsoleStat
      key="package"
      icon={Repeat2}
      label={t('dashboard.packageUsed')}
      value={<span>{symbol}<CountUp from={0} to={(packageUsedQuota / Q) * rate} duration={1.4} decimals={2} /></span>}
      helper={t('dashboard.quotaUnits', { count: packageUsedQuota.toLocaleString() })}
      tone="emerald"
    />,
    <ConsoleStat
      key="requests"
      icon={Sparkles}
      label={t('dashboard.totalRequests')}
      value={<CountUp from={0} to={requestCount} duration={1.4} />}
      helper="Total API requests across all keys"
      tone="amber"
    />,
  ];

  return (
    <ConsolePage>
      <ConsoleHero
        eyebrow="Console overview"
        title={`${t('dashboard.welcome')} ${user?.display_name || user?.username || 'User'}`}
        subtitle={t('dashboard.manageDesc')}
        actions={[
          <Link key="tokens" to="/tokens" className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5">
            <KeyRound className="h-4 w-4" />
            {t('dashboard.apiKeys')}
          </Link>,
          <Link key="logs" to="/logs" className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5">
            <Activity className="h-4 w-4" />
            {t('dashboard.logs')}
          </Link>,
          <Link key="topup" to="/topup" className="btn-primary inline-flex items-center gap-2 px-4 py-2.5">
            <CreditCard className="h-4 w-4" />
            {t('nav.topup')}
          </Link>,
        ]}
        stats={heroStats}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <ConsoleSection
          title={t('dashboard.redeemCode')}
          subtitle="Redeem a code and refresh your balance immediately."
        >
          <form onSubmit={handleRedeem} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={redeemInput}
              onChange={(e) => setRedeemInput(e.target.value)}
              className="input flex-1"
              placeholder={t('dashboard.enterCode')}
            />
            <button type="submit" disabled={redeeming} className="btn-primary justify-center whitespace-nowrap">
              {redeeming ? t('dashboard.redeeming') : t('dashboard.redeem')}
            </button>
          </form>
        </ConsoleSection>

        <ConsoleSection
          title={t('dashboard.quickLinks')}
          subtitle="Frequently used console areas."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickLinkCard to="/tokens" title={t('dashboard.apiKeys')} desc={t('dashboard.manageKeys')} icon={KeyRound} />
            <QuickLinkCard to="/packages" title={t('dashboard.packages')} desc="Manage subscription billing" icon={Banknote} />
            <QuickLinkCard to="/pricing" title={t('dashboard.pricing')} desc={t('dashboard.modelPrices')} icon={Sparkles} />
            <QuickLinkCard to="/logs" title={t('dashboard.logs')} desc={t('dashboard.viewLogs')} icon={Activity} />
            {site?.allow_sub_dist && (
              <QuickLinkCard to="/sub-site" title={t('subDist.nav')} desc={t('subDist.dashboardEntry')} icon={Link2} />
            )}
          </div>
        </ConsoleSection>
      </div>

      {affLink && (
        <ConsoleSection
          className="mt-6"
          title={t('topup.inviteTitle')}
          subtitle={t('topup.inviteSubtitle')}
          action={
            <ConsoleBadge tone="brand">
              {t('topup.currentCommissionRateLabel')} { (currentCommissionRate * 100).toFixed(1)}%
            </ConsoleBadge>
          }
        >
          <p className="mb-5 text-xs text-page-muted">
            {t('topup.currentCommissionRateDesc', {
              rate: (defaultCommissionRate * 100).toFixed(1),
            })}
          </p>

          <div className="mb-5">{renderCommissionApplicationPanel()}</div>

          <div className="grid gap-4 md:grid-cols-3">
            <MiniMetric label={t('topup.affAvailable')} value={`${symbol}${(((user?.aff_quota || 0) / Q) * rate).toFixed(2)}`} />
            <MiniMetric label={t('topup.affTotal')} value={`${symbol}${(((user?.aff_history_quota || 0) / Q) * rate).toFixed(2)}`} />
            <MiniMetric label={t('topup.affCount')} value={String(user?.aff_count || 0)} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label className="mb-2 block text-sm font-medium text-page-label">{t('topup.inviteLink')}</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input type="text" readOnly value={affLink} className="input flex-1 text-sm" />
                <button onClick={handleCopyAffLink} className="btn-secondary justify-center whitespace-nowrap px-4 py-2 text-sm">
                  {t('topup.copy')}
                </button>
              </div>
            </div>

            {(user?.aff_quota || 0) > 0 && (
              <div className="flex flex-col gap-3 sm:items-stretch lg:flex-row lg:items-end">
                <button type="button" onClick={handleOpenWithdraw} className="btn-secondary justify-center whitespace-nowrap px-4 py-2 text-sm">
                  {t('topup.withdraw')}
                </button>
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-medium text-page-label">{t('topup.transferToBalance')}</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder={t('topup.transferPlaceholder')}
                      className="input flex-1 text-sm"
                      min={1}
                    />
                    <button onClick={handleTransfer} disabled={transferring} className="btn-primary justify-center whitespace-nowrap px-4 py-2 text-sm">
                      {transferring ? t('topup.processing') : t('topup.transfer')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5">
            <button
              onClick={() => {
                setShowAffEarnings(!showAffEarnings);
                if (!showAffEarnings) loadAffEarnings();
              }}
              className="text-sm font-medium text-page-secondary transition-colors hover:text-page"
            >
              {showAffEarnings ? t('topup.hideEarnings') : t('topup.viewEarnings')}
            </button>
            {showAffEarnings && (
              <div className="mt-3 space-y-2">
                {affEarningsLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-500" />
                  </div>
                ) : affEarnings.length === 0 ? (
                  <p className="py-6 text-center text-sm text-page-muted">{t('topup.noEarnings')}</p>
                ) : (
                  affEarnings.map((item, i) => (
                    <div key={i} className="flex items-center justify-between rounded-2xl border border-page-divider bg-page-surface/50 px-4 py-3">
                      <div>
                        <p className="text-sm text-page">{item.model_name}</p>
                        <p className="text-xs text-page-muted">
                          {new Date(item.created_time * 1000).toLocaleString()} · {(item.commission_rate * 100).toFixed(1)}%
                        </p>
                      </div>
                      <span className="text-sm font-medium text-page-success">
                        +{symbol}{((item.commission_quota / Q) * rate).toFixed(4)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </ConsoleSection>
      )}

      {showWithdrawModal && (
        <ModalShell title={t('topup.withdrawTitle')} subtitle={t('topup.withdrawSubtitle')} onClose={handleCloseWithdraw}>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-page-label">{t('topup.withdrawAvailable')}</label>
              <input type="text" readOnly value={`${symbol}${availableAffAmount.toFixed(2)}`} className="input bg-page-surface-hover/60 text-page-secondary" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-page-label">{t('topup.withdrawAmount')}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-page-muted">{symbol}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="input pl-8"
                  />
                </div>
                <button type="button" onClick={() => setWithdrawAmount(availableAffAmount.toFixed(2))} className="btn-secondary whitespace-nowrap px-4">
                  {t('topup.withdrawAll')}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-page-label">{t('topup.withdrawMethod')}</label>
              <input
                type="text"
                value={withdrawMethod}
                onChange={(e) => setWithdrawMethod(e.target.value)}
                placeholder={t('topup.withdrawMethodPlaceholder')}
                className="input"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-page-label">{t('topup.withdrawRemark')}</label>
              <textarea
                value={withdrawRemark}
                onChange={(e) => setWithdrawRemark(e.target.value)}
                placeholder={t('topup.withdrawRemarkPlaceholder')}
                className="input min-h-[96px] resize-y"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-2 sm:flex sm:justify-end sm:gap-3">
            <button type="button" onClick={handleCloseWithdraw} disabled={withdrawing} className="btn-secondary px-4 py-2">
              {t('tokens.cancel')}
            </button>
            <button type="button" onClick={handleWithdraw} disabled={withdrawing} className="btn-primary px-4 py-2">
              {withdrawing ? t('topup.processing') : t('topup.submitWithdraw')}
            </button>
          </div>
        </ModalShell>
      )}

      {showKolApplyModal && (
        <ModalShell title={t('topup.kolApplyModalTitle')} subtitle={t('topup.kolApplyModalDesc')} onClose={handleCloseKolApply}>
          <div className="space-y-4">
            <Field label={t('topup.kolSocialLabel')}>
              <input
                type="text"
                value={socialLink}
                onChange={(e) => setSocialLink(e.target.value)}
                placeholder={t('topup.kolSocialPlaceholder')}
                className="input"
              />
            </Field>
            <Field label={t('topup.kolFollowersLabel')}>
              <input
                type="text"
                value={followers}
                onChange={(e) => setFollowers(e.target.value)}
                placeholder={t('topup.kolFollowersPlaceholder')}
                className="input"
              />
            </Field>
            <Field label={t('topup.kolPlanLabel')}>
              <textarea
                value={promotionPlan}
                onChange={(e) => setPromotionPlan(e.target.value)}
                placeholder={t('topup.kolPlanPlaceholder')}
                className="input min-h-[96px] resize-y"
              />
            </Field>
            <Field label={t('topup.kolContactLabel')}>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder={t('topup.kolContactPlaceholder')}
                className="input"
              />
            </Field>
          </div>

          <div className="mt-6 grid gap-2 sm:flex sm:justify-end sm:gap-3">
            <button type="button" onClick={handleCloseKolApply} disabled={kolApplyLoading} className="btn-secondary px-4 py-2">
              {t('tokens.cancel')}
            </button>
            <button type="button" onClick={handleKolApply} disabled={kolApplyLoading} className="btn-primary px-4 py-2">
              {kolApplyLoading ? t('topup.processing') : t('topup.kolApplySubmit')}
            </button>
          </div>
        </ModalShell>
      )}
    </ConsolePage>
  );
}

function QuickLinkCard({ to, title, desc, icon: Icon }) {
  return (
    <Link to={to} className="group rounded-2xl border border-page-divider bg-page-surface/40 p-4 transition-colors hover:border-brand-500/30 hover:bg-page-surface">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-page-divider bg-white/50 text-brand-500">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-page group-hover:text-page-link">{title}</p>
          <p className="mt-1 text-xs leading-5 text-page-secondary">{desc}</p>
        </div>
      </div>
      <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-500">
        Open <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-page-divider bg-page-surface/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-page-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-page">{value}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-page-label">{label}</label>
      {children}
    </div>
  );
}

function ModalShell({ title, subtitle, onClose, children }) {
  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-page mb-1">{title}</h3>
          <p className="text-sm text-page-secondary">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
