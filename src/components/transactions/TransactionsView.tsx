import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Plus,
  RotateCcw,
  Search,
  Tag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  SortDirection,
  Transaction,
  TransactionsSortOption,
  TransactionType,
} from '../../types/finance';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import {
  isDateInTimePeriod,
  normalizeLegacyPeriodPreset,
  TimePeriodValue,
} from '../../utils/dateRangeFilter';
import {
  ExportTransactionsContext,
  exportTransactionsToExcel,
  exportTransactionsToPDF,
} from '../../utils/exportTransactions';
import {
  calculateTransactionSummary,
  getTodayLocalDateString,
  parseLocalDate,
} from '../../utils/transactionMetrics';
import { TimePeriodFilter } from '../common/TimePeriodFilter';
import { formatDateYYYYMMDD } from '../../utils/localeDetection';
import { TransactionModal } from './TransactionModal';
import { TransactionRow } from './TransactionRow';
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
          <span className="truncate max-w-[140px]">{activeOption?.label}</span>
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

const SORT_OPTIONS: { id: TransactionsSortOption; labelKey: string }[] = [
  { id: 'date', labelKey: 'transactions.sort.date' },
  { id: 'amount', labelKey: 'transactions.sort.amount' },
  { id: 'category', labelKey: 'transactions.sort.category' },
  { id: 'account', labelKey: 'transactions.sort.account' },
];

