import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Coins,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Account, AccountType, AccountsSortOption, SortDirection } from '../../types/finance';
import {
  calculateAccountBalance,
  calculateCurrencySubtotals,
  calculateTotalPortfolioInGlobalCurrency,
  formatCurrencyAmount,
} from '../../utils/accountMetrics';
import {
  ExportAccountsContext,
  exportAccountsToExcel,
  exportAccountsToPDF,
} from '../../utils/exportAccounts';
import { AccountCard } from './AccountCard';
import { AccountModal } from './AccountModal';
import { GlassSelectModal } from '../common/GlassSelectModal';

type FilterType = 'all' | AccountType;

const TYPE_OPTIONS: { id: FilterType; labelKey: string }[] = [
  { id: 'all', labelKey: 'accounts.filter.allTypes' },
  { id: 'bank', labelKey: 'accounts.type.bank' },
  { id: 'debit_card', labelKey: 'accounts.type.debit_card' },
  { id: 'cash', labelKey: 'accounts.type.cash' },
  { id: 'digital_wallet', labelKey: 'accounts.type.digital_wallet' },
  { id: 'other', labelKey: 'accounts.type.other' },
];

const SORT_OPTIONS: { id: AccountsSortOption; labelKey: string }[] = [
  { id: 'createdAt', labelKey: 'accounts.sort.createdAt' },
  { id: 'name', labelKey: 'accounts.sort.name' },
  { id: 'balance', labelKey: 'accounts.sort.balance' },
  { id: 'currency', labelKey: 'accounts.sort.currency' },
  { id: 'type', labelKey: 'accounts.sort.type' },
];

interface GlassDropdownOption {
  id: string;
  label: string;
}

interface GlassFilterDropdownProps {
  icon: React.ComponentType<{ className?: string }>;
  title?: string;
  value: string;
  options: GlassDropdownOption[];
  onChange: (id: string) => void;
  isFiltered?: boolean;
  align?: 'left' | 'right';
}

