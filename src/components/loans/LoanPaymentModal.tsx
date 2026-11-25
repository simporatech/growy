import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ChevronDown, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Account, Loan, Transaction } from '../../types/finance';
import { calculateAccountBalance, formatCurrencyAmount } from '../../utils/accountMetrics';
import { getLoanRemaining } from '../../utils/loanMetrics';
import { getTodayLocalDateString } from '../../utils/transactionMetrics';
import { AccountIconBadge } from '../accounts/AccountIconBadge';
import { CategoryIconBadge } from '../budgets/CategoryIconBadge';
import { GlassDatePicker } from '../common/GlassDatePicker';
import { GlassSelectModal } from '../common/GlassSelectModal';

interface LoanPaymentModalProps {
  loan: Loan | null;
  accounts: Account[];
  allTransactions: Transaction[];
  onClose: () => void;
  onSubmitPayment: (
    loanId: string,
    paymentInLoanCurrency: number,
    txs: Array<Omit<Transaction, 'id' | 'createdAt' | 'loanId'>>
  ) => void;
}

export function LoanPaymentModal({
  loan,
  accounts,
  allTransactions,
  onClose,
  onSubmitPayment,
}: LoanPaymentModalProps) {
  const { user } = useAuth();
  const { currency: globalCurrency, convertBetween } = useCurrency();
  const { t } = useLanguage();

  const [date, setDate] = useState(() => getTodayLocalDateString(user?.preferences.timezone));
  const [accountId, setAccountId] = useState('');
  const [principalInput, setPrincipalInput] = useState('');
  const [interestInput, setInterestInput] = useState('0');
  const [accountTotalInput, setAccountTotalInput] = useState('');
  const [interestCategoryId, setInterestCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [interestCategoryOpen, setInterestCategoryOpen] = useState(false);

  const accountBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const acc of accounts) {
      map.set(acc.id, calculateAccountBalance(acc, allTransactions));
    }
    return map;
  }, [accounts, allTransactions]);

  const matchingInterestCategories = useMemo(
    () =>
      (user?.data.budgets ?? []).filter(
        (c) => c.kind === (loan?.direction === 'receivable' ? 'income' : 'expense')
      ),
    [user?.data.budgets, loan?.direction]
  );

  useEffect(() => {
    if (!loan) return;
    const defaultAcc =
      accounts.find((a) => a.currency === loan.currency) ?? accounts[0] ?? null;
    const remaining = getLoanRemaining(loan);
    setDate(getTodayLocalDateString(user?.preferences.timezone));
    setAccountId(defaultAcc?.id ?? '');
    setPrincipalInput(remaining.toFixed(2));
    setInterestInput('0');
    if (defaultAcc) {
      const converted =
        defaultAcc.currency === loan.currency
          ? remaining
          : convertBetween(remaining, loan.currency, defaultAcc.currency);
      setAccountTotalInput(converted.toFixed(2));
    } else {
      setAccountTotalInput(remaining.toFixed(2));
    }
    setInterestCategoryId('');
    setNote('');
    setAccountOpen(false);
    setInterestCategoryOpen(false);
    setError(null);
  }, [loan, accounts, convertBetween, user?.preferences.timezone]);

  useEffect(() => {
    if (!loan) return;
    if (
      interestCategoryId &&
      !matchingInterestCategories.some((c) => c.id === interestCategoryId)
    ) {
      setInterestCategoryId(matchingInterestCategories[0]?.id ?? '');
    } else if (!interestCategoryId && matchingInterestCategories.length > 0) {
      setInterestCategoryId(matchingInterestCategories[0].id);
    }
  }, [loan, interestCategoryId, matchingInterestCategories]);

  useEffect(() => {
    if (!loan) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !accountOpen && !interestCategoryOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loan, accountOpen, interestCategoryOpen, onClose]);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedInterestCategory = matchingInterestCategories.find(
    (c) => c.id === interestCategoryId
  );
  const isCrossCurrency = Boolean(
    loan && selectedAccount && selectedAccount.currency !== loan.currency
  );
  const parsedInterestPreview = Number(interestInput || '0');
  const hasInterest = Number.isFinite(parsedInterestPreview) && parsedInterestPreview > 0;
  const remainingLoanBalance = loan ? getLoanRemaining(loan) : 0;

  const interestCategoryOptions = useMemo(
    () =>
      matchingInterestCategories.map((cat) => ({
        id: cat.id,
        label: cat.name,
        icon: <CategoryIconBadge iconId={cat.iconId} color={cat.color} size="sm" />,
      })),
    [matchingInterestCategories]
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

  const syncAccountTotal = (nextPrincipalStr: string, nextInterestStr: string) => {
    if (!loan || !selectedAccount) return;
    const p = Number(nextPrincipalStr || '0');
    const i = Number(nextInterestStr || '0');
    const total = (Number.isFinite(p) ? p : 0) + (Number.isFinite(i) ? i : 0);
    const converted =
      selectedAccount.currency === loan.currency
        ? total
        : convertBetween(total, loan.currency, selectedAccount.currency);
    setAccountTotalInput(converted.toFixed(2));
  };

  const handlePrincipalChange = (val: string) => {
    setPrincipalInput(val);
    syncAccountTotal(val, interestInput);
  };

  const handleInterestChange = (val: string) => {
    setInterestInput(val);
    syncAccountTotal(principalInput, val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;
    setError(null);

    if (!accountId || !selectedAccount) {
      setError(t('loanPayModal.errorAccount'));
      return;
    }

    const parsedPrincipal = Number(principalInput || '0');
    const parsedInterest = Number(interestInput || '0');

    if (
      !Number.isFinite(parsedPrincipal) ||
      parsedPrincipal < 0 ||
      !Number.isFinite(parsedInterest) ||
      parsedInterest < 0 ||
      parsedPrincipal + parsedInterest <= 0
    ) {
      setError(t('loanPayModal.errorAmount'));
      return;
    }

    if (parsedPrincipal > remainingLoanBalance + 0.005) {
      setError(t('loanPayModal.errorExceedsRemaining'));
      return;
    }

    if (parsedInterest > 0 && !interestCategoryId) {
      setError(t('loanPayModal.errorInterestCategory'));
      return;
    }

    const totalLoanCurrency = parsedPrincipal + parsedInterest;
    const parsedAccountTotal = isCrossCurrency ? Number(accountTotalInput) : totalLoanCurrency;
    if (!Number.isFinite(parsedAccountTotal) || parsedAccountTotal <= 0) {
      setError(t('loanPayModal.errorAmount'));
      return;
    }

    const accountPrincipal =
      parsedPrincipal <= 0
        ? 0
        : isCrossCurrency
          ? parsedAccountTotal * (parsedPrincipal / totalLoanCurrency)
          : parsedPrincipal;
    const accountInterest =
      parsedInterest <= 0
        ? 0
        : isCrossCurrency
          ? parsedAccountTotal - accountPrincipal
          : parsedInterest;

    const txType = loan.direction === 'payable' ? 'expense' : 'income';
    const baseDesc = t('loanPayModal.paymentDesc').replace('{title}', loan.title);
    const interestDesc = t('loanPayModal.interestDesc').replace('{title}', loan.title);
    const isOperational = !loan.affectsAccountOnCreate && Boolean(loan.categoryId);
    const linkedCategory = isOperational
      ? (user?.data.budgets ?? []).find((c) => c.id === loan.categoryId)
      : undefined;

    const txsToCreate: Array<Omit<Transaction, 'id' | 'createdAt' | 'loanId'>> = [];

    if (parsedPrincipal > 0) {
      txsToCreate.push({
        type: txType,
        date,
        accountId: selectedAccount.id,
        amount: accountPrincipal,
        toAmount: parsedPrincipal,
        categoryId: isOperational ? loan.categoryId : undefined,
        category: isOperational ? linkedCategory?.name : undefined,
        loanEntryKind: 'repayment',
        excludeFromCashFlow: !isOperational,
        globalAmountSnapshot: convertBetween(parsedPrincipal, loan.currency, globalCurrency),
        snapshotCurrency: globalCurrency,
        description: note.trim() ? `${baseDesc} — ${note.trim()}` : baseDesc,
      });
    }

    if (parsedInterest > 0) {
      txsToCreate.push({
        type: txType,
        date,
        accountId: selectedAccount.id,
        amount: accountInterest,
        categoryId: interestCategoryId,
        category: selectedInterestCategory?.name,
        excludeFromCashFlow: false,
        globalAmountSnapshot: convertBetween(parsedInterest, loan.currency, globalCurrency),
        snapshotCurrency: globalCurrency,
        description: note.trim() ? `${interestDesc} — ${note.trim()}` : interestDesc,
      });
    }

    onSubmitPayment(loan.id, parsedPrincipal, txsToCreate);
    onClose();
  };

  const modalContent = (
    <AnimatePresence>
      {loan && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => {
            if ((e.target as HTMLElement)?.closest?.('[data-portal-popover="true"]')) return;
            if (accountOpen || interestCategoryOpen) return;
            onClose();
          }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="loan-payment-title"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.08]">
              <h2 id="loan-payment-title" className="font-display text-lg font-semibold text-white">
                {t('loanPayModal.title')}
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
              <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-4">
                {accounts.length === 0 && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{t('loanPayModal.noAccounts')}</span>
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Loan Remaining Summary */}
                <div className="rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{loan.title}</p>
                    <p className="text-[12px] text-[#8E8E93]">{t('loanPayModal.remainingLabel')}</p>
                  </div>
                  <span className="font-display text-lg font-bold text-dynamic-accent tabular-nums shrink-0">
                    {formatCurrencyAmount(getLoanRemaining(loan), loan.currency)}
                  </span>
                </div>

                {/* Date & Account */}
                <GlassDatePicker
                  label={t('loanPayModal.dateLabel')}
                  value={date}
                  onChange={setDate}
                />

                <div>
                  <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                    {t('loanPayModal.accountLabel')}
                  </span>
                  <button
                    type="button"
                    disabled={accounts.length === 0}
                    onClick={() => setAccountOpen(true)}
                    className="focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3 text-left transition-all hover:border-white/[0.18] disabled:opacity-50"
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
                        {t('loanPayModal.accountLabel')}
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B8BE]" />
                  </button>
                </div>

                {/* Principal & Optional Interest Split */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="loan-pay-principal"
                      className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                    >
                      {t('loanPayModal.principalLabel')} ({loan.currency})
                    </label>
                    <input
                      id="loan-pay-principal"
                      type="number"
                      step="0.01"
                      min="0"
                      max={remainingLoanBalance}
                      value={principalInput}
                      onChange={(e) => handlePrincipalChange(e.target.value)}
                      placeholder="0.00"
                      className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white outline-none tabular-nums"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="loan-pay-interest"
                      className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                    >
                      {t('loanPayModal.interestLabel')} ({loan.currency})
                    </label>
                    <input
                      id="loan-pay-interest"
                      type="number"
                      step="0.01"
                      min="0"
                      value={interestInput}
                      onChange={(e) => handleInterestChange(e.target.value)}
                      placeholder="0.00"
                      className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white outline-none tabular-nums"
                    />
                  </div>
                </div>
                <p className="-mt-2 text-[12px] text-[#8E8E93]">{t('loanPayModal.interestHint')}</p>

                {isCrossCurrency && (
                  <div>
                    <label
                      htmlFor="loan-pay-acc-total"
                      className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                    >
                      {t('loanPayModal.accountAmountLabel')} ({selectedAccount?.currency})
                    </label>
                    <input
                      id="loan-pay-acc-total"
                      type="number"
                      step="0.01"
                      min="0"
                      value={accountTotalInput}
                      onChange={(e) => setAccountTotalInput(e.target.value)}
                      className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white outline-none tabular-nums"
                    />
                  </div>
                )}

                {hasInterest && (
                  <div>
                    <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                      {t('loanPayModal.interestCategoryLabel')}
                    </span>
                    {matchingInterestCategories.length === 0 ? (
                      <div className="h-12 flex items-center rounded-xl border border-white/[0.08] bg-black/25 px-3.5 text-[13px] text-[#B8B8BE] truncate">
                        {t('loanModal.noCategoriesPrompt')}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setInterestCategoryOpen(true)}
                        className="focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3 text-left transition-all hover:border-white/[0.18]"
                      >
                        {selectedInterestCategory ? (
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <CategoryIconBadge
                              iconId={selectedInterestCategory.iconId}
                              color={selectedInterestCategory.color}
                              size="sm"
                            />
                            <span className="truncate text-sm font-medium text-white">
                              {selectedInterestCategory.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-[#B8B8BE] truncate">
                            {t('loanModal.categoryPlaceholder')}
                          </span>
                        )}
                        <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B8BE]" />
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="loan-pay-note"
                    className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                  >
                    {t('loanPayModal.noteLabel')}
                  </label>
                  <input
                    id="loan-pay-note"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('loanPayModal.notePlaceholder')}
                    className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-sm text-white placeholder:text-white/30 outline-none"
                  />
                </div>
              </div>

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
                  disabled={accounts.length === 0}
                  style={{ color: 'var(--accent-foreground)' }}
                  className="bg-dynamic-accent h-11 rounded-xl px-5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {t('loanPayModal.submit')}
                </button>
              </div>
            </form>
          </motion.div>

          <GlassSelectModal
            isOpen={accountOpen}
            title={t('loanPayModal.accountLabel')}
            value={accountId}
            options={accountOptions}
            searchable={accounts.length > 6}
            onSelect={(nextId) => {
              setAccountId(nextId);
              const nextAcc = accounts.find((a) => a.id === nextId);
              if (loan && nextAcc) {
                const p = Number(principalInput || '0');
                const i = Number(interestInput || '0');
                const total = (Number.isFinite(p) ? p : 0) + (Number.isFinite(i) ? i : 0);
                const converted =
                  nextAcc.currency === loan.currency
                    ? total
                    : convertBetween(total, loan.currency, nextAcc.currency);
                setAccountTotalInput(converted.toFixed(2));
              }
            }}
            onClose={() => setAccountOpen(false)}
          />

          <GlassSelectModal
            isOpen={interestCategoryOpen}
            title={t('loanPayModal.interestCategoryLabel')}
            value={interestCategoryId}
            options={interestCategoryOptions}
            searchable={matchingInterestCategories.length > 5}
            onSelect={setInterestCategoryId}
            onClose={() => setInterestCategoryOpen(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}

