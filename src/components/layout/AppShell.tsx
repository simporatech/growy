import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Cloud,
  CloudOff,
  HandCoins,
  Landmark,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Repeat,
  Settings,
  Sparkles,
  Target,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { TranslationKey } from '../../i18n/locales/en';
import { AutoBillingResult, processDueSubscriptions } from '../../utils/subscriptionAutomation';
import { AccountsView } from '../accounts/AccountsView';
import { BudgetsView } from '../budgets/BudgetsView';
import { AutoBillingToast } from '../common/AutoBillingToast';
import { GrowyIntelligenceView } from '../intelligence/GrowyIntelligenceView';
import { LoansView } from '../loans/LoansView';
import { OverviewView } from '../overview/OverviewView';
import { SettingsView } from '../settings/SettingsView';
import { SubscriptionsView } from '../subscriptions/SubscriptionsView';
import { TransactionsView } from '../transactions/TransactionsView';

type NavTab =
  | 'accounts'
  | 'transactions'
  | 'budgets'
  | 'subscriptions'
  | 'loans'
  | 'intelligence'
  | 'overview'
  | 'settings';

interface NavItem {
  id: Exclude<NavTab, 'settings'>;
  labelKey: TranslationKey;
  mobileLabelKey: TranslationKey;
  descKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_NAV: NavItem[] = [
  {
    id: 'overview',
    labelKey: 'nav.overview',
    mobileLabelKey: 'nav.mobile.overview',
    descKey: 'placeholder.overviewDesc',
    icon: LayoutDashboard,
  },
  {
    id: 'accounts',
    labelKey: 'nav.accounts',
    mobileLabelKey: 'nav.mobile.accounts',
    descKey: 'placeholder.accountsDesc',
    icon: Landmark,
  },
  {
    id: 'transactions',
    labelKey: 'nav.transactions',
    mobileLabelKey: 'nav.mobile.transactions',
    descKey: 'placeholder.transactionsDesc',
    icon: ArrowLeftRight,
  },
  {
    id: 'budgets',
    labelKey: 'nav.budgets',
    mobileLabelKey: 'nav.mobile.budgets',
    descKey: 'placeholder.budgetsDesc',
    icon: Target,
  },
  {
    id: 'subscriptions',
    labelKey: 'nav.subscriptions',
    mobileLabelKey: 'nav.mobile.subscriptions',
    descKey: 'placeholder.subscriptionsDesc',
    icon: Repeat,
  },
  {
    id: 'loans',
    labelKey: 'nav.loans',
    mobileLabelKey: 'nav.mobile.loans',
    descKey: 'placeholder.loansDesc',
    icon: HandCoins,
  },
  {
    id: 'intelligence',
    labelKey: 'nav.intelligence',
    mobileLabelKey: 'nav.mobile.intelligence',
    descKey: 'placeholder.intelligenceDesc',
    icon: Sparkles,
  },
];

const SIDEBAR_SPRING = {
  type: 'spring' as const,
  stiffness: 360,
  damping: 32,
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'G';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function SidebarTooltip({ label, show }: { label: string; show: boolean }) {
  if (!show) return null;
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 whitespace-nowrap rounded-xl bg-[#242426]/95 backdrop-blur-xl border border-white/[0.12] px-3 py-1.5 text-[13px] font-medium text-white opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100 shadow-[0_12px_28px_-6px_rgba(0,0,0,0.45)]"
    >
      {label}
    </span>
  );
}

export function AppShell() {
  const { user, syncStatus, signOut, updateUserPreferences, applyAutoBilling } = useAuth();
  const { currency: globalCurrency, convertBetween } = useCurrency();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [logoSrc, setLogoSrc] = useState('/assets/brand/growy-logo.svg');
  const [autoBillingResult, setAutoBillingResult] = useState<AutoBillingResult | null>(null);
  const [highlightedLoanId, setHighlightedLoanId] = useState<string | null>(null);
  const [highlightedRecurringId, setHighlightedRecurringId] = useState<string | null>(null);

  const handleNavigateToLoan = useCallback((loanId: string) => {
    setActiveTab('loans');
    setHighlightedLoanId(loanId);
    window.setTimeout(() => {
      setHighlightedLoanId((prev) => (prev === loanId ? null : prev));
    }, 2400);
  }, []);

  const handleNavigateToRecurring = useCallback((recurringId: string) => {
    setActiveTab('subscriptions');
    setHighlightedRecurringId(recurringId);
    window.setTimeout(() => {
      setHighlightedRecurringId((prev) => (prev === recurringId ? null : prev));
    }, 2400);
  }, []);

  useEffect(() => {
    if (!user) return;
    const result = processDueSubscriptions(user, convertBetween, globalCurrency);
    if (result) {
      applyAutoBilling(
        result.generatedTransactions,
        result.updatedSubscriptions,
        result.updatedLoans
      );
      if (result.generatedTransactions.length > 0) {
        setAutoBillingResult(result);
      }
    }
  }, [
    user?.id,
    user?.data.subscriptions,
    user?.preferences.timezone,
    globalCurrency,
    convertBetween,
    applyAutoBilling,
  ]);

  const collapsed = user?.preferences.sidebarCollapsed ?? false;

  const toggleSidebar = useCallback(() => {
    updateUserPreferences({ sidebarCollapsed: !collapsed });
  }, [collapsed, updateUserPreferences]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const activeNavMeta = PRIMARY_NAV.find((item) => item.id === activeTab);
  const collapseLabel = collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar');

  return (
    <MotionConfig reducedMotion="user">
      <div className="ambient-bg relative h-screen overflow-hidden w-full flex flex-col lg:flex-row">
        {/* Multi-layered Ambient Light Orbs for Glass Refraction (exclusively --accent-color) */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div
            className="absolute -top-36 -left-28 h-[460px] w-[460px] rounded-full blur-3xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 11%, transparent)' }}
          />
          <div
            className="absolute -bottom-32 -right-24 h-[460px] w-[460px] rounded-full blur-3xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 7%, transparent)' }}
          />
        </div>

        {/* Desktop Floating Glass Sidebar (250px expanded <-> 76px collapsed) */}
        <motion.aside
          initial={{ x: -16, opacity: 0, width: collapsed ? 76 : 250 }}
          animate={{ x: 0, opacity: 1, width: collapsed ? 76 : 250 }}
          transition={SIDEBAR_SPRING}
          className={`relative z-20 hidden lg:flex lg:shrink-0 lg:flex-col lg:my-4 lg:ml-4 lg:h-[calc(100vh-2rem)] rounded-3xl ${
            collapsed ? 'overflow-visible' : 'overflow-hidden'
          }`}
        >
          <div
            className={`glass-card flex h-full flex-col justify-between transition-[padding] duration-200 ${
              collapsed ? 'px-0 py-3 items-center' : 'p-4 overflow-hidden'
            }`}
          >
            {/* Top Brand + Collapse Toggle */}
            <div className={collapsed ? 'w-full flex flex-col items-center' : 'w-full'}>
              <div
                className={`flex items-center pb-6 pt-1 ${
                  collapsed ? 'w-full flex-col gap-3 justify-center' : 'justify-between px-1.5'
                }`}
              >
                <div className={`flex items-center min-w-0 ${collapsed ? 'justify-center mx-auto' : 'gap-2.5'}`}>
                  <img
                    src={logoSrc}
                    alt="Growy"
                    onError={() => setLogoSrc('/assets/brand/growy-logo.png')}
                    className="h-9 w-9 shrink-0 object-contain select-none"
                  />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="font-display text-lg font-semibold tracking-[-0.02em] text-white overflow-hidden whitespace-nowrap"
                      >
                        {t('brand.name')}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label={collapseLabel}
                  title={`${collapseLabel} (Ctrl+B)`}
                  className={`group relative flex shrink-0 items-center justify-center rounded-2xl text-[#B8B8BE] hover:bg-white/[0.08] hover:text-white active:scale-95 transition-all ${
                    collapsed ? 'h-11 w-11 mx-auto' : 'h-8 w-8 rounded-xl'
                  }`}
                >
                  {collapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                  <SidebarTooltip label={collapseLabel} show={collapsed} />
                </button>
              </div>

              {/* Primary Navigation */}
              <nav
                aria-label="Primary"
                className={`w-full space-y-1.5 ${collapsed ? 'flex flex-col items-center' : ''}`}
              >
                {PRIMARY_NAV.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const label = t(item.labelKey);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      aria-label={label}
                      className={`group relative flex items-center rounded-2xl text-[15px] font-medium transition-colors duration-150 active:scale-[0.98] ${
                        collapsed
                          ? 'w-11 h-11 justify-center mx-auto p-0'
                          : 'w-full gap-3 px-3.5 py-2.5'
                      } ${isActive ? 'text-white' : 'text-[#B8B8BE] hover:text-white'}`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="desktop-nav-pill"
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                          className="bg-dynamic-accent-subtle border-dynamic-accent absolute inset-0 rounded-2xl border"
                        />
                      )}
                      <Icon
                        className={`relative z-10 h-4 w-4 shrink-0 transition-colors ${
                          isActive ? 'text-dynamic-accent' : 'text-[#B8B8BE]'
                        }`}
                      />
                      {!collapsed && (
                        <span className="relative z-10 truncate whitespace-nowrap">{label}</span>
                      )}
                      <SidebarTooltip label={label} show={collapsed} />
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Footer */}
            <div
              className={`w-full space-y-3.5 pt-4 border-t border-white/[0.08] ${
                collapsed ? 'flex flex-col items-center' : ''
              }`}
            >
              {collapsed ? (
                <div className="w-full flex flex-col items-center gap-2">
                  <div
                    title={
                      syncStatus === 'synced'
                        ? t('sync.synced')
                        : syncStatus === 'syncing'
                          ? t('sync.syncing')
                          : syncStatus === 'offline'
                            ? t('sync.offline')
                            : t('sync.localOnly')
                    }
                    className="flex h-8 w-11 mx-auto items-center justify-center rounded-xl border border-white/[0.06] bg-black/25"
                  >
                    {syncStatus === 'syncing' ? (
                      <RefreshCw className="h-3.5 w-3.5 text-dynamic-accent animate-spin" />
                    ) : syncStatus === 'offline' ? (
                      <CloudOff className="h-3.5 w-3.5 text-coral" />
                    ) : syncStatus === 'synced' ? (
                      <Cloud className="h-3.5 w-3.5 text-dynamic-accent" />
                    ) : (
                      <Cloud className="h-3.5 w-3.5 text-[#8E8E93]" />
                    )}
                  </div>

                  <div
                    title={user?.fullName}
                    className="bg-dynamic-accent-soft text-dynamic-accent border-dynamic-accent flex h-11 w-11 mx-auto items-center justify-center rounded-2xl border text-[13px] font-display font-semibold select-none"
                  >
                    {getInitials(user?.fullName ?? 'G')}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    aria-label={t('nav.settings')}
                    className={`group relative flex h-11 w-11 mx-auto items-center justify-center rounded-2xl transition-all active:scale-95 ${
                      activeTab === 'settings'
                        ? 'bg-dynamic-accent-soft text-dynamic-accent border-dynamic-accent border'
                        : 'text-[#B8B8BE] hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    <SidebarTooltip label={t('nav.settings')} show={collapsed} />
                  </button>

                  <button
                    type="button"
                    onClick={signOut}
                    aria-label={t('nav.signOut')}
                    className="group relative flex h-11 w-11 mx-auto items-center justify-center rounded-2xl text-[#B8B8BE] hover:bg-coral/15 hover:text-coral transition-all active:scale-95"
                  >
                    <LogOut className="h-4 w-4" />
                    <SidebarTooltip label={t('nav.signOut')} show={collapsed} />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-1.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-[#B8B8BE]">
                      {syncStatus === 'syncing' ? (
                        <RefreshCw className="h-3.5 w-3.5 text-dynamic-accent animate-spin shrink-0" />
                      ) : syncStatus === 'offline' ? (
                        <CloudOff className="h-3.5 w-3.5 text-coral shrink-0" />
                      ) : syncStatus === 'synced' ? (
                        <Cloud className="h-3.5 w-3.5 text-dynamic-accent shrink-0" />
                      ) : (
                        <Cloud className="h-3.5 w-3.5 text-[#8E8E93] shrink-0" />
                      )}
                      <span
                        className={
                          syncStatus === 'offline'
                            ? 'text-coral font-medium'
                            : syncStatus === 'synced' || syncStatus === 'syncing'
                              ? 'text-white/90 font-medium'
                              : 'text-[#8E8E93]'
                        }
                      >
                        {syncStatus === 'synced'
                          ? t('sync.synced')
                          : syncStatus === 'syncing'
                            ? t('sync.syncing')
                            : syncStatus === 'offline'
                              ? t('sync.offline')
                              : t('sync.localOnly')}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/[0.06] bg-black/25 p-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="bg-dynamic-accent-soft text-dynamic-accent border-dynamic-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-display font-semibold">
                      {getInitials(user?.fullName ?? 'G')}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{user?.fullName}</p>
                      <p className="truncate text-[13px] text-[#B8B8BE]">{user?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      aria-label={t('nav.settings')}
                      title={t('nav.settings')}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all active:scale-95 ${
                        activeTab === 'settings'
                          ? 'bg-dynamic-accent-soft text-dynamic-accent border-dynamic-accent border'
                          : 'text-[#B8B8BE] hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      <Settings className="h-4 w-4 shrink-0" />
                    </button>
                    <button
                      type="button"
                      onClick={signOut}
                      aria-label={t('nav.signOut')}
                      title={t('nav.signOut')}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#B8B8BE] hover:bg-coral/15 hover:text-coral transition-all active:scale-95"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                    </button>
                  </div>
                </div>
                </div>
              )}

              {collapsed ? (
                <p className="text-[9px] tracking-[0.14em] uppercase opacity-70 text-center w-full font-display font-semibold text-white/95">
                  SIMP<span style={{ color: 'var(--accent-color)' }}>O</span>RA
                </p>
              ) : (
                <p className="text-center text-[13px] tracking-wide text-[#B8B8BE]">
                  {t('brand.poweredBy')}{' '}
                  <span className="font-display font-semibold tracking-wider text-white/95">
                    SIMP<span style={{ color: 'var(--accent-color)' }}>O</span>RA
                  </span>
                </p>
              )}
            </div>
          </div>
        </motion.aside>

        {/* Mobile Sticky Glass Top Header */}
        <header className="sticky top-0 z-30 lg:hidden flex items-center justify-between px-4 py-3 bg-[#1A1A1C]/75 backdrop-blur-xl border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <img
              src={logoSrc}
              alt="Growy"
              onError={() => setLogoSrc('/assets/brand/growy-logo.png')}
              className="h-8 w-8 object-contain select-none"
            />
            <span className="font-display text-base font-semibold text-white">
              {t('brand.name')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              aria-label={t('nav.settings')}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border backdrop-blur-xl transition-all active:scale-95 ${
                activeTab === 'settings'
                  ? 'border-dynamic-accent bg-dynamic-accent-soft text-dynamic-accent'
                  : 'border-white/[0.08] bg-[#333333]/40 text-[#B8B8BE] hover:text-white'
              }`}
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={signOut}
              aria-label={t('nav.signOut')}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#333333]/40 backdrop-blur-xl text-[#B8B8BE] hover:text-coral transition-all active:scale-95"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Main Content Canvas */}
        <main
          style={{ scrollbarGutter: 'stable' }}
          className="relative z-10 flex-1 min-w-0 min-h-0 lg:h-screen overflow-y-auto custom-scrollbar px-4 sm:px-6 lg:px-8 pt-6 pb-28 lg:py-8"
        >
          <div className="mx-auto max-w-7xl w-full">
            <AnimatePresence mode="wait">
              {activeTab === 'settings' ? (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <SettingsView />
                </motion.div>
              ) : activeTab === 'overview' ? (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                >
                  <OverviewView onNavigate={(tab) => setActiveTab(tab)} />
                </motion.div>
              ) : activeTab === 'accounts' ? (
                <motion.div
                  key="accounts"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                >
                  <AccountsView />
                </motion.div>
              ) : activeTab === 'transactions' ? (
                <motion.div
                  key="transactions"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                >
                  <TransactionsView
                    onNavigateToLoan={handleNavigateToLoan}
                    onNavigateToRecurring={handleNavigateToRecurring}
                  />
                </motion.div>
              ) : activeTab === 'budgets' ? (
                <motion.div
                  key="budgets"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                >
                  <BudgetsView />
                </motion.div>
              ) : activeTab === 'subscriptions' ? (
                <motion.div
                  key="subscriptions"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                >
                  <SubscriptionsView highlightedRecurringId={highlightedRecurringId} />
                </motion.div>
              ) : activeTab === 'loans' ? (
                <motion.div
                  key="loans"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                >
                  <LoansView highlightedLoanId={highlightedLoanId} />
                </motion.div>
              ) : activeTab === 'intelligence' ? (
                <motion.div
                  key="intelligence"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                >
                  <GrowyIntelligenceView
                    onNavigate={(targetTab) =>
                      setActiveTab(targetTab === 'recurring' ? 'subscriptions' : targetTab)
                    }
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                  className="space-y-6"
                >
                  <div>
                    <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-white">
                      {activeNavMeta ? t(activeNavMeta.labelKey) : ''}
                    </h1>
                    <p className="mt-1 text-sm text-[#B8B8BE]">
                      {activeNavMeta ? t(activeNavMeta.descKey) : ''}
                    </p>
                  </div>

                  <div className="glass-card p-8 sm:p-10 flex flex-col items-start gap-4">
                    <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-11 w-11 items-center justify-center rounded-2xl border">
                      {activeNavMeta && <activeNavMeta.icon className="text-dynamic-accent h-5 w-5" />}
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-semibold text-white">
                        {t('placeholder.comingSoon')}
                      </h2>
                      <p className="mt-1.5 max-w-xl text-sm text-[#B8B8BE] leading-relaxed">
                        {activeNavMeta ? t(activeNavMeta.descKey) : ''}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* iOS-Grade Floating Bottom Dock */}
        <motion.nav
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.08 }}
          aria-label="Mobile Navigation"
          className="lg:hidden fixed bottom-3 inset-x-3 z-40"
        >
          <div className="grid grid-cols-7 gap-0.5 backdrop-blur-2xl bg-[#242426]/90 border border-white/[0.10] rounded-2xl px-1.5 py-2 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)]">
            {PRIMARY_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const mobileLabel = t(item.mobileLabelKey);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-label={t(item.labelKey)}
                  className="relative flex min-h-[44px] min-w-0 flex-col items-center justify-center rounded-xl px-1 py-1.5 transition-colors active:scale-95"
                >
                  {isActive && (
                    <motion.span
                      layoutId="mobile-nav-pill"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      className="bg-dynamic-accent-subtle border-dynamic-accent absolute inset-0 rounded-xl border"
                    />
                  )}
                  <Icon
                    className={`relative z-10 h-5 w-5 shrink-0 ${
                      isActive ? 'text-dynamic-accent' : 'text-[#B8B8BE]'
                    }`}
                  />
                  <span
                    className={`relative z-10 mt-1 w-full truncate text-center text-[11px] font-medium ${
                      isActive ? 'text-dynamic-accent' : 'text-[#B8B8BE]'
                    }`}
                  >
                    {mobileLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.nav>

        <AutoBillingToast
          items={autoBillingResult?.summaryItems ?? null}
          totalGlobalCharged={autoBillingResult?.totalGlobalCharged ?? 0}
          globalCurrency={globalCurrency}
          onViewTransactions={() => setActiveTab('transactions')}
          onDismiss={() => setAutoBillingResult(null)}
        />
      </div>
    </MotionConfig>
  );
}
