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
const GSAP_SCRIPT_ID = 'tokenboom-home-gsap';

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
  const siteName = site?.name || 'TokenBoomAi';
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
    { label: 'Token routes', value: `${enabledModels.length || 50}+`, detail: 'model liquidity' },
    { label: 'Boom lanes', value: `${categoryGroups.length || 6}+`, detail: 'capability clusters' },
    { label: 'Credit firepower', value: totalCredits > 0 ? `$${formatCompactNumber(totalCredits)}` : 'API', detail: 'ready to spend' },
  ];

  const valueCards = [
    {
      icon: Database,
      tone: 'cyan',
      title: 'Token marketplace',
      text: 'Browse model routes like a live token board: price, availability, and capability signals stay visible before launch.',
    },
    {
      icon: ShieldCheck,
      tone: 'emerald',
      title: 'Controlled blast radius',
      text: 'API keys, account controls, and the OpenAI-compatible base URL keep high-volume token spend predictable.',
    },
    {
      icon: Code2,
      tone: 'slate',
      title: 'Drop-in ignition',
      text: `Keep existing OpenAI-style clients and set the base URL to ${baseUrl}.`,
    },
    {
      icon: Gauge,
      tone: 'amber',
      title: 'Live token economics',
      text: 'Compare input, output, cache, and per-call costs from the same pricing surface used across the app.',
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

      <section className="relative overflow-hidden border-b border-cyan-300/20 bg-[#0b061f]">
        <div className="saas-home-ambient absolute inset-0" />
        <div className="saas-home-hero-grid absolute inset-0 opacity-70" />
        <div className="saas-home-noise absolute inset-0 opacity-[0.16]" />
        <div className="saas-home-burst absolute left-1/2 top-10 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full" />
        <CossSection className="relative py-10 sm:py-14 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.96fr)_minmax(390px,0.78fr)] lg:items-center">
            <div className="min-w-0">
              <div data-home-reveal="hero" className="coss-chip mb-5 tokenboom-chip">
                <Sparkles size={15} />
                {siteName} token blast gateway
              </div>
              <h1 data-home-reveal="hero" className="max-w-4xl text-4xl font-black tracking-normal text-white sm:text-5xl lg:text-6xl">
                Buy tokens. Route models. Hit the boom button for AI apps.
              </h1>
              <p data-home-reveal="hero" className="mt-5 max-w-3xl text-xl leading-8 text-cyan-50/90 sm:text-2xl sm:leading-9">
                TokenBoomAi turns model access into a bright, fast token marketplace: top up credits, pick routes, and call every model through one explosive API base URL.
              </p>
              <p data-home-reveal="hero" className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                {siteName} keeps token spend, API keys, model discovery, and SDK-compatible requests in one high-energy control plane.
              </p>

              <div data-home-reveal="hero" className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
                <Link
                  to={user ? '/tokens' : '/register'}
                  className="coss-button-primary w-full px-5 py-3 sm:w-auto"
                >
                  <KeyRound size={17} />
                  Ignite API key
                </Link>
                <Link
                  to="/models"
                  className="coss-button-secondary w-full px-5 py-3 sm:w-auto"
                >
                  <Boxes size={17} />
                  Browse token routes
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
                <TrustBadge label="Token pricing board" />
                <TrustBadge label="Usage telemetry" />
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
          <EndpointCard title="TokenBoom API base" value={baseUrl} icon={Server} copyText={baseUrl} />
          <EndpointCard title="Chat completions" value={`${baseUrl}/chat/completions`} icon={TerminalSquare} copyText={`${baseUrl}/chat/completions`} />
          <EndpointCard title="Token route board" value="/models" icon={Boxes} link="/models" />
        </div>
      </CossSection>

      <CossSection data-home-reveal="section">
        <SectionHeader
          eyebrow="Token route board"
          title="Choose model routes with price, speed, and capability context."
          text="Every public card keeps the decision surface focused on model id, availability, use case, token cost, and a direct Playground path."
          action={{ to: '/models', label: 'View route board' }}
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
          title="Everything needed to turn token credits into production AI calls."
          text="The public surface connects route discovery, token prices, API keys, usage context, and SDK-friendly requests without exposing internal operating details."
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
            <p className="text-sm font-semibold text-page-link">Boom lanes</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold leading-tight text-page sm:text-4xl">
              Token routes grouped by public capability.
            </h2>
            <p className="mt-4 text-sm leading-6 text-page-secondary">
              These groups are generated from the same public model data used by pricing, keys, and route pages.
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
              <CossCard className="p-5 text-sm text-page-secondary sm:col-span-2">
                The catalog is syncing. Model families will appear here when public catalog data is available.
              </CossCard>
            )}
          </div>
        </div>
      </CossSection>

      <CossSection data-home-reveal="section">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold text-page-link">Developer quickstart</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold leading-tight text-page sm:text-4xl">
              Point your app at one OpenAI-compatible base URL.
            </h2>
            <p className="mt-4 text-sm leading-6 text-page-secondary">
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
            eyebrow="Token packs"
            title="Packages connect token credits and API access."
            text="Public package cards stay focused on token firepower. Buy with account balance, activate credits, and keep usage visible from the console."
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
          radial-gradient(circle at 20% 12%, rgba(34, 211, 238, 0.34), transparent 32%),
          radial-gradient(circle at 76% 20%, rgba(236, 72, 153, 0.34), transparent 30%),
          radial-gradient(circle at 52% 66%, rgba(190, 242, 100, 0.18), transparent 28%),
          linear-gradient(135deg, #0b061f 0%, #15103a 44%, #061b31 100%);
      }
      .saas-home-hero-grid {
        background-image:
          linear-gradient(rgba(34, 211, 238, 0.12) 1px, transparent 1px),
          linear-gradient(90deg, rgba(236, 72, 153, 0.1) 1px, transparent 1px);
        background-size: 46px 46px;
        mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.18));
      }
      .saas-home-burst {
        display: none;
      }
      .saas-home-noise {
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.38'/%3E%3C/svg%3E");
        mix-blend-mode: screen;
      }
      .saas-home-flow {
        position: relative;
        overflow: hidden;
      }
      .saas-home-flow::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(190, 242, 100, 0.72), rgba(34, 211, 238, 0.55), transparent);
        animation: saas-home-flow 4.8s ease-in-out infinite;
      }
      .saas-home-control-line {
        background: linear-gradient(90deg, rgba(34, 211, 238, 0.42), rgba(236, 72, 153, 0.44), rgba(190, 242, 100, 0.34));
      }
      .saas-home-shimmer {
        position: relative;
        overflow: hidden;
        background: rgba(34, 211, 238, 0.14);
      }
      .saas-home-shimmer::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(190, 242, 100, 0.42), rgba(34, 211, 238, 0.32), transparent);
        animation: saas-home-shimmer 2.8s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .saas-home-flow::after,
        .saas-home-shimmer::after,
        .saas-home-burst {
          animation: none !important;
        }
      }
      @keyframes tokenboom-hero-spin {
        to { transform: translateX(-50%) rotate(360deg); }
      }
    `}</style>
  );
}

function TrustBadge({ label, wide = false }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-300/24 bg-white/10 px-3 py-1.5 text-xs font-semibold text-cyan-50 shadow-sm shadow-cyan-950/20 backdrop-blur ${wide ? 'break-all' : ''}`}>
      <CheckCircle2 size={14} className="shrink-0 text-lime-300" />
      <span className={wide ? 'break-all' : ''}>{label}</span>
    </span>
  );
}

