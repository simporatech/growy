import { UserProfile } from '../context/AuthContext';
import { BillingFrequency, Loan, Subscription, Transaction, TransactionType } from '../types/finance';
import { formatDateYYYYMMDD } from './localeDetection';

export interface AutoBillingSummaryItem {
  subscriptionId: string;
  kind: TransactionType;
  name: string;
  cyclesProcessed: number;
  totalAmount: number;
  currency: string;
  totalGlobalAmount: number;
}

export interface AutoBillingResult {
  generatedTransactions: Transaction[];
  updatedSubscriptions: Subscription[];
  updatedLoans?: Loan[];
  summaryItems: AutoBillingSummaryItem[];
  totalGlobalCharged: number;
}

function addCalendarMonths(year: number, month: number, day: number, monthsToAdd: number): string {
  const totalMonths = month - 1 + monthsToAdd;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonthZeroIndexed = ((totalMonths % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonthZeroIndexed + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDay);
  return `${targetYear}-${String(targetMonthZeroIndexed + 1).padStart(2, '0')}-${String(
    clampedDay
  ).padStart(2, '0')}`;
}

export function advanceBillingDate(dateStr: string, frequency: BillingFrequency): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!match) return dateStr;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  switch (frequency) {
    case 'weekly': {
      const next = new Date(year, month - 1, day + 7);
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(
        next.getDate()
      ).padStart(2, '0')}`;
    }
    case 'biweekly': {
      const next = new Date(year, month - 1, day + 14);
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(
        next.getDate()
      ).padStart(2, '0')}`;
    }
    case 'monthly':
      return addCalendarMonths(year, month, day, 1);
    case 'quarterly':
      return addCalendarMonths(year, month, day, 3);
    case 'annual':
      return addCalendarMonths(year, month, day, 12);
  }
}

/**
 * Pure, deterministic processor that generates real expense, income, transfer, or
 * loan-repayment transactions for every active recurring rule whose nextBillingDate <= today
 * (in the user's timezone) and advances nextBillingDate cycle-by-cycle past today.
 */
