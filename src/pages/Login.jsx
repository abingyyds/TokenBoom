import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Boxes, CheckCircle2, Code2, KeyRound, LockKeyhole, Play, Server, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePublicApiBaseUrl, useSite } from '../context/SiteContext';
import { PUBLIC_API_BASE_URL } from '../constants/api';
import toast from 'react-hot-toast';

export default function Login() {
  const { t } = useTranslation();
  const { login, user } = useAuth();
  const { site } = useSite();
  const apiBaseUrl = usePublicApiBaseUrl() || PUBLIC_API_BASE_URL;
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  if (user) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      toast.error(t('login.fillAllFields'));
      return;
    }
    setLoading(true);
    try {
      const result = await login(form.username, form.password);
      if (result.success) {
        toast.success(t('login.welcomeBackToast'));
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
        return;
      }
    } catch (err) {
      // Network error handled by interceptor.
    }
    setLoading(false);
  };

  const siteName = site?.name || 'SubRouter';
  const featureRows = [
    { icon: KeyRound, title: 'API keys', text: 'Create, review, and rotate keys from the console.' },
    { icon: Boxes, title: 'Model catalog', text: 'Compare public model ids and price signals before launch.' },
    { icon: ShieldCheck, title: 'Usage visibility', text: 'Keep request history and account controls close to your workflow.' },
  ];

  return (
    <div className="coss-page">
      <section className="coss-page-header">
        <div className="coss-container grid gap-8 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-end">
          <div className="max-w-3xl">
            <div className="coss-chip">
              <LockKeyhole size={14} />
              Secure console
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Sign in to {siteName}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Access API keys, model tools, usage history, and playground workflows from a compact SubRouter workspace.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="coss-chip">OpenAI-compatible API</span>
              <span className="coss-chip">Public model catalog</span>
              <span className="coss-chip">Usage and keys</span>
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
              <p className="text-sm font-semibold text-slate-950">Console workspace</p>
              <p className="mt-1 text-sm text-slate-500">Everything needed after sign-in, without leaving the product surface.</p>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-1">
              {featureRows.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="coss-icon-tile">
                    <Icon size={17} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/models" className="group coss-card flex items-center justify-between gap-3 p-4">
              <span>
                <span className="block text-sm font-semibold text-slate-950">Browse models</span>
                <span className="mt-1 block text-sm text-slate-500">Check model ids and prices.</span>
              </span>
              <ArrowRight size={17} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
            </Link>
            <Link to="/docs/quickstart" className="group coss-card flex items-center justify-between gap-3 p-4">
              <span>
                <span className="block text-sm font-semibold text-slate-950">Open quickstart</span>
                <span className="mt-1 block text-sm text-slate-500">Use standard request shapes.</span>
              </span>
              <ArrowRight size={17} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
            </Link>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="coss-card-frame overflow-hidden">
            <div className="border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Welcome back</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">{t('login.welcomeBack')}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {site?.name ? t('login.signInTo', { name: site.name }) : t('login.signInToDefault')}
                  </p>
                </div>
                <span className="coss-icon-tile">
                  <LockKeyhole size={18} />
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="mb-5 grid grid-cols-2 gap-3">
                <MiniMetric icon={KeyRound} label="Keys" value="Manage access" />
                <MiniMetric icon={Play} label="Test" value="Open playground" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t('login.username')}</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="coss-input"
                    placeholder={t('login.enterUsername')}
                    autoComplete="username"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t('login.password')}</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="coss-input"
                    placeholder={t('login.enterPassword')}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <button type="submit" disabled={loading} className="coss-button-primary w-full py-3">
                  {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                  {loading ? t('login.signingIn') : t('login.signInBtn')}
                </button>
              </form>

              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="flex items-start gap-2 text-xs leading-5 text-emerald-900">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-700" />
                  Your account opens keys, logs, model catalog tools, and playground access in the same console.
                </p>
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-600">
                  {t('login.noAccount')}{' '}
                  <Link to="/register" className="font-semibold text-slate-950 transition-colors hover:text-slate-700">
                    {t('login.createOne')}
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
