import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  ChevronDown,
  CreditCard,
  Home,
  KeyRound,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  PackageCheck,
  Settings2,
  Trophy,
  UserCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSite } from '../../context/SiteContext';
import ComplianceLinks from '../../components/ComplianceLinks';
import LanguageSwitch from '../../components/LanguageSwitch';

export default function SaasLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { site } = useSite();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [consoleMenuOpen, setConsoleMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const closeConsoleTimer = useRef(null);
  const closeAccountTimer = useRef(null);

  const siteName = site?.name || 'AstraLayer';
  const isAdmin = user?.is_admin || user?.role === 'admin';
  const displayName = user?.display_name || user?.username || user?.email;
  const accountPrimary = user?.email || displayName || 'Account';
  const accountSecondary = displayName && displayName !== accountPrimary ? displayName : 'Account';
  const consolePath = user ? '/dashboard' : '/login';
  const publicNavItems = [
    { to: '/', label: 'Home', icon: Home, exact: true },
    { to: '/models', label: 'Models', icon: Boxes, prefix: '/models' },
    { to: '/rankings', label: 'Rankings', icon: Trophy },
    { to: '/playground', label: 'Playground', icon: MessageSquareText, aliases: ['/chat'] },
    { to: '/docs/quickstart', label: 'Docs', icon: BookOpen, prefix: '/docs' },
  ];
  const consoleMenuItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, auth: true },
    { to: '/tokens', label: 'API Keys', icon: KeyRound, auth: true },
    { to: '/topup', label: 'Recharge / Top up', icon: CreditCard, auth: true },
    { to: '/logs', label: 'Call logs', icon: BarChart3, auth: true },
    { to: '/tasks', label: 'Tasks', icon: Layers3, auth: true },
    { to: '/packages', label: 'Packages / Plans', icon: PackageCheck },
    ...(site?.allow_sub_dist ? [{ to: '/sub-site', label: 'Sub-site / Distributor', icon: Building2 }] : []),
    ...(isAdmin ? [{ to: '/site-admin/saas', label: 'SaaS Admin', icon: Settings2, auth: true }] : []),
  ];
  const consoleNavItem = {
    to: consolePath,
    label: 'Console',
    icon: LayoutDashboard,
    aliases: ['/dashboard', '/tokens', '/logs', '/tasks', '/topup', '/packages', '/sub-site', '/site-admin/saas'],
  };
  const consoleShellPaths = ['/dashboard', '/tokens', '/logs', '/tasks', '/topup', '/site-admin/saas'];
  const isConsoleShell = consoleShellPaths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const isSaasAdminRoute = location.pathname === '/site-admin/saas' || location.pathname.startsWith('/site-admin/saas/');
  const consoleSidebarItems = isSaasAdminRoute && !consoleMenuItems.some((item) => item.to === '/site-admin/saas')
    ? [...consoleMenuItems, { to: '/site-admin/saas', label: 'SaaS Admin', icon: Settings2 }]
    : consoleMenuItems;

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.to;
    if (item.prefix && location.pathname.startsWith(item.prefix)) return true;
    if (item.aliases?.some((alias) => location.pathname === alias || location.pathname.startsWith(`${alias}/`))) return true;
    return location.pathname === item.to;
  };

  const navTarget = (item) => (item.auth && !user ? '/login' : item.to);
  const closeMenus = () => {
    setMobileMenuOpen(false);
    setConsoleMenuOpen(false);
    setAccountMenuOpen(false);
  };

  const cancelConsoleClose = () => {
    if (closeConsoleTimer.current) {
      clearTimeout(closeConsoleTimer.current);
      closeConsoleTimer.current = null;
    }
  };

  const openConsoleMenu = () => {
    cancelConsoleClose();
    setAccountMenuOpen(false);
    setConsoleMenuOpen(true);
  };

  const scheduleConsoleClose = () => {
    cancelConsoleClose();
    closeConsoleTimer.current = setTimeout(() => {
      setConsoleMenuOpen(false);
      closeConsoleTimer.current = null;
    }, 180);
  };

  const cancelAccountClose = () => {
    if (closeAccountTimer.current) {
      clearTimeout(closeAccountTimer.current);
      closeAccountTimer.current = null;
    }
  };

  const openAccountMenu = () => {
    cancelAccountClose();
    setConsoleMenuOpen(false);
    setAccountMenuOpen(true);
  };

  const scheduleAccountClose = () => {
    cancelAccountClose();
    closeAccountTimer.current = setTimeout(() => {
      setAccountMenuOpen(false);
      closeAccountTimer.current = null;
    }, 180);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
    closeMenus();
  };

  useEffect(() => {
    setMobileMenuOpen(false);
    setConsoleMenuOpen(false);
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => () => {
    cancelConsoleClose();
    cancelAccountClose();
  }, []);

  return (
    <div className="theme-saas min-h-screen bg-[#fbfcff] text-slate-950">
      {site?.announcement && (
        <div className="border-b border-cyan-100 bg-cyan-50 px-4 py-2 text-center text-sm text-cyan-800">
          {site.announcement}
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:flex-none" onClick={() => setMobileMenuOpen(false)}>
            {site?.logo ? (
              <img src={site.logo} alt={siteName} className="h-8 w-auto max-w-[140px] object-contain sm:max-w-[180px]" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
                {siteName.charAt(0)}
              </span>
            )}
            <span className="truncate text-base font-semibold tracking-normal text-slate-950">{siteName}</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {publicNavItems.map((item) => {
              const { to, label, icon: Icon } = item;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item)
                      ? 'bg-slate-950 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
            <div
              className="relative py-2"
              onMouseEnter={openConsoleMenu}
              onMouseLeave={scheduleConsoleClose}
              onFocus={openConsoleMenu}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setConsoleMenuOpen(false);
                }
              }}
            >
              <Link
                to={consolePath}
                aria-haspopup="menu"
                aria-expanded={consoleMenuOpen}
                onClick={(event) => {
                  if (user) {
                    event.preventDefault();
                    cancelConsoleClose();
                    setConsoleMenuOpen(true);
                  }
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(consoleNavItem)
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <LayoutDashboard size={16} />
                Console
                <ChevronDown size={14} className={`transition-transform ${consoleMenuOpen ? 'rotate-180' : ''}`} />
              </Link>

              {consoleMenuOpen && (
                <div className="absolute left-0 top-full z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10" role="menu">
                  {consoleMenuItems.map((item) => {
                    const { label, icon: Icon } = item;
                    return (
                      <Link
                        key={item.to}
                        to={navTarget(item)}
                        role="menuitem"
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive(item)
                            ? 'bg-slate-950 text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                        }`}
                      >
                        <Icon size={16} />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitch className="text-slate-500 hover:bg-slate-100 hover:text-slate-900" />
            {user ? (
              <div
                className="relative hidden py-2 sm:block"
                onMouseEnter={openAccountMenu}
                onMouseLeave={scheduleAccountClose}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setAccountMenuOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  onFocus={openAccountMenu}
                  onClick={openAccountMenu}
                  className={`inline-flex max-w-[230px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    accountMenuOpen
                      ? 'bg-slate-100 text-slate-950'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  <UserCircle size={16} className="shrink-0" />
                  <span className="truncate">{accountPrimary}</span>
                  <ChevronDown size={14} className={`shrink-0 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {accountMenuOpen && (
                  <div className="absolute right-0 top-full z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-950/10" role="menu">
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="truncate text-sm font-semibold text-slate-950">{accountPrimary}</p>
                      <p className="truncate text-xs text-slate-500">{accountSecondary}</p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
                    >
                      <LogOut size={16} />
                      {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950">
                  {t('nav.login')}
                </Link>
                <Link to="/register" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
                  {t('nav.signUp')}
                </Link>
              </div>
            )}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            className="fixed inset-x-0 top-16 z-40 h-[calc(100dvh-4rem)] bg-slate-950/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <nav
              className="ml-auto flex h-full w-[min(23rem,calc(100vw-1.25rem))] flex-col gap-1 overflow-y-auto border-l border-slate-200 bg-white px-4 py-4 shadow-2xl shadow-slate-950/15"
              onClick={(event) => event.stopPropagation()}
            >
              {publicNavItems.map((item) => {
                const { to, label, icon: Icon } = item;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={closeMenus}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      isActive(item) ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
              <div className="mt-2 border-t border-slate-100 pt-3">
                <Link
                  to={consolePath}
                  onClick={closeMenus}
                  className={`inline-flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${
                    isActive(consoleNavItem) ? 'bg-slate-950 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <LayoutDashboard size={16} />
                  Console
                </Link>
                <div className="mt-1 grid gap-1 pl-0 sm:pl-3">
                  {consoleMenuItems.map((item) => {
                    const { label, icon: Icon } = item;
                    return (
                      <Link
                        key={item.to}
                        to={navTarget(item)}
                        onClick={closeMenus}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                          isActive(item) ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Icon size={15} />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
              {user && (
                <div className="mt-2 border-t border-slate-100 pt-3">
                  <div className="px-3 pb-1">
                    <p className="truncate text-sm font-semibold text-slate-950">{accountPrimary}</p>
                    <p className="truncate text-xs text-slate-500">{accountSecondary}</p>
                  </div>
                  <div className="grid gap-1 pl-3">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      <LogOut size={15} />
                      {t('nav.logout')}
                    </button>
                  </div>
                </div>
              )}
              {!user && (
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <Link to="/login" onClick={closeMenus} className="rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-700">
                    {t('nav.login')}
                  </Link>
                  <Link to="/register" onClick={closeMenus} className="rounded-lg bg-slate-950 px-3 py-2 text-center text-sm font-semibold text-white">
                    {t('nav.signUp')}
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      <main className={isConsoleShell ? 'bg-[#f7f9fc]' : ''}>
        {isConsoleShell ? (
          <div className="mx-auto grid max-w-[1500px] gap-5 px-3 py-4 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
            <aside className="hidden lg:block">
              <div className="sticky top-20 overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm">
                <div className="border-b border-slate-100 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Console</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-950">{displayName || siteName}</p>
                </div>
                <nav className="mt-2 grid gap-1">
                  {consoleSidebarItems.map((item) => {
                    const { label, icon: Icon } = item;
                    return (
                      <Link
                        key={item.to}
                        to={navTarget(item)}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive(item)
                            ? 'bg-slate-950 text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                        }`}
                      >
                        <Icon size={16} />
                        <span className="truncate">{label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </aside>
            <div className="min-w-0">
              <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
                {consoleSidebarItems.map((item) => {
                  const { label, icon: Icon } = item;
                  return (
                    <Link
                      key={item.to}
                      to={navTarget(item)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
                        isActive(item)
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <Icon size={15} />
                      {label}
                    </Link>
                  );
                })}
              </div>
              <Outlet />
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>&copy; {new Date().getFullYear()} {siteName}. AI model marketplace and API gateway.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/models" className="hover:text-slate-950">Models</Link>
            <Link to="/rankings" className="hover:text-slate-950">Rankings</Link>
            <Link to="/docs/quickstart" className="hover:text-slate-950">Docs</Link>
            <Link to={user ? '/tokens' : '/login'} className="hover:text-slate-950">API Keys</Link>
            <Link to="/packages" className="hover:text-slate-950">{t('nav.packages')}</Link>
            <Link to={user ? '/logs' : '/login'} className="hover:text-slate-950">Logs</Link>
            <Link to="/apps" className="hover:text-slate-950">Apps</Link>
            <ComplianceLinks site={site} linkClassName="hover:text-slate-950" />
          </div>
        </div>
      </footer>
    </div>
  );
}
