import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  ChevronDown,
  Coins,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  HandCoins,
  Layers,
  Plus,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  Loan,
  LoanDirection,
  LoansSortOption,
  SortDirection,
} from '../../types/finance';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import { exportLoansToExcel, exportLoansToPDF } from '../../utils/exportLoans';
import {
  calculateLoanSummary,
  getLoanProgressPct,
  getLoanRemaining,
  isLoanOverdue,
  isLoanSettled,
} from '../../utils/loanMetrics';
import { GlassSelectModal } from '../common/GlassSelectModal';
import { LoanCard } from './LoanCard';
import { LoanModal } from './LoanModal';
import { LoanPaymentModal } from './LoanPaymentModal';

interface DropdownOption {
  id: string;
  label: string;
}

function GlassFilterButton({
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
        <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B8BE]" />
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

const SORT_OPTIONS: { id: LoansSortOption; labelKey: string }[] = [
  { id: 'dueDate', labelKey: 'loans.sort.dueDate' },
  { id: 'remaining', labelKey: 'loans.sort.remaining' },
  { id: 'progress', labelKey: 'loans.sort.progress' },
  { id: 'principal', labelKey: 'loans.sort.principal' },
  { id: 'startDate', labelKey: 'loans.sort.startDate' },
];

export function LoansView({ highlightedLoanId }: { highlightedLoanId?: string | null }) {
  const {
    user,
    addLoan,
    updateLoan,
    deleteLoan,
    recordLoanPayment,
    updateUserPreferences,
  } = useAuth();
  const { currency: globalCurrency, convertBetween } = useCurrency();
  const { accentColor } = useTheme();
  const { t } = useLanguage();

  const savedFilters = user?.preferences.viewFilters?.loans;
  const [searchQuery, setSearchQuery] = useState(savedFilters?.search ?? '');
  const [directionFilter, setDirectionFilter] = useState<'all' | LoanDirection>(
    savedFilters?.directionFilter ?? 'all'
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'settled' | 'overdue'>(
    savedFilters?.statusFilter ?? 'all'
  );
  const [currencyFilter, setCurrencyFilter] = useState(savedFilters?.currencyFilter ?? 'all');
  const [sortBy, setSortBy] = useState<LoansSortOption>(savedFilters?.sortBy ?? 'dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    savedFilters?.sortDirection ?? 'asc'
  );

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [payingLoan, setPayingLoan] = useState<Loan | null>(null);
  const [deletingLoan, setDeletingLoan] = useState<Loan | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const loans = user?.data.loans ?? [];
  const accounts = user?.data.accounts ?? [];
  const transactions = user?.data.transactions ?? [];
  const timezone = user?.preferences.timezone;

  const convertToGlobal = useMemo(
    () => (amount: number, from: string) => convertBetween(amount, from, globalCurrency),
    [convertBetween, globalCurrency]
  );

  useEffect(() => {
    if (!highlightedLoanId) return;
    const el = document.getElementById(`loan-card-${highlightedLoanId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedLoanId]);

  useEffect(() => {
    const current = user?.preferences.viewFilters?.loans;
    if (
      current?.search === searchQuery &&
      current?.directionFilter === directionFilter &&
      current?.statusFilter === statusFilter &&
      current?.currencyFilter === currencyFilter &&
      current?.sortBy === sortBy &&
      current?.sortDirection === sortDirection
    ) {
      return;
    }
    updateUserPreferences({
      viewFilters: {
        loans: {
          search: searchQuery,
          directionFilter,
          statusFilter,
          currencyFilter,
          sortBy,
          sortDirection,
        },
      },
    });
  }, [
    searchQuery,
    directionFilter,
    statusFilter,
    currencyFilter,
    sortBy,
    sortDirection,
    user?.preferences.viewFilters?.loans,
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
    () => calculateLoanSummary(loans, convertToGlobal),
    [loans, convertToGlobal]
  );

  const uniqueCurrencies = useMemo(
    () => Array.from(new Set(loans.map((l) => l.currency))).sort(),
    [loans]
  );

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = loans.filter((loan) => {
      if (directionFilter !== 'all' && loan.direction !== directionFilter) return false;
      if (currencyFilter !== 'all' && loan.currency !== currencyFilter) return false;

      const settled = isLoanSettled(loan);
      const overdue = isLoanOverdue(loan, timezone);
      if (statusFilter === 'active' && settled) return false;
      if (statusFilter === 'settled' && !settled) return false;
      if (statusFilter === 'overdue' && !overdue) return false;

      if (q) {
        const matchesTitle = loan.title.toLowerCase().includes(q);
        const matchesParty = loan.counterparty?.toLowerCase().includes(q) ?? false;
        const matchesCurr = loan.currency.toLowerCase().includes(q);
        if (!matchesTitle && !matchesParty && !matchesCurr) return false;
      }
      return true;
    });

    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'dueDate') {
        return a.dueDate.localeCompare(b.dueDate) * dir;
      }
      if (sortBy === 'startDate') {
        return a.startDate.localeCompare(b.startDate) * dir;
      }
      if (sortBy === 'remaining') {
        const remA = convertToGlobal(getLoanRemaining(a), a.currency);
        const remB = convertToGlobal(getLoanRemaining(b), b.currency);
        return (remA - remB) * dir;
      }
      if (sortBy === 'progress') {
        return (getLoanProgressPct(a) - getLoanProgressPct(b)) * dir;
      }
      const pA = convertToGlobal(a.principalAmount, a.currency);
      const pB = convertToGlobal(b.principalAmount, b.currency);
      return (pA - pB) * dir;
    });
  }, [
    loans,
    directionFilter,
    currencyFilter,
    statusFilter,
    searchQuery,
    sortBy,
    sortDirection,
    timezone,
    convertToGlobal,
  ]);

  const directionOptions: DropdownOption[] = useMemo(
    () => [
      { id: 'all', label: t('loans.filter.allDirections') },
      { id: 'payable', label: t('loans.filter.payable') },
      { id: 'receivable', label: t('loans.filter.receivable') },
    ],
    [t]
  );

  const statusOptions: DropdownOption[] = useMemo(
    () => [
      { id: 'all', label: t('loans.filter.allStatuses') },
      { id: 'active', label: t('loans.filter.active') },
      { id: 'settled', label: t('loans.filter.settled') },
      { id: 'overdue', label: t('loans.filter.overdue') },
    ],
    [t]
  );

  const currencyOptions: DropdownOption[] = useMemo(
    () => [
      { id: 'all', label: t('accounts.filter.allCurrencies') },
      ...uniqueCurrencies.map((c) => ({ id: c, label: c })),
    ],
    [uniqueCurrencies, t]
  );

  const sortDropdownOptions: DropdownOption[] = useMemo(
    () =>
      SORT_OPTIONS.map((opt) => ({
        id: opt.id,
        label: t(opt.labelKey as 'loans.sort.dueDate'),
      })),
    [t]
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    directionFilter !== 'all' ||
    statusFilter !== 'all' ||
    currencyFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setDirectionFilter('all');
    setStatusFilter('all');
    setCurrencyFilter('all');
  };

  const buildExportContext = () => {
    const filterParts: string[] = [];
    if (directionFilter !== 'all') {
      filterParts.push(t(`loans.filter.${directionFilter}` as const));
    }
    if (statusFilter !== 'all') {
      filterParts.push(t(`loans.filter.${statusFilter}` as const));
    }
    if (currencyFilter !== 'all') {
      filterParts.push(currencyFilter);
    }
    if (searchQuery.trim()) {
      filterParts.push(`"${searchQuery.trim()}"`);
    }

    return {
      accountHolder: user?.fullName ?? 'Growy Member',
      globalCurrency,
      accentColor,
      appliedFiltersText: filterParts.length > 0 ? filterParts.join(' · ') : t('accounts.filter.all'),
      timezone,
      convertBetween,
      labels: {
        reportTitle: t('loansExport.reportTitle'),
        accountHolder: t('export.accountHolder'),
        generatedDate: t('export.generatedDate'),
        globalCurrency: t('export.globalCurrency'),
        appliedFilters: t('export.appliedFilters'),
        colTitle: t('loansExport.colTitle'),
        colDirection: t('loansExport.colDirection'),
        colCounterparty: t('loansExport.colCounterparty'),
        colPrincipal: t('loansExport.colPrincipal'),
        colPaid: t('loansExport.colPaid'),
        colRemaining: t('loansExport.colRemaining'),
        colProgress: t('loansExport.colProgress'),
        colDueDate: t('loansExport.colDueDate'),
        colStatus: t('loansExport.colStatus'),
        statusActive: t('loans.filter.active'),
        statusSettled: t('loans.filter.settled'),
        statusOverdue: t('loans.filter.overdue'),
        totalReceivable: t('loansExport.totalReceivable'),
        totalPayable: t('loansExport.totalPayable'),
        netPosition: t('loansExport.netPosition'),
        poweredBy: 'Growy — Powered by SIMPORA',
        directionLabels: {
          payable: t('loans.direction.payable'),
          receivable: t('loans.direction.receivable'),
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
              {t('nav.loans')}
            </h1>
            <p className="mt-1 text-sm text-[#B8B8BE]">{t('loans.subtitle')}</p>

            <div className="mt-5 flex flex-wrap items-baseline gap-3">
              <span
                className={`font-display text-3xl sm:text-4xl font-bold tracking-tight tabular-nums ${
                  summary.netLoanPosition < 0 ? 'text-coral' : 'text-dynamic-accent'
                }`}
              >
                {summary.netLoanPosition > 0 ? '+' : ''}
                {formatCurrencyAmount(summary.netLoanPosition, globalCurrency)}
              </span>
              <span className="text-[13px] font-medium text-[#B8B8BE]">
                {t('loans.netPosition')} ({globalCurrency})
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
                          exportLoansToExcel(filteredAndSorted, buildExportContext());
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
                          exportLoansToPDF(filteredAndSorted, buildExportContext());
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
                setEditingLoan(null);
                setModalOpen(true);
              }}
              style={{ color: 'var(--accent-foreground)' }}
              className="bg-dynamic-accent inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>{t('loans.add')}</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/[0.08]">
          <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#B8B8BE]">
              <ArrowDownLeft className="text-dynamic-accent h-4 w-4 shrink-0" />
              <span className="truncate">{t('loans.totalReceivable')}</span>
            </span>
            <span className="font-display text-base font-semibold text-dynamic-accent tabular-nums shrink-0">
              {formatCurrencyAmount(summary.totalReceivable, globalCurrency)}
            </span>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#B8B8BE]">
              <ArrowUpRight className="h-4 w-4 text-coral shrink-0" />
              <span className="truncate">{t('loans.totalPayable')}</span>
            </span>
            <span className="font-display text-base font-semibold text-coral tabular-nums shrink-0">
              {formatCurrencyAmount(summary.totalPayable, globalCurrency)}
            </span>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#B8B8BE]">
              <HandCoins className="text-dynamic-accent h-4 w-4 shrink-0" />
              <span className="truncate">{t('loans.activeSettled')}</span>
            </span>
            <span className="font-display text-base font-semibold text-white tabular-nums shrink-0">
              <span className="text-dynamic-accent">{summary.activeCount}</span>
              <span className="text-[#B8B8BE]"> / {summary.settledCount}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Single-Row Search, Multi-Filter & Bidirectional Sort Toolbar */}
      {loans.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 h-4 w-4 text-[#8E8E93] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('loans.searchPlaceholder')}
                className="focus-dynamic-accent w-full h-11 rounded-xl bg-[#333333]/35 backdrop-blur-xl border border-white/[0.08] pl-10 pr-4 text-sm text-white placeholder:text-[#B8B8BE]/60 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:flex items-center gap-3">
              <GlassFilterButton
                icon={Layers}
                value={directionFilter}
                options={directionOptions}
                onChange={(id) => setDirectionFilter(id as 'all' | LoanDirection)}
                isFiltered={directionFilter !== 'all'}
              />

              <GlassFilterButton
                icon={Filter}
                value={statusFilter}
                options={statusOptions}
                onChange={(id) =>
                  setStatusFilter(id as 'all' | 'active' | 'settled' | 'overdue')
                }
                isFiltered={statusFilter !== 'all'}
              />

              <GlassFilterButton
                icon={Coins}
                value={currencyFilter}
                options={currencyOptions}
                onChange={setCurrencyFilter}
                isFiltered={currencyFilter !== 'all'}
              />

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <GlassFilterButton
                    icon={ArrowUpDown}
                    value={sortBy}
                    options={sortDropdownOptions}
                    onChange={(id) => setSortBy(id as LoansSortOption)}
                    isFiltered={sortBy !== 'dueDate'}
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

      {/* 2-Column Grid or Empty States */}
      {loans.length === 0 ? (
        <div className="glass-card p-10 sm:p-14 flex flex-col items-center text-center">
          <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-14 w-14 items-center justify-center rounded-2xl border">
            <HandCoins className="text-dynamic-accent h-7 w-7" />
          </div>
          <h2 className="mt-5 font-display text-xl font-semibold text-white">
            {t('loans.emptyTitle')}
          </h2>
          <p className="mt-2 max-w-md text-sm text-[#B8B8BE] leading-relaxed">
            {t('loans.emptyDesc')}
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingLoan(null);
              setModalOpen(true);
            }}
            style={{ color: 'var(--accent-foreground)' }}
            className="bg-dynamic-accent mt-6 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{t('loans.createFirst')}</span>
          </button>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="glass-card p-10 text-center space-y-3">
          <p className="text-sm text-[#B8B8BE]">{t('loans.noFilterMatch')}</p>
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
            {filteredAndSorted.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                globalCurrency={globalCurrency}
                timezone={timezone}
                isHighlighted={highlightedLoanId === loan.id}
                convertToGlobal={convertToGlobal}
                onRecordPayment={(item) => setPayingLoan(item)}
                onEdit={(item) => {
                  setEditingLoan(item);
                  setModalOpen(true);
                }}
                onDelete={(item) => setDeletingLoan(item)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit Loan Modal */}
      <LoanModal
        isOpen={modalOpen}
        editingLoan={editingLoan}
        accounts={accounts}
        allTransactions={transactions}
        onClose={() => {
          setModalOpen(false);
          setEditingLoan(null);
        }}
        onSave={(loanPayload, disbursementTx) => {
          if (editingLoan) {
            updateLoan(editingLoan.id, loanPayload);
          } else {
            addLoan(loanPayload, disbursementTx);
          }
        }}
      />

      {/* Record Payment Modal */}
      <LoanPaymentModal
        loan={payingLoan}
        accounts={accounts}
        allTransactions={transactions}
        onClose={() => setPayingLoan(null)}
        onSubmitPayment={recordLoanPayment}
      />

      {/* Delete Confirmation Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {deletingLoan && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setDeletingLoan(null)}
                className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="delete-loan-title"
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
                      <h3 id="delete-loan-title" className="font-display text-lg font-semibold text-white">
                        {t('loans.deleteTitle')}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-[#B8B8BE]">
                        {t('loans.deleteWarning')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setDeletingLoan(null)}
                      className="h-11 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                    >
                      {t('settings.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteLoan(deletingLoan.id);
                        setDeletingLoan(null);
                      }}
                      className="h-11 rounded-xl bg-coral px-4 text-sm font-semibold text-[#1A1A1C] hover:bg-coral/90 active:scale-[0.98] transition-all"
                    >
                      {t('loans.confirmDeleteBtn')}
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