export function processDueSubscriptions(
  user: UserProfile,
  convertCurrency: (amount: number, fromCurrency: string, toCurrency?: string) => number,
  globalCurrency: string
): AutoBillingResult | null {
  const subscriptions = user.data.subscriptions ?? [];
  if (subscriptions.length === 0) return null;

  const todayStr = formatDateYYYYMMDD(new Date(), user.preferences.timezone);
  const accountMap = new Map(user.data.accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(user.data.budgets.map((c) => [c.id, c]));
  const loanMap = new Map((user.data.loans ?? []).map((l) => [l.id, l]));

  const generatedTransactions: Transaction[] = [];
  const summaryItems: AutoBillingSummaryItem[] = [];
  const loanPaidDelta = new Map<string, number>();
  let totalGlobalCharged = 0;
  let hasAnyUpdates = false;
  let hasDeactivatedSubs = false;

  const getLoanRemainingLive = (loan: Loan): number =>
    Math.max(
      0,
      loan.principalAmount - ((Number(loan.paidAmount) || 0) + (loanPaidDelta.get(loan.id) ?? 0))
    );

  const updatedSubscriptions = subscriptions.map((sub) => {
    if (!sub.isActive) {
      return sub;
    }

    const linkedLoan = sub.linkedLoanId ? loanMap.get(sub.linkedLoanId) : undefined;
    const interestNative = Math.max(0, Number(sub.interestAmount) || 0);
    if (linkedLoan && getLoanRemainingLive(linkedLoan) <= 0 && interestNative <= 0) {
      hasDeactivatedSubs = true;
      return { ...sub, isActive: false };
    }

    if (!sub.nextBillingDate || sub.nextBillingDate > todayStr) {
      return sub;
    }

    const kind: TransactionType = linkedLoan
      ? linkedLoan.direction === 'payable'
        ? 'expense'
        : 'income'
      : sub.kind ?? 'expense';
    const srcAccount = accountMap.get(sub.accountId);
    const srcCurrency = srcAccount?.currency ?? globalCurrency;
    const linkedCategory =
      !linkedLoan && kind !== 'transfer' && sub.categoryId
        ? categoryMap.get(sub.categoryId)
        : undefined;

    let cursorDate = sub.nextBillingDate;
    let cyclesProcessed = 0;
    let subTotalNative = 0;
    let subTotalGlobal = 0;
    let shouldDeactivateSub = false;
    const MAX_CYCLES_PER_PASS = 120;

    while (cursorDate <= todayStr && cyclesProcessed < MAX_CYCLES_PER_PASS) {
      if (linkedLoan && getLoanRemainingLive(linkedLoan) <= 0) {
        shouldDeactivateSub = true;
        break;
      }

      if (linkedLoan) {
        const remainingBefore = getLoanRemainingLive(linkedLoan);
        const fullPrincipalInLoanCurrency =
          srcCurrency === linkedLoan.currency
            ? sub.amount
            : convertCurrency(sub.amount, srcCurrency, linkedLoan.currency);
        const actualPrincipalInLoanCurrency = Math.min(
          fullPrincipalInLoanCurrency,
          remainingBefore
        );
        const actualPrincipalInSrcCurrency =
          srcCurrency === linkedLoan.currency
            ? actualPrincipalInLoanCurrency
            : convertCurrency(actualPrincipalInLoanCurrency, linkedLoan.currency, srcCurrency);

        const isEs = user.preferences.language === 'es';
        const loanPaymentPrefix = isEs ? 'Abono a préstamo' : 'Loan payment';
        const interestPrefix = isEs ? 'Intereses de préstamo' : 'Loan interest';
        const isOperationalLoan =
          !linkedLoan.affectsAccountOnCreate && Boolean(linkedLoan.categoryId);
        const operationalCategory =
          isOperationalLoan && linkedLoan.categoryId
            ? categoryMap.get(linkedLoan.categoryId)
            : undefined;
        const txType = linkedLoan.direction === 'payable' ? 'expense' : 'income';

        let cycleNativeTotal = 0;
        let cycleGlobalTotal = 0;

        if (actualPrincipalInLoanCurrency > 0) {
          const principalGlobal = convertCurrency(
            actualPrincipalInSrcCurrency,
            srcCurrency,
            globalCurrency
          );
          generatedTransactions.push({
            id: crypto.randomUUID(),
            type: txType,
            date: cursorDate,
            accountId: sub.accountId,
            amount: actualPrincipalInSrcCurrency,
            toAmount: actualPrincipalInLoanCurrency,
            categoryId: isOperationalLoan ? linkedLoan.categoryId : undefined,
            category: isOperationalLoan ? operationalCategory?.name : undefined,
            loanId: linkedLoan.id,
            loanEntryKind: 'repayment',
            recurringId: sub.id,
            excludeFromCashFlow: !isOperationalLoan,
            globalAmountSnapshot: principalGlobal,
            snapshotCurrency: globalCurrency,
            description: `${loanPaymentPrefix}: ${linkedLoan.title} (${sub.name})`,
            createdAt: new Date().toISOString(),
          });

          loanPaidDelta.set(
            linkedLoan.id,
            (loanPaidDelta.get(linkedLoan.id) ?? 0) + actualPrincipalInLoanCurrency
          );
          cycleNativeTotal += actualPrincipalInSrcCurrency;
          cycleGlobalTotal += principalGlobal;
        }

        if (interestNative > 0) {
          const interestGlobal = convertCurrency(interestNative, srcCurrency, globalCurrency);
          const interestCat = sub.interestCategoryId
            ? categoryMap.get(sub.interestCategoryId)
            : undefined;
          generatedTransactions.push({
            id: crypto.randomUUID(),
            type: txType,
            date: cursorDate,
            accountId: sub.accountId,
            amount: interestNative,
            categoryId: sub.interestCategoryId,
            category: interestCat?.name,
            loanId: linkedLoan.id,
            recurringId: sub.id,
            excludeFromCashFlow: false,
            globalAmountSnapshot: interestGlobal,
            snapshotCurrency: globalCurrency,
            description: `${interestPrefix}: ${linkedLoan.title} (${sub.name})`,
            createdAt: new Date().toISOString(),
          });
          cycleNativeTotal += interestNative;
          cycleGlobalTotal += interestGlobal;
        }

        cyclesProcessed += 1;
        subTotalNative += cycleNativeTotal;
        subTotalGlobal += cycleGlobalTotal;
        cursorDate = advanceBillingDate(cursorDate, sub.frequency);

        if (getLoanRemainingLive(linkedLoan) <= 0) {
          shouldDeactivateSub = true;
        }
        continue;
      }

      const globalAmountSnapshot = convertCurrency(sub.amount, srcCurrency, globalCurrency);

      if (kind === 'transfer') {
        generatedTransactions.push({
          id: crypto.randomUUID(),
          type: 'transfer',
          date: cursorDate,
          accountId: sub.accountId,
          amount: sub.amount,
          toAccountId: sub.toAccountId,
          toAmount: sub.toAmount ?? sub.amount,
          recurringId: sub.id,
          globalAmountSnapshot,
          snapshotCurrency: globalCurrency,
          description: `${sub.name} (Auto-billing)`,
          createdAt: new Date().toISOString(),
        });
      } else {
        generatedTransactions.push({
          id: crypto.randomUUID(),
          type: kind,
          date: cursorDate,
          accountId: sub.accountId,
          amount: sub.amount,
          categoryId: sub.categoryId || undefined,
          category: linkedCategory?.name,
          recurringId: sub.id,
          globalAmountSnapshot,
          snapshotCurrency: globalCurrency,
          description: `${sub.name} (Auto-billing)`,
          createdAt: new Date().toISOString(),
        });
      }

      cyclesProcessed += 1;
      subTotalNative += sub.amount;
      subTotalGlobal += globalAmountSnapshot;
      cursorDate = advanceBillingDate(cursorDate, sub.frequency);
    }

    if (cyclesProcessed > 0) {
      hasAnyUpdates = true;
      totalGlobalCharged += subTotalGlobal;
      summaryItems.push({
        subscriptionId: sub.id,
        kind,
        name: sub.name,
        cyclesProcessed,
        totalAmount: subTotalNative,
        currency: srcCurrency,
        totalGlobalAmount: subTotalGlobal,
      });

      if (shouldDeactivateSub) {
        hasDeactivatedSubs = true;
      }

      return {
        ...sub,
        nextBillingDate: cursorDate,
        isActive: shouldDeactivateSub ? false : sub.isActive,
      };
    }

    if (shouldDeactivateSub) {
      hasDeactivatedSubs = true;
      return { ...sub, isActive: false };
    }

    return sub;
  });

  if (!hasAnyUpdates && !hasDeactivatedSubs) {
    return null;
  }

  let updatedLoans: Loan[] | undefined;
  const settledLoanIds = new Set<string>();
  if (loanPaidDelta.size > 0 && user.data.loans) {
    updatedLoans = user.data.loans.map((loan) => {
      const delta = loanPaidDelta.get(loan.id);
      if (!delta) return loan;
      const nextPaid = Math.max(0, (Number(loan.paidAmount) || 0) + delta);
      if (nextPaid >= loan.principalAmount) {
        settledLoanIds.add(loan.id);
      }
      return {
        ...loan,
        paidAmount: nextPaid,
      };
    });
  }

  const finalSubscriptions =
    settledLoanIds.size > 0
      ? updatedSubscriptions.map((sub) =>
          sub.linkedLoanId && settledLoanIds.has(sub.linkedLoanId) && sub.isActive
            ? { ...sub, isActive: false }
            : sub
        )
      : updatedSubscriptions;

  return {
    generatedTransactions,
    updatedSubscriptions: finalSubscriptions,
    updatedLoans,
    summaryItems,
    totalGlobalCharged,
  };
}