function GlassFilterDropdown({
  icon: Icon,
  title,
  value,
  options,
  onChange,
  isFiltered = false,
}: GlassFilterDropdownProps) {
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

export function AccountsView() {
  const {
    user,
    addFinancialAccount,
    updateFinancialAccount,
    deleteFinancialAccount,
    updateUserPreferences,
  } = useAuth();
  const { currency: globalCurrency, convertBetween } = useCurrency();
  const { accentColor } = useTheme();
  const { t } = useLanguage();

  const savedAccountsFilters = user?.preferences.viewFilters?.accounts;
  const [searchQuery, setSearchQuery] = useState(savedAccountsFilters?.search ?? '');
  const [activeFilter, setActiveFilter] = useState<FilterType>(
    (savedAccountsFilters?.typeFilter as FilterType) ?? 'all'
  );
  const [activeCurrencyFilter, setActiveCurrencyFilter] = useState<string>(
    savedAccountsFilters?.currencyFilter ?? 'all'
  );
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const accounts = user?.data.accounts ?? [];
  const transactions = user?.data.transactions ?? [];
  const sortBy: AccountsSortOption =
    (savedAccountsFilters?.sortBy as AccountsSortOption) ??
    user?.preferences.accountsSortBy ??
    'createdAt';
  const sortDirection: SortDirection =
    savedAccountsFilters?.sortDirection ?? user?.preferences.accountsSortDirection ?? 'desc';

  useEffect(() => {
    const current = user?.preferences.viewFilters?.accounts;
    if (
      current?.search === searchQuery &&
      current?.typeFilter === activeFilter &&
      current?.currencyFilter === activeCurrencyFilter &&
      current?.sortBy === sortBy &&
      current?.sortDirection === sortDirection
    ) {
      return;
    }
    updateUserPreferences({
      viewFilters: {
        accounts: {
          search: searchQuery,
          typeFilter: activeFilter,
          currencyFilter: activeCurrencyFilter,
          sortBy,
          sortDirection,
        },
      },
    });
  }, [
    searchQuery,
    activeFilter,
    activeCurrencyFilter,
    sortBy,
    sortDirection,
    user?.preferences.viewFilters?.accounts,
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

  const currencySubtotals = useMemo(
    () => calculateCurrencySubtotals(accounts, transactions),
    [accounts, transactions]
  );

  const uniqueCurrencies = useMemo(
    () => currencySubtotals.map((item) => item.currency),
    [currencySubtotals]
  );

  useEffect(() => {
    if (activeCurrencyFilter !== 'all' && !uniqueCurrencies.includes(activeCurrencyFilter)) {
      setActiveCurrencyFilter('all');
    }
  }, [activeCurrencyFilter, uniqueCurrencies]);

  const totalPortfolio = useMemo(
    () =>
      calculateTotalPortfolioInGlobalCurrency(accounts, transactions, (amount, from) =>
        convertBetween(amount, from, globalCurrency)
      ),
    [accounts, transactions, convertBetween, globalCurrency]
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 || activeFilter !== 'all' || activeCurrencyFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setActiveFilter('all');
    setActiveCurrencyFilter('all');
  };

  const filteredAndSortedAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = accounts.filter((acc) => {
      if (activeFilter !== 'all' && acc.type !== activeFilter) return false;
      if (activeCurrencyFilter !== 'all' && acc.currency !== activeCurrencyFilter) return false;
      if (!q) return true;
      return acc.name.toLowerCase().includes(q) || acc.currency.toLowerCase().includes(q);
    });

    const dir = sortDirection === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (sortBy === 'createdAt') {
        const aTime = Date.parse(a.createdAt) || 0;
        const bTime = Date.parse(b.createdAt) || 0;
        return (aTime - bTime) * dir;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name) * dir;
      }
      if (sortBy === 'currency') {
        const cmp = a.currency.localeCompare(b.currency);
        return (cmp !== 0 ? cmp : a.name.localeCompare(b.name)) * dir;
      }
      if (sortBy === 'type') {
        const cmp = a.type.localeCompare(b.type);
        return (cmp !== 0 ? cmp : a.name.localeCompare(b.name)) * dir;
      }
      if (sortBy === 'balance') {
        const aBal = convertBetween(
          calculateAccountBalance(a, transactions),
          a.currency,
          globalCurrency
        );
        const bBal = convertBetween(
          calculateAccountBalance(b, transactions),
          b.currency,
          globalCurrency
        );
        return (aBal - bBal) * dir;
      }
      return 0;
    });
  }, [
    accounts,
    transactions,
    activeFilter,
    activeCurrencyFilter,
    searchQuery,
    sortBy,
    sortDirection,
    convertBetween,
    globalCurrency,
  ]);

  const typeDropdownOptions: GlassDropdownOption[] = useMemo(
    () => TYPE_OPTIONS.map((opt) => ({ id: opt.id, label: t(opt.labelKey as never) })),
    [t]
  );

  const currencyDropdownOptions: GlassDropdownOption[] = useMemo(
    () => [
      { id: 'all', label: t('accounts.filter.allCurrencies') },
      ...uniqueCurrencies.map((code) => ({ id: code, label: code })),
    ],
    [uniqueCurrencies, t]
  );

  const sortDropdownOptions: GlassDropdownOption[] = useMemo(
    () => SORT_OPTIONS.map((opt) => ({ id: opt.id, label: t(opt.labelKey as never) })),
    [t]
  );

  const openCreateModal = () => {
    setEditingAccount(null);
    setModalOpen(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setModalOpen(true);
  };

  const handleSaveAccount = (payload: Omit<Account, 'id' | 'createdAt'>) => {
    if (editingAccount) {
      updateFinancialAccount(editingAccount.id, payload);
    } else {
      addFinancialAccount(payload);
    }
  };

  const buildExportContext = (): ExportAccountsContext => {
    const filterParts: string[] = [];
    filterParts.push(
      activeFilter === 'all'
        ? t('accounts.filter.allTypes')
        : t(`accounts.type.${activeFilter}` as const)
    );
    filterParts.push(
      activeCurrencyFilter === 'all' ? t('accounts.filter.allCurrencies') : activeCurrencyFilter
    );
    if (searchQuery.trim()) {
      filterParts.push(`"${searchQuery.trim()}"`);
    }

    return {
      transactions,
      accountHolder: user?.fullName ?? 'Growy User',
      globalCurrency,
      accentColor,
      appliedFiltersText: filterParts.join(' · '),
      convertBetween,
      labels: {
        reportTitle: t('export.reportTitle'),
        accountHolder: t('export.accountHolder'),
        generatedDate: t('export.generatedDate'),
        globalCurrency: t('export.globalCurrency'),
        appliedFilters: t('export.appliedFilters'),
        colName: t('export.colName'),
        colType: t('export.colType'),
        colCurrency: t('export.colCurrency'),
        colInitialBalance: t('export.colInitialBalance'),
        colCurrentBalance: t('export.colCurrentBalance'),
        colConvertedBalance: t('export.colConvertedBalance'),
        totalLabel: t('export.total'),
        poweredBy: t('brand.poweredBy'),
        typeLabels: {
          bank: t('accounts.type.bank'),
          debit_card: t('accounts.type.debit_card'),
          cash: t('accounts.type.cash'),
          digital_wallet: t('accounts.type.digital_wallet'),
          other: t('accounts.type.other'),
        },
      },
    };
  };

  return (
    <div className="space-y-6">
      {/* Header & Top Portfolio Summary Banner */}
      <section className="glass-card relative z-30 p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-medium text-[#B8B8BE]">
                {t('accounts.totalBalance')}
              </span>
              <span className="bg-dynamic-accent-soft text-dynamic-accent border-dynamic-accent inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[13px] font-medium">
                <Sparkles className="h-3 w-3" />
                {t('accounts.liveFxBadge')} · {globalCurrency}
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[13px] font-medium text-[#B8B8BE] tabular-nums">
                {accounts.length}{' '}
                {accounts.length === 1
                  ? t('accounts.accountCountSingular')
                  : t('accounts.accountCountPlural')}
              </span>
            </div>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white tabular-nums">
              {formatCurrencyAmount(totalPortfolio, globalCurrency)}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Export Dropdown */}
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                disabled={filteredAndSortedAccounts.length === 0}
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
                        exportAccountsToExcel(filteredAndSortedAccounts, buildExportContext());
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
                        exportAccountsToPDF(filteredAndSortedAccounts, buildExportContext());
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
              onClick={openCreateModal}
              style={{ color: 'var(--accent-foreground)' }}
              className="bg-dynamic-accent inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>{t('accounts.addAccount')}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Per-Currency Subtotals */}
        {currencySubtotals.length > 0 && (
          <div className="pt-4 border-t border-white/[0.08] flex flex-wrap gap-3">
            {currencySubtotals.map((item) => (
              <div
                key={item.currency}
                className="flex-1 min-w-[190px] rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="bg-dynamic-accent-soft text-dynamic-accent border-dynamic-accent rounded-lg border px-2 py-0.5 font-display text-[13px] font-semibold tabular-nums">
                    {item.currency}
                  </span>
                  <span className="text-[13px] text-[#B8B8BE] tabular-nums">
                    {item.count}{' '}
                    {item.count === 1
                      ? t('accounts.accountCountSingular')
                      : t('accounts.accountCountPlural')}
                  </span>
                </div>
                <span className="font-display text-base font-semibold text-white tabular-nums">
                  {formatCurrencyAmount(item.total, item.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Single-Row Compact Toolbar */}
      {accounts.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 h-4 w-4 text-[#8E8E93] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('accounts.searchPlaceholder')}
                className="focus-dynamic-accent w-full h-11 rounded-xl bg-[#333333]/35 backdrop-blur-xl border border-white/[0.08] pl-10 pr-4 text-base sm:text-sm text-white placeholder:text-[#B8B8BE]/60 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex items-center gap-3">
              <GlassFilterDropdown
                icon={Filter}
                value={activeFilter}
                options={typeDropdownOptions}
                onChange={(id) => setActiveFilter(id as FilterType)}
                isFiltered={activeFilter !== 'all'}
              />

              <GlassFilterDropdown
                icon={Coins}
                value={activeCurrencyFilter}
                options={currencyDropdownOptions}
                onChange={setActiveCurrencyFilter}
                isFiltered={activeCurrencyFilter !== 'all'}
              />

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <GlassFilterDropdown
                    icon={ArrowUpDown}
                    value={sortBy}
                    options={sortDropdownOptions}
                    onChange={(id) =>
                      updateUserPreferences({ accountsSortBy: id as AccountsSortOption })
                    }
                    isFiltered={sortBy !== 'createdAt'}
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateUserPreferences({
                      accountsSortDirection: sortDirection === 'asc' ? 'desc' : 'asc',
                    })
                  }
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

      {/* Empty State or Accounts Grid */}
      {accounts.length === 0 ? (
        <section className="glass-card p-8 sm:p-12 text-center flex flex-col items-center">
          <div className="bg-dynamic-accent-soft border-dynamic-accent mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border">
            <Landmark className="text-dynamic-accent h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-semibold text-white">
            {t('accounts.emptyTitle')}
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-[#B8B8BE] leading-relaxed">
            {t('accounts.emptyDesc')}
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            style={{ color: 'var(--accent-foreground)' }}
            className="bg-dynamic-accent mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{t('accounts.createFirst')}</span>
          </button>
        </section>
      ) : filteredAndSortedAccounts.length === 0 ? (
        <section className="glass-card p-8 text-center space-y-3">
          <p className="text-sm text-[#B8B8BE]">{t('accounts.noFilterMatch')}</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <AnimatePresence>
            {filteredAndSortedAccounts.map((account) => {
              const currentBalance = calculateAccountBalance(account, transactions);
              const convertedBalance = convertBetween(
                currentBalance,
                account.currency,
                globalCurrency
              );
              return (
                <AccountCard
                  key={account.id}
                  account={account}
                  currentBalance={currentBalance}
                  globalCurrency={globalCurrency}
                  convertedBalance={convertedBalance}
                  onEdit={() => openEditModal(account)}
                  onDelete={() => setDeletingAccount(account)}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add / Edit Account Modal */}
      <AccountModal
        isOpen={modalOpen}
        editingAccount={editingAccount}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveAccount}
      />

      {/* Delete Account Confirmation Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {deletingAccount && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setDeletingAccount(null)}
                className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md"
              >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-financial-account-title"
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
                  <h3
                    id="delete-financial-account-title"
                    className="font-display text-lg font-semibold text-white"
                  >
                    {t('accounts.deleteTitle')}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#B8B8BE]">
                    {t('accounts.deleteWarning')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingAccount(null)}
                  className="min-h-[44px] rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                >
                  {t('settings.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteFinancialAccount(deletingAccount.id);
                    setDeletingAccount(null);
                  }}
                  className="min-h-[44px] rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-[#1A1A1C] hover:bg-coral/90 active:scale-[0.98] transition-all"
                >
                  {t('accounts.confirmDeleteBtn')}
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
