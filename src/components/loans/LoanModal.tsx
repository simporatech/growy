import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Check, ChevronDown, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SUPPORTED_CURRENCIES, useCurrency } from '../../context/CurrencyContext';
import { CATEGORY_ICONS, CategoryIconGroup, getCategoryIconLabel } from '../../data/categoryIcons';
import { useLanguage } from '../../i18n/LanguageContext';
import { Account, Loan, LoanDirection, Transaction } from '../../types/finance';
import { calculateAccountBalance, formatCurrencyAmount } from '../../utils/accountMetrics';
import { getTodayLocalDateString } from '../../utils/transactionMetrics';
import { AccountIconBadge } from '../accounts/AccountIconBadge';
import { CategoryIconBadge } from '../budgets/CategoryIconBadge';
import { GlassDatePicker } from '../common/GlassDatePicker';
import { GlassSelectModal } from '../common/GlassSelectModal';

interface LoanModalProps {
  isOpen: boolean;
  editingLoan: Loan | null;
  accounts: Account[];
  allTransactions: Transaction[];
  onClose: () => void;
  onSave: (
    loan: Omit<Loan, 'id' | 'createdAt'>,
    disbursementTx?: Omit<Transaction, 'id' | 'createdAt' | 'loanId'>
  ) => void;
}

const COLOR_SWATCHES = [
  '#97f2cc',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#fbbf24',
  '#fb923c',
  '#f87171',
  '#2dd4bf',
];

const ICON_GROUPS: CategoryIconGroup[] = ['financial', 'essentials', 'lifestyle', 'income'];

