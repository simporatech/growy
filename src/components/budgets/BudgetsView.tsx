import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  BudgetCategory,
  BudgetsSortOption,
  CategoryKind,
  SortDirection,
} from '../../types/finance';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import {
  calculateCategoryMetrics,
  calculateGlobalBudgetSummary,
} from '../../utils/budgetMetrics';
import { normalizeLegacyPeriodPreset, TimePeriodValue } from '../../utils/dateRangeFilter';
import { TimePeriodFilter } from '../common/TimePeriodFilter';
import {
  ExportBudgetsContext,
  exportBudgetsToExcel,
  exportBudgetsToPDF,
} from '../../utils/exportBudgets';
import { BudgetCard } from './BudgetCard';
import { CategoryModal } from './CategoryModal';
import { GlassSelectModal } from '../common/GlassSelectModal';

interface DropdownOption {
  id: string;
  label: string;
}

function GlassSelectDropdown({
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
        className={`w-full lg:w-auto h-11 inline-flex items-center justify-between gap-2 rounded-xl backdrop-blur-xl border px-3.5 text-sm font-medium transition-all active:scale-[0.98] ${
          isFiltered
            ? 'bg-dynamic-accent-subtle border-dynamic-accent text-white'
            : 'bg-[#333333]/35 border-white/[0.08] text-white hover:border-white/[0.18]'
        }`}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
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

const SORT_OPTIONS: { id: BudgetsSortOption; labelKey: string }[] = [
  { id: 'createdAt', labelKey: 'budgets.sort.createdAt' },
  { id: 'name', labelKey: 'budgets.sort.name' },
  { id: 'target', labelKey: 'budgets.sort.target' },
  { id: 'actual', labelKey: 'budgets.sort.actual' },
  { id: 'progress', labelKey: 'budgets.sort.progress' },
];

export function BudgetsView() {
  const {
    user,
    addBudgetCategory,
    updateBudgetCategory,
    deleteBudgetCategory,
    updateUserPreferences,
  } = useAuth();
  const { currency: globalCurrency, convertBetween } = useCurrency();
  const { accentColor } = useTheme();
  const { t } = useLanguage();

  const savedBudgetFilters = user?.preferences.viewFilters?.budgets;
  const [activeKind, setActiveKind] = useState<CategoryKind>(
    savedBudgetFilters?.activeTab ?? 'expense'
  );
  const [searchQuery, setSearchQuery] = useState(savedBudgetFilters?.search ?? '');
  const [statusFilter, setStatusFilter] = useState(savedBudgetFilters?.statusFilter ?? 'all');
  const [periodValue, setPeriodValue] = useState<TimePeriodValue>({
    preset: normalizeLegacyPeriodPreset(savedBudgetFilters?.periodFilter, 'this_month'),
    customStart: savedBudgetFilters?.customStart,
    customEnd: savedBudgetFilters?.customEnd,
  });
  const [sortBy, setSortBy] = useState<BudgetsSortOption>(
    (savedBudgetFilters?.sortBy as BudgetsSortOption) ?? 'createdAt'
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    savedBudgetFilters?.sortDirection ?? 'desc'
  );

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<BudgetCategory | null>(null);

  const exportMenuRef = useRef<HTMLDivElement>(null);

  const categories = user?.data.budgets ?? [];
  const transactions = user?.data.transactions ?? [];
  const accounts = user?.data.accounts ?? [];

  const convertToGlobal = useMemo(
    () => (amount: number, from: string) => convertBetween(amount, from, globalCurrency),
    [convertBetween, globalCurrency]
  );

  useEffect(() => {
    const current = user?.preferences.viewFilters?.budgets;
    if (
      current?.activeTab === activeKind &&
      current?.search === searchQuery &&
      current?.statusFilter === statusFilter &&
      current?.periodFilter === periodValue.preset &&
      current?.customStart === periodValue.customStart &&
      current?.customEnd === periodValue.customEnd &&
      current?.sortBy === sortBy &&
      current?.sortDirection === sortDirection
    ) {
      return;
    }
    updateUserPreferences({
      viewFilters: {
        budgets: {
          activeTab: activeKind,
          search: searchQuery,
          statusFilter,
          periodFilter: periodValue.preset,
          customStart: periodValue.customStart,
          customEnd: periodValue.customEnd,
          sortBy,
          sortDirection,
        },
      },
    });
  }, [
    activeKind,
    searchQuery,
    statusFilter,
    periodValue,
    sortBy,
    sortDirection,
    user?.preferences.viewFilters?.budgets,
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
    () =>
      calculateGlobalBudgetSummary(
        categories,
        transactions,
        accounts,
        convertToGlobal,
        undefined,
        globalCurrency,
        periodValue,
        user?.preferences.timezone
      ),
    [categories, transactions, accounts, convertToGlobal, globalCurrency, periodValue, user?.preferences.timezone]
  );

  const expenseCount = useMemo(
    () => categories.filter((c) => c.kind === 'expense').length,
    [categories]
  );
  const incomeCount = useMemo(
    () => categories.filter((c) => c.kind === 'income').length,
    [categories]
  );

  const tabCategories = useMemo(
    () => categories.filter((c) => c.kind === activeKind),
    [categories, activeKind]
  );

  const enrichedCategories = useMemo(() => {
    return tabCategories.map((cat) => ({
      category: cat,
      metrics: calculateCategoryMetrics(
        cat,
        transactions,
        accounts,
        convertToGlobal,
        undefined,
        globalCurrency,
        periodValue,
        user?.preferences.timezone
      ),
    }));
  }, [tabCategories, transactions, accounts, convertToGlobal, globalCurrency, periodValue, user?.preferences.timezone]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = enrichedCategories.filter(({ category, metrics }) => {
      if (q && !category.name.toLowerCase().includes(q)) return false;
      if (statusFilter === 'all') return true;
      if (activeKind === 'income' && statusFilter === 'reached') {
        return metrics.status === 'achieved' || metrics.status === 'surpassed';
      }
      return metrics.status === statusFilter;
    });

    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'createdAt') {
        const aTime = Date.parse(a.category.createdAt) || 0;
        const bTime = Date.parse(b.category.createdAt) || 0;
        return (aTime - bTime) * dir;
      }
      if (sortBy === 'name') {
        return a.category.name.localeCompare(b.category.name) * dir;
      }
      if (sortBy === 'target') {
        return (a.metrics.target - b.metrics.target) * dir;
      }
      if (sortBy === 'actual') {
        return (a.metrics.actual - b.metrics.actual) * dir;
      }
      if (sortBy === 'progress') {
        return (a.metrics.progressPct - b.metrics.progressPct) * dir;
      }
      return 0;
    });
  }, [enrichedCategories, searchQuery, statusFilter, activeKind, sortBy, sortDirection]);

  const statusFilterOptions: DropdownOption[] = useMemo(() => {
    if (activeKind === 'expense') {
      return [
        { id: 'all', label: t('budgets.filter.allStatuses') },
        { id: 'on_track', label: `${t('budgets.status.on_track')} (<80%)` },
        { id: 'near_limit', label: `${t('budgets.status.near_limit')} (80–100%)` },
        { id: 'exceeded', label: `${t('budgets.status.exceeded')} (>100%)` },
      ];
    }
    return [
      { id: 'all', label: t('budgets.filter.allStatuses') },
      { id: 'in_progress', label: `${t('budgets.status.in_progress')} (<100%)` },
      { id: 'reached', label: `${t('budgets.health.achieved')} (>=100%)` },
    ];
  }, [activeKind, t]);

  const sortDropdownOptions: DropdownOption[] = useMemo(
    () => SORT_OPTIONS.map((opt) => ({ id: opt.id, label: t(opt.labelKey as never) })),
    [t]
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== 'all' ||
    periodValue.preset !== 'this_month';

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPeriodValue({ preset: 'this_month' });
  };

  const buildExportContext = (): ExportBudgetsContext => {
    const activeStatusLabel =
      statusFilterOptions.find((o) => o.id === statusFilter)?.label ??
      t('budgets.filter.allStatuses');
    const filterParts = [activeStatusLabel];
    if (searchQuery.trim()) filterParts.push(`"${searchQuery.trim()}"`);

    return {
      transactions,
      accounts,
      accountHolder: user?.fullName ?? 'Growy User',
      globalCurrency,
      accentColor,
      activeTabText:
        activeKind === 'expense' ? t('budgets.expenseTab') : t('budgets.incomeTab'),
      appliedFiltersText: filterParts.join(' · '),
      convertBetween,
      labels: {
        reportTitle: t('budgetsExport.reportTitle'),
        accountHolder: t('export.accountHolder'),
        generatedDate: t('export.generatedDate'),
        globalCurrency: t('export.globalCurrency'),
        activeTabLabel: t('budgetsExport.activeTab'),
        appliedFilters: t('export.appliedFilters'),
        colCategory: t('budgetsExport.colCategory'),
        colType: t('budgetsExport.colType'),
        colTarget: t('budgetsExport.colTarget'),
        colActual: t('budgetsExport.colActual'),
        colRemaining: t('budgetsExport.colRemaining'),
        colProgress: t('budgetsExport.colProgress'),
        colStatus: t('budgetsExport.colStatus'),
        totalLabel: t('budgetsExport.total'),
        poweredBy: t('brand.poweredBy'),
        kindLabels: {
          expense: t('categoryModal.kindExpense'),
          income: t('categoryModal.kindIncome'),
        },
        statusLabels: {
          on_track: t('budgets.status.on_track'),
          near_limit: t('budgets.status.near_limit'),
          exceeded: t('budgets.status.exceeded'),
          in_progress: t('budgets.status.in_progress'),
          achieved: t('budgets.status.achieved'),
          surpassed: t('budgets.status.surpassed'),
        },
      },
    };
  };

  const handleSaveCategory = (payload: Omit<BudgetCategory, 'id' | 'createdAt'>) => {
    if (editingCategory) {
      updateBudgetCategory(editingCategory.id, payload);
    } else {
      addBudgetCategory(payload);
      setActiveKind(payload.kind);
    }
  };

  const expenseHealthBadgeClass =
    summary.expenseHealthStatus === 'exceeded'
      ? 'border-coral/35 bg-coral/15 text-coral'
      : summary.expenseHealthStatus === 'near_limit'
        ? 'border-amber-400/35 bg-amber-400/15 text-amber-300'
        : 'bg-dynamic-accent-soft text-dynamic-accent border-dynamic-accent border';

  const incomeStatusBadgeClass =
    summary.incomeProgressStatus === 'achieved' || summary.incomeProgressStatus === 'surpassed'
      ? 'bg-dynamic-accent-soft text-dynamic-accent border-dynamic-accent border'
      : 'border-white/[0.1] bg-white/[0.06] text-[#B8B8BE]';

  return (
    <div className="space-y-6">
      {/* Top Portfolio Summary Banner */}
      <section className="glass-card relative z-30 p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {t('nav.budgets')}
            </h1>
            <p className="mt-1 text-sm text-[#B8B8BE]">{t('placeholder.budgetsDesc')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Export Dropdown */}
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                disabled={filteredAndSorted.length === 0}
                onClick={() => setExportMenuOpen((prev) => !prev)}
                aria-expanded={exportMenuOpen}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 text-sm font-medium text-white hover:bg-white/[0.1] active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <Download className="text-dynamic-accent h-4 w-4" />
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
                    initial={{ opacity: 0, scale: 0.96, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -6 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute right-0 top-full mt-2 z-40 min-w-[235px] w-max rounded-2xl bg-[#242426]/95 backdrop-blur-2xl border border-white/[0.12] p-1.5 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setExportMenuOpen(false);
                        exportBudgetsToExcel(
                          filteredAndSorted.map((item) => item.category),
                          buildExportContext()
                        );
                      }}
                      className="w-full min-h-[44px] flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-left text-sm text-[#B8B8BE] hover:bg-white/[0.06] hover:text-white transition-colors"
                    >
                      <FileSpreadsheet className="text-dynamic-accent h-4 w-4 shrink-0" />
                      <span>{t('accounts.exportExcel')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportMenuOpen(false);
                        exportBudgetsToPDF(
                          filteredAndSorted.map((item) => item.category),
                          buildExportContext()
                        );
                      }}
                      className="w-full min-h-[44px] flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-left text-sm text-[#B8B8BE] hover:bg-white/[0.06] hover:text-white transition-colors"
                    >
                      <FileText className="text-dynamic-accent h-4 w-4 shrink-0" />
                      <span>{t('accounts.exportPdf')}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingCategory(null);
                setModalOpen(true);
              }}
              style={{ color: 'var(--accent-foreground)' }}
              className="bg-dynamic-accent inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>{t('budgets.addCategory')}</span>
            </button>
          </div>
        </div>

        {/* Side-by-Side Expense & Income Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/[0.08]">
          {/* Expense Budgets Summary */}
          <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
                <TrendingDown className="text-dynamic-accent h-4 w-4" />
                {t('budgets.expenseSummaryTitle')}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${expenseHealthBadgeClass}`}
              >
                {t(`budgets.health.${summary.expenseHealthStatus}` as const)}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <p className="font-display text-xl font-semibold text-white tabular-nums">
                {formatCurrencyAmount(summary.totalExpenseSpent, globalCurrency)}{' '}
                <span className="text-sm font-normal text-[#B8B8BE]">
                  / {formatCurrencyAmount(summary.totalExpenseBudgeted, globalCurrency)}
                </span>
              </p>
              <span className="font-display text-sm font-semibold text-white tabular-nums">
                {summary.globalExpensePct.toFixed(0)}%
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-black/40 border border-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, summary.globalExpensePct)}%` }}
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                className={`h-full rounded-full ${
                  summary.expenseHealthStatus === 'exceeded' ? 'bg-coral' : 'bg-dynamic-accent'
                }`}
              />
            </div>
          </div>

          {/* Income Goals Summary */}
          <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
                <TrendingUp className="text-dynamic-accent h-4 w-4" />
                {t('budgets.incomeSummaryTitle')}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${incomeStatusBadgeClass}`}
              >
                {t(`budgets.health.${summary.incomeProgressStatus}` as const)}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <p className="font-display text-xl font-semibold text-white tabular-nums">
                {formatCurrencyAmount(summary.totalIncomeEarned, globalCurrency)}{' '}
                <span className="text-sm font-normal text-[#B8B8BE]">
                  / {formatCurrencyAmount(summary.totalIncomeGoal, globalCurrency)}
                </span>
              </p>
              <span className="font-display text-sm font-semibold text-white tabular-nums">
                {summary.globalIncomePct.toFixed(0)}%
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-black/40 border border-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, summary.globalIncomePct)}%` }}
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                className="bg-dynamic-accent h-full rounded-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2-Tab Segmented Control */}
      <div
        role="tablist"
        aria-label={t('nav.budgets')}
        className="relative grid grid-cols-2 p-1.5 rounded-2xl bg-[#333333]/35 backdrop-blur-xl border border-white/[0.08]"
      >
        {(
          [
            { id: 'expense', label: t('budgets.expenseTab'), count: expenseCount },
            { id: 'income', label: t('budgets.incomeTab'), count: incomeCount },
          ] as const
        ).map((tab) => {
          const active = activeKind === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (tab.id !== activeKind) {
                  setActiveKind(tab.id);
                  setStatusFilter('all');
                }
              }}
              className={`relative z-10 min-h-[44px] flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'text-white' : 'text-[#B8B8BE] hover:text-white'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="budgets-tab-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="bg-dynamic-accent-soft border-dynamic-accent absolute inset-0 rounded-xl border"
                />
              )}
              <span className="relative z-10 truncate">{tab.label}</span>
              <span
                className={`relative z-10 rounded-full px-2 py-0.5 font-display text-[13px] font-semibold tabular-nums ${
                  active ? 'bg-black/30 text-dynamic-accent' : 'bg-white/[0.06] text-[#B8B8BE]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Single-Row Compact Toolbar */}
      {tabCategories.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 h-4 w-4 text-[#8E8E93] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('budgets.searchPlaceholder')}
                className="focus-dynamic-accent w-full h-11 rounded-xl bg-[#333333]/35 backdrop-blur-xl border border-white/[0.08] pl-10 pr-4 text-sm text-white placeholder:text-[#B8B8BE]/60 outline-none transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <TimePeriodFilter
                value={periodValue}
                onChange={setPeriodValue}
                defaultPreset="this_month"
              />

              <GlassSelectDropdown
                icon={Filter}
                value={statusFilter}
                options={statusFilterOptions}
                onChange={setStatusFilter}
                isFiltered={statusFilter !== 'all'}
              />

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <GlassSelectDropdown
                    icon={ArrowUpDown}
                    value={sortBy}
                    options={sortDropdownOptions}
                    onChange={(id) => setSortBy(id as BudgetsSortOption)}
                    isFiltered={sortBy !== 'createdAt'}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
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
                    transition={{ type: 'spring', stiffness: 420, damping: 26 }}
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
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 py-1 text-[13px] font-medium text-[#B8B8BE] hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5 text-dynamic-accent" />
                <span>{t('accounts.filter.reset')}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grid or Empty State */}
      <AnimatePresence mode="wait">
        {tabCategories.length === 0 ? (
          <motion.section
            key={`empty-${activeKind}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="glass-card p-8 sm:p-12 text-center flex flex-col items-center"
          >
            <div className="bg-dynamic-accent-soft border-dynamic-accent mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border">
              <Target className="text-dynamic-accent h-6 w-6" />
            </div>
            <h2 className="font-display text-lg font-semibold text-white">
              {activeKind === 'expense'
                ? t('budgets.emptyExpenseTitle')
                : t('budgets.emptyIncomeTitle')}
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-[#B8B8BE] leading-relaxed">
              {activeKind === 'expense'
                ? t('budgets.emptyExpenseDesc')
                : t('budgets.emptyIncomeDesc')}
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingCategory(null);
                setModalOpen(true);
              }}
              style={{ color: 'var(--accent-foreground)' }}
              className="bg-dynamic-accent mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>{t('budgets.createFirst')}</span>
            </button>
          </motion.section>
        ) : filteredAndSorted.length === 0 ? (
          <motion.section
            key={`nomatch-${activeKind}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card p-8 text-center space-y-3"
          >
            <p className="text-sm text-[#B8B8BE]">{t('budgets.noFilterMatch')}</p>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-medium text-white hover:bg-white/[0.08] transition-all"
            >
              <RotateCcw className="h-4 w-4 text-dynamic-accent" />
              <span>{t('accounts.filter.reset')}</span>
            </button>
          </motion.section>
        ) : (
          <motion.div
            key={`grid-${activeKind}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            <AnimatePresence>
              {filteredAndSorted.map(({ category, metrics }) => (
                <BudgetCard
                  key={category.id}
                  category={category}
                  metrics={metrics}
                  globalCurrency={globalCurrency}
                  onEdit={() => {
                    setEditingCategory(category);
                    setModalOpen(true);
                  }}
                  onDelete={() => setDeletingCategory(category)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit Category Modal */}
      <CategoryModal
        isOpen={modalOpen}
        defaultKind={activeKind}
        editingCategory={editingCategory}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveCategory}
      />

      {/* Delete Category Confirmation Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {deletingCategory && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setDeletingCategory(null)}
                className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
              >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-category-title"
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
                  <h3
                    id="delete-category-title"
                    className="font-display text-lg font-semibold text-white"
                  >
                    {t('budgets.deleteTitle')}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#B8B8BE]">
                    {t('budgets.deleteWarning')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingCategory(null)}
                  className="min-h-[44px] rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                >
                  {t('settings.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteBudgetCategory(deletingCategory.id);
                    setDeletingCategory(null);
                  }}
                  className="min-h-[44px] rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-[#1A1A1C] hover:bg-coral/90 active:scale-[0.98] transition-all"
                >
                  {t('budgets.confirmDeleteBtn')}
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

