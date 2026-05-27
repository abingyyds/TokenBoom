import React, { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Boxes, CheckCircle2, Code2, CreditCard, KeyRound, LockKeyhole, Play, Route, Server, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePublicApiBaseUrl, useSite } from '../context/SiteContext';
import { PUBLIC_API_BASE_URL } from '../constants/api';
import toast from 'react-hot-toast';

export default function Register() {
  const { t } = useTranslation();
  const { register, user } = useAuth();
  const { site } = useSite();
  const apiBaseUrl = usePublicApiBaseUrl() || PUBLIC_API_BASE_URL;
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '', password2: '', email: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const affCode = new URLSearchParams(window.location.search).get('aff');
    if (affCode) {
      localStorage.setItem('dist_aff', affCode);
    }
  }, []);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      toast.error(t('register.fillRequired'));
      return;
    }
    if (form.password !== form.password2) {
      toast.error(t('register.passwordMismatch'));
      return;
    }
    if (form.password.length < 8 || form.password.length > 20) {
      toast.error(t('register.passwordLength'));
      return;
    }
    setLoading(true);
    try {
      const affCode = new URLSearchParams(window.location.search).get('aff') || localStorage.getItem('dist_aff') || '';
      const result = await register({
        username: form.username,
        password: form.password,
        email: form.email || undefined,
        aff_code: affCode || undefined,
      });
      if (result.success) {
        toast.success(t('register.accountCreated'));
        navigate('/login', { replace: true });
        return;
      }
    } catch (err) {
      // Network error handled by interceptor.
    }
    setLoading(false);
  };

  const siteName = site?.name || 'SubRouter';
  const steps = [
    { icon: KeyRound, title: 'Create access', text: 'Set up an account and keep the existing auth flow unchanged.' },
    { icon: Boxes, title: 'Pick a model', text: 'Use the public catalog to find a stable model id.' },
    { icon: Code2, title: 'Send requests', text: `Point your client at ${apiBaseUrl}.` },
  ];
  const trustCues = [
    { icon: Route, label: 'Unified API' },
    { icon: ShieldCheck, label: 'Usage visibility' },
    { icon: CreditCard, label: 'Transparent pricing' },
  ];

  return (
    <div className="coss-page">
      <section className="coss-page-header">
        <div className="coss-container grid gap-8 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-end">
          <div className="max-w-3xl">
            <div className="coss-chip">
              <Sparkles size={14} />
              Start here
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Create your account for {siteName}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Register once, then use the console for API keys, model browsing, usage history, and playground workflows.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {trustCues.map(({ label }) => (
                <span key={label} className="coss-chip">{label}</span>
              ))}
            </div>
          </div>

          <div className="coss-card-muted p-4">
            <div className="flex items-center gap-3">
              <span className="coss-icon-tile">
                <Server size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">API base URL</p>
                <p className="mt-1 truncate font-mono text-sm font-semibold text-slate-950">{apiBaseUrl}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="coss-container grid gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,0.94fr)_minmax(380px,0.6fr)] lg:gap-8">
        <div className="order-2 grid content-start gap-4 lg:order-1">
          <div className="coss-card-frame overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
              <p className="text-sm font-semibold text-slate-950">Quick path</p>
              <p className="mt-1 text-sm text-slate-500">A short route from account creation to first request.</p>
            </div>
            <div className="grid gap-3 p-4">
              {steps.map(({ icon: Icon, title, text }, index) => (
                <div key={title} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="coss-icon-tile">
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">{index + 1}. {title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Link to="/models" className="group coss-card flex items-center justify-between gap-3 p-4">
              <span className="text-sm font-semibold text-slate-950">Models</span>
              <ArrowRight size={17} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
            </Link>
            <Link to="/docs/quickstart" className="group coss-card flex items-center justify-between gap-3 p-4">
              <span className="text-sm font-semibold text-slate-950">Docs</span>
              <ArrowRight size={17} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
            </Link>
            <Link to="/playground" className="group coss-card flex items-center justify-between gap-3 p-4">
              <span className="text-sm font-semibold text-slate-950">Playground</span>
              <ArrowRight size={17} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
            </Link>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="coss-card-frame overflow-hidden">
            <div className="border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Create access</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">{t('register.createAccount')}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {site?.name ? t('register.getStartedWith', { name: site.name }) : t('register.getStartedDefault')}
                  </p>
                </div>
                <span className="coss-icon-tile">
                  <LockKeyhole size={18} />
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="mb-5 grid grid-cols-2 gap-3">
                <MiniMetric icon={LockKeyhole} label="Account" value="Console login" />
                <MiniMetric icon={Play} label="Build" value="Keys and tests" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t('register.username')} *</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="coss-input"
                    placeholder={t('register.chooseUsername')}
                    autoComplete="username"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t('register.email')}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="coss-input"
                    placeholder={t('register.emailPlaceholder')}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t('register.password')} *</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="coss-input"
                    placeholder={t('register.passwordPlaceholder')}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t('register.confirmPassword')} *</label>
                  <input
                    type="password"
                    value={form.password2}
                    onChange={(e) => setForm({ ...form, password2: e.target.value })}
                    className="coss-input"
                    placeholder={t('register.repeatPassword')}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <button type="submit" disabled={loading} className="coss-button-primary w-full py-3">
                  {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                  {loading ? t('register.creating') : t('register.createAccountBtn')}
                </button>
              </form>

              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="flex items-start gap-2 text-xs leading-5 text-emerald-900">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-700" />
                  Registration keeps the same sign-in flow while unlocking API keys, the catalog, and playground access.
                </p>
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-600">
                  {t('register.hasAccount')}{' '}
                  <Link to="/login" className="font-semibold text-slate-950 transition-colors hover:text-slate-700">
                    {t('register.signIn')}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MiniMetric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        <Icon size={14} />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}
