import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeftRight,
  ChevronDown,
  HandCoins,
  Lock,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  CATEGORY_ICONS,
  CategoryIconGroup,
  getCategoryIconLabel,
} from '../../data/categoryIcons';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  Account,
  BillingFrequency,
  BudgetCategory,
  Subscription,
  Transaction,
  TransactionType,
} from '../../types/finance';
import { calculateAccountBalance, formatCurrencyAmount } from '../../utils/accountMetrics';
import { getLoanRemaining, isLoanSettled } from '../../utils/loanMetrics';
import { getTodayLocalDateString } from '../../utils/transactionMetrics';
import { AccountIconBadge } from '../accounts/AccountIconBadge';
import { CategoryIconBadge } from '../budgets/CategoryIconBadge';
import { GlassDatePicker } from '../common/GlassDatePicker';
import { GlassSelectModal } from '../common/GlassSelectModal';

interface SubscriptionModalProps {
  isOpen: boolean;
  editingSubscription: Subscription | null;
  accounts: Account[];
  categories: BudgetCategory[];
  allTransactions: Transaction[];
  onClose: () => void;
  onSave: (payload: Omit<Subscription, 'id' | 'createdAt'>) => void;
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

const FREQUENCIES: BillingFrequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'];
const ICON_GROUPS: CategoryIconGroup[] = ['essentials', 'lifestyle', 'income', 'financial'];

interface AccountDropdownProps {
  label: string;
  value: string;
  accounts: Account[];
  balances: Map<string, number>;
  disabled?: boolean;
  onChange: (id: string) => void;
  onOpenChange?: (open: boolean) => void;
}

function AccountPortalDropdown({
  label,
  value,
  accounts,
  balances,
  disabled,
  onChange,
  onOpenChange,
}: AccountDropdownProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const selected = accounts.find((a) => a.id === value);

  const options = useMemo(
    () =>
      accounts.map((acc) => {
        const bal = balances.get(acc.id) ?? acc.initialBalance;
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
        disabled={disabled || accounts.length === 0}
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3 text-left transition-all hover:border-white/[0.18] disabled:opacity-50"
      >
        {selected ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <AccountIconBadge
              iconId={selected.iconId}
              color={selected.color}
              accountType={selected.type}
              size="sm"
            />
            <span className="truncate text-sm font-medium text-white">{selected.name}</span>
            <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-[#B8B8BE]">
              {selected.currency}
            </span>
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
        searchable={accounts.length > 6}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

export function SubscriptionModal({
  isOpen,
  editingSubscription,
  accounts,
  categories,
  allTransactions,
  onClose,
  onSave,
}: SubscriptionModalProps) {
  const { user } = useAuth();
  const { locale, t } = useLanguage();

  const [kind, setKind] = useState<TransactionType>('expense');
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [linkedLoanId, setLinkedLoanId] = useState('');
  const [interestAmountInput, setInterestAmountInput] = useState('');
  const [interestCategoryId, setInterestCategoryId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [toAmountInput, setToAmountInput] = useState('');
  const [frequency, setFrequency] = useState<BillingFrequency>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState(() =>
    getTodayLocalDateString(user?.preferences.timezone)
  );
  const [iconId, setIconId] = useState('tv');
  const [color, setColor] = useState('#97f2cc');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [loanDropdownOpen, setLoanDropdownOpen] = useState(false);
  const [interestCategoryDropdownOpen, setInterestCategoryDropdownOpen] = useState(false);
  const [iconDropdownOpen, setIconDropdownOpen] = useState(false);

  const accountBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const acc of accounts) {
      map.set(acc.id, calculateAccountBalance(acc, allTransactions));
    }
    return map;
  }, [accounts, allTransactions]);

  const matchingCategories = useMemo(
    () => categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense')),
    [categories, kind]
  );

  const availableLoans = useMemo(() => {
    if (kind === 'transfer') return [];
    const expectedDirection = kind === 'income' ? 'receivable' : 'payable';
    return (user?.data.loans ?? []).filter(
      (l) => l.direction === expectedDirection && !isLoanSettled(l)
    );
  }, [user?.data.loans, kind]);

  const isEditLocked = Boolean(editingSubscription);

  const selectedLoan = useMemo(
    () => (user?.data.loans ?? []).find((l) => l.id === linkedLoanId),
    [user?.data.loans, linkedLoanId]
  );

  const loanOptions = useMemo(
    () => [
      { id: '', label: t('subModal.linkedLoanNone') },
      ...availableLoans.map((loan) => ({
        id: loan.id,
        label: loan.counterparty ? `${loan.title} · ${loan.counterparty}` : loan.title,
        subtitle: `${formatCurrencyAmount(getLoanRemaining(loan), loan.currency)} · ${t(
          `loans.direction.${loan.direction}` as 'loans.direction.payable'
        )}`,
        icon: <HandCoins className="h-4 w-4 text-dynamic-accent" />,
      })),
    ],
    [availableLoans, t]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (editingSubscription) {
      const initialKind: TransactionType = editingSubscription.kind ?? 'expense';
      setKind(initialKind);
      setName(editingSubscription.name);
      setAccountId(editingSubscription.accountId);
      setToAccountId(editingSubscription.toAccountId ?? accounts[1]?.id ?? '');
      setCategoryId(editingSubscription.categoryId ?? '');
      setLinkedLoanId(editingSubscription.linkedLoanId ?? '');
      setInterestAmountInput(
        editingSubscription.interestAmount && editingSubscription.interestAmount > 0
          ? String(editingSubscription.interestAmount)
          : ''
      );
      setInterestCategoryId(editingSubscription.interestCategoryId ?? '');
      setAmountInput(String(editingSubscription.amount));
      setToAmountInput(
        editingSubscription.toAmount !== undefined ? String(editingSubscription.toAmount) : ''
      );
      setFrequency(editingSubscription.frequency);
      setNextBillingDate(editingSubscription.nextBillingDate);
      setIconId(editingSubscription.iconId);
      setColor(editingSubscription.color);
      setIsActive(editingSubscription.isActive);
    } else {
      setKind('expense');
      setName('');
      setAccountId(accounts[0]?.id ?? '');
      setToAccountId(accounts[1]?.id ?? '');
      setCategoryId('');
      setLinkedLoanId('');
      setInterestAmountInput('');
      setInterestCategoryId('');
      setAmountInput('');
      setToAmountInput('');
      setFrequency('monthly');
      setNextBillingDate(getTodayLocalDateString(user?.preferences.timezone));
      setIconId('tv');
      setColor('#97f2cc');
      setIsActive(true);
    }
    setAccountDropdownOpen(false);
    setCategoryDropdownOpen(false);
    setLoanDropdownOpen(false);
    setInterestCategoryDropdownOpen(false);
    setIconDropdownOpen(false);
    setError(null);
  }, [isOpen, editingSubscription, accounts, user?.preferences.timezone]);

  useEffect(() => {
    if (kind === 'transfer') {
      if (linkedLoanId) setLinkedLoanId('');
      return;
    }
    if (linkedLoanId && !availableLoans.some((l) => l.id === linkedLoanId)) {
      setLinkedLoanId('');
    }
  }, [kind, linkedLoanId, availableLoans]);

  useEffect(() => {
    if (kind === 'transfer') return;
    if (categoryId && !matchingCategories.some((c) => c.id === categoryId)) {
      setCategoryId(matchingCategories[0]?.id ?? '');
    } else if (!categoryId && matchingCategories.length > 0 && !editingSubscription) {
      setCategoryId(matchingCategories[0].id);
    }
  }, [kind, categoryId, matchingCategories, editingSubscription]);

  useEffect(() => {
    if (kind !== 'transfer' || accounts.length < 2) return;
    if (!toAccountId || toAccountId === accountId) {
      const alt = accounts.find((a) => a.id !== accountId);
      if (alt) setToAccountId(alt.id);
    }
  }, [kind, accountId, toAccountId, accounts]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !accountDropdownOpen && !categoryDropdownOpen && !iconDropdownOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, accountDropdownOpen, categoryDropdownOpen, iconDropdownOpen, onClose]);

  const sourceAccount = accounts.find((a) => a.id === accountId);
  const destinationAccount = accounts.find((a) => a.id === toAccountId);
  const destinationOptions = useMemo(
    () => accounts.filter((a) => a.id !== accountId),
    [accounts, accountId]
  );
  const selectedCategory = matchingCategories.find((c) => c.id === categoryId);
  const selectedIconDef = useMemo(
    () => CATEGORY_ICONS.find((item) => item.id === iconId) ?? CATEGORY_ICONS[0],
    [iconId]
  );

  const isCrossCurrency =
    kind === 'transfer' &&
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

  const categoryOptions = useMemo(
    () =>
      matchingCategories.map((cat) => ({
        id: cat.id,
        label: cat.name,
        icon: <CategoryIconBadge iconId={cat.iconId} color={cat.color} size="sm" />,
      })),
    [matchingCategories]
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError(t('subModal.errorName'));
      return;
    }
    if (!accountId || !sourceAccount) {
      setError(t('subModal.errorAccount'));
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(t('subModal.errorAmount'));
      return;
    }
    if (!nextBillingDate) {
      setError(t('subModal.errorDate'));
      return;
    }

    if (kind === 'transfer') {
      if (!toAccountId || !destinationAccount || toAccountId === accountId) {
        setError(t('subModal.errorDestination'));
        return;
      }
      const finalToAmount = isCrossCurrency ? parsedToAmount : parsedAmount;
      if (isCrossCurrency && (!Number.isFinite(finalToAmount) || finalToAmount <= 0)) {
        setError(t('subModal.errorReceivedAmount'));
        return;
      }

      onSave({
        kind: 'transfer',
        name: name.trim(),
        iconId,
        color,
        frequency,
        nextBillingDate,
        accountId,
        amount: parsedAmount,
        toAccountId,
        toAmount: finalToAmount,
        isActive,
      });
      onClose();
      return;
    }

    const parsedInterest = linkedLoanId ? Number(interestAmountInput || '0') : 0;
    if (linkedLoanId && (!Number.isFinite(parsedInterest) || parsedInterest < 0)) {
      setError(t('subModal.errorAmount'));
      return;
    }
    if (linkedLoanId && parsedInterest > 0 && !interestCategoryId) {
      setError(t('loanPayModal.errorInterestCategory'));
      return;
    }

    onSave({
      kind,
      name: name.trim(),
      iconId,
      color,
      frequency,
      nextBillingDate,
      accountId,
      categoryId: linkedLoanId ? undefined : categoryId || undefined,
      linkedLoanId: linkedLoanId || undefined,
      interestAmount: linkedLoanId && parsedInterest > 0 ? parsedInterest : undefined,
      interestCategoryId: linkedLoanId && parsedInterest > 0 ? interestCategoryId : undefined,
      amount: parsedAmount,
      isActive,
    });
    onClose();
  };

  const canSubmitTransfer = kind !== 'transfer' || accounts.length >= 2;
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
            if (accountDropdownOpen || categoryDropdownOpen || iconDropdownOpen) return;
            onClose();
          }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscription-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden"
          >
            {/* Sticky Top Header */}
            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.08]">
              <h2
                id="subscription-modal-title"
                className="font-display text-xl font-semibold text-white"
              >
                {editingSubscription ? t('subModal.editTitle') : t('subModal.newTitle')}
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
                {accounts.length === 0 && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{t('subModal.noAccountsPrompt')}</span>
                  </div>
                )}

                {kind === 'transfer' && accounts.length === 1 && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{t('subModal.needTwoAccounts')}</span>
                  </div>
                )}

                {/* 3-Tab Movement Type Switcher */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="block text-[13px] font-medium text-[#B8B8BE]">
                      {t('subModal.kindLabel')}
                    </span>
                    {isEditLocked && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8E8E93]">
                        <Lock className="h-3 w-3 shrink-0" />
                        <span>{t('subModal.lockedBadge')}</span>
                      </span>
                    )}
                  </div>
                  <div
                    className={`grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-black/30 border border-white/[0.06] ${
                      isEditLocked ? 'opacity-65 cursor-not-allowed' : ''
                    }`}
                  >
                    {(
                      [
                        { id: 'expense', icon: TrendingDown, label: t('subModal.tab.expense') },
                        { id: 'income', icon: TrendingUp, label: t('subModal.tab.income') },
                        { id: 'transfer', icon: ArrowLeftRight, label: t('subModal.tab.transfer') },
                      ] as const
                    ).map((tab) => {
                      const active = kind === tab.id;
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          disabled={isEditLocked}
                          onClick={() => {
                            if (!isEditLocked) setKind(tab.id);
                          }}
                          className={`relative min-h-[42px] flex items-center justify-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                            isEditLocked ? 'cursor-not-allowed' : ''
                          } ${active ? 'text-white' : 'text-[#B8B8BE] hover:text-white'}`}
                        >
                          {active && (
                            <motion.span
                              layoutId="sub-kind-pill"
                              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                              className="bg-dynamic-accent-soft border-dynamic-accent absolute inset-0 rounded-xl border"
                            />
                          )}
                          <Icon
                            className={`relative z-10 h-3.5 w-3.5 shrink-0 ${
                              active
                                ? tab.id === 'expense'
                                  ? 'text-coral'
                                  : 'text-dynamic-accent'
                                : ''
                            }`}
                          />
                          <span className="relative z-10 whitespace-nowrap">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {isEditLocked && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#8E8E93]">
                      <Lock className="h-3 w-3 shrink-0" />
                      <span>{t('subModal.lockedAccountingHint')}</span>
                    </p>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label
                    htmlFor="sub-name-input"
                    className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                  >
                    {t('subModal.nameLabel')}
                  </label>
                  <input
                    id="sub-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('subModal.namePlaceholder')}
                    className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white placeholder:text-white/30 outline-none transition-all"
                  />
                </div>

                {/* Accounts & Amount (Dynamic by kind) */}
                {kind === 'transfer' ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <AccountPortalDropdown
                        label={t('subModal.fromAccountLabel')}
                        value={accountId}
                        accounts={accounts}
                        balances={accountBalances}
                        onChange={setAccountId}
                        onOpenChange={setAccountDropdownOpen}
                      />
                      <AccountPortalDropdown
                        label={t('subModal.toAccountLabel')}
                        value={toAccountId}
                        accounts={destinationOptions}
                        balances={accountBalances}
                        disabled={accounts.length < 2}
                        onChange={setToAccountId}
                        onOpenChange={setAccountDropdownOpen}
                      />
                    </div>

                    {isCrossCurrency ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label
                              htmlFor="sub-amount-input"
                              className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                            >
                              {t('subModal.amountSentLabel')} ({sourceAccount?.currency})
                            </label>
                            <input
                              id="sub-amount-input"
                              type="number"
                              step="0.01"
                              min="0"
                              value={amountInput}
                              onChange={(e) => setAmountInput(e.target.value)}
                              placeholder="0.00"
                              className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white placeholder:text-white/30 outline-none tabular-nums transition-all"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="sub-to-amount-input"
                              className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                            >
                              {t('subModal.amountReceivedLabel')} ({destinationAccount?.currency})
                            </label>
                            <input
                              id="sub-to-amount-input"
                              type="number"
                              step="0.01"
                              min="0"
                              value={toAmountInput}
                              onChange={(e) => setToAmountInput(e.target.value)}
                              placeholder="0.00"
                              className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white placeholder:text-white/30 outline-none tabular-nums transition-all"
                            />
                          </div>
                        </div>

                        {impliedRate !== null && (
                          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/25 px-3.5 py-2 text-[13px]">
                            <span className="text-[#B8B8BE]">{t('txModal.impliedRateLabel')}</span>
                            <span className="font-display font-semibold text-dynamic-accent tabular-nums">
                              1 {sourceAccount?.currency} = {impliedRate.toFixed(4)}{' '}
                              {destinationAccount?.currency}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label
                          htmlFor="sub-amount-input"
                          className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                        >
                          {linkedLoanId
                            ? t('loanPayModal.principalLabel')
                            : t('subModal.amountLabel')}{' '}
                          ({sourceAccount?.currency ?? 'USD'})
                        </label>
                        <input
                          id="sub-amount-input"
                          type="number"
                          step="0.01"
                          min="0"
                          value={amountInput}
                          onChange={(e) => setAmountInput(e.target.value)}
                          placeholder="0.00"
                          className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white placeholder:text-white/30 outline-none tabular-nums transition-all"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <AccountPortalDropdown
                        label={t('subModal.accountLabel')}
                        value={accountId}
                        accounts={accounts}
                        balances={accountBalances}
                        onChange={setAccountId}
                        onOpenChange={setAccountDropdownOpen}
                      />

                      <div>
                        <label
                          htmlFor="sub-amount-input"
                          className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                        >
                          {linkedLoanId
                            ? t('loanPayModal.principalLabel')
                            : t('subModal.amountLabel')}{' '}
                          ({sourceAccount?.currency ?? 'USD'})
                        </label>
                        <input
                          id="sub-amount-input"
                          type="number"
                          step="0.01"
                          min="0"
                          value={amountInput}
                          onChange={(e) => setAmountInput(e.target.value)}
                          placeholder="0.00"
                          className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white placeholder:text-white/30 outline-none tabular-nums transition-all"
                        />
                      </div>
                    </div>

                    {/* Optional Linked Loan Selector */}
                    {(availableLoans.length > 0 || Boolean(linkedLoanId)) && (
                      <div>
                        <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                          {t('subModal.linkedLoanLabel')}
                        </span>
                        <button
                          type="button"
                          disabled={isEditLocked}
                          onClick={() => {
                            if (!isEditLocked) setLoanDropdownOpen(true);
                          }}
                          aria-expanded={!isEditLocked && loanDropdownOpen}
                          className={`focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3 text-left transition-all ${
                            isEditLocked
                              ? 'opacity-65 cursor-not-allowed'
                              : 'hover:border-white/[0.18]'
                          }`}
                        >
                          {selectedLoan ? (
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <HandCoins className="h-4 w-4 shrink-0 text-dynamic-accent" />
                              <span className="truncate text-sm font-medium text-white">
                                {selectedLoan.counterparty
                                  ? `${selectedLoan.title} · ${selectedLoan.counterparty}`
                                  : selectedLoan.title}
                              </span>
                              <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-[#B8B8BE]">
                                {formatCurrencyAmount(
                                  getLoanRemaining(selectedLoan),
                                  selectedLoan.currency
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-[#B8B8BE] truncate">
                              {t('subModal.linkedLoanNone')}
                            </span>
                          )}
                          {isEditLocked ? (
                            <Lock className="h-4 w-4 shrink-0 text-[#8E8E93]" />
                          ) : (
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-[#B8B8BE] transition-transform duration-200 ${
                                loanDropdownOpen ? 'rotate-180' : ''
                              }`}
                            />
                          )}
                        </button>
                        {isEditLocked ? (
                          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#8E8E93]">
                            <Lock className="h-3 w-3 shrink-0" />
                            <span>{t('subModal.lockedAccountingHint')}</span>
                          </p>
                        ) : (
                          selectedLoan && (
                            <p className="mt-1.5 text-[12px] text-[#B8B8BE]">
                              {t('subModal.finalInstallmentHint')}
                            </p>
                          )
                        )}
                      </div>
                    )}

                    {/* Optional Interest / Fee for Linked Loan */}
                    {linkedLoanId && (
                      <div className="space-y-3">
                        <div>
                          <label
                            htmlFor="sub-interest-input"
                            className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                          >
                            {t('loanPayModal.interestLabel')} ({sourceAccount?.currency ?? 'USD'})
                          </label>
                          <input
                            id="sub-interest-input"
                            type="number"
                            step="0.01"
                            min="0"
                            value={interestAmountInput}
                            onChange={(e) => setInterestAmountInput(e.target.value)}
                            placeholder="0.00"
                            className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white placeholder:text-white/30 outline-none tabular-nums transition-all"
                          />
                          <p className="mt-1.5 text-[12px] text-[#8E8E93]">
                            {t('loanPayModal.interestHint')}
                          </p>
                        </div>

                        {Number(interestAmountInput || '0') > 0 && (
                          <div>
                            <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                              {t('loanPayModal.interestCategoryLabel')}
                            </span>
                            {matchingCategories.length === 0 ? (
                              <div className="h-12 flex items-center rounded-xl border border-white/[0.08] bg-black/25 px-3.5 text-[13px] text-[#B8B8BE] truncate">
                                {t('subModal.noCategoriesPrompt')}
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={isEditLocked}
                                  onClick={() => {
                                    if (!isEditLocked) setInterestCategoryDropdownOpen(true);
                                  }}
                                  aria-expanded={!isEditLocked && interestCategoryDropdownOpen}
                                  className={`focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3 text-left transition-all ${
                                    isEditLocked
                                      ? 'opacity-65 cursor-not-allowed'
                                      : 'hover:border-white/[0.18]'
                                  }`}
                                >
                                  {(() => {
                                    const selectedInterestCat = matchingCategories.find(
                                      (c) => c.id === interestCategoryId
                                    );
                                    return selectedInterestCat ? (
                                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <CategoryIconBadge
                                          iconId={selectedInterestCat.iconId}
                                          color={selectedInterestCat.color}
                                          size="sm"
                                        />
                                        <span className="truncate text-sm font-medium text-white">
                                          {selectedInterestCat.name}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-sm text-[#B8B8BE] truncate">
                                        {t('subModal.categoryPlaceholder')}
                                      </span>
                                    );
                                  })()}
                                  {isEditLocked ? (
                                    <Lock className="h-4 w-4 shrink-0 text-[#8E8E93]" />
                                  ) : (
                                    <ChevronDown
                                      className={`h-4 w-4 shrink-0 text-[#B8B8BE] transition-transform duration-200 ${
                                        interestCategoryDropdownOpen ? 'rotate-180' : ''
                                      }`}
                                    />
                                  )}
                                </button>
                                {isEditLocked && (
                                  <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#8E8E93]">
                                    <Lock className="h-3 w-3 shrink-0" />
                                    <span>{t('subModal.lockedAccountingHint')}</span>
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Matching Category Dropdown (hidden when linked to a loan) */}
                    {!linkedLoanId && (
                      <div>
                        <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                          {t('subModal.categoryLabel')}
                        </span>
                        {matchingCategories.length === 0 ? (
                          <div className="h-12 flex items-center rounded-xl border border-white/[0.08] bg-black/25 px-3.5 text-[13px] text-[#B8B8BE] truncate">
                            {t('subModal.noCategoriesPrompt')}
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={isEditLocked}
                              onClick={() => {
                                if (!isEditLocked) setCategoryDropdownOpen(true);
                              }}
                              aria-expanded={!isEditLocked && categoryDropdownOpen}
                              className={`focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3 text-left transition-all ${
                                isEditLocked
                                  ? 'opacity-65 cursor-not-allowed'
                                  : 'hover:border-white/[0.18]'
                              }`}
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
                                <span className="text-sm text-[#B8B8BE] truncate">
                                  {t('subModal.categoryPlaceholder')}
                                </span>
                              )}
                              {isEditLocked ? (
                                <Lock className="h-4 w-4 shrink-0 text-[#8E8E93]" />
                              ) : (
                                <ChevronDown
                                  className={`h-4 w-4 shrink-0 text-[#B8B8BE] transition-transform duration-200 ${
                                    categoryDropdownOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              )}
                            </button>
                            {isEditLocked && (
                              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#8E8E93]">
                                <Lock className="h-3 w-3 shrink-0" />
                                <span>{t('subModal.lockedAccountingHint')}</span>
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Frequency Selector */}
                <div>
                  <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                    {t('subModal.frequencyLabel')}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 rounded-2xl bg-black/30 border border-white/[0.06]">
                    {FREQUENCIES.map((freq) => {
                      const active = frequency === freq;
                      return (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => setFrequency(freq)}
                          className={`relative min-h-[40px] rounded-xl px-2 text-[13px] font-medium transition-colors ${
                            active ? 'text-white' : 'text-[#B8B8BE] hover:text-white'
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="sub-freq-pill"
                              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                              className="bg-dynamic-accent-soft border-dynamic-accent absolute inset-0 rounded-xl border"
                            />
                          )}
                          <span className="relative z-10">{t(`subs.freq.${freq}` as const)}</span>
                        </button>
                      );
                    })}
                  </div>
                  {isEditLocked && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#8E8E93]">
                      <Lock className="h-3 w-3 shrink-0" />
                      <span>{t('subModal.lockedAccountingHint')}</span>
                    </p>
                  )}
                </div>

                {/* Next Date + Icon Dropdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <GlassDatePicker
                    label={t('subModal.nextDateLabel')}
                    value={nextBillingDate}
                    onChange={setNextBillingDate}
                  />

                  <div>
                    <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                      {t('subModal.iconLabel')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIconDropdownOpen(true)}
                      aria-expanded={iconDropdownOpen}
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

                {/* Color Swatches + Custom Hex */}
                <div>
                  <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                    {t('subModal.colorLabel')}
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
                      aria-label={t('subModal.colorLabel')}
                      className="focus-dynamic-accent h-9 w-24 rounded-xl bg-black/30 border border-white/[0.08] px-2.5 font-mono text-xs text-white outline-none"
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{t('subModal.activeLabel')}</p>
                    <p className="text-[13px] text-[#B8B8BE]">{t('subModal.activeHint')}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    onClick={() => setIsActive((prev) => !prev)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors p-0.5 ${
                      isActive
                        ? 'bg-dynamic-accent border-dynamic-accent'
                        : 'bg-black/40 border-white/[0.14]'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-[#1A1A1C] shadow transition-transform ${
                        isActive ? 'translate-x-5' : 'translate-x-0 bg-white/75'
                      }`}
                    />
                  </button>
                </div>

                {error && (
                  <p className="rounded-xl border border-coral/30 bg-coral/10 px-3.5 py-2.5 text-[13px] text-coral">
                    {error}
                  </p>
                )}
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
                  disabled={!canSubmit}
                  style={{ color: 'var(--accent-foreground)' }}
                  className="bg-dynamic-accent h-11 rounded-xl px-5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
                >
                  {editingSubscription ? t('subModal.saveEdit') : t('subModal.saveNew')}
                </button>
              </div>
            </form>
          </motion.div>

          <GlassSelectModal
            isOpen={!isEditLocked && loanDropdownOpen}
            title={t('subModal.linkedLoanLabel')}
            value={linkedLoanId}
            options={loanOptions}
            searchable={availableLoans.length > 5}
            onSelect={setLinkedLoanId}
            onClose={() => setLoanDropdownOpen(false)}
          />

          <GlassSelectModal
            isOpen={!isEditLocked && categoryDropdownOpen}
            title={t('subModal.categoryLabel')}
            value={categoryId}
            options={categoryOptions}
            searchable={matchingCategories.length > 5}
            onSelect={setCategoryId}
            onClose={() => setCategoryDropdownOpen(false)}
          />

          <GlassSelectModal
            isOpen={!isEditLocked && interestCategoryDropdownOpen}
            title={t('loanPayModal.interestCategoryLabel')}
            value={interestCategoryId}
            options={categoryOptions}
            searchable={matchingCategories.length > 5}
            onSelect={setInterestCategoryId}
            onClose={() => setInterestCategoryDropdownOpen(false)}
          />

          <GlassSelectModal
            isOpen={iconDropdownOpen}
            title={t('subModal.iconLabel')}
            value={iconId}
            options={iconOptions}
            groups={iconGroups}
            layout="grid"
            searchable
            searchPlaceholder={t('categoryModal.iconSearch')}
            onSelect={setIconId}
            onClose={() => setIconDropdownOpen(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
