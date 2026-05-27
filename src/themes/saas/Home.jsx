import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Braces,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  Gauge,
  KeyRound,
  Layers3,
  LineChart,
  Play,
  Server,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSite, useCurrency } from '../../context/SiteContext';
import { getSitePackages, Q } from '../../api';
import CodeBlock from '../../components/CodeBlock';
import CopyButton from '../../components/CopyButton';
import ModelBadges, { AvailabilityBadge } from '../../components/ModelBadges';
import ModelPrice from '../../components/ModelPrice';
import {
  CossCard,
  CossSection,
  CossStat,
  CossTableFrame,
  CossTabs,
} from '../../components/public/CossLayout';
import { INVALID_WEBSITE_API_BASE_URL } from '../../constants/api';
import { getPublicModelCatalog, readPublicModelCatalog } from '../../utils/publicCatalog';
import {
  buildCurlSnippet,
  buildJsSnippet,
  buildPythonSnippet,
  formatCompactNumber,
  formatTokenUsageValue,
  formatUsageValue,
  getModelCategory,
  getModelDisplayName,
  getModelId,
  getModelRoute,
  getModelSummary,
  getModelTags,
  getSupportedModes,
  sortModels,
} from '../../utils/modelMeta';

const fallbackDisplayModels = [
  { id: 'gpt-4o-mini', model_name: 'gpt-4o-mini', display_name: 'GPT-4o Mini', category: 'Fast reasoning' },
  { id: 'claude-sonnet-4-5', model_name: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5', category: 'Advanced reasoning' },
  { id: 'gemini-2.5-pro', model_name: 'gemini-2.5-pro', display_name: 'Gemini 2.5 Pro', category: 'Multimodal' },
  { id: 'deepseek-chat', model_name: 'deepseek-chat', display_name: 'DeepSeek Chat', category: 'General purpose' },
];

const snippetTabs = [
  { key: 'curl', label: 'cURL' },
  { key: 'js', label: 'JavaScript' },
  { key: 'python', label: 'Python' },
];

const GSAP_CDN_URL = 'https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js';
const GSAP_SCRIPT_ID = 'sassai-home-gsap';

function useHomeMotion(scopeRef) {
  useEffect(() => {
    const scope = scopeRef.current;
    if (typeof window === 'undefined' || typeof document === 'undefined' || !scope) {
      return undefined;
    }

    let context;
    let observer;
    let cancelled = false;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const getGsap = () => {
      if (window.gsap) return Promise.resolve(window.gsap);

      const existingScript = document.getElementById(GSAP_SCRIPT_ID);
      if (existingScript) {
        return new Promise((resolve, reject) => {
          existingScript.addEventListener('load', () => resolve(window.gsap), { once: true });
          existingScript.addEventListener('error', reject, { once: true });
        });
      }

      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.id = GSAP_SCRIPT_ID;
        script.src = GSAP_CDN_URL;
        script.async = true;
        script.onload = () => resolve(window.gsap);
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    const runMotion = (gsap) => {
      if (cancelled || !gsap?.context) return;

      context = gsap.context(() => {
        const select = gsap.utils.selector(scope);
        const heroItems = select('[data-home-reveal="hero"]');
        const heroPanel = scope.querySelector('[data-home-panel]');
        const stats = select('[data-home-reveal="stats"] > *');
        const sections = select('[data-home-reveal="section"]');
        const animated = [...heroItems, heroPanel, ...stats, ...sections].filter(Boolean);

        gsap.set(animated, { willChange: 'transform, opacity' });

        if (reduceMotion) {
          gsap.set(animated, { autoAlpha: 1, y: 0, scale: 1, clearProps: 'willChange' });
          return;
        }

        const intro = gsap.timeline({
          defaults: { duration: 0.68, ease: 'power3.out' },
        });

        intro
          .addLabel('intro', 0)
          .from(heroItems, { autoAlpha: 0, y: 24, stagger: 0.07 }, 'intro')
          .from(heroPanel, { autoAlpha: 0, y: 30, scale: 0.98 }, 'intro+=0.12')
          .from(stats, { autoAlpha: 0, y: 16, stagger: 0.06 }, 'intro+=0.28');

        if (!('IntersectionObserver' in window)) {
          gsap.set(sections, { autoAlpha: 1, y: 0, clearProps: 'willChange' });
          return;
        }

        gsap.set(sections, { autoAlpha: 0, y: 26 });
        observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            gsap.to(entry.target, {
              autoAlpha: 1,
              y: 0,
              duration: 0.7,
              ease: 'power3.out',
              clearProps: 'willChange',
            });
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -12% 0px' });

        sections.forEach((section) => observer.observe(section));
      }, scope);
    };

    getGsap().then(runMotion).catch(() => {
      scope.setAttribute('data-gsap-unavailable', 'true');
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      context?.revert();
    };
  }, [scopeRef]);
}

export default function SaasHome() {
  const homeRef = useRef(null);
  const { user } = useAuth();
  const { site } = useSite();
  const { fmtPlanPrice, apiBaseUrl } = useCurrency();
  const cachedCatalog = useMemo(() => readPublicModelCatalog(), []);
  const [models, setModels] = useState(() => cachedCatalog?.models || []);
  const [packages, setPackages] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSnippet, setActiveSnippet] = useState('curl');
  const siteName = site?.name || 'SubRouter';
  const baseUrl = apiBaseUrl;

  useHomeMotion(homeRef);

  useEffect(() => {
    let cancelled = false;
    getPublicModelCatalog().then((catalog) => {
      if (!cancelled) setModels(catalog.models);
    }).catch(() => {});
    getSitePackages().then((res) => { if (res.data.success) setPackages(res.data.data || []); }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledModels = useMemo(() => models.filter((model) => model.enabled !== false), [models]);
  const featuredModels = useMemo(() => sortModels(enabledModels, 'popular').slice(0, 6), [enabledModels]);
  const displayModels = featuredModels.length ? featuredModels : fallbackDisplayModels;
  const routeModels = displayModels.slice(0, 4);
  const categoryGroups = useMemo(() => {
    const groups = new Map();
    enabledModels.forEach((model) => {
      const category = getModelCategory(model);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(model);
    });
    return Array.from(groups.entries())
      .map(([name, items]) => ({ key: name.toLowerCase(), name, models: items }))
      .sort((a, b) => b.models.length - a.models.length || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [enabledModels]);
  const enabledPackages = useMemo(() => packages.filter((pkg) => pkg.enabled !== false), [packages]);
  const totalCredits = useMemo(
    () => enabledPackages.reduce((sum, pkg) => sum + (Number(pkg.quota_amount) || 0), 0) / Q,
    [enabledPackages],
  );
  const defaultModelId = displayModels[0] ? getModelId(displayModels[0]) : 'gpt-4o-mini';

  const showcasedModels = useMemo(() => {
    if (activeCategory === 'all') return displayModels.slice(0, 6);
    const group = categoryGroups.find((item) => item.key === activeCategory);
    if (!group?.models?.length) return displayModels.slice(0, 6);
    return sortModels(group.models, 'popular').slice(0, 6);
  }, [activeCategory, categoryGroups, displayModels]);

  const showcaseTabs = useMemo(() => [
    { key: 'all', label: 'All', count: enabledModels.length || displayModels.length },
    ...categoryGroups.slice(0, 5).map((group) => ({
      key: group.key,
      label: group.name,
      count: group.models.length,
    })),
  ], [categoryGroups, displayModels.length, enabledModels.length]);

  const heroStats = [
    { label: 'Public models', value: `${enabledModels.length || 50}+`, detail: 'catalog ready' },
    { label: 'Capability groups', value: `${categoryGroups.length || 6}+`, detail: 'use-case filters' },
    { label: 'Plan credits', value: totalCredits > 0 ? `$${formatCompactNumber(totalCredits)}` : 'API', detail: 'account controlled' },
  ];

  const valueCards = [
    {
      icon: Database,
      tone: 'cyan',
      title: 'Model marketplace',
      text: 'Search public model ids, availability, capability tags, and fit signals before choosing a production default.',
    },
    {
      icon: ShieldCheck,
      tone: 'emerald',
      title: 'Enterprise access',
      text: 'API keys, account controls, and the OpenAI-compatible base URL stay predictable from prototype to launch.',
    },
    {
      icon: Code2,
      tone: 'slate',
      title: 'Drop-in integration',
      text: `Keep existing OpenAI-style clients and set the base URL to ${baseUrl}.`,
    },
    {
      icon: Gauge,
      tone: 'amber',
      title: 'Official pricing',
      text: 'Compare input, output, cache, and per-call economics using the public pricing surface already used across the app.',
    },
  ];

  const snippets = useMemo(() => ({
    curl: buildCurlSnippet({ baseUrl, modelId: defaultModelId }),
    js: buildJsSnippet({ baseUrl, modelId: defaultModelId }),
    python: buildPythonSnippet({ baseUrl, modelId: defaultModelId }),
  }), [baseUrl, defaultModelId]);

  const activeSnippetConfig = snippetTabs.find((item) => item.key === activeSnippet) || snippetTabs[0];

  return (
    <div ref={homeRef} className="coss-page overflow-hidden">
      <HomeMotionStyles />

      <section className="relative overflow-hidden border-b border-slate-200/80 bg-white">
        <div className="saas-home-ambient absolute inset-0" />
        <div className="saas-home-hero-grid absolute inset-0 opacity-80" />
        <div className="saas-home-noise absolute inset-0 opacity-[0.13]" />
        <CossSection className="relative py-10 sm:py-14 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.96fr)_minmax(390px,0.78fr)] lg:items-center">
            <div className="min-w-0">
              <div data-home-reveal="hero" className="coss-chip mb-5">
                <Sparkles size={15} />
                {siteName} model gateway
              </div>
              <h1 data-home-reveal="hero" className="max-w-4xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
                One enterprise-grade OpenAI-compatible gateway for production LLM apps.
              </h1>
              <p data-home-reveal="hero" className="mt-5 max-w-3xl text-xl leading-8 text-slate-700 sm:text-2xl sm:leading-9">
                Discover models, compare official prices, issue API keys, and ship through a single stable endpoint built for teams moving AI workloads into production.
              </p>
              <p data-home-reveal="hero" className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                {siteName} brings model discovery, developer credentials, usage visibility, and SDK-compatible requests into one business-grade control plane.
              </p>

              <div data-home-reveal="hero" className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
                <Link
                  to={user ? '/tokens' : '/register'}
                  className="coss-button-primary w-full px-5 py-3 sm:w-auto"
                >
                  <KeyRound size={17} />
                  Start building / Get API key
                </Link>
                <Link
                  to="/models"
                  className="coss-button-secondary w-full px-5 py-3 sm:w-auto"
                >
                  <Boxes size={17} />
                  Explore models
                </Link>
                <Link
                  to={`/playground?model=${encodeURIComponent(defaultModelId)}`}
                  className="coss-button-ghost w-full px-5 py-3 sm:w-auto"
                >
                  <Play size={17} />
                  Open Playground
                </Link>
              </div>

              <div data-home-reveal="hero" className="mt-6 flex flex-wrap items-center gap-2">
                <TrustBadge label="OpenAI-compatible" />
                <TrustBadge label="Official USD pricing" />
                <TrustBadge label="Usage visibility" />
                <TrustBadge label={`Base URL: ${baseUrl}`} wide />
              </div>
            </div>

            <div data-home-panel>
              <HeroGatewayPanel models={routeModels} baseUrl={baseUrl} totalModels={enabledModels.length} />
            </div>
          </div>

          <div data-home-reveal="stats" className="mt-8 grid gap-3 sm:grid-cols-3">
            {heroStats.map((stat) => (
              <CossStat key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} />
            ))}
          </div>
        </CossSection>
      </section>

      <CossSection className="pt-7" data-home-reveal="section">
        <div className="grid gap-4 md:grid-cols-3">
          <EndpointCard title="API base URL" value={baseUrl} icon={Server} copyText={baseUrl} />
          <EndpointCard title="Chat completions" value={`${baseUrl}/chat/completions`} icon={TerminalSquare} copyText={`${baseUrl}/chat/completions`} />
          <EndpointCard title="Model marketplace" value="/models" icon={Boxes} link="/models" />
        </div>
      </CossSection>

      <CossSection data-home-reveal="section">
        <SectionHeader
          eyebrow="Model marketplace"
          title="Choose production models with price and capability context."
          text="Every public card keeps the decision surface focused on model id, availability, use case, official pricing, and a direct Playground path."
          action={{ to: '/models', label: 'View model catalog' }}
        />

        <div className="mb-5">
          <CossTabs
            items={showcaseTabs}
            value={activeCategory}
            onChange={setActiveCategory}
            getLabel={(item) => `${item.label}${item.count ? ` (${formatCompactNumber(item.count)})` : ''}`}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featuredModels.length > 0 ? (
            showcasedModels.map((model) => (
              <FeaturedModelCard key={getModelId(model)} model={model} />
            ))
          ) : (
            <CatalogSyncState />
          )}
        </div>
      </CossSection>

      <CossSection data-home-reveal="section">
        <GatewayFlowVisual models={routeModels} baseUrl={baseUrl} />
      </CossSection>

      <CossSection data-home-reveal="section">
        <SectionHeader
          eyebrow="Platform primitives"
          title="Everything a production LLM team expects before launch."
          text="The public surface connects model discovery, official prices, API keys, usage context, and SDK-friendly requests without exposing internal operating details."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {valueCards.map((card) => (
            <ValueCard key={card.title} {...card} />
          ))}
        </div>
      </CossSection>

      <CossSection data-home-reveal="section">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold text-slate-700">Catalog families</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Model families grouped by public capability.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              These groups are generated from the same public model data used by pricing, keys, and catalog pages.
            </p>
            <Link to="/models" className="coss-button-primary mt-7">
              Browse models <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {categoryGroups.length > 0 ? (
              categoryGroups.map((group) => (
                <CategoryCard key={group.key} group={group} />
              ))
            ) : (
              <CossCard className="p-5 text-sm text-slate-600 sm:col-span-2">
                The catalog is syncing. Model families will appear here when public catalog data is available.
              </CossCard>
            )}
          </div>
        </div>
      </CossSection>

      <CossSection data-home-reveal="section">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold text-slate-700">Developer quickstart</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Point your app at one OpenAI-compatible base URL.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Keep the request shape familiar: generate a key, choose a public model id, and send traffic to the API base.
            </p>
            <div className="mt-7 space-y-4">
              <QuickStep index={1} title="Create an API key" text="Generate a key from the signed-in API Keys page." />
              <QuickStep index={2} title="Choose a model" text="Copy the exact model id from the catalog or detail page." />
              <QuickStep index={3} title="Send a request" text={`Use the OpenAI-compatible ${baseUrl}/chat/completions endpoint.`} />
            </div>
          </div>
          <div className="grid gap-4">
            <UsagePanel baseUrl={baseUrl} modelId={defaultModelId} />
            <ApiBasePanel baseUrl={baseUrl} />
            <div>
              <div className="mb-3">
                <CossTabs items={snippetTabs} value={activeSnippet} onChange={setActiveSnippet} />
              </div>
              <CodeBlock
                title={`${activeSnippetConfig.label} first request`}
                language={activeSnippetConfig.key}
                code={snippets[activeSnippetConfig.key]}
              />
            </div>
          </div>
        </div>
      </CossSection>

      {enabledPackages.length > 0 && (
        <CossSection data-home-reveal="section">
          <SectionHeader
            eyebrow="Enterprise access"
            title="Plans connect credits, billing, and API access."
            text="Public package cards stay focused on plan value while billing, activation, and account controls continue through the existing platform flow."
            action={{ to: '/packages', label: 'View packages' }}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {enabledPackages.slice(0, 3).map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} fmtPlanPrice={fmtPlanPrice} />
            ))}
          </div>
        </CossSection>
      )}
    </div>
  );
}

function HomeMotionStyles() {
  return (
    <style>{`
      [data-home-reveal],
      [data-home-panel] {
        will-change: transform, opacity;
      }
      @keyframes saas-home-flow {
        0% { transform: translateX(-120%); }
        100% { transform: translateX(120%); }
      }
      @keyframes saas-home-shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      .saas-home-ambient {
        background:
          linear-gradient(115deg, rgba(8, 145, 178, 0.14) 0%, rgba(255, 255, 255, 0) 35%),
          linear-gradient(235deg, rgba(16, 185, 129, 0.12) 0%, rgba(255, 255, 255, 0) 34%),
          linear-gradient(180deg, #ffffff 0%, #f8fafc 66%, #eef6f8 100%);
      }
      .saas-home-hero-grid {
        background-image:
          linear-gradient(rgba(15, 23, 42, 0.055) 1px, transparent 1px),
          linear-gradient(90deg, rgba(15, 23, 42, 0.055) 1px, transparent 1px);
        background-size: 44px 44px;
        mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.18));
      }
      .saas-home-noise {
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.38'/%3E%3C/svg%3E");
        mix-blend-mode: multiply;
      }
      .saas-home-flow {
        position: relative;
        overflow: hidden;
      }
      .saas-home-flow::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.34), transparent);
        animation: saas-home-flow 3.2s ease-in-out infinite;
      }
      .saas-home-control-line {
        background: linear-gradient(90deg, rgba(34, 211, 238, 0.18), rgba(16, 185, 129, 0.22), rgba(148, 163, 184, 0.08));
      }
      .saas-home-shimmer {
        position: relative;
        overflow: hidden;
        background: rgba(226, 232, 240, 0.92);
      }
      .saas-home-shimmer::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.68), transparent);
        animation: saas-home-shimmer 1.8s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .saas-home-flow::after,
        .saas-home-shimmer::after {
          animation: none !important;
        }
      }
    `}</style>
  );
}

function TrustBadge({ label, wide = false }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ${wide ? 'break-all' : ''}`}>
      <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
      <span className={wide ? 'break-all' : ''}>{label}</span>
    </span>
  );
}

function HeroGatewayPanel({ models, baseUrl, totalModels }) {
  const rows = models.length ? models.slice(0, 4) : fallbackDisplayModels;
  const firstModelId = getModelId(rows[0]);

  return (
    <div className="relative min-w-0">
      <div className="relative rounded-xl border border-slate-900 bg-slate-950 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:p-4">
        <div className="saas-home-control-line pointer-events-none absolute inset-x-0 top-0 h-px" />
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-1 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Production ready
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400">OpenAI-compatible request</p>
              <p className="mt-1 break-all font-mono text-sm font-semibold text-white">{baseUrl}/chat/completions</p>
            </div>
            <CopyButton
              text={`${baseUrl}/chat/completions`}
              iconOnly
              className="h-9 w-9 shrink-0 border-white/10 bg-white/10 px-0 py-0 text-slate-100 hover:bg-white/15 hover:text-white"
            />
          </div>
          <div className="grid gap-2 rounded-lg border border-white/10 bg-slate-900/90 p-3 font-mono text-xs text-slate-200">
            <div className="flex min-w-0 items-center gap-2">
              <span className="rounded-md bg-cyan-300/10 px-2 py-1 text-cyan-100">POST</span>
              <span className="min-w-0 truncate">/chat/completions</span>
            </div>
            <div className="grid gap-1 text-slate-400 sm:grid-cols-[auto_1fr]">
              <span>model</span>
              <span className="min-w-0 truncate text-slate-100">{firstModelId}</span>
              <span>messages</span>
              <span className="text-slate-100">OpenAI-compatible JSON</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <GatewaySignal icon={Boxes} label="Catalog" value={`${totalModels || 50}+ models`} />
          <GatewaySignal icon={Activity} label="Health" value="Ready" tone="emerald" />
          <GatewaySignal icon={Zap} label="Access" value="Keys" tone="amber" />
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Model selector</p>
              <p className="mt-1 text-sm font-semibold text-white">Public catalog choices</p>
            </div>
            <Layers3 size={18} className="text-cyan-200" />
          </div>
          <div className="space-y-2">
            {rows.map((model, index) => (
              <div key={getModelId(model)} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-slate-900/90 p-3 transition hover:border-cyan-300/30 hover:bg-slate-900">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{getModelDisplayName(model)}</p>
                  <p className="mt-1 truncate font-mono text-xs text-slate-400">{getModelId(model)}</p>
                </div>
                <span className="rounded-md bg-white/5 px-2 py-1 font-mono text-xs text-cyan-100">0{index + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2 text-xs text-slate-300">
          <FlowNode label="Key" icon={KeyRound} />
          <FlowLine />
          <FlowNode label="Model" icon={Cpu} />
          <FlowLine />
          <FlowNode label="Output" icon={CheckCircle2} />
        </div>
      </div>
    </div>
  );
}

function GatewaySignal({ icon: Icon, label, value, tone = 'cyan' }) {
  const toneClasses = {
    cyan: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    amber: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  };

  return (
    <div className={`rounded-lg border p-3 ${toneClasses[tone] || toneClasses.cyan}`}>
      <div className="flex items-center gap-2">
        <Icon size={15} />
        <span className="text-xs opacity-80">{label}</span>
      </div>
      <p className="mt-2 truncate font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}

function FlowNode({ label, icon: Icon }) {
  return (
    <div className="inline-flex min-w-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-2">
      <Icon size={14} className="shrink-0 text-cyan-200" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function FlowLine() {
  return <div className="saas-home-flow h-px min-w-8 bg-white/[0.12]" />;
}

function EndpointCard({ title, value, icon: Icon, link, copyText }) {
  const content = (
    <div className="group flex min-h-[104px] items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-xl hover:shadow-cyan-950/5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white transition group-hover:bg-cyan-700">
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-900">{value}</p>
      </div>
      {copyText ? (
        <CopyButton text={copyText} iconOnly className="h-9 w-9 shrink-0 px-0 py-0" />
      ) : (
        <ArrowUpRight size={17} className="shrink-0 text-slate-400 transition group-hover:text-cyan-700" />
      )}
    </div>
  );
  if (link) return <Link to={link}>{content}</Link>;
  return content;
}

function SectionHeader({ eyebrow, title, text, action }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-cyan-700">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">{title}</h2>
        {text && <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{text}</p>}
      </div>
      {action && (
        <Link to={action.to} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-cyan-700">
          {action.label} <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

function FeaturedModelCard({ model }) {
  const modelId = getModelId(model);
  const usage = formatUsageValue(model);
  const tokenUsage = formatTokenUsageValue(model);
  const modes = getSupportedModes(model).slice(0, 3);
  const summary = getModelSummary(model);
  const metricRows = [
    { label: 'Category', value: getModelCategory(model) },
    usage !== '-' ? { label: 'Requests', value: usage } : null,
    tokenUsage !== '-' ? { label: 'Tokens', value: tokenUsage } : null,
  ].filter(Boolean).slice(0, 3);

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-xl hover:shadow-cyan-950/[0.08]">
      <div className="border-b border-slate-100 bg-slate-50/80 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-950">{getModelDisplayName(model)}</h3>
            <p className="mt-1 truncate font-mono text-xs text-slate-500">{modelId}</p>
          </div>
          <AvailabilityBadge model={model} />
        </div>
        <p className="mt-4 min-h-[48px] text-sm leading-6 text-slate-600">{summary}</p>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {metricRows.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs text-slate-500">{metric.label}</p>
              <p className="mt-1 truncate font-mono text-xs font-semibold text-slate-950">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {modes.map((mode) => (
            <span key={mode} className="rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-cyan-700">
              {mode}
            </span>
          ))}
        </div>
        <div className="mt-3">
          <ModelBadges model={model} />
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-500">Official pricing</p>
          <ModelPrice model={model} />
        </div>
      </div>

      <div className="grid gap-2 border-t border-slate-100 bg-white p-4 sm:grid-cols-2">
        <Link to={getModelRoute(model)} className="coss-button-secondary min-w-0 px-3">
          Details <ArrowRight size={15} />
        </Link>
        <Link to={`/playground?model=${encodeURIComponent(modelId)}`} className="coss-button-primary min-w-0 px-3">
          Try in Playground
        </Link>
      </div>
    </article>
  );
}

function CatalogSyncState() {
  return (
    <div className="grid gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-3 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="saas-home-shimmer h-4 w-36 rounded-full" />
              <div className="saas-home-shimmer h-3 w-48 rounded-full" />
            </div>
            <div className="saas-home-shimmer h-7 w-16 rounded-full" />
          </div>
          <div className="mt-6 space-y-3">
            <div className="saas-home-shimmer h-3 w-full rounded-full" />
            <div className="saas-home-shimmer h-3 w-5/6 rounded-full" />
            <div className="saas-home-shimmer h-20 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function GatewayFlowVisual({ models, baseUrl }) {
  const rows = models.length ? models.slice(0, 4) : fallbackDisplayModels;

  return (
    <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
      <div>
        <p className="text-sm font-semibold text-slate-700">API workbench</p>
        <h2 className="mt-2 max-w-xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
          One request path, many public model choices.
        </h2>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Keep the endpoint stable while your app selects the public model id that fits cost, speed, context, or capability needs.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <MiniCapability icon={ShieldCheck} title="Key ready" text="Create API keys from the existing account flow." />
          <MiniCapability icon={Code2} title="SDK ready" text="Use familiar OpenAI-compatible clients." />
          <MiniCapability icon={LineChart} title="Pricing context" text="Compare economics before launch." />
          <MiniCapability icon={Activity} title="Catalog status" text="Public availability stays visible." />
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-xl border border-slate-900 bg-slate-950 p-4 shadow-2xl shadow-slate-950/[0.14]">
          <div className="mb-4 flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Request composer</p>
              <p className="mt-1 break-all font-mono text-sm font-semibold text-white">{baseUrl}/chat/completions</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
              <Braces size={13} />
              JSON
            </span>
          </div>

          <EndpointInputGroup baseUrl={baseUrl} />

          <div className="mt-4 grid gap-3 sm:grid-cols-[0.9fr_auto_1.1fr] sm:items-stretch">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-medium text-slate-400">Payload</p>
              <div className="mt-4 space-y-2 font-mono text-xs text-slate-200">
                <p>{`{`}</p>
                <p className="pl-3">"model": "{getModelId(rows[0])}",</p>
                <p className="pl-3">"messages": [...]</p>
                <p>{`}`}</p>
              </div>
            </div>

            <div className="hidden min-w-16 items-center sm:flex">
              <FlowLine />
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-medium text-slate-400">Response shape</p>
              <div className="mt-4 space-y-2 font-mono text-xs text-slate-200">
                <p>choices[0].message.content</p>
                <p>usage.prompt_tokens</p>
                <p>usage.completion_tokens</p>
              </div>
            </div>
          </div>
        </div>

        <ModelFitTable models={rows} />
      </div>
    </div>
  );
}

function EndpointInputGroup({ baseUrl }) {
  const endpoint = `${baseUrl}/chat/completions`;
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-2 sm:flex-row sm:items-center">
      <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-cyan-300/10 px-3 py-2 font-mono text-xs font-semibold text-cyan-100">
        POST
      </span>
      <code className="min-w-0 flex-1 break-all rounded-md bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100">
        {endpoint}
      </code>
      <CopyButton
        text={endpoint}
        className="shrink-0 border-white/10 bg-white/10 text-slate-100 hover:bg-white/15 hover:text-white"
      />
    </div>
  );
}

function ModelFitTable({ models }) {
  return (
    <CossTableFrame title="Model fit matrix" meta={`${models.length} featured choices`}>
      <div className="overflow-x-auto">
        <table className="min-w-[680px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Signals</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {models.map((model) => {
              const modelId = getModelId(model);
              return (
                <tr key={modelId} className="transition hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-950">{getModelDisplayName(model)}</p>
                    <p className="mt-1 max-w-[260px] truncate font-mono text-xs text-slate-500">{modelId}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{getModelCategory(model)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {getModelTags(model).slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/playground?model=${encodeURIComponent(modelId)}`} className="inline-flex items-center justify-end gap-1.5 text-xs font-semibold text-cyan-700 hover:text-slate-950">
                      Playground <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CossTableFrame>
  );
}