export function TransactionsView({
  onNavigateToLoan,
  onNavigateToRecurring,
}: {
  onNavigateToLoan?: (loanId: string) => void;
  onNavigateToRecurring?: (recurringId: string) => void;
}) {
  const {
    user,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateUserPreferences,
  } = useAuth();
  const { currency: globalCurrency, convertBetween } = useCurrency();
  const { accentColor } = useTheme();
  const { locale, t } = useLanguage();

  const savedTxFilters = user?.preferences.viewFilters?.transactions;
  const [searchQuery, setSearchQuery] = useState(savedTxFilters?.search ?? '');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>(
    (savedTxFilters?.typeFilter as 'all' | TransactionType) ?? 'all'
  );
  const [accountFilter, setAccountFilter] = useState(savedTxFilters?.accountFilter ?? 'all');
  const [categoryFilter, setCategoryFilter] = useState(savedTxFilters?.categoryFilter ?? 'all');
  const [periodValue, setPeriodValue] = useState<TimePeriodValue>({
    preset: normalizeLegacyPeriodPreset(savedTxFilters?.periodFilter, 'all_time'),
    customStart: savedTxFilters?.customStart,
    customEnd: savedTxFilters?.customEnd,
  });
  const [sortBy, setSortBy] = useState<TransactionsSortOption>(
    (savedTxFilters?.sortBy as TransactionsSortOption) ?? 'date'
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    savedTxFilters?.sortDirection ?? 'desc'
  );

  useEffect(() => {
    const current = user?.preferences.viewFilters?.transactions;
    if (
      current?.search === searchQuery &&
      current?.typeFilter === typeFilter &&
      current?.accountFilter === accountFilter &&
      current?.categoryFilter === categoryFilter &&
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
        transactions: {
          search: searchQuery,
          typeFilter,
          accountFilter,
          categoryFilter,
          periodFilter: periodValue.preset,
          customStart: periodValue.customStart,
          customEnd: periodValue.customEnd,
          sortBy,
          sortDirection,
        },
      },
    });
  }, [
    searchQuery,
    typeFilter,
    accountFilter,
    categoryFilter,
    periodValue,
    sortBy,
    sortDirection,
    user?.preferences.viewFilters?.transactions,
    updateUserPreferences,
  ]);

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  const exportMenuRef = useRef<HTMLDivElement>(null);

  const transactions = user?.data.transactions ?? [];
  const accounts = user?.data.accounts ?? [];
  const categories = user?.data.budgets ?? [];

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const convertToGlobal = useMemo(
    () => (amount: number, from: string) => convertBetween(amount, from, globalCurrency),
    [convertBetween, globalCurrency]
  );

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

  const filteredAndSortedTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = transactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (accountFilter !== 'all') {
        if (tx.accountId !== accountFilter && tx.toAccountId !== accountFilter) return false;
      }
      if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;
      if (!isDateInTimePeriod(tx.date, periodValue, user?.preferences.timezone)) return false;

      if (q) {
        const srcName = accountMap.get(tx.accountId)?.name.toLowerCase() ?? '';
        const dstName = tx.toAccountId ? accountMap.get(tx.toAccountId)?.name.toLowerCase() ?? '' : '';
        const catName =
          (tx.categoryId ? categoryMap.get(tx.categoryId)?.name.toLowerCase() : '') ??
          tx.category?.toLowerCase() ??
          '';
        const desc = tx.description?.toLowerCase() ?? '';
        if (
          !desc.includes(q) &&
          !catName.includes(q) &&
          !srcName.includes(q) &&
          !dstName.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });

    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'date') {
        const aTime = parseLocalDate(a.date).getTime();
        const bTime = parseLocalDate(b.date).getTime();
        if (aTime !== bTime) return (aTime - bTime) * dir;
        return (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * dir;
      }
      if (sortBy === 'amount') {
        const aConv = convertToGlobal(a.amount, accountMap.get(a.accountId)?.currency ?? 'USD');
        const bConv = convertToGlobal(b.amount, accountMap.get(b.accountId)?.currency ?? 'USD');
        return (aConv - bConv) * dir;
      }
      if (sortBy === 'category') {
        const aCat =
          (a.categoryId ? categoryMap.get(a.categoryId)?.name : a.category) ??
          t('transactions.type.transfer');
        const bCat =
          (b.categoryId ? categoryMap.get(b.categoryId)?.name : b.category) ??
          t('transactions.type.transfer');
        return aCat.localeCompare(bCat) * dir;
      }
      if (sortBy === 'account') {
        const aAcc = accountMap.get(a.accountId)?.name ?? '';
        const bAcc = accountMap.get(b.accountId)?.name ?? '';
        return aAcc.localeCompare(bAcc) * dir;
      }
      return 0;
    });
  }, [
    transactions,
    typeFilter,
    accountFilter,
    categoryFilter,
    periodValue,
    user?.preferences.timezone,
    searchQuery,
    sortBy,
    sortDirection,
    accountMap,
    categoryMap,
    convertToGlobal,
    t,
  ]);

  const summary = useMemo(
    () =>
      calculateTransactionSummary(
        filteredAndSortedTransactions,
        accounts,
        convertToGlobal,
        globalCurrency
      ),
    [filteredAndSortedTransactions, accounts, convertToGlobal, globalCurrency]
  );

  // Group transactions by date header
  const groupedByDate = useMemo(() => {
    const groups: { date: string; label: string; items: Transaction[] }[] = [];
    const indexMap = new Map<string, number>();

    const todayStr = getTodayLocalDateString(user?.preferences.timezone);
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = formatDateYYYYMMDD(yesterdayDate, user?.preferences.timezone);

    const formatter = new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    for (const tx of filteredAndSortedTransactions) {
      let idx = indexMap.get(tx.date);
      if (idx === undefined) {
        let label: string;
        if (tx.date === todayStr) {
          label = t('transactions.today');
        } else if (tx.date === yesterdayStr) {
          label = t('transactions.yesterday');
        } else {
          const parsed = parseLocalDate(tx.date);
          label = Number.isNaN(parsed.getTime()) ? tx.date : formatter.format(parsed);
        }
        idx = groups.length;
        indexMap.set(tx.date, idx);
        groups.push({ date: tx.date, label, items: [] });
      }
      groups[idx].items.push(tx);
    }

    return groups;
  }, [filteredAndSortedTransactions, locale, t]);

  const typeOptions: DropdownOption[] = useMemo(
    () => [
      { id: 'all', label: t('transactions.filter.allTypes') },
      { id: 'expense', label: t('transactions.filter.expenses') },
      { id: 'income', label: t('transactions.filter.income') },
      { id: 'transfer', label: t('transactions.filter.transfers') },
    ],
    [t]
  );

  const accountOptions: DropdownOption[] = useMemo(
    () => [
      { id: 'all', label: t('transactions.filter.allAccounts') },
      ...accounts.map((a) => ({ id: a.id, label: `${a.name} (${a.currency})` })),
    ],
    [accounts, t]
  );

  const categoryOptions: DropdownOption[] = useMemo(
    () => [
      { id: 'all', label: t('transactions.filter.allCategories') },
      ...categories.map((c) => ({ id: c.id, label: c.name })),
    ],
    [categories, t]
  );

  const sortOptions: DropdownOption[] = useMemo(
    () => SORT_OPTIONS.map((opt) => ({ id: opt.id, label: t(opt.labelKey as never) })),
    [t]
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    typeFilter !== 'all' ||
    accountFilter !== 'all' ||
    categoryFilter !== 'all' ||
    periodValue.preset !== 'all_time';

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setAccountFilter('all');
    setCategoryFilter('all');
    setPeriodValue({ preset: 'all_time' });
  };

  const buildExportContext = (): ExportTransactionsContext => {
    const periodText =
      periodValue.preset === 'custom'
        ? `${periodValue.customStart ?? ''} – ${periodValue.customEnd ?? ''}`
        : t(`period.${periodValue.preset}` as 'period.all_time');
    const parts = [
      typeOptions.find((o) => o.id === typeFilter)?.label ?? '',
      accountOptions.find((o) => o.id === accountFilter)?.label ?? '',
      categoryOptions.find((o) => o.id === categoryFilter)?.label ?? '',
      periodText,
    ].filter(Boolean);
    if (searchQuery.trim()) parts.push(`"${searchQuery.trim()}"`);

    return {
      accounts,
      categories,
      accountHolder: user?.fullName ?? 'Growy User',
      globalCurrency,
      accentColor,
      appliedFiltersText: parts.join(' · '),
      convertBetween,
      labels: {
        reportTitle: t('txExport.reportTitle'),
        accountHolder: t('export.accountHolder'),
        generatedDate: t('export.generatedDate'),
        globalCurrency: t('export.globalCurrency'),
        appliedFilters: t('export.appliedFilters'),
        colDate: t('txExport.colDate'),
        colType: t('txExport.colType'),
        colCategoryOrRoute: t('txExport.colCategoryOrRoute'),
        colAccounts: t('txExport.colAccounts'),
        colDescription: t('txExport.colDescription'),
        colAmount: t('txExport.colAmount'),
        colConverted: t('txExport.colConverted'),
        totalIncome: t('transactions.totalIncome'),
        totalExpenses: t('transactions.totalExpenses'),
        netCashFlow: t('transactions.netCashFlow'),
        poweredBy: t('brand.poweredBy'),
        typeLabels: {
          expense: t('transactions.type.expense'),
          income: t('transactions.type.income'),
          transfer: t('transactions.type.transfer'),
        },
        transferRouteLabel: t('transactions.type.transfer'),
        unknownLabel: t('transactions.unknownAccount'),
      },
    };
  };

  const handleSaveTransaction = (payload: Omit<Transaction, 'id' | 'createdAt'>) => {
    if (editingTx) {
      updateTransaction(editingTx.id, payload);
    } else {
      addTransaction(payload);
    }
  };

  const hasFxVariance = Math.abs(summary.totalFxVariance) >= 0.005;

  return (
    <div className="space-y-6">
      {/* Top Summary Banner */}
      <section className="glass-card relative z-30 p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-sm font-medium text-[#B8B8BE]">
              {t('transactions.netCashFlow')} ({globalCurrency})
            </span>
            <h1
              className={`mt-1.5 font-display text-3xl sm:text-4xl font-bold tracking-tight tabular-nums ${
                summary.netCashFlow < 0 ? 'text-coral' : 'text-dynamic-accent'
              }`}
            >
              {summary.netCashFlow > 0 ? '+' : ''}
              {formatCurrencyAmount(summary.netCashFlow, globalCurrency)}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                disabled={filteredAndSortedTransactions.length === 0}
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
                        exportTransactionsToExcel(
                          filteredAndSortedTransactions,
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
                        exportTransactionsToPDF(
                          filteredAndSortedTransactions,
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
                setEditingTx(null);
                setModalOpen(true);
              }}
              style={{ color: 'var(--accent-foreground)' }}
              className="bg-dynamic-accent inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>{t('transactions.record')}</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Pills */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 ${
            hasFxVariance ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
          } gap-3 pt-4 border-t border-white/[0.08]`}
        >
          <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#B8B8BE]">
              <TrendingUp className="text-dynamic-accent h-4 w-4" />
              {t('transactions.totalIncome')}
            </span>
            <span className="font-display text-base font-semibold text-dynamic-accent tabular-nums">
              {formatCurrencyAmount(summary.totalIncome, globalCurrency)}
            </span>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#B8B8BE]">
              <TrendingDown className="h-4 w-4 text-coral" />
              {t('transactions.totalExpenses')}
            </span>
            <span className="font-display text-base font-semibold text-coral tabular-nums">
              {formatCurrencyAmount(summary.totalExpenses, globalCurrency)}
            </span>
          </div>

          {hasFxVariance && (
            <div
              title={t('transactions.fxVarianceTooltip')}
              className="rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 flex items-center justify-between gap-2 cursor-help"
            >
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#B8B8BE]">
                <ArrowLeftRight className="text-dynamic-accent h-4 w-4 shrink-0" />
                <span className="truncate">{t('transactions.fxVariance')}</span>
              </span>
              <span
                className={`font-display text-base font-semibold tabular-nums shrink-0 ${
                  summary.totalFxVariance < 0 ? 'text-coral' : 'text-dynamic-accent'
                }`}
              >
                {summary.totalFxVariance > 0 ? '+' : ''}
                {formatCurrencyAmount(summary.totalFxVariance, globalCurrency)}
              </span>
            </div>
          )}

          <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#B8B8BE]">
              <ArrowLeftRight className="text-dynamic-accent h-4 w-4" />
              {t('transactions.totalMovements')}
            </span>
            <span className="font-display text-base font-semibold text-white tabular-nums">
              {summary.count}
            </span>
          </div>
        </div>
      </section>

      {/* Single-Row Compact Toolbar */}
      {transactions.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 h-4 w-4 text-[#8E8E93] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('transactions.searchPlaceholder')}
                className="focus-dynamic-accent w-full h-11 rounded-xl bg-[#333333]/35 backdrop-blur-xl border border-white/[0.08] pl-10 pr-4 text-base sm:text-sm text-white placeholder:text-[#B8B8BE]/60 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex flex-wrap items-center gap-3">
              <GlassSelectDropdown
                icon={Filter}
                value={typeFilter}
                options={typeOptions}
                onChange={(id) => setTypeFilter(id as 'all' | TransactionType)}
                isFiltered={typeFilter !== 'all'}
              />

              <GlassSelectDropdown
                icon={Landmark}
                value={accountFilter}
                options={accountOptions}
                onChange={setAccountFilter}
                isFiltered={accountFilter !== 'all'}
              />

              <GlassSelectDropdown
                icon={Tag}
                value={categoryFilter}
                options={categoryOptions}
                onChange={setCategoryFilter}
                isFiltered={categoryFilter !== 'all'}
              />

              <div className="col-span-2 sm:col-span-1">
                <TimePeriodFilter
                  value={periodValue}
                  onChange={setPeriodValue}
                  defaultPreset="all_time"
                />
              </div>

              <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
                <div className="flex-1">
                  <GlassSelectDropdown
                    icon={ArrowUpDown}
                    value={sortBy}
                    options={sortOptions}
                    onChange={(id) => setSortBy(id as TransactionsSortOption)}
                    isFiltered={sortBy !== 'date'}
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

      {/* Empty State or Date-Grouped Ledger */}
      {transactions.length === 0 ? (
        <section className="glass-card p-8 sm:p-12 text-center flex flex-col items-center">
          <div className="bg-dynamic-accent-soft border-dynamic-accent mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border">
            <ArrowLeftRight className="text-dynamic-accent h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-semibold text-white">
            {t('transactions.emptyTitle')}
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-[#B8B8BE] leading-relaxed">
            {t('transactions.emptyDesc')}
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingTx(null);
              setModalOpen(true);
            }}
            style={{ color: 'var(--accent-foreground)' }}
            className="bg-dynamic-accent mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{t('transactions.recordFirst')}</span>
          </button>
        </section>
      ) : groupedByDate.length === 0 ? (
        <section className="glass-card p-8 text-center space-y-3">
          <p className="text-sm text-[#B8B8BE]">{t('transactions.noFilterMatch')}</p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-medium text-white hover:bg-white/[0.08] transition-all"
          >
            <RotateCcw className="h-4 w-4 text-dynamic-accent" />
            <span>{t('accounts.filter.reset')}</span>
          </button>
        </section>
      ) : (
        <div className="space-y-5">
          {groupedByDate.map((group) => (
            <section key={group.date} className="space-y-2">
              <h2 className="px-1 font-display text-[13px] font-semibold uppercase tracking-wider text-[#B8B8BE]">
                {group.label}
              </h2>
              <div className="glass-card overflow-hidden divide-y divide-white/[0.06]">
                <AnimatePresence>
                  {group.items.map((tx) => {
                    const src = accountMap.get(tx.accountId);
                    const dst = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined;
                    const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
                    const converted = convertToGlobal(tx.amount, src?.currency ?? 'USD');
                    return (
                      <TransactionRow
                        key={tx.id}
                        transaction={tx}
                        sourceAccount={src}
                        destinationAccount={dst}
                        category={cat}
                        globalCurrency={globalCurrency}
                        convertedAmount={converted}
                        onEdit={() => {
                          setEditingTx(tx);
                          setModalOpen(true);
                        }}
                        onDelete={() => setDeletingTx(tx)}
                        onNavigateToLoan={onNavigateToLoan}
                        onNavigateToRecurring={onNavigateToRecurring}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Add / Edit Transaction Modal */}
      <TransactionModal
        isOpen={modalOpen}
        editingTransaction={editingTx}
        accounts={accounts}
        categories={categories}
        allTransactions={transactions}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveTransaction}
      />

      {/* Delete Confirmation Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {deletingTx && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setDeletingTx(null)}
                className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md"
              >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-tx-title"
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 pt-3 sm:p-7 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-7 space-y-5"
            >
              <div className="sm:hidden mx-auto h-1.5 w-10 rounded-full bg-white/20" />
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-coral/30 bg-coral/10">
                  <AlertTriangle className="h-5 w-5 text-coral" />
                </div>
                <div>
                  <h3 id="delete-tx-title" className="font-display text-lg font-semibold text-white">
                    {deletingTx.loanId && deletingTx.loanEntryKind === 'disbursement'
                      ? t('transactions.deleteLoanDisbursementTitle')
                      : deletingTx.loanId && deletingTx.loanEntryKind === 'repayment'
                        ? t('transactions.deleteLoanRepaymentTitle')
                        : t('transactions.deleteTitle')}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#B8B8BE]">
                    {deletingTx.loanId && deletingTx.loanEntryKind === 'disbursement'
                      ? t('transactions.deleteLoanDisbursementWarning')
                      : deletingTx.loanId && deletingTx.loanEntryKind === 'repayment'
                        ? t('transactions.deleteLoanRepaymentWarning')
                        : t('transactions.deleteWarning')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingTx(null)}
                  className="min-h-[44px] rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                >
                  {t('settings.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteTransaction(deletingTx.id);
                    setDeletingTx(null);
                  }}
                  className="min-h-[44px] rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-[#1A1A1C] hover:bg-coral/90 active:scale-[0.98] transition-all"
                >
                  {t('transactions.confirmDeleteBtn')}
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

