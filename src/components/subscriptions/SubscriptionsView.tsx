import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Layers,
  Plus,
  Repeat,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  BillingFrequency,
  SortDirection,
  Subscription,
  SubscriptionsSortOption,
  TransactionType,
} from '../../types/finance';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import {
  exportSubscriptionsToExcel,
  exportSubscriptionsToPDF,
} from '../../utils/exportSubscriptions';
import {
  calculateMonthlyEquivalent,
  calculateSubscriptionSummary,
} from '../../utils/subscriptionMetrics';
import { SubscriptionCard } from './SubscriptionCard';
import { SubscriptionModal } from './SubscriptionModal';
import { GlassSelectModal } from '../common/GlassSelectModal';

interface DropdownOption {
  id: string;
  label: string;
}

function GlassFilterDropdown({
  icon: Icon,
  title,
  value,
  options,
  onChange,
  isFiltered = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title?: string;
  value: string;
  options: DropdownOption[];
  onChange: (id: string) => void;
  isFiltered?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const activeOption = options.find((o) => o.id === value) ?? options[0];

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className={`w-full h-11 flex items-center justify-between gap-2.5 rounded-xl border px-3.5 text-sm font-medium backdrop-blur-xl transition-all active:scale-[0.98] ${
          isFiltered
            ? 'bg-dynamic-accent-soft border-dynamic-accent text-white'
            : 'bg-[#333333]/35 border-white/[0.08] text-white hover:border-white/[0.16]'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Icon className="text-dynamic-accent h-4 w-4 shrink-0" />
          <span className="truncate">{activeOption?.label}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#B8B8BE] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <GlassSelectModal
        isOpen={open}
        title={title ?? options[0]?.label ?? ''}
        value={value}
        options={options}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

const FREQUENCY_ORDER: Record<BillingFrequency, number> = {
  weekly: 1,
  biweekly: 2,
  monthly: 3,
  quarterly: 4,
  annual: 5,
};

const SORT_OPTIONS: { id: SubscriptionsSortOption; labelKey: string }[] = [
  { id: 'nextBillingDate', labelKey: 'subs.sort.nextBillingDate' },
  { id: 'amount', labelKey: 'subs.sort.amount' },
  { id: 'name', labelKey: 'subs.sort.name' },
  { id: 'frequency', labelKey: 'subs.sort.frequency' },
  { id: 'createdAt', labelKey: 'subs.sort.createdAt' },
];

export function SubscriptionsView({
  highlightedRecurringId = null,
}: {
  highlightedRecurringId?: string | null;
}) {
  const {
    user,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    updateUserPreferences,
  } = useAuth();
  const { currency: globalCurrency, convertBetween } = useCurrency();
  const { accentColor } = useTheme();
  const { t } = useLanguage();

  const savedFilters = user?.preferences.viewFilters?.subscriptions;
  const [searchQuery, setSearchQuery] = useState(savedFilters?.search ?? '');
  const [kindFilter, setKindFilter] = useState<'all' | TransactionType>(
    savedFilters?.kindFilter ?? 'all'
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>(
    savedFilters?.statusFilter ?? 'all'
  );
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | BillingFrequency>(
    savedFilters?.frequencyFilter ?? 'all'
  );
  const [accountFilter, setAccountFilter] = useState(savedFilters?.accountFilter ?? 'all');
  const [sortBy, setSortBy] = useState<SubscriptionsSortOption>(
    savedFilters?.sortBy ?? 'nextBillingDate'
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    savedFilters?.sortDirection ?? 'asc'
  );

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [deletingSub, setDeletingSub] = useState<Subscription | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const subscriptions = user?.data.subscriptions ?? [];
  const accounts = user?.data.accounts ?? [];
  const categories = user?.data.budgets ?? [];
  const transactions = user?.data.transactions ?? [];
  const timezone = user?.preferences.timezone;

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    if (!highlightedRecurringId) return;
    const el = document.getElementById(`sub-card-${highlightedRecurringId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedRecurringId]);

  const convertToGlobal = useMemo(
    () => (amount: number, from: string) => convertBetween(amount, from, globalCurrency),
    [convertBetween, globalCurrency]
  );

  useEffect(() => {
    const current = user?.preferences.viewFilters?.subscriptions;
    if (
      current?.search === searchQuery &&
      (current?.kindFilter ?? 'all') === kindFilter &&
      current?.statusFilter === statusFilter &&
      current?.frequencyFilter === frequencyFilter &&
      current?.accountFilter === accountFilter &&
      current?.sortBy === sortBy &&
      current?.sortDirection === sortDirection
    ) {
      return;
    }
    updateUserPreferences({
      viewFilters: {
        subscriptions: {
          search: searchQuery,
          kindFilter,
          statusFilter,
          frequencyFilter,
          accountFilter,
          sortBy,
          sortDirection,
        },
      },
    });
  }, [
    searchQuery,
    kindFilter,
    statusFilter,
    frequencyFilter,
    accountFilter,
    sortBy,
    sortDirection,
    user?.preferences.viewFilters?.subscriptions,
    updateUserPreferences,
  ]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [exportMenuOpen]);

  const summary = useMemo(
    () => calculateSubscriptionSummary(subscriptions, accounts, convertToGlobal, timezone),
    [subscriptions, accounts, convertToGlobal, timezone]
  );

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = subscriptions.filter((sub) => {
      const subKind: TransactionType = sub.kind ?? 'expense';
      if (kindFilter !== 'all' && subKind !== kindFilter) return false;
      if (statusFilter === 'active' && !sub.isActive) return false;
      if (statusFilter === 'paused' && sub.isActive) return false;
      if (frequencyFilter !== 'all' && sub.frequency !== frequencyFilter) return false;
      if (
        accountFilter !== 'all' &&
        sub.accountId !== accountFilter &&
        sub.toAccountId !== accountFilter
      ) {
        return false;
      }
      if (q) {
        const src = accountMap.get(sub.accountId);
        const dst = sub.toAccountId ? accountMap.get(sub.toAccountId) : undefined;
        const matchesName = sub.name.toLowerCase().includes(q);
        const matchesSrc = src?.name.toLowerCase().includes(q) ?? false;
        const matchesDst = dst?.name.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesSrc && !matchesDst) return false;
      }
      return true;
    });

    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'nextBillingDate') {
        return a.nextBillingDate.localeCompare(b.nextBillingDate) * dir;
      }
      if (sortBy === 'amount') {
        const curA = accountMap.get(a.accountId)?.currency ?? 'USD';
        const curB = accountMap.get(b.accountId)?.currency ?? 'USD';
        const valA = convertToGlobal(calculateMonthlyEquivalent(a.amount, a.frequency), curA);
        const valB = convertToGlobal(calculateMonthlyEquivalent(b.amount, b.frequency), curB);
        return (valA - valB) * dir;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name) * dir;
      }
      if (sortBy === 'frequency') {
        return (FREQUENCY_ORDER[a.frequency] - FREQUENCY_ORDER[b.frequency]) * dir;
      }
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    });
  }, [
    subscriptions,
    kindFilter,
    statusFilter,
    frequencyFilter,
    accountFilter,
    searchQuery,
    sortBy,
    sortDirection,
    accountMap,
    convertToGlobal,
  ]);

  const kindDropdownOptions: DropdownOption[] = useMemo(
    () => [
      { id: 'all', label: t('subs.filter.allTypes') },
      { id: 'expense', label: t('subs.typeShort.expense') },
      { id: 'income', label: t('subs.typeShort.income') },
      { id: 'transfer', label: t('subs.typeShort.transfer') },
    ],
    [t]
  );

  const statusDropdownOptions: DropdownOption[] = useMemo(
    () => [
      { id: 'all', label: t('subs.filter.allStatuses') },
      { id: 'active', label: t('subs.filter.active') },
      { id: 'paused', label: t('subs.filter.paused') },
    ],
    [t]
  );

  const frequencyDropdownOptions: DropdownOption[] = useMemo(
    () => [
      { id: 'all', label: t('subs.filter.allFrequencies') },
      { id: 'weekly', label: t('subs.freq.weekly') },
      { id: 'biweekly', label: t('subs.freq.biweekly') },
      { id: 'monthly', label: t('subs.freq.monthly') },
      { id: 'quarterly', label: t('subs.freq.quarterly') },
      { id: 'annual', label: t('subs.freq.annual') },
    ],
    [t]
  );

  const accountDropdownOptions: DropdownOption[] = useMemo(
    () => [
      { id: 'all', label: t('subs.filter.allAccounts') },
      ...accounts.map((a) => ({ id: a.id, label: `${a.name} (${a.currency})` })),
    ],
    [accounts, t]
  );

  const sortDropdownOptions: DropdownOption[] = useMemo(
    () =>
      SORT_OPTIONS.map((opt) => ({
        id: opt.id,
        label: t(opt.labelKey as 'subs.sort.nextBillingDate'),
      })),
    [t]
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    kindFilter !== 'all' ||
    statusFilter !== 'all' ||
    frequencyFilter !== 'all' ||
    accountFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setKindFilter('all');
    setStatusFilter('all');
    setFrequencyFilter('all');
    setAccountFilter('all');
  };

  const buildExportContext = () => {
    const filterParts: string[] = [];
    if (kindFilter !== 'all') {
      filterParts.push(t(`subs.typeShort.${kindFilter}` as const));
    }
    if (statusFilter !== 'all') {
      filterParts.push(
        statusFilter === 'active' ? t('subs.filter.active') : t('subs.filter.paused')
      );
    }
    if (frequencyFilter !== 'all') {
      filterParts.push(t(`subs.freq.${frequencyFilter}` as const));
    }
    if (accountFilter !== 'all') {
      filterParts.push(accountMap.get(accountFilter)?.name ?? accountFilter);
    }
    if (searchQuery.trim()) {
      filterParts.push(`"${searchQuery.trim()}"`);
    }

    return {
      accounts,
      accountHolder: user?.fullName ?? 'Growy Member',
      globalCurrency,
      accentColor,
      appliedFiltersText: filterParts.length > 0 ? filterParts.join(' · ') : t('accounts.filter.all'),
      timezone,
      convertBetween,
      labels: {
        reportTitle: t('subsExport.reportTitle'),
        accountHolder: t('export.accountHolder'),
        generatedDate: t('export.generatedDate'),
        globalCurrency: t('export.globalCurrency'),
        appliedFilters: t('export.appliedFilters'),
        colName: t('subsExport.colName'),
        colType: t('subsExport.colType'),
        colFrequency: t('subsExport.colFrequency'),
        colAccount: t('subsExport.colAccount'),
        colNextBilling: t('subsExport.colNextBilling'),
        colNativeAmount: t('subsExport.colNativeAmount'),
        colMonthlyGlobal: t('subsExport.colMonthlyGlobal'),
        colStatus: t('subsExport.colStatus'),
        statusActive: t('subs.filter.active'),
        statusPaused: t('subs.filter.paused'),
        totalIncome: t('subsExport.totalIncome'),
        totalExpenses: t('subsExport.totalExpenses'),
        netMonthlyFlow: t('subsExport.netMonthlyFlow'),
        poweredBy: 'Growy — Powered by SIMPORA',
        unknownAccount: t('subs.unknownAccount'),
        frequencyLabels: {
          weekly: t('subs.freq.weekly'),
          biweekly: t('subs.freq.biweekly'),
          monthly: t('subs.freq.monthly'),
          quarterly: t('subs.freq.quarterly'),
          annual: t('subs.freq.annual'),
        },
        typeLabels: {
          expense: t('subs.typeShort.expense'),
          income: t('subs.typeShort.income'),
          transfer: t('subs.typeShort.transfer'),
        },
      },
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Summary Header */}
      <section className="glass-card relative z-30 p-6 sm:p-7 rounded-3xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {t('nav.subscriptions')}
            </h1>
            <p className="mt-1 text-sm text-[#B8B8BE]">{t('subs.subtitle')}</p>

            <div className="mt-5 flex flex-wrap items-baseline gap-3">
              <span
                className={`font-display text-3xl sm:text-4xl font-bold tracking-tight tabular-nums ${
                  summary.netMonthlyRecurringFlow < 0 ? 'text-coral' : 'text-dynamic-accent'
                }`}
              >
                {summary.netMonthlyRecurringFlow > 0 ? '+' : ''}
                {formatCurrencyAmount(summary.netMonthlyRecurringFlow, globalCurrency)}
              </span>
              <span className="text-[13px] font-medium text-[#B8B8BE]">
                {t('subs.netMonthlyFlow')} ({globalCurrency})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            {filteredAndSorted.length > 0 && (
              <div ref={exportMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setExportMenuOpen((prev) => !prev)}
                  aria-expanded={exportMenuOpen}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.1] bg-[#333333]/40 px-4 text-sm font-medium text-white backdrop-blur-xl hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                >
                  <Download className="text-dynamic-accent h-4 w-4 shrink-0" />
                  <span>{t('accounts.export')}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[#B8B8BE] transition-transform duration-200 ${
                      exportMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {exportMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute right-0 mt-2 min-w-[235px] w-max rounded-2xl bg-[#242426]/95 backdrop-blur-2xl border border-white/[0.12] p-1.5 shadow-[0_20px_48px_-12px_rgba(0,0,0,0.65)] z-50"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setExportMenuOpen(false);
                          exportSubscriptionsToExcel(filteredAndSorted, buildExportContext());
                        }}
                        className="w-full min-h-[44px] flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-left text-sm font-medium text-white whitespace-nowrap hover:bg-white/[0.07] transition-colors"
                      >
                        <FileSpreadsheet className="text-dynamic-accent h-4 w-4 shrink-0" />
                        <span>{t('accounts.exportExcel')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExportMenuOpen(false);
                          exportSubscriptionsToPDF(filteredAndSorted, buildExportContext());
                        }}
                        className="w-full min-h-[44px] flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-left text-sm font-medium text-white whitespace-nowrap hover:bg-white/[0.07] transition-colors"
                      >
                        <FileText className="text-dynamic-accent h-4 w-4 shrink-0" />
                        <span>{t('accounts.exportPdf')}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setEditingSub(null);
                setModalOpen(true);
              }}
              style={{ color: 'var(--accent-foreground)' }}
              className="bg-dynamic-accent inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>{t('subs.add')}</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-white/[0.08]">
          <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#B8B8BE]">
              <TrendingDown className="h-4 w-4 text-coral shrink-0" />
              <span className="truncate">{t('subs.monthlyExpenses')}</span>
            </span>
            <span className="font-display text-base font-semibold text-coral tabular-nums shrink-0">
              {formatCurrencyAmount(summary.monthlyRecurringExpenses, globalCurrency)}
            </span>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#B8B8BE]">
              <TrendingUp className="text-dynamic-accent h-4 w-4 shrink-0" />
              <span className="truncate">{t('subs.monthlyIncome')}</span>
            </span>
            <span className="font-display text-base font-semibold text-dynamic-accent tabular-nums shrink-0">
              {formatCurrencyAmount(summary.monthlyRecurringIncome, globalCurrency)}
            </span>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#B8B8BE]">
              <Repeat className="text-dynamic-accent h-4 w-4 shrink-0" />
              <span className="truncate">{t('subs.activePaused')}</span>
            </span>
            <span className="font-display text-base font-semibold text-white tabular-nums shrink-0">
              <span className="text-dynamic-accent">{summary.activeCount}</span>
              <span className="text-[#B8B8BE]"> / {summary.pausedCount}</span>
            </span>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#B8B8BE]">
              <Clock className="text-dynamic-accent h-4 w-4 shrink-0" />
              <span className="truncate">{t('subs.dueIn7Days')}</span>
            </span>
            <span
              className={`font-display text-base font-semibold tabular-nums shrink-0 ${
                summary.upcoming7DaysCount > 0 ? 'text-amber-300' : 'text-white'
              }`}
            >
              {summary.upcoming7DaysCount}
            </span>
          </div>
        </div>
      </section>

      {/* Single-Row Search, Multi-Filter & Bidirectional Sort Toolbar */}
      {subscriptions.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 h-4 w-4 text-[#8E8E93] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('subs.searchPlaceholder')}
                className="focus-dynamic-accent w-full h-11 rounded-xl bg-[#333333]/35 backdrop-blur-xl border border-white/[0.08] pl-10 pr-4 text-sm text-white placeholder:text-[#B8B8BE]/60 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 xl:flex items-center gap-3">
              <GlassFilterDropdown
                icon={Layers}
                value={kindFilter}
                options={kindDropdownOptions}
                onChange={(id) => setKindFilter(id as 'all' | TransactionType)}
                isFiltered={kindFilter !== 'all'}
              />

              <GlassFilterDropdown
                icon={Filter}
                value={statusFilter}
                options={statusDropdownOptions}
                onChange={(id) => setStatusFilter(id as 'all' | 'active' | 'paused')}
                isFiltered={statusFilter !== 'all'}
              />

              <GlassFilterDropdown
                icon={Repeat}
                value={frequencyFilter}
                options={frequencyDropdownOptions}
                onChange={(id) => setFrequencyFilter(id as 'all' | BillingFrequency)}
                isFiltered={frequencyFilter !== 'all'}
              />

              <GlassFilterDropdown
                icon={Landmark}
                value={accountFilter}
                options={accountDropdownOptions}
                onChange={setAccountFilter}
                isFiltered={accountFilter !== 'all'}
              />

              <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
                <div className="flex-1">
                  <GlassFilterDropdown
                    icon={ArrowUpDown}
                    value={sortBy}
                    options={sortDropdownOptions}
                    onChange={(id) => setSortBy(id as SubscriptionsSortOption)}
                    isFiltered={sortBy !== 'nextBillingDate'}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  aria-label={
                    sortDirection === 'asc' ? t('accounts.sort.asc') : t('accounts.sort.desc')
                  }
                  title={
                    sortDirection === 'asc' ? t('accounts.sort.asc') : t('accounts.sort.desc')
                  }
                  className="bg-dynamic-accent-subtle border-dynamic-accent text-dynamic-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border backdrop-blur-xl transition-transform active:scale-95 hover:opacity-90"
                >
                  <motion.span
                    key={sortDirection}
                    initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                    className="flex items-center justify-center"
                  >
                    {sortDirection === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </motion.span>
                </button>
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={resetFilters}
                className="text-dynamic-accent text-[13px] font-medium hover:underline"
              >
                {t('accounts.filter.reset')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2-Column Cards Grid or Empty States */}
      {subscriptions.length === 0 ? (
        <div className="glass-card p-10 sm:p-14 flex flex-col items-center text-center">
          <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-14 w-14 items-center justify-center rounded-2xl border">
            <Repeat className="text-dynamic-accent h-7 w-7" />
          </div>
          <h2 className="mt-5 font-display text-xl font-semibold text-white">
            {t('subs.emptyTitle')}
          </h2>
          <p className="mt-2 max-w-md text-sm text-[#B8B8BE] leading-relaxed">
            {t('subs.emptyDesc')}
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingSub(null);
              setModalOpen(true);
            }}
            style={{ color: 'var(--accent-foreground)' }}
            className="bg-dynamic-accent mt-6 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{t('subs.createFirst')}</span>
          </button>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="glass-card p-10 text-center space-y-3">
          <p className="text-sm text-[#B8B8BE]">{t('subs.noFilterMatch')}</p>
          <button
            type="button"
            onClick={resetFilters}
            className="text-dynamic-accent text-sm font-medium hover:underline"
          >
            {t('accounts.filter.reset')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <AnimatePresence mode="popLayout">
            {filteredAndSorted.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                account={accountMap.get(sub.accountId)}
                toAccount={sub.toAccountId ? accountMap.get(sub.toAccountId) : undefined}
                isHighlighted={highlightedRecurringId === sub.id}
                category={sub.categoryId ? categoryMap.get(sub.categoryId) : undefined}
                globalCurrency={globalCurrency}
                timezone={timezone}
                convertToGlobal={convertToGlobal}
                onToggleActive={(item) =>
                  updateSubscription(item.id, { isActive: !item.isActive })
                }
                onEdit={(item) => {
                  setEditingSub(item);
                  setModalOpen(true);
                }}
                onDelete={(item) => setDeletingSub(item)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit Modal */}
      <SubscriptionModal
        isOpen={modalOpen}
        editingSubscription={editingSub}
        accounts={accounts}
        categories={categories}
        allTransactions={transactions}
        onClose={() => {
          setModalOpen(false);
          setEditingSub(null);
        }}
        onSave={(payload) => {
          if (editingSub) {
            updateSubscription(editingSub.id, payload);
          } else {
            addSubscription(payload);
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {deletingSub && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setDeletingSub(null)}
                className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
              >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-sub-title"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-md p-6 sm:p-7 space-y-5"
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-coral/30 bg-coral/10">
                  <AlertTriangle className="h-5 w-5 text-coral" />
                </div>
                <div>
                  <h3 id="delete-sub-title" className="font-display text-lg font-semibold text-white">
                    {t('subs.deleteTitle')}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#B8B8BE]">
                    {t('subs.deleteWarning')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingSub(null)}
                  className="h-11 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                >
                  {t('settings.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteSubscription(deletingSub.id);
                    setDeletingSub(null);
                  }}
                  className="h-11 rounded-xl bg-coral px-4 text-sm font-semibold text-[#1A1A1C] hover:bg-coral/90 active:scale-[0.98] transition-all"
                >
                  {t('subs.confirmDeleteBtn')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