function MiniCapability({ icon: Icon, title, text }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <Icon size={18} className="text-cyan-700" />
      <p className="mt-3 font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
    </div>
  );
}

function ValueCard({ icon: Icon, title, text, tone }) {
  const toneClasses = {
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-slate-950 text-white border-slate-950',
  };

  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-xl hover:shadow-cyan-950/[0.07]">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg border ${toneClasses[tone] || toneClasses.cyan}`}>
          <Icon size={20} />
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
          Built in
        </span>
      </div>
      <h3 className="mt-4 font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function CategoryCard({ group }) {
  const previewModels = group.models.slice(0, 3);

  return (
    <Link
      to={`/models?category=${encodeURIComponent(group.name)}`}
      className="group min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-white hover:shadow-lg hover:shadow-cyan-950/5"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-800 shadow-sm transition group-hover:bg-slate-950 group-hover:text-white">
          <Layers3 size={16} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-950">{group.name}</p>
          <p className="text-xs text-slate-500">{group.models.length} models</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {previewModels.map((model) => (
          <span key={getModelId(model)} className="max-w-full truncate rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-500">
            {getModelId(model)}
          </span>
        ))}
      </div>
    </Link>
  );
}

function UsagePanel({ baseUrl, modelId }) {
  const rows = [
    { label: 'API base', value: baseUrl, copy: baseUrl, icon: Server },
    { label: 'Model id', value: modelId, copy: modelId, icon: Cpu },
    { label: 'Format', value: 'OpenAI-compatible JSON', icon: Braces },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <row.icon size={16} className="shrink-0 text-cyan-700" />
            {row.copy && <CopyButton text={row.copy} iconOnly className="h-7 w-7 shrink-0 px-0 py-0" />}
          </div>
          <p className="mt-3 text-xs text-slate-500">{row.label}</p>
          <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-950">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function ApiBasePanel({ baseUrl }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">API base URL</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Use the API base URL below. {INVALID_WEBSITE_API_BASE_URL} alone is invalid for API calls.
          </p>
        </div>
        <CopyButton text={baseUrl} className="shrink-0" />
      </div>
      <div className="mt-4 flex min-w-0 flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:flex-row sm:items-center">
        <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-slate-950 px-3 py-2 font-mono text-xs font-semibold text-white">
          base_url
        </span>
        <code className="min-w-0 flex-1 break-all rounded-md bg-white px-3 py-2 font-mono text-sm text-slate-950">
          {baseUrl}
        </code>
      </div>
    </div>
  );
}

function QuickStep({ index, title, text }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700">
        {index}
      </span>
      <div>
        <p className="font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function PackageCard({ pkg, fmtPlanPrice }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-xl hover:shadow-cyan-950/[0.07]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-slate-950">{pkg.name}</h3>
          <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">{getPackageDescription(pkg)}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-100 bg-cyan-50 text-cyan-700">
          <Sparkles size={18} />
        </span>
      </div>
      <div className="mt-6 flex flex-wrap items-end gap-2">
        <span className="text-3xl font-semibold text-slate-950">{fmtPlanPrice(pkg.price, pkg.currency)}</span>
        <span className="pb-1 text-sm text-slate-500">/{pkg.billing_interval || 'cycle'}</span>
      </div>
      <Link to="/packages" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 transition hover:text-slate-950">
        View plan <ArrowRight size={15} />
      </Link>
    </div>
  );
}

function getPackageDescription(pkg) {
  const description = String(pkg?.description || '').trim();
  if (!description || /[\u4e00-\u9fff]/.test(description)) {
    return 'Managed credits, billing, and access controls for production usage.';
  }
  return description;
}