export function LoanModal({
  isOpen,
  editingLoan,
  accounts,
  allTransactions,
  onClose,
  onSave,
}: LoanModalProps) {
  const { user } = useAuth();
  const { currency: globalCurrency, convertBetween } = useCurrency();
  const { locale, t } = useLanguage();

  const [direction, setDirection] = useState<LoanDirection>('payable');
  const [title, setTitle] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [loanCurrency, setLoanCurrency] = useState(globalCurrency);
  const [principalInput, setPrincipalInput] = useState('');
  const [startDate, setStartDate] = useState(() =>
    getTodayLocalDateString(user?.preferences.timezone)
  );
  const [dueDate, setDueDate] = useState(() =>
    getTodayLocalDateString(user?.preferences.timezone)
  );
  const [affectsAccountOnCreate, setAffectsAccountOnCreate] = useState(false);
  const [initialAccountId, setInitialAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [iconId, setIconId] = useState('landmark');
  const [color, setColor] = useState('#97f2cc');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [directionOpen, setDirectionOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);

  const categories = user?.data.budgets ?? [];
  const matchingCategories = useMemo(
    () =>
      categories.filter((c) => c.kind === (direction === 'receivable' ? 'income' : 'expense')),
    [categories, direction]
  );

  const accountBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const acc of accounts) {
      map.set(acc.id, calculateAccountBalance(acc, allTransactions));
    }
    return map;
  }, [accounts, allTransactions]);

  useEffect(() => {
    if (!isOpen) return;
    if (editingLoan) {
      setDirection(editingLoan.direction);
      setTitle(editingLoan.title);
      setCounterparty(editingLoan.counterparty ?? '');
      setLoanCurrency(editingLoan.currency);
      setPrincipalInput(String(editingLoan.principalAmount));
      setStartDate(editingLoan.startDate);
      setDueDate(editingLoan.dueDate);
      setAffectsAccountOnCreate(editingLoan.affectsAccountOnCreate);
      setInitialAccountId(editingLoan.initialAccountId ?? accounts[0]?.id ?? '');
      setCategoryId(editingLoan.affectsAccountOnCreate ? '' : editingLoan.categoryId ?? '');
      setIconId(editingLoan.iconId);
      setColor(editingLoan.color);
      setNotes(editingLoan.notes ?? '');
    } else {
      const today = getTodayLocalDateString(user?.preferences.timezone);
      setDirection('payable');
      setTitle('');
      setCounterparty('');
      setLoanCurrency(globalCurrency);
      setPrincipalInput('');
      setStartDate(today);
      setDueDate(today);
      setAffectsAccountOnCreate(false);
      setInitialAccountId('');
      setCategoryId('');
      setIconId('landmark');
      setColor('#97f2cc');
      setNotes('');
    }
    setDirectionOpen(false);
    setCurrencyOpen(false);
    setAccountOpen(false);
    setCategoryOpen(false);
    setIconOpen(false);
    setError(null);
  }, [isOpen, editingLoan, accounts, globalCurrency, user?.preferences.timezone]);

  useEffect(() => {
    if (affectsAccountOnCreate) {
      if (categoryId) setCategoryId('');
      return;
    }
    if (categoryId && !matchingCategories.some((c) => c.id === categoryId)) {
      setCategoryId(matchingCategories[0]?.id ?? '');
    } else if (!categoryId && matchingCategories.length > 0 && !editingLoan) {
      setCategoryId(matchingCategories[0].id);
    }
  }, [affectsAccountOnCreate, categoryId, matchingCategories, editingLoan]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !directionOpen &&
        !currencyOpen &&
        !accountOpen &&
        !categoryOpen &&
        !iconOpen
      ) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, directionOpen, currencyOpen, accountOpen, categoryOpen, iconOpen, onClose]);

  const directionOptions = useMemo(
    () => [
      {
        id: 'payable',
        label: t('loans.filter.payable'),
        icon: <ArrowUpRight className="text-coral h-4 w-4" />,
      },
      {
        id: 'receivable',
        label: t('loans.filter.receivable'),
        icon: <ArrowDownLeft className="text-dynamic-accent h-4 w-4" />,
      },
    ],
    [t]
  );

  const currencyOptions = useMemo(
    () =>
      SUPPORTED_CURRENCIES.map((c) => ({
        id: c.code,
        label: c.code,
        subtitle: c.name,
        badge: c.symbol,
        keywords: [c.code, c.name, c.symbol],
      })),
    []
  );

  const accountOptions = useMemo(
    () =>
      accounts.map((acc) => {
        const bal = accountBalances.get(acc.id) ?? acc.initialBalance;
        return {
          id: acc.id,
          label: acc.name,
          badge: acc.currency,
          subtitle: formatCurrencyAmount(bal, acc.currency),
          icon: (
            <AccountIconBadge
              iconId={acc.iconId}
              color={acc.color}
              accountType={acc.type}
              size="sm"
            />
          ),
          keywords: [acc.name, acc.currency],
        };
      }),
    [accounts, accountBalances]
  );

  const iconGroups = useMemo(
    () => [
      { id: 'all', label: t('categoryModal.group.all') },
      ...ICON_GROUPS.map((grp) => ({
        id: grp,
        label: t(`categoryModal.group.${grp}` as const),
      })),
    ],
    [t]
  );

  const iconOptions = useMemo(
    () =>
      CATEGORY_ICONS.map((item) => ({
        id: item.id,
        label: getCategoryIconLabel(item, locale),
        groupId: item.group,
        icon: <CategoryIconBadge iconId={item.id} color={color} size="sm" />,
        keywords: [item.label.en, item.label.es, item.id, ...item.keywords],
      })),
    [locale, color]
  );

  const selectedAccount = accounts.find((a) => a.id === initialAccountId);
  const selectedCategory = matchingCategories.find((c) => c.id === categoryId);
  const selectedIconDef =
    CATEGORY_ICONS.find((item) => item.id === iconId) ?? CATEGORY_ICONS[0];

  const categoryOptions = useMemo(
    () =>
      matchingCategories.map((cat) => ({
        id: cat.id,
        label: cat.name,
        icon: <CategoryIconBadge iconId={cat.iconId} color={cat.color} size="sm" />,
      })),
    [matchingCategories]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 2) {
      setError(t('loanModal.errorTitle'));
      return;
    }
    const parsedPrincipal = Number(principalInput);
    if (!Number.isFinite(parsedPrincipal) || parsedPrincipal <= 0) {
      setError(t('loanModal.errorPrincipal'));
      return;
    }
    if (!startDate || !dueDate) {
      setError(t('loanModal.errorDates'));
      return;
    }
    if (!editingLoan && affectsAccountOnCreate && (!initialAccountId || !selectedAccount)) {
      setError(t('loanModal.errorAccount'));
      return;
    }
    if (!affectsAccountOnCreate && !categoryId) {
      setError(t('loanModal.errorCategory'));
      return;
    }

    const loanPayload: Omit<Loan, 'id' | 'createdAt'> = {
      direction,
      title: title.trim(),
      counterparty: counterparty.trim() || undefined,
      currency: loanCurrency,
      principalAmount: parsedPrincipal,
      paidAmount: editingLoan?.paidAmount ?? 0,
      startDate,
      dueDate,
      affectsAccountOnCreate,
      initialAccountId: affectsAccountOnCreate ? initialAccountId : undefined,
      categoryId: affectsAccountOnCreate ? undefined : categoryId || undefined,
      iconId,
      color,
      notes: notes.trim() || undefined,
    };

    let disbursementTx: Omit<Transaction, 'id' | 'createdAt' | 'loanId'> | undefined;
    if (!editingLoan && affectsAccountOnCreate && selectedAccount) {
      const txAmountInAccountCurrency =
        selectedAccount.currency === loanCurrency
          ? parsedPrincipal
          : convertBetween(parsedPrincipal, loanCurrency, selectedAccount.currency);

      disbursementTx = {
        type: direction === 'payable' ? 'income' : 'expense',
        date: startDate,
        accountId: selectedAccount.id,
        amount: txAmountInAccountCurrency,
        toAmount: parsedPrincipal,
        loanEntryKind: 'disbursement',
        excludeFromCashFlow: true,
        globalAmountSnapshot: convertBetween(parsedPrincipal, loanCurrency, globalCurrency),
        snapshotCurrency: globalCurrency,
        description: t('loanModal.disbursementDesc').replace('{title}', title.trim()),
      };
    }

    onSave(loanPayload, disbursementTx);
    onClose();
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => {
            if ((e.target as HTMLElement)?.closest?.('[data-portal-popover="true"]')) return;
            if (directionOpen || currencyOpen || accountOpen || categoryOpen || iconOpen) return;
            onClose();
          }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="loan-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden"
          >
            {/* Sticky Top Header */}
            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.08]">
              <h2 id="loan-modal-title" className="font-display text-xl font-semibold text-white">
                {editingLoan ? t('loanModal.editTitle') : t('loanModal.newTitle')}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#B8B8BE] hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-4">
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Direction & Currency */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                      {t('loanModal.directionLabel')}
                    </span>
                    <button
                      type="button"
                      disabled={Boolean(editingLoan)}
                      onClick={() => setDirectionOpen(true)}
                      className="focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-left transition-all hover:border-white/[0.18] disabled:opacity-60"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {direction === 'payable' ? (
                          <ArrowUpRight className="text-coral h-4 w-4 shrink-0" />
                        ) : (
                          <ArrowDownLeft className="text-dynamic-accent h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate text-sm font-medium text-white">
                          {t(`loans.filter.${direction}` as const)}
                        </span>
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B8BE]" />
                    </button>
                  </div>

                  <div>
                    <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                      {t('loanModal.currencyLabel')}
                    </span>
                    <button
                      type="button"
                      disabled={Boolean(editingLoan)}
                      onClick={() => setCurrencyOpen(true)}
                      className="focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-left transition-all hover:border-white/[0.18] disabled:opacity-60"
                    >
                      <span className="font-display text-sm font-semibold text-dynamic-accent tabular-nums">
                        {loanCurrency}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B8BE]" />
                    </button>
                  </div>
                </div>

                {/* Title & Counterparty */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="loan-title-input"
                      className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                    >
                      {t('loanModal.titleLabel')}
                    </label>
                    <input
                      id="loan-title-input"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t('loanModal.titlePlaceholder')}
                      className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white placeholder:text-white/30 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="loan-counterparty-input"
                      className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                    >
                      {t('loanModal.counterpartyLabel')}
                    </label>
                    <input
                      id="loan-counterparty-input"
                      type="text"
                      value={counterparty}
                      onChange={(e) => setCounterparty(e.target.value)}
                      placeholder={t('loanModal.counterpartyPlaceholder')}
                      className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white placeholder:text-white/30 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Principal & Icon */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="loan-principal-input"
                      className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                    >
                      {t('loanModal.principalLabel')} ({loanCurrency})
                    </label>
                    <input
                      id="loan-principal-input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={principalInput}
                      onChange={(e) => setPrincipalInput(e.target.value)}
                      placeholder="0.00"
                      className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white placeholder:text-white/30 outline-none tabular-nums transition-all"
                    />
                  </div>

                  <div>
                    <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                      {t('loanModal.iconLabel')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIconOpen(true)}
                      className="focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3 text-left transition-all hover:border-white/[0.18]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryIconBadge iconId={iconId} color={color} size="sm" />
                        <span className="truncate text-sm font-medium text-white">
                          {getCategoryIconLabel(selectedIconDef, locale)}
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B8BE]" />
                    </button>
                  </div>
                </div>

                {/* Start Date & Due Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <GlassDatePicker
                    label={t('loanModal.startDateLabel')}
                    value={startDate}
                    onChange={setStartDate}
                  />
                  <GlassDatePicker
                    label={t('loanModal.dueDateLabel')}
                    value={dueDate}
                    onChange={setDueDate}
                  />
                </div>

                {/* Account Impact vs. Operational Category (Mutually Exclusive) */}
                <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4 space-y-3">
                  {!editingLoan && accounts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAffectsAccountOnCreate((prev) => {
                          const next = !prev;
                          if (next) {
                            setCategoryId('');
                            setInitialAccountId((cur) => cur || accounts[0]?.id || '');
                          } else {
                            setInitialAccountId('');
                            setCategoryId(matchingCategories[0]?.id ?? '');
                          }
                          return next;
                        });
                      }}
                      className="w-full flex items-start gap-3 text-left"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          affectsAccountOnCreate
                            ? 'bg-dynamic-accent border-dynamic-accent text-[#1A1A1C]'
                            : 'border-white/[0.2] bg-black/30'
                        }`}
                      >
                        {affectsAccountOnCreate && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">
                          {direction === 'payable'
                            ? t('loanModal.affectsPayableLabel')
                            : t('loanModal.affectsReceivableLabel')}
                        </p>
                        <p className="mt-0.5 text-[13px] text-[#B8B8BE]">
                          {t('loanModal.affectsHint')}
                        </p>
                      </div>
                    </button>
                  )}

                  {!editingLoan && affectsAccountOnCreate && accounts.length > 0 ? (
                    <div>
                      <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                        {t('loanModal.accountLabel')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAccountOpen(true)}
                        className="focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3 text-left transition-all hover:border-white/[0.18]"
                      >
                        {selectedAccount ? (
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <AccountIconBadge
                              iconId={selectedAccount.iconId}
                              color={selectedAccount.color}
                              accountType={selectedAccount.type}
                              size="sm"
                            />
                            <span className="truncate text-sm font-medium text-white">
                              {selectedAccount.name}
                            </span>
                            <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-[#B8B8BE]">
                              {selectedAccount.currency}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-[#B8B8BE]">
                            {t('loanModal.accountLabel')}
                          </span>
                        )}
                        <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B8BE]" />
                      </button>
                    </div>
                  ) : !affectsAccountOnCreate ? (
                    <div>
                      <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                        {t('loanModal.categoryLabel')}
                      </span>
                      {matchingCategories.length === 0 ? (
                        <div className="h-12 flex items-center rounded-xl border border-white/[0.08] bg-black/25 px-3.5 text-[13px] text-[#B8B8BE] truncate">
                          {t('loanModal.noCategoriesPrompt')}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCategoryOpen(true)}
                          className="focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3 text-left transition-all hover:border-white/[0.18]"
                        >
                          {selectedCategory ? (
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <CategoryIconBadge
                                iconId={selectedCategory.iconId}
                                color={selectedCategory.color}
                                size="sm"
                              />
                              <span className="truncate text-sm font-medium text-white">
                                {selectedCategory.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-[#B8B8BE]">
                              {t('loanModal.categoryPlaceholder')}
                            </span>
                          )}
                          <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B8BE]" />
                        </button>
                      )}
                      <p className="mt-1.5 text-[12px] text-[#B8B8BE]">
                        {t('loanModal.categoryHint')}
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Color Swatches */}
                <div>
                  <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                    {t('loanModal.colorLabel')}
                  </span>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {COLOR_SWATCHES.map((swatch) => {
                      const active = color.toLowerCase() === swatch.toLowerCase();
                      return (
                        <button
                          key={swatch}
                          type="button"
                          onClick={() => setColor(swatch)}
                          aria-label={swatch}
                          className={`relative h-9 w-9 rounded-full transition-transform hover:scale-105 active:scale-95 ${
                            active ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1A1A1C]' : ''
                          }`}
                          style={{ backgroundColor: swatch }}
                        />
                      );
                    })}
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      maxLength={7}
                      aria-label={t('loanModal.colorLabel')}
                      className="focus-dynamic-accent h-9 w-24 rounded-xl bg-black/30 border border-white/[0.08] px-2.5 font-mono text-xs text-white outline-none"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label
                    htmlFor="loan-notes-input"
                    className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                  >
                    {t('loanModal.notesLabel')}
                  </label>
                  <input
                    id="loan-notes-input"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('loanModal.notesPlaceholder')}
                    className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white placeholder:text-white/30 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.08] bg-[#1A1A1C]/40">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                >
                  {t('settings.cancel')}
                </button>
                <button
                  type="submit"
                  style={{ color: 'var(--accent-foreground)' }}
                  className="bg-dynamic-accent h-11 rounded-xl px-5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  {editingLoan ? t('loanModal.saveEdit') : t('loanModal.saveNew')}
                </button>
              </div>
            </form>
          </motion.div>

          <GlassSelectModal
            isOpen={directionOpen}
            title={t('loanModal.directionLabel')}
            value={direction}
            options={directionOptions}
            searchable={false}
            onSelect={(id) => setDirection(id as LoanDirection)}
            onClose={() => setDirectionOpen(false)}
          />

          <GlassSelectModal
            isOpen={currencyOpen}
            title={t('loanModal.currencyLabel')}
            value={loanCurrency}
            options={currencyOptions}
            searchable
            searchPlaceholder={t('accountModal.currencySearch')}
            emptyText={t('settings.noCurrencyMatch')}
            onSelect={setLoanCurrency}
            onClose={() => setCurrencyOpen(false)}
          />

          <GlassSelectModal
            isOpen={accountOpen}
            title={t('loanModal.accountLabel')}
            value={initialAccountId}
            options={accountOptions}
            searchable={accounts.length > 6}
            onSelect={setInitialAccountId}
            onClose={() => setAccountOpen(false)}
          />

          <GlassSelectModal
            isOpen={categoryOpen}
            title={t('loanModal.categoryLabel')}
            value={categoryId}
            options={categoryOptions}
            searchable={matchingCategories.length > 5}
            onSelect={setCategoryId}
            onClose={() => setCategoryOpen(false)}
          />

          <GlassSelectModal
            isOpen={iconOpen}
            title={t('loanModal.iconLabel')}
            value={iconId}
            options={iconOptions}
            groups={iconGroups}
            layout="grid"
            searchable
            searchPlaceholder={t('categoryModal.iconSearch')}
            onSelect={setIconId}
            onClose={() => setIconOpen(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}

