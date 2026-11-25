import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeftRight,
  ChevronDown,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { Account, BudgetCategory, Transaction, TransactionType } from '../../types/finance';
import { calculateAccountBalance, formatCurrencyAmount } from '../../utils/accountMetrics';
import { getTodayLocalDateString } from '../../utils/transactionMetrics';
import { AccountIconBadge } from '../accounts/AccountIconBadge';
import { CategoryIconBadge } from '../budgets/CategoryIconBadge';
import { GlassDatePicker } from '../common/GlassDatePicker';
import { GlassSelectModal } from '../common/GlassSelectModal';

interface TransactionModalProps {
  isOpen: boolean;
  editingTransaction: Transaction | null;
  accounts: Account[];
  categories: BudgetCategory[];
  allTransactions: Transaction[];
  onClose: () => void;
  onSave: (payload: Omit<Transaction, 'id' | 'createdAt'>) => void;
}

interface AccountSelectDropdownProps {
  label: string;
  value: string;
  accounts: Account[];
  balances: Map<string, number>;
  placeholder: string;
  onChange: (id: string) => void;
}

function AccountSelectDropdown({
  label,
  value,
  accounts,
  balances,
  placeholder,
  onChange,
}: AccountSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.id === value);

  const options = useMemo(
    () =>
      accounts.map((acc) => {
        const bal = balances.get(acc.id) ?? 0;
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
    [accounts, balances]
  );

  return (
    <div>
      <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3 text-left transition-all hover:border-white/[0.18]"
      >
        {selected ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <AccountIconBadge
              iconId={selected.iconId}
              color={selected.color}
              accountType={selected.type}
              size="sm"
            />
            <span className="truncate text-sm font-medium text-white flex-1 min-w-0">
              {selected.name}
            </span>
            <span className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[11px] text-[#B8B8BE] shrink-0">
              {selected.currency}
            </span>
          </div>
        ) : (
          <span className="text-sm text-[#B8B8BE] truncate">{placeholder}</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B8BE]" />
      </button>

      <GlassSelectModal
        isOpen={open}
        title={label}
        value={value}
        options={options}
        searchable={accounts.length > 6}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

interface CategorySelectDropdownProps {
  label: string;
  value: string;
  categories: BudgetCategory[];
  emptyText: string;
  searchPlaceholder: string;
  onChange: (id: string) => void;
}

function CategorySelectDropdown({
  label,
  value,
  categories,
  emptyText,
  searchPlaceholder,
  onChange,
}: CategorySelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = categories.find((c) => c.id === value);

  const options = useMemo(
    () =>
      categories.map((cat) => ({
        id: cat.id,
        label: cat.name,
        icon: <CategoryIconBadge iconId={cat.iconId} color={cat.color} size="sm" />,
      })),
    [categories]
  );

  return (
    <div>
      <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">{label}</span>
      {categories.length === 0 ? (
        <div className="h-12 flex items-center rounded-xl border border-white/[0.08] bg-black/25 px-3.5 text-[13px] text-[#B8B8BE] truncate">
          {emptyText}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className="focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3 text-left transition-all hover:border-white/[0.18]"
          >
            {selected ? (
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <CategoryIconBadge iconId={selected.iconId} color={selected.color} size="sm" />
                <span className="truncate text-sm font-medium text-white">{selected.name}</span>
              </div>
            ) : (
              <span className="text-sm text-[#B8B8BE] truncate">{label}</span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B8BE]" />
          </button>

          <GlassSelectModal
            isOpen={open}
            title={label}
            value={value}
            options={options}
            searchable={categories.length > 5}
            searchPlaceholder={searchPlaceholder}
            onSelect={onChange}
            onClose={() => setOpen(false)}
          />
        </>
      )}
    </div>
  );
}

export function TransactionModal({
  isOpen,
  editingTransaction,
  accounts,
  categories,
  allTransactions,
  onClose,
  onSave,
}: TransactionModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { currency: globalCurrency, convertBetween } = useCurrency();

  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(() => getTodayLocalDateString(user?.preferences.timezone));
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [toAmountInput, setToAmountInput] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const accountBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const acc of accounts) {
      map.set(acc.id, calculateAccountBalance(acc, allTransactions));
    }
    return map;
  }, [accounts, allTransactions]);

  const matchingCategories = useMemo(
    () => categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense')),
    [categories, type]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (editingTransaction) {
      setType(editingTransaction.type);
      setDate(editingTransaction.date);
      setAccountId(editingTransaction.accountId);
      setToAccountId(editingTransaction.toAccountId ?? '');
      setCategoryId(editingTransaction.categoryId ?? '');
      setAmountInput(String(editingTransaction.amount));
      setToAmountInput(
        editingTransaction.toAmount !== undefined ? String(editingTransaction.toAmount) : ''
      );
      setDescription(editingTransaction.description ?? '');
    } else {
      const firstAcc = accounts[0]?.id ?? '';
      const secondAcc = accounts[1]?.id ?? '';
      setType('expense');
      setDate(getTodayLocalDateString(user?.preferences.timezone));
      setAccountId(firstAcc);
      setToAccountId(secondAcc);
      setCategoryId('');
      setAmountInput('');
      setToAmountInput('');
      setDescription('');
    }
    setError(null);
  }, [isOpen, editingTransaction, accounts]);

  useEffect(() => {
    if (type === 'transfer') return;
    if (categoryId && !matchingCategories.some((c) => c.id === categoryId)) {
      setCategoryId(matchingCategories[0]?.id ?? '');
    } else if (!categoryId && matchingCategories.length > 0 && !editingTransaction) {
      setCategoryId(matchingCategories[0].id);
    }
  }, [type, categoryId, matchingCategories, editingTransaction]);

  useEffect(() => {
    if (type !== 'transfer' || accounts.length < 2) return;
    if (!toAccountId || toAccountId === accountId) {
      const alt = accounts.find((a) => a.id !== accountId);
      if (alt) setToAccountId(alt.id);
    }
  }, [type, accountId, toAccountId, accounts]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sourceAccount = accounts.find((a) => a.id === accountId);
  const destinationAccount = accounts.find((a) => a.id === toAccountId);
  const destinationOptions = useMemo(
    () => accounts.filter((a) => a.id !== accountId),
    [accounts, accountId]
  );

  const isCrossCurrency =
    type === 'transfer' &&
    sourceAccount &&
    destinationAccount &&
    sourceAccount.currency !== destinationAccount.currency;

  const parsedAmount = Number(amountInput);
  const parsedToAmount = Number(toAmountInput);

  const impliedRate =
    isCrossCurrency &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    Number.isFinite(parsedToAmount) &&
    parsedToAmount > 0
      ? parsedToAmount / parsedAmount
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!accountId || !sourceAccount) {
      setError(t('txModal.errorAccount'));
      return;
    }
    if (!date) {
      setError(t('txModal.errorDate'));
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(t('txModal.errorAmount'));
      return;
    }

    if (type === 'transfer') {
      if (!toAccountId || !destinationAccount || toAccountId === accountId) {
        setError(t('txModal.errorDestination'));
        return;
      }
      const finalToAmount = isCrossCurrency ? parsedToAmount : parsedAmount;
      if (isCrossCurrency && (!Number.isFinite(finalToAmount) || finalToAmount <= 0)) {
        setError(t('txModal.errorReceivedAmount'));
        return;
      }

      const globalAmountSnapshot = convertBetween(
        parsedAmount,
        sourceAccount.currency,
        globalCurrency
      );

      onSave({
        type: 'transfer',
        date,
        accountId,
        amount: parsedAmount,
        toAccountId,
        toAmount: finalToAmount,
        globalAmountSnapshot,
        snapshotCurrency: globalCurrency,
        description: description.trim() || undefined,
      });
      onClose();
      return;
    }

    if (!categoryId) {
      setError(t('txModal.errorCategory'));
      return;
    }

    const chosenCategory = matchingCategories.find((c) => c.id === categoryId);
    const globalAmountSnapshot = convertBetween(
      parsedAmount,
      sourceAccount.currency,
      globalCurrency
    );

    onSave({
      type,
      date,
      accountId,
      amount: parsedAmount,
      categoryId,
      category: chosenCategory?.name,
      globalAmountSnapshot,
      snapshotCurrency: globalCurrency,
      description: description.trim() || undefined,
    });
    onClose();
  };

  const canSubmitTransfer = type !== 'transfer' || accounts.length >= 2;
  const canSubmit = accounts.length > 0 && canSubmitTransfer;

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
            onClose();
          }}
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-modal-title"
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full sm:max-w-xl max-h-[90dvh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] sm:pb-0"
          >
            {/* Sticky Top Header */}
            <div className="shrink-0 px-6 pt-3 sm:pt-4 pb-4 border-b border-white/[0.08] space-y-2">
              <div className="sm:hidden mx-auto h-1.5 w-10 rounded-full bg-white/20" />
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="transaction-modal-title"
                  className="font-display text-xl font-semibold text-white"
                >
                  {editingTransaction ? t('txModal.editTitle') : t('txModal.newTitle')}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-[#B8B8BE] hover:text-white active:scale-95 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Middle Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 pb-6 space-y-4">
              {/* 3-Tab Movement Type Switcher */}
              <div
                role="tablist"
                aria-label={t('txModal.typeLabel')}
                className="relative grid grid-cols-3 p-1 rounded-2xl bg-black/30 border border-white/[0.08]"
              >
                {(
                  [
                    { id: 'expense', label: t('transactions.type.expense'), icon: TrendingDown },
                    { id: 'income', label: t('transactions.type.income'), icon: TrendingUp },
                    { id: 'transfer', label: t('transactions.type.transfer'), icon: ArrowLeftRight },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = type === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setType(tab.id);
                        setError(null);
                      }}
                      className={`relative z-10 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium transition-colors ${
                        active ? 'text-white' : 'text-[#B8B8BE] hover:text-white'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="tx-type-pill"
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                          className="bg-dynamic-accent-soft border-dynamic-accent absolute inset-0 rounded-xl border"
                        />
                      )}
                      <Icon
                        className={`relative z-10 h-4 w-4 shrink-0 ${
                          active
                            ? tab.id === 'expense'
                              ? 'text-coral'
                              : 'text-dynamic-accent'
                            : ''
                        }`}
                      />
                      <span className="relative z-10 truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {accounts.length === 0 ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200 leading-relaxed">
                  {t('txModal.noAccountsPrompt')}
                </div>
              ) : type === 'transfer' && accounts.length < 2 ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200 leading-relaxed">
                  {t('txModal.needTwoAccounts')}
                </div>
              ) : null}

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form id="transaction-modal-form" onSubmit={handleSubmit} noValidate className="space-y-4">
                {type !== 'transfer' ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <GlassDatePicker
                        label={t('txModal.dateLabel')}
                        value={date}
                        onChange={setDate}
                      />

                      <div>
                        <label
                          htmlFor="tx-amount-input"
                          className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                        >
                          {t('txModal.amountLabel')} ({sourceAccount?.currency ?? 'USD'})
                        </label>
                        <input
                          id="tx-amount-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={amountInput}
                          onChange={(e) => setAmountInput(e.target.value)}
                          placeholder="0.00"
                          className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-4 font-display text-base text-white tabular-nums outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <AccountSelectDropdown
                        label={t('txModal.accountLabel')}
                        value={accountId}
                        accounts={accounts}
                        balances={accountBalances}
                        placeholder={t('txModal.errorAccount')}
                        onChange={setAccountId}
                      />

                      <CategorySelectDropdown
                        label={t('txModal.categoryLabel')}
                        value={categoryId}
                        categories={matchingCategories}
                        emptyText={t('txModal.noCategoriesPrompt')}
                        searchPlaceholder={t('budgets.searchPlaceholder')}
                        onChange={setCategoryId}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <GlassDatePicker
                      label={t('txModal.dateLabel')}
                      value={date}
                      onChange={setDate}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <AccountSelectDropdown
                        label={t('txModal.fromAccountLabel')}
                        value={accountId}
                        accounts={accounts}
                        balances={accountBalances}
                        placeholder={t('txModal.errorAccount')}
                        onChange={setAccountId}
                      />

                      <AccountSelectDropdown
                        label={t('txModal.toAccountLabel')}
                        value={toAccountId}
                        accounts={destinationOptions}
                        balances={accountBalances}
                        placeholder={t('txModal.errorDestination')}
                        onChange={setToAccountId}
                      />
                    </div>

                    {isCrossCurrency ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label
                              htmlFor="tx-amount-sent"
                              className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                            >
                              {t('txModal.amountSentLabel')} ({sourceAccount?.currency})
                            </label>
                            <input
                              id="tx-amount-sent"
                              type="number"
                              min="0"
                              step="0.01"
                              value={amountInput}
                              onChange={(e) => setAmountInput(e.target.value)}
                              placeholder="0.00"
                              className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-4 font-display text-base sm:text-sm text-white tabular-nums outline-none transition-all"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="tx-amount-received"
                              className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                            >
                              {t('txModal.amountReceivedLabel')} ({destinationAccount?.currency})
                            </label>
                            <input
                              id="tx-amount-received"
                              type="number"
                              min="0"
                              step="0.01"
                              value={toAmountInput}
                              onChange={(e) => setToAmountInput(e.target.value)}
                              placeholder="0.00"
                              className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-4 font-display text-base sm:text-sm text-white tabular-nums outline-none transition-all"
                            />
                          </div>
                        </div>

                        {impliedRate !== null && (
                          <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3.5 py-2 text-[13px] text-[#B8B8BE] tabular-nums">
                            {t('txModal.impliedRateLabel')}:{' '}
                            <span className="font-display font-semibold text-dynamic-accent">
                              1 {sourceAccount?.currency} = {impliedRate.toFixed(4)}{' '}
                              {destinationAccount?.currency}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label
                          htmlFor="tx-amount-input"
                          className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                        >
                          {t('txModal.transferAmountLabel')} ({sourceAccount?.currency ?? 'USD'})
                        </label>
                        <input
                          id="tx-amount-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={amountInput}
                          onChange={(e) => setAmountInput(e.target.value)}
                          placeholder="0.00"
                          className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-4 font-display text-base text-white tabular-nums outline-none transition-all"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Optional Description */}
                <div>
                  <label
                    htmlFor="tx-description-input"
                    className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                  >
                    {t('txModal.descriptionLabel')}
                  </label>
                  <input
                    id="tx-description-input"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('txModal.descriptionPlaceholder')}
                    className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-4 text-base sm:text-sm text-white placeholder:text-white/30 outline-none transition-all"
                  />
                </div>
              </form>
            </div>

            {/* Sticky Bottom Footer */}
            <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.08] bg-black/20">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all"
              >
                {t('settings.cancel')}
              </button>
              <button
                type="submit"
                form="transaction-modal-form"
                disabled={!canSubmit}
                style={{ color: 'var(--accent-foreground)' }}
                className="bg-dynamic-accent min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {editingTransaction ? t('txModal.saveEdit') : t('txModal.saveNew')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