function HeroGatewayPanel({ models, baseUrl, totalModels }) {
  const rows = models.length ? models.slice(0, 4) : fallbackDisplayModels;
  const firstModelId = getModelId(rows[0]);

  return (
    <div className="relative min-w-0">
      <div className="relative rounded-xl border border-cyan-300/25 bg-[#09051d] p-3 shadow-[0_24px_90px_rgba(8,145,178,0.26)] sm:p-4">
        <div className="saas-home-control-line pointer-events-none absolute inset-x-0 top-0 h-px" />
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-1 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Boom ready
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-cyan-300/20 bg-white/[0.06] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-cyan-100/70">TokenBoom request</p>
              <p className="mt-1 break-all font-mono text-sm font-semibold text-white">{baseUrl}/chat/completions</p>
            </div>
            <CopyButton
              text={`${baseUrl}/chat/completions`}
              iconOnly
              className="h-9 w-9 shrink-0 border-white/10 bg-white/10 px-0 py-0 text-slate-100 hover:bg-white/15 hover:text-white"
            />
          </div>
          <div className="grid gap-2 rounded-lg border border-white/10 bg-[#120b2f]/95 p-3 font-mono text-xs text-slate-200">
            <div className="flex min-w-0 items-center gap-2">
              <span className="rounded-md bg-lime-300/15 px-2 py-1 text-lime-100">POST</span>
              <span className="min-w-0 truncate">/chat/completions</span>
            </div>
            <div className="grid gap-1 text-cyan-100/55 sm:grid-cols-[auto_1fr]">
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

        <div className="mt-4 rounded-lg border border-fuchsia-300/20 bg-white/[0.05] p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-fuchsia-100/70">Route selector</p>
              <p className="mt-1 text-sm font-semibold text-white">Public token choices</p>
            </div>
            <Layers3 size={18} className="text-cyan-200" />
          </div>
          <div className="space-y-2">
            {rows.map((model, index) => (
              <div key={getModelId(model)} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-slate-900/90 p-3 transition hover:border-cyan-300/30 hover:bg-slate-900">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{getModelDisplayName(model)}</p>
                  <p className="mt-1 truncate font-mono text-xs text-cyan-100/55">{getModelId(model)}</p>
                </div>
                <span className="rounded-md bg-lime-300/10 px-2 py-1 font-mono text-xs text-lime-100">0{index + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2 text-xs text-slate-300">
          <FlowNode label="Key" icon={KeyRound} />
          <FlowLine />
          <FlowNode label="Route" icon={Cpu} />
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
      <Icon size={14} className="shrink-0 text-lime-200" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function FlowLine() {
  return <div className="saas-home-flow h-px min-w-8 bg-white/[0.12]" />;
}

function EndpointCard({ title, value, icon: Icon, link, copyText }) {
  const content = (
    <div className="group flex min-h-[104px] items-center gap-3 rounded-lg border border-page-divider bg-page-surface/50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500/40 hover:bg-page-surface-hover hover:shadow-xl hover:shadow-brand-500/10">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-[#0b061f] transition group-hover:bg-brand-400">
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-page-muted">{title}</p>
        <p className="mt-1 break-all font-mono text-sm font-semibold text-page">{value}</p>
      </div>
      {copyText ? (
        <CopyButton text={copyText} iconOnly className="h-9 w-9 shrink-0 px-0 py-0" />
      ) : (
        <ArrowUpRight size={17} className="shrink-0 text-page-muted transition group-hover:text-page-link" />
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
        <p className="text-sm font-semibold text-page-link">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold leading-tight text-page sm:text-4xl">{title}</h2>
        {text && <p className="mt-3 max-w-2xl text-sm leading-6 text-page-secondary">{text}</p>}
      </div>
      {action && (
        <Link to={action.to} className="inline-flex items-center gap-2 text-sm font-semibold text-page-secondary transition hover:text-page-link">
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
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-page-divider bg-page-surface/50 shadow-sm transition hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-xl hover:shadow-brand-500/10">
      <div className="border-b border-page-divider bg-page-surface/40 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-page">{getModelDisplayName(model)}</h3>
            <p className="mt-1 truncate font-mono text-xs text-page-muted">{modelId}</p>
          </div>
          <AvailabilityBadge model={model} />
        </div>
        <p className="mt-4 min-h-[48px] text-sm leading-6 text-page-secondary">{summary}</p>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {metricRows.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-page-divider bg-page-surface/50 px-3 py-2">
              <p className="text-xs text-page-muted">{metric.label}</p>
              <p className="mt-1 truncate font-mono text-xs font-semibold text-page">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {modes.map((mode) => (
            <span key={mode} className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold capitalize text-page-info">
              {mode}
            </span>
          ))}
        </div>
        <div className="mt-3">
          <ModelBadges model={model} />
        </div>

        <div className="mt-5 rounded-lg border border-page-divider bg-page-surface/40 p-3">
          <p className="mb-2 text-xs font-semibold text-page-muted">Official pricing</p>
          <ModelPrice model={model} />
        </div>
      </div>

      <div className="grid gap-2 border-t border-page-divider bg-page-surface/30 p-4 sm:grid-cols-2">
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
        <div key={index} className="rounded-xl border border-page-divider bg-page-surface/50 p-5 shadow-sm">
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
        <p className="text-sm font-semibold text-page-link">API workbench</p>
        <h2 className="mt-2 max-w-xl text-3xl font-semibold leading-tight text-page sm:text-4xl">
          One request path, many public model choices.
        </h2>
        <p className="mt-4 text-sm leading-6 text-page-secondary">
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
              <p className="text-xs font-medium text-cyan-100/55">Request composer</p>
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
              <p className="text-xs font-medium text-cyan-100/55">Payload</p>
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
              <p className="text-xs font-medium text-cyan-100/55">Response shape</p>
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
          <thead className="border-b border-page-divider bg-page-surface/40 text-xs font-semibold text-page-muted">
            <tr>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Signals</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-page-divider bg-page-surface/30">
            {models.map((model) => {
              const modelId = getModelId(model);
              return (
                <tr key={modelId} className="transition hover:bg-page-surface-hover">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-page">{getModelDisplayName(model)}</p>
                    <p className="mt-1 max-w-[260px] truncate font-mono text-xs text-page-muted">{modelId}</p>
                  </td>
                  <td className="px-4 py-3 text-page-secondary">{getModelCategory(model)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {getModelTags(model).slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full border border-page-divider bg-page-surface/50 px-2 py-0.5 text-[11px] font-medium text-page-secondary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/playground?model=${encodeURIComponent(modelId)}`} className="inline-flex items-center justify-end gap-1.5 text-xs font-semibold text-page-link hover:text-page">
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
    <div className="rounded-lg border border-page-divider bg-page-surface/50 p-4">
      <Icon size={18} className="text-page-link" />
      <p className="mt-3 font-semibold text-page">{title}</p>
      <p className="mt-1 text-xs leading-5 text-page-secondary">{text}</p>
    </div>
  );
}

function ValueCard({ icon: Icon, title, text, tone }) {
  const toneClasses = {
    cyan: 'bg-cyan-500/10 text-page-info border-cyan-500/25',
    emerald: 'bg-emerald-500/10 text-page-success border-emerald-500/25',
    amber: 'bg-amber-500/10 text-page-warning border-amber-500/25',
    slate: 'bg-slate-950 text-white border-slate-950',
  };

  return (
    <div className="group rounded-xl border border-page-divider bg-page-surface/50 p-5 shadow-sm transition hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-xl hover:shadow-brand-500/10">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg border ${toneClasses[tone] || toneClasses.cyan}`}>
          <Icon size={20} />
        </span>
        <span className="rounded-full border border-page-divider bg-page-surface px-2.5 py-1 text-[11px] font-semibold text-page-muted">
          Built in
        </span>
      </div>
      <h3 className="mt-4 font-semibold text-page">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-page-secondary">{text}</p>
    </div>
  );
}

function CategoryCard({ group }) {
  const previewModels = group.models.slice(0, 3);

  return (
    <Link
      to={`/models?category=${encodeURIComponent(group.name)}`}
      className="group min-w-0 rounded-xl border border-page-divider bg-page-surface/50 p-4 transition hover:-translate-y-0.5 hover:border-brand-500/40 hover:bg-page-surface-hover hover:shadow-lg hover:shadow-brand-500/10"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-page-surface text-page-secondary shadow-sm transition group-hover:bg-brand-500 group-hover:text-[#0b061f]">
          <Layers3 size={16} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-page">{group.name}</p>
          <p className="text-xs text-page-muted">{group.models.length} models</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {previewModels.map((model) => (
          <span key={getModelId(model)} className="max-w-full truncate rounded-full border border-page-divider bg-page-surface px-2 py-0.5 font-mono text-[11px] text-page-muted">
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
        <div key={row.label} className="min-w-0 rounded-xl border border-page-divider bg-page-surface/50 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <row.icon size={16} className="shrink-0 text-page-link" />
            {row.copy && <CopyButton text={row.copy} iconOnly className="h-7 w-7 shrink-0 px-0 py-0" />}
          </div>
          <p className="mt-3 text-xs text-page-muted">{row.label}</p>
          <p className="mt-2 break-all font-mono text-sm font-semibold text-page">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function ApiBasePanel({ baseUrl }) {
  return (
    <div className="rounded-xl border border-page-divider bg-page-surface/50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-page">API base URL</p>
          <p className="mt-1 text-xs leading-5 text-page-muted">
            Use the API base URL below. {INVALID_WEBSITE_API_BASE_URL} alone is invalid for API calls.
          </p>
        </div>
        <CopyButton text={baseUrl} className="shrink-0" />
      </div>
      <div className="mt-4 flex min-w-0 flex-col gap-2 rounded-lg border border-page-divider bg-page-inset p-2 sm:flex-row sm:items-center">
        <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-brand-500 px-3 py-2 font-mono text-xs font-semibold text-[#0b061f]">
          base_url
        </span>
        <code className="min-w-0 flex-1 break-all rounded-md bg-page-surface px-3 py-2 font-mono text-sm text-page">
          {baseUrl}
        </code>
      </div>
    </div>
  );
}

function QuickStep({ index, title, text }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-xs font-semibold text-page-success">
        {index}
      </span>
      <div>
        <p className="font-semibold text-page">{title}</p>
        <p className="mt-1 text-sm leading-6 text-page-secondary">{text}</p>
      </div>
    </div>
  );
}

function PackageCard({ pkg, fmtPlanPrice }) {
  return (
    <div className="rounded-xl border border-page-divider bg-page-surface/50 p-5 shadow-sm transition hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-xl hover:shadow-brand-500/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-page">{pkg.name}</h3>
          <p className="mt-2 min-h-[48px] text-sm leading-6 text-page-secondary">{getPackageDescription(pkg)}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-page-info">
          <Sparkles size={18} />
        </span>
      </div>
      <div className="mt-6 flex flex-wrap items-end gap-2">
        <span className="text-3xl font-semibold text-page">{fmtPlanPrice(pkg.price, pkg.currency)}</span>
        {pkg.duration > 0 && (
          <span className="pb-1 text-sm text-page-muted">{pkg.duration} days</span>
        )}
      </div>
      <Link to="/packages" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-page-link transition hover:text-page">
        View package <ArrowRight size={15} />
      </Link>
    </div>
  );
}

function getPackageDescription(pkg) {
  const description = String(pkg?.description || '').trim();
  if (!description || /[\u4e00-\u9fff]/.test(description)) {
    return 'Managed credits and access controls for production usage.';
  }
  return description;
}
