import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { Banknote, CreditCard, ExternalLink, Repeat2, ShieldCheck, Sparkles, TicketPercent, Wallet } from 'lucide-react';
import {
  getUserUsage, redeemCode, getTopupInfo,
  createEpayOrder, createStripeOrder, createCreemOrder,
  createCryptoOrder, getCryptoOrderStatus, getTopupHistory,
  Q,
} from '../api';
import { useCurrency } from '../context/SiteContext';
import CountUp from '../components/bits/CountUp';
import {
  ConsoleBadge,
  ConsoleHero,
  ConsolePage,
  ConsoleSection,
  ConsoleStat,
} from '../components/ConsoleSurface';
import toast from 'react-hot-toast';

function normalizeExternalUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return '';
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return '';
    if (parsed.host.includes(':') && !parsed.port && !parsed.host.startsWith('[')) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function normalizePaymentLabel(value) {
  const label = String(value || '').trim();
  return Array.from(label).slice(0, 32).join('');
}

function normalizeCreemProducts(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((product) => {
        if (!product || typeof product !== 'object') return null;
        const productId = String(product.productId || product.product_id || product.id || '').trim();
        const quota = Number(product.quota ?? product.quotaAmount ?? product.quota_amount ?? product.amount ?? product.price);
        if (!productId || !Number.isFinite(quota) || quota <= 0) return null;
        return { ...product, productId, quota };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getCreemMinTopup(products) {
  const quotas = products
    .map((product) => Number(product?.quota))
    .filter((quota) => Number.isFinite(quota) && quota > 0);
  return quotas.length > 0 ? Math.min(...quotas) : 1;
}

function isMultipleOf(value, unit) {
  if (!Number.isFinite(value) || !Number.isFinite(unit) || unit <= 0) return false;
  const quotient = value / unit;
  return Math.abs(quotient - Math.round(quotient)) < 1e-8;
}

function findCompatibleCreemProduct(products, amount) {
  const payAmount = Number(amount);
  if (!Number.isFinite(payAmount) || payAmount <= 0) return null;
  return products.find((product) => isMultipleOf(payAmount, Number(product?.quota))) || null;
}

function openPendingPaymentWindow() {
  if (typeof window === 'undefined') return null;
  const userAgent = navigator.userAgent || '';
  const useSameTab = (
    /Android|iPhone|iPad|iPod|Mobile|MicroMessenger|FBAN|FBAV|Instagram/i.test(userAgent) ||
    (navigator.maxTouchPoints > 1 && window.matchMedia?.('(max-width: 768px)').matches)
  );
  if (useSameTab) return null;
  const opened = window.open('', '_blank');
  if (!opened) return null;
  try {
    opened.document.write(`<!doctype html>
<html>
  <head>
    <title>Redirecting to payment</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #020617; color: #f8fafc; }
      main { max-width: 24rem; padding: 2rem; text-align: center; }
      p { margin: .5rem 0 0; color: #94a3b8; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>Opening payment...</h1>
      <p>Please wait while the checkout page is prepared.</p>
    </main>
  </body>
</html>`);
    opened.document.close();
  } catch {
    // Some mobile browsers restrict access to the placeholder window.
  }
  return opened;
}

function openPaymentUrl(paymentWindow, url) {
  if (!url || typeof window === 'undefined') return;
  if (paymentWindow && !paymentWindow.closed) {
    try {
      paymentWindow.opener = null;
      paymentWindow.location.href = url;
      return;
    } catch {
      // Fall back to same-tab navigation below.
    }
  }
  window.location.assign(url);
}

function closePendingPaymentWindow(paymentWindow) {
  try {
    if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
  } catch {
    // Ignore browsers that block closing a pending payment window.
  }
}

function paymentErrorMessage(res, fallback) {
  if (res?.data?.message === 'success') return fallback;
  return typeof res?.data?.data === 'string' ? res.data.data : res?.data?.message;
}

export default function Topup() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { site } = useSite();
  const { symbol, rate } = useCurrency();

  const [usage, setUsage] = useState(null);
  const [topupInfo, setTopupInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Redeem code
  const [redeemInput, setRedeemInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  // Online topup
  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [payingMethod, setPayingMethod] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [cryptoDetailsOpen, setCryptoDetailsOpen] = useState(false);

  // Crypto modal
  const [cryptoOrder, setCryptoOrder] = useState(null);
  const [cryptoPolling, setCryptoPolling] = useState(false);
  const [selectedChain, setSelectedChain] = useState('');
  const [selectedToken, setSelectedToken] = useState('usdt');

  // History
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const enableTopup = site?.enable_topup && topupInfo;
  const topupConfig = site?.topup_config;
  const presetAmounts = topupInfo?.amount_options || [1, 5, 10, 20, 50, 100];
  const minTopup = topupInfo?.min_topup || 1;
  const payMethods = topupInfo?.pay_methods || [];
  const enableOnline = topupInfo?.enable_online_topup;
  const enableStripe = topupInfo?.enable_stripe_topup;
  const enableCreem = topupInfo?.enable_creem_topup;
  const enableCrypto = topupInfo?.enable_crypto_topup;
  const redeemCodeShopUrl = useMemo(
    () => normalizeExternalUrl(site?.top_up_link || topupConfig?.top_up_link || topupInfo?.top_up_link),
    [site?.top_up_link, topupConfig?.top_up_link, topupInfo?.top_up_link],
  );
  const redeemCodeShopLabel = useMemo(
    () => normalizePaymentLabel(site?.top_up_link_name || topupConfig?.top_up_link_name || topupInfo?.top_up_link_name) || t('topup.otherPayment'),
    [site?.top_up_link_name, topupConfig?.top_up_link_name, topupInfo?.top_up_link_name, t],
  );

  const openRedeemCodeShop = useCallback(() => {
    if (!redeemCodeShopUrl) return;
    window.open(redeemCodeShopUrl, '_blank', 'noopener,noreferrer');
  }, [redeemCodeShopUrl]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usageRes, topupRes] = await Promise.all([
        getUserUsage(),
        site?.enable_topup ? getTopupInfo().catch(() => null) : Promise.resolve(null),
      ]);
      if (usageRes.data.success) setUsage(usageRes.data.data);
      if (topupRes?.data?.data) setTopupInfo(topupRes.data.data);
    } catch (e) { /* interceptor */ }
    setLoading(false);
  }, [site?.enable_topup]);

  useEffect(() => { loadData(); }, [loadData]);

  const quota = usage?.quota ?? user?.quota ?? 0;
  const usedQuota = usage?.used_quota ?? user?.used_quota ?? 0;
  const packageUsedQuota = usage?.package_used_quota ?? user?.package_used_quota ?? 0;
  const requestCount = usage?.request_count ?? user?.request_count ?? 0;
  const balanceDollars = quota / Q * rate;

  const formatCurrencyAmount = useCallback((value) => {
    if (value === '' || value == null || Number.isNaN(Number(value))) return '';
    return Number(value).toFixed(2).replace(/\.?0+$/, '');
  }, []);

  const toDisplayAmount = useCallback((quotaAmount) => {
    if (quotaAmount === '' || quotaAmount == null) return '';
    return formatCurrencyAmount(Number(quotaAmount) * rate);
  }, [formatCurrencyAmount, rate]);

  const toQuotaAmount = useCallback((currencyAmount) => {
    const numeric = Number.parseFloat(currencyAmount);
    if (!Number.isFinite(numeric) || numeric <= 0) return '';
    return Math.max(minTopup, Math.round(numeric / rate));
  }, [minTopup, rate]);

  // Redeem
  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!redeemInput.trim()) return;
    setRedeeming(true);
    try {
      const res = await redeemCode(redeemInput.trim());
      if (res.data.success) {
        toast.success(t('topup.redeemSuccess'));
        setRedeemInput('');
        await Promise.all([loadData(), refreshUser()]);
      }
    } catch (err) { /* interceptor */ }
    setRedeeming(false);
  };

  // Select preset
  const handlePreset = (val) => {
    setSelectedPreset(val);
    setAmount(String(val));
    setDisplayAmount(toDisplayAmount(val));
  };

  // Determine if a payment method is Stripe-based
  const isStripePayment = (method) =>
    ['stripe', 'alipay', 'wxpay'].includes(method) && !method.startsWith('epay_');

  const isCreemPayment = (method) => method === 'creem';

  const getMethodMinTopup = (method) => {
    const payMethod = (payMethods || []).find((item) => item.type === method);
    const methodMinTopup = Number(payMethod?.min_topup);
    if (Number.isFinite(methodMinTopup) && methodMinTopup > 0) return methodMinTopup;
    if (isCreemPayment(method)) {
      const configuredMin = Number(topupInfo?.creem_min_topup);
      return Number.isFinite(configuredMin) && configuredMin > 0
        ? configuredMin
        : getCreemMinTopup(normalizeCreemProducts(topupInfo?.creem_products));
    }
    if (isStripePayment(method)) {
      const stripeMin = Number(topupInfo?.stripe_min_topup);
      if (Number.isFinite(stripeMin) && stripeMin > 0) return stripeMin;
    }
    return minTopup;
  };

  const getMethodDisplayName = (method) => {
    const payMethod = (payMethods || []).find((item) => item.type === method);
    return payMethod?.name || (method === 'creem' ? 'Creem' : 'Stripe');
  };

  const showGatewayMinTopupError = (method, minAmount) => {
    toast.error(t('topup.gatewayMinimumAmount', {
      channel: getMethodDisplayName(method),
      amount: formatCurrencyAmount(minAmount),
    }));
  };

  // Pay handler for EPay, Stripe, and Creem methods
  const handlePay = async (method) => {
    setSelectedPaymentMethod(method);
    setCryptoDetailsOpen(false);
    const payAmount = parseInt(amount);
    if (!payAmount || payAmount <= 0) {
      toast.error(t('topup.enterAmount'));
      return;
    }
    const isGatewayPayment = isStripePayment(method) || isCreemPayment(method);
    const methodMinTopup = getMethodMinTopup(method);
    if (isGatewayPayment && payAmount < methodMinTopup) {
      showGatewayMinTopupError(method, methodMinTopup);
      return;
    }
    if (!isGatewayPayment && payAmount < minTopup) {
      toast.error(t('topup.minimumAmount', { min: formatCurrencyAmount(minTopup * rate) }));
      return;
    }
    const creemProduct = isCreemPayment(method)
      ? findCompatibleCreemProduct(creemProducts, payAmount)
      : null;
    if (isCreemPayment(method) && creemProducts.length > 0 && !creemProduct) {
      toast.error(t('topup.creemUnsupportedAmount'));
      return;
    }
    const usesPaymentPage = isCreemPayment(method) || isStripePayment(method);
    let paymentWindow = usesPaymentPage ? openPendingPaymentWindow() : null;
    setPaymentLoading(true);
    setPayingMethod(method);
    try {
      const returnUrl = window.location.origin + '/topup?payment=return';
      const data = { amount: payAmount, payment_method: method, return_url: returnUrl };

      if (isCreemPayment(method)) {
        const creemData = {
          amount: payAmount,
          payment_method: 'creem',
          return_url: returnUrl,
        };
        if (creemProduct?.productId) {
          creemData.product_id = creemProduct.productId;
        }
        const res = await createCreemOrder(creemData);
        if (res.data.message === 'success' && res.data.data?.checkout_url) {
          openPaymentUrl(paymentWindow, res.data.data.checkout_url);
          paymentWindow = null;
        } else {
          closePendingPaymentWindow(paymentWindow);
          paymentWindow = null;
          const errMsg = paymentErrorMessage(res, t('common.requestFailed'));
          toast.error(errMsg || t('common.requestFailed'));
        }
      } else if (isStripePayment(method)) {
        // Stripe payment
        const res = await createStripeOrder(data);
        if (res.data.message === 'success' && res.data.data?.pay_link) {
          openPaymentUrl(paymentWindow, res.data.data.pay_link);
          paymentWindow = null;
        } else {
          closePendingPaymentWindow(paymentWindow);
          paymentWindow = null;
          const errMsg = paymentErrorMessage(res, t('common.requestFailed'));
          toast.error(errMsg || t('common.requestFailed'));
        }
      } else {
        // EPay payment - submit via hidden form (same as main site)
        const res = await createEpayOrder(data);
        if (res.data.message === 'success') {
          const params = res.data.data; // EPay form params
          const url = res.data.url;     // EPay gateway URL
          if (url && params) {
            const form = document.createElement('form');
            form.action = url;
            form.method = 'POST';
            // Open in new tab (except Safari)
            const isSafari = navigator.userAgent.indexOf('Safari') > -1
              && navigator.userAgent.indexOf('Chrome') < 1;
            if (!isSafari) {
              form.target = '_blank';
            }
            for (const key in params) {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = params[key];
              form.appendChild(input);
            }
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
          }
        } else {
          const errMsg = typeof res.data.data === 'string' ? res.data.data : res.data.message;
          toast.error(errMsg || t('common.requestFailed'));
        }
      }
    } catch (e) {
      closePendingPaymentWindow(paymentWindow);
      paymentWindow = null;
      /* interceptor */
    }
    setPaymentLoading(false);
    setPayingMethod('');
  };

  // Crypto pay - needs chain + token
  const handleCryptoPay = async () => {
    const payAmountVal = parseInt(amount);
    if (!payAmountVal || payAmountVal <= 0) {
      toast.error(t('topup.enterAmount'));
      return;
    }
    if (!selectedChain) {
      toast.error(t('topup.selectChain'));
      return;
    }
    if (!selectedToken) {
      toast.error(t('topup.selectToken'));
      return;
    }
    setPaymentLoading(true);
    setPayingMethod('crypto');
    try {
      const res = await createCryptoOrder({
        amount: payAmountVal,
        chain: selectedChain,
        token: selectedToken,
      });
      if (res.data.message === 'success' && res.data.data) {
        setCryptoOrder(res.data.data);
        startCryptoPolling(res.data.data.trade_no);
      } else if (res.data.message !== 'success') {
        const errMsg = typeof res.data.data === 'string' ? res.data.data : res.data.message;
        toast.error(errMsg || t('common.requestFailed'));
      }
    } catch (e) { /* interceptor */ }
    setPaymentLoading(false);
    setPayingMethod('');
  };

  const startCryptoPolling = (tradeNo) => {
    setCryptoPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await getCryptoOrderStatus(tradeNo);
        if (res.data.data?.status === 'success') {
          clearInterval(interval);
          setCryptoPolling(false);
          setCryptoOrder(null);
          toast.success(t('topup.paymentSuccess'));
          await Promise.all([loadData(), refreshUser()]);
        } else if (res.data.data?.status === 'expired') {
          clearInterval(interval);
          setCryptoPolling(false);
          toast.error(t('topup.orderExpired'));
        }
      } catch (e) {
        clearInterval(interval);
        setCryptoPolling(false);
      }
    }, 5000);
    // Auto-stop after expiry time
    const expiryMs = (topupInfo?.crypto_expiry_minutes || 30) * 60 * 1000;
    setTimeout(() => { clearInterval(interval); setCryptoPolling(false); }, expiryMs);
  };

  // Available crypto chains from config
  const cryptoWallets = topupInfo?.crypto_wallets || {};
  const availableChains = useMemo(() => {
    const chains = [];
    if (cryptoWallets.tron) chains.push({ key: 'tron', label: 'TRON (TRC20)' });
    if (cryptoWallets.eth) chains.push({ key: 'eth', label: 'Ethereum (ERC20)' });
    if (cryptoWallets.bsc) chains.push({ key: 'bsc', label: 'BSC (BEP20)' });
    return chains;
  }, [cryptoWallets.tron, cryptoWallets.eth, cryptoWallets.bsc]);
  const selectedChainMeta = useMemo(
    () => availableChains.find((chain) => chain.key === selectedChain) || null,
    [availableChains, selectedChain],
  );
  const selectedChainLabel = selectedChainMeta?.label || '';
  const selectedTokenLabel = selectedToken.toUpperCase();
  const selectedCryptoLabel = selectedChainLabel
    ? `${selectedTokenLabel} (${selectedChainLabel})`
    : selectedTokenLabel;
  const shouldShowCryptoOptions =
    cryptoDetailsOpen && selectedPaymentMethod === 'crypto' && enableCrypto && availableChains.length > 0;

  const handleSelectCryptoPayment = () => {
    setSelectedPaymentMethod('crypto');
    setCryptoDetailsOpen(true);
    if (!selectedChain && availableChains.length > 0) {
      setSelectedChain(availableChains[0].key);
    }
  };

  // Set default chain when available
  useEffect(() => {
    if (availableChains.length > 0 && !selectedChain) {
      setSelectedChain(availableChains[0].key);
    }
  }, [availableChains, selectedChain]);

  useEffect(() => {
    if (!enableCrypto || availableChains.length === 0 || selectedPaymentMethod !== 'crypto') {
      setCryptoDetailsOpen(false);
    }
  }, [availableChains.length, enableCrypto, selectedPaymentMethod]);

  const creemProducts = useMemo(() => {
    return normalizeCreemProducts(topupInfo?.creem_products);
  }, [topupInfo?.creem_products]);

  const creemMinTopup = useMemo(() => {
    const configuredMin = Number(topupInfo?.creem_min_topup);
    return Number.isFinite(configuredMin) && configuredMin > 0
      ? configuredMin
      : getCreemMinTopup(creemProducts);
  }, [topupInfo?.creem_min_topup, creemProducts]);

  // History
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await getTopupHistory({ page: 1, page_size: 20 });
      if (res.data.data?.items) {
        setHistory(res.data.data.items);
      }
    } catch (e) { /* interceptor */ }
    setHistoryLoading(false);
  };

  const checkoutPaymentMethods = useMemo(() => {
    const methods = (payMethods || [])
      .filter((m) => m?.type && m.type !== 'crypto')
      .map((method) => {
        if (isStripePayment(method.type) && (!method.min_topup || Number(method.min_topup) <= 0)) {
          const stripeMin = Number(topupInfo?.stripe_min_topup);
          if (Number.isFinite(stripeMin) && stripeMin > 0) {
            return { ...method, min_topup: stripeMin };
          }
        }
        if (method.type === 'creem' && (!method.min_topup || Number(method.min_topup) <= 0)) {
          return { ...method, min_topup: creemMinTopup };
        }
        return method;
      });

    if (enableCreem && creemProducts.length > 0 && !methods.some((method) => method.type === 'creem')) {
      methods.push({ name: 'Creem', type: 'creem', min_topup: creemMinTopup });
    }
    return methods;
  }, [payMethods, enableCreem, creemProducts, creemMinTopup, topupInfo?.stripe_min_topup]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
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
      icon={Repeat2}
      label={t('dashboard.used')}
      value={<span>{symbol}<CountUp from={0} to={(usedQuota / Q) * rate} duration={1.4} decimals={2} /></span>}
      helper={t('dashboard.quotaUnits', { count: usedQuota.toLocaleString() })}
      tone="sky"
    />,
    <ConsoleStat
      key="package"
      icon={Banknote}
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
      helper="All API requests"
      tone="amber"
    />,
  ];

  return (
    <ConsolePage>
      <ConsoleHero
        eyebrow="Billing center"
        title={t('topup.title')}
        subtitle={t('topup.subtitle')}
        actions={[
          <button
            key="history"
            type="button"
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5"
          >
            <CreditCard className="h-4 w-4" />
            {showHistory ? t('topup.hideHistory') : t('topup.viewHistory')}
          </button>,
        ]}
        stats={statCards}
      />

      {site?.enable_topup && (enableOnline || enableStripe || enableCreem || enableCrypto || redeemCodeShopUrl) && (checkoutPaymentMethods.length > 0 || enableCrypto || redeemCodeShopUrl) && (
        <ConsoleSection
          className="mt-6"
          title={t('topup.onlineTopup')}
          subtitle="Choose a payment method, set the amount, and complete checkout."
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
            <div className="space-y-6">
              <div>
                <label className="mb-3 block text-sm font-medium text-page-label">{t('topup.selectAmount')}</label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {presetAmounts.map((val) => (
                    <button
                      key={val}
                      onClick={() => handlePreset(val)}
                      className={`rounded-2xl border px-3 py-2 text-sm font-medium transition-all ${
                        selectedPreset === val
                          ? 'border-brand-500/40 bg-brand-500/15 text-page'
                          : 'border-page-divider bg-page-surface/40 text-page-label hover:bg-page-surface-hover hover:text-page'
                      }`}
                    >
                      {symbol}{formatCurrencyAmount(val * rate)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-page-label">{t('topup.customAmount')}</label>
                <input
                  type="number"
                  value={displayAmount}
                  onChange={(e) => {
                    const currentValue = e.target.value;
                    setDisplayAmount(currentValue);
                    setSelectedPreset(null);
                    const quotaAmount = toQuotaAmount(currentValue);
                    setAmount(quotaAmount === '' ? '' : String(quotaAmount));
                  }}
                  onBlur={(e) => {
                    const quotaAmount = toQuotaAmount(e.target.value);
                    if (quotaAmount === '') {
                      setDisplayAmount('');
                      setAmount('');
                      return;
                    }
                    setAmount(String(quotaAmount));
                    setDisplayAmount(toDisplayAmount(quotaAmount));
                  }}
                  min={minTopup * rate}
                  step="0.01"
                  placeholder={t('topup.amountPlaceholder', { min: formatCurrencyAmount(minTopup * rate) })}
                  className="input"
                />
                <p className="mt-2 text-xs text-page-muted">{t('topup.customAmountHint')}</p>
                {amount ? (
                  <p className="mt-2 text-xs text-page-muted">
                    {t('topup.rechargeAmountLabel')}: {symbol}{displayAmount || toDisplayAmount(amount)}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-page-label">{t('topup.paymentMethod')}</label>
                <div className="flex flex-wrap gap-2">
                  {checkoutPaymentMethods.map((method) => {
                    const isCurrentLoading = paymentLoading && payingMethod === method.type;
                    const isMethodStripe = isStripePayment(method.type);
                    const isMethodCreem = isCreemPayment(method.type);
                    const minForMethod = Number(method.min_topup) || 0;
                    const belowGatewayMin =
                      (isMethodStripe || isMethodCreem) &&
                      minForMethod > Number(amount || 0);
                    const disabled =
                      paymentLoading ||
                      !amount ||
                      (!enableOnline && !isMethodStripe && !isMethodCreem) ||
                      (!enableStripe && isMethodStripe) ||
                      (!enableCreem && isMethodCreem);
                    return (
                      <button
                        key={method.type}
                        onClick={() => handlePay(method.type)}
                        disabled={disabled}
                        title={
                          belowGatewayMin
                            ? t('topup.gatewayMinimumAmount', {
                                channel: method.name,
                                amount: formatCurrencyAmount(minForMethod),
                              })
                            : undefined
                        }
                        className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          selectedPaymentMethod === method.type
                            ? 'border-brand-500/40 bg-brand-500/15 text-page'
                            : 'border-page-divider bg-page-surface/40 text-page-label hover:bg-page-surface-hover hover:text-page'
                        }`}
                      >
                        {isCurrentLoading ? t('topup.processing') : method.name}
                      </button>
                    );
                  })}
                  {enableCrypto && availableChains.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectCryptoPayment}
                      disabled={paymentLoading}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        selectedPaymentMethod === 'crypto'
                          ? 'border-brand-500/40 bg-brand-500/15 text-page'
                          : 'border-page-divider bg-page-surface/40 text-page-label hover:bg-page-surface-hover hover:text-page'
                      }`}
                    >
                      {t('topup.cryptoPayment')}
                    </button>
                  )}
                  {redeemCodeShopUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPaymentMethod('external');
                        setCryptoDetailsOpen(false);
                        openRedeemCodeShop();
                      }}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                        selectedPaymentMethod === 'external'
                          ? 'border-brand-500/40 bg-brand-500/15 text-page'
                          : 'border-page-divider bg-page-surface/40 text-page-label hover:bg-page-surface-hover hover:text-page'
                      }`}
                    >
                      {redeemCodeShopLabel}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {shouldShowCryptoOptions && (
                <div className="rounded-2xl border border-page-divider bg-page-surface/40 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-brand-500" />
                    <h3 className="text-sm font-semibold text-page">{t('topup.cryptoPayment')}</h3>
                  </div>
                  <p className="text-xs text-page-muted">{t('topup.cryptoSelectionHint')}</p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-page-muted">{t('topup.cryptoStepChain')}</p>
                      <div className="flex flex-wrap gap-2">
                        {availableChains.map((chain) => (
                          <button
                            key={chain.key}
                            onClick={() => setSelectedChain(chain.key)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              selectedChain === chain.key
                                ? 'bg-brand-500 text-white'
                                : 'border border-page-divider bg-page-surface/40 text-page-label hover:bg-page-surface-hover hover:text-page'
                            }`}
                          >
                            {chain.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-page-muted">{t('topup.cryptoStepToken')}</p>
                      <div className="flex flex-wrap gap-2">
                        {['usdt', 'usdc'].map((token) => (
                          <button
                            key={token}
                            onClick={() => setSelectedToken(token)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              selectedToken === token
                                ? 'bg-brand-500 text-white'
                                : 'border border-page-divider bg-page-surface/40 text-page-label hover:bg-page-surface-hover hover:text-page'
                            }`}
                          >
                            {token.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-page-divider bg-page-surface/50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-page-muted">{t('topup.cryptoSelectedSummary')}</p>
                      <p className="mt-1 text-sm font-medium text-page">{selectedCryptoLabel}</p>
                    </div>

                    <button
                      onClick={handleCryptoPay}
                      disabled={paymentLoading || !amount}
                      className="btn-primary inline-flex w-full items-center justify-center gap-2"
                    >
                      {paymentLoading && payingMethod === 'crypto'
                        ? t('topup.processing')
                        : t('topup.generateCryptoAddress', { method: selectedCryptoLabel })}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ConsoleSection>
      )}

      {/* Crypto Payment Modal */}
      {cryptoOrder && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setCryptoOrder(null)}>
          <div className="glass rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-page mb-4">{t('topup.cryptoPayment')}</h3>
            <div className="space-y-4">
              <div className="glass-sm rounded-xl p-4">
                <p className="text-xs text-page-secondary mb-1">{t('topup.walletAddress')}</p>
                <p className="text-sm text-page font-mono break-all">{cryptoOrder.wallet}</p>
              </div>
              <div className="rounded-xl border-2 border-amber-400/60 bg-amber-500/10 p-4">
                <p className="mb-2 text-xs font-semibold text-page-warning">{t('topup.exactAmountLabel')}</p>
                <p className="break-all font-mono text-2xl font-bold text-page-warning">{cryptoOrder.amount} {cryptoOrder.token}</p>
                <p className="mt-2 text-xs leading-relaxed text-page-warning">{t('topup.exactAmountNotice')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-sm rounded-xl p-3">
                  <p className="text-xs text-page-secondary mb-1">{t('topup.amount')}</p>
                  <p className="text-sm text-page font-medium font-mono">{cryptoOrder.amount} {cryptoOrder.token}</p>
                </div>
                <div className="glass-sm rounded-xl p-3">
                  <p className="text-xs text-page-secondary mb-1">{t('topup.chain')}</p>
                  <p className="text-sm text-page font-medium">{selectedChainLabel || cryptoOrder.chain}</p>
                </div>
              </div>
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-page-warning">
                {t('topup.exactAmountDetail')}
              </div>
              {cryptoPolling && (
                <div className="flex items-center gap-2 text-sm text-page-secondary">
                  <div className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                  {t('topup.waitingPayment')}
                </div>
              )}
              <button
                onClick={() => { setCryptoOrder(null); setCryptoPolling(false); }}
                className="w-full py-2 rounded-xl text-sm glass-sm text-page-secondary hover:text-page transition-colors"
              >
                {t('topup.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <ConsoleSection className="mt-6" title={t('topup.history')} subtitle="Recent billing and recharge activity.">
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-500" />
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-page-divider bg-page-surface/40 py-10 text-center text-sm text-page-muted">
              {t('topup.noHistory')}
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-2xl border border-page-divider bg-page-surface/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-page">{symbol}{(Number(item.amount) * rate).toFixed(2)}</p>
                    <p className="text-xs text-page-muted">
                      {new Date(item.create_time * 1000).toLocaleString()} · {item.payment_method || t('topup.redeemCode')}
                    </p>
                  </div>
                  <ConsoleBadge tone={item.status === 'success' ? 'emerald' : item.status === 'pending' ? 'amber' : 'rose'}>
                    {item.status === 'success' ? t('topup.statusSuccess') : item.status === 'pending' ? t('topup.statusPending') : t('topup.statusFailed')}
                  </ConsoleBadge>
                </div>
              ))}
            </div>
          )}
        </ConsoleSection>
      )}

      <ConsoleSection
        className="mt-6"
        title={t('topup.redeemTitle')}
        subtitle={redeemCodeShopUrl ? t('topup.redeemShopHint') : t('topup.redeemHint')}
        action={
          redeemCodeShopUrl ? (
            <a
              href={redeemCodeShopUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all hover:bg-brand-600"
            >
              <TicketPercent size={16} />
              {t('topup.buyRedeemCode')}
              <ExternalLink size={14} />
            </a>
          ) : null
        }
      >
        <form onSubmit={handleRedeem} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value)}
            className="input flex-1"
            placeholder={t('topup.enterRedeemCode')}
          />
          <button type="submit" disabled={redeeming} className="btn-primary justify-center whitespace-nowrap">
            {redeeming ? t('topup.redeeming') : t('topup.redeem')}
          </button>
        </form>
      </ConsoleSection>
    </ConsolePage>
  );
}
