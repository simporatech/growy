import { Account, BudgetCategory, Loan, Subscription, Transaction } from '../types/finance';
import { formatCurrencyAmount } from './accountMetrics';
import { formatDateYYYYMMDD } from './localeDetection';
import { getLoanRemaining, isLoanSettled } from './loanMetrics';
import { advanceBillingDate } from './subscriptionAutomation';
import { getTransactionGlobalAmount, parseLocalDate } from './transactionMetrics';

export type ProjectionHorizon = 'this_month' | 'this_year';

export interface ProjectionPoint {
  key: string;
  label: string;
  isElapsed: boolean;
  isToday: boolean;
  realBalance: number;
  planBalance: number;
  events: string[];
}

export interface ProjectionResult {
  horizon: ProjectionHorizon;
  points: ProjectionPoint[];
  todayIndex: number;
  startBalance: number;
  projectedRealEnd: number;
  projectedPlanEnd: number;
  projectedNetChange: number;
  hasBudgetsOrGoals: boolean;
}

function toYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function buildFinancialProjection({
  horizon,
  availableCash,
  accounts,
  transactions,
  categories,
  subscriptions,
  loans,
  convertToGlobal,
  globalCurrency,
  locale,
  timeZone,
}: {
  horizon: ProjectionHorizon;
  availableCash: number;
  accounts: Account[];
  transactions: Transaction[];
  categories: BudgetCategory[];
  subscriptions: Subscription[];
  loans: Loan[];
  convertToGlobal: (amount: number, fromCurrency: string) => number;
  globalCurrency: string;
  locale: 'en' | 'es';
  timeZone?: string;
}): ProjectionResult {
  const accountCurrencyMap = new Map(accounts.map((a) => [a.id, a.currency]));
  const todayStr = formatDateYYYYMMDD(new Date(), timeZone);
  const todayDate = parseLocalDate(todayStr);
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth();

  const horizonEndStr =
    horizon === 'this_month'
      ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
          new Date(currentYear, currentMonth + 1, 0).getDate()
        ).padStart(2, '0')}`
      : `${currentYear}-12-31`;

  // 1. Historical daily transaction net deltas (all transactions affect account balance)
  const txDeltaByDay = new Map<string, number>();
  for (const tx of transactions) {
    const dayKey = tx.date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey) || dayKey > todayStr) continue;
    const cur = accountCurrencyMap.get(tx.accountId) ?? globalCurrency;
    const amt = getTransactionGlobalAmount(tx, cur, convertToGlobal, globalCurrency);
    const delta = tx.type === 'income' ? amt : tx.type === 'expense' ? -amt : 0;
    txDeltaByDay.set(dayKey, (txDeltaByDay.get(dayKey) ?? 0) + delta);
  }

  // 2. Average daily variable (non-recurring operational) net spending over last 30 days
  const cutoff30 = new Date(todayDate);
  cutoff30.setDate(cutoff30.getDate() - 29);
  const cutoff30Str = toYYYYMMDD(cutoff30);
  let varExpense30 = 0;
  let varIncome30 = 0;
  for (const tx of transactions) {
    if (tx.excludeFromCashFlow || tx.recurringId) continue;
    const dayKey = tx.date.slice(0, 10);
    if (dayKey < cutoff30Str || dayKey > todayStr) continue;
    const cur = accountCurrencyMap.get(tx.accountId) ?? globalCurrency;
    const amt = getTransactionGlobalAmount(tx, cur, convertToGlobal, globalCurrency);
    if (tx.type === 'expense') varExpense30 += amt;
    else if (tx.type === 'income') varIncome30 += amt;
  }
  const avgDailyVarNet = (varIncome30 - varExpense30) / 30;

  // 3. Forward scheduled recurring events (with smart loan clamping) & unsettled loan due dates
  const forwardDeltaByDay = new Map<string, number>();
  const forwardEventsByDay = new Map<string, string[]>();
  const loanRemainingMap = new Map<string, number>();
  const loansCoveredByRecurring = new Set<string>();

  for (const loan of loans) {
    if (!isLoanSettled(loan)) {
      loanRemainingMap.set(loan.id, getLoanRemaining(loan));
    }
  }

  const pushEvent = (dateKey: string, delta: number, label: string) => {
    forwardDeltaByDay.set(dateKey, (forwardDeltaByDay.get(dateKey) ?? 0) + delta);
    const existing = forwardEventsByDay.get(dateKey) ?? [];
    existing.push(label);
    forwardEventsByDay.set(dateKey, existing);
  };

  for (const sub of subscriptions) {
    if (!sub.isActive || !sub.nextBillingDate) continue;
    const srcCur = accountCurrencyMap.get(sub.accountId) ?? globalCurrency;
    const kind = sub.kind ?? 'expense';
    if (kind === 'transfer') continue;

    if (sub.linkedLoanId) {
      loansCoveredByRecurring.add(sub.linkedLoanId);
    }

    let cursor = sub.nextBillingDate;
    let guard = 0;
    while (cursor <= horizonEndStr && guard < 120) {
      guard += 1;
      if (cursor > todayStr) {
        if (sub.linkedLoanId) {
          const linkedLoan = loans.find((l) => l.id === sub.linkedLoanId);
          if (linkedLoan) {
            const remLoan = loanRemainingMap.get(linkedLoan.id) ?? 0;
            if (remLoan <= 0) break;
            const fullInLoan =
              srcCur === linkedLoan.currency
                ? sub.amount
                : convertToGlobal(sub.amount, srcCur) /
                  Math.max(0.000001, convertToGlobal(1, linkedLoan.currency));
            const actualLoan = Math.min(fullInLoan, remLoan);
            loanRemainingMap.set(linkedLoan.id, Math.max(0, remLoan - actualLoan));

            const actualGlobal = convertToGlobal(actualLoan, linkedLoan.currency);
            const interestGlobal = convertToGlobal(Number(sub.interestAmount) || 0, srcCur);
            const totalGlobal = actualGlobal + interestGlobal;
            const sign = linkedLoan.direction === 'payable' ? -1 : 1;
            pushEvent(
              cursor,
              sign * totalGlobal,
              `${sub.name} (${sign > 0 ? '+' : '−'}${formatCurrencyAmount(totalGlobal, globalCurrency)})`
            );
          }
        } else {
          const globalAmt = convertToGlobal(sub.amount, srcCur);
          const sign = kind === 'income' ? 1 : -1;
          pushEvent(
            cursor,
            sign * globalAmt,
            `${sub.name} (${sign > 0 ? '+' : '−'}${formatCurrencyAmount(globalAmt, globalCurrency)})`
          );
        }
      }
      const next = advanceBillingDate(cursor, sub.frequency);
      if (next === cursor) break;
      cursor = next;
    }
  }

  // Unsettled loans not covered by an active recurring rule
  const loanEventsByDay = new Map<string, number>();
  for (const loan of loans) {
    if (isLoanSettled(loan) || loansCoveredByRecurring.has(loan.id)) continue;
    if (loan.dueDate > todayStr && loan.dueDate <= horizonEndStr) {
      const remGlobal = convertToGlobal(getLoanRemaining(loan), loan.currency);
      const sign = loan.direction === 'receivable' ? 1 : -1;
      loanEventsByDay.set(loan.dueDate, (loanEventsByDay.get(loan.dueDate) ?? 0) + sign * remGlobal);
      pushEvent(
        loan.dueDate,
        sign * remGlobal,
        `${loan.title} (${sign > 0 ? '+' : '−'}${formatCurrencyAmount(remGlobal, globalCurrency)})`
      );
    }
  }

  // 4. Budgets & Goals monthly net target
  let totalMonthlyIncomeGoal = 0;
  let totalMonthlyExpenseBudget = 0;
  for (const cat of categories) {
    const targetGlobal = convertToGlobal(cat.targetAmount, cat.currency || globalCurrency);
    if (cat.kind === 'income') totalMonthlyIncomeGoal += targetGlobal;
    else totalMonthlyExpenseBudget += targetGlobal;
  }
  const hasBudgetsOrGoals = totalMonthlyIncomeGoal > 0 || totalMonthlyExpenseBudget > 0;
  const monthlyPlanNet = totalMonthlyIncomeGoal - totalMonthlyExpenseBudget;

  if (horizon === 'this_month') {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dailyPlanNet = monthlyPlanNet / daysInMonth;
    const fmtDay = new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });

    const dayKeys: string[] = [];
    for (let d = 1; d <= daysInMonth; d += 1) {
      dayKeys.push(
        `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      );
    }

    const todayIdx = Math.max(0, todayDate.getDate() - 1);
    const points: ProjectionPoint[] = new Array(dayKeys.length);

    // Reconstruct elapsed balances backwards from availableCash at todayIdx
    let runningBack = availableCash;
    for (let i = todayIdx; i >= 0; i -= 1) {
      const k = dayKeys[i];
      points[i] = {
        key: k,
        label: fmtDay.format(parseLocalDate(k)),
        isElapsed: true,
        isToday: i === todayIdx,
        realBalance: runningBack,
        planBalance: runningBack,
        events: [],
      };
      runningBack -= txDeltaByDay.get(k) ?? 0;
    }
    const startBalance = runningBack;

    // Project forward from todayIdx + 1 to end of month
    let realCursor = availableCash;
    let planCursor = availableCash;
    for (let i = todayIdx + 1; i < dayKeys.length; i += 1) {
      const k = dayKeys[i];
      realCursor += (forwardDeltaByDay.get(k) ?? 0) + avgDailyVarNet;
      planCursor += dailyPlanNet + (loanEventsByDay.get(k) ?? 0);
      points[i] = {
        key: k,
        label: fmtDay.format(parseLocalDate(k)),
        isElapsed: false,
        isToday: false,
        realBalance: realCursor,
        planBalance: planCursor,
        events: forwardEventsByDay.get(k) ?? [],
      };
    }

    const projectedRealEnd = points[points.length - 1]?.realBalance ?? availableCash;
    const projectedPlanEnd = points[points.length - 1]?.planBalance ?? availableCash;

    return {
      horizon,
      points,
      todayIndex: todayIdx,
      startBalance,
      projectedRealEnd,
      projectedPlanEnd,
      projectedNetChange: projectedRealEnd - startBalance,
      hasBudgetsOrGoals,
    };
  }

  // Horizon: 'this_year' (Jan..Dec, 12 monthly points)
  const fmtMonth = new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    month: 'short',
  });
  const monthKeys = Array.from({ length: 12 }, (_, m) => `${currentYear}-${String(m + 1).padStart(2, '0')}`);

  const txDeltaByMonth = new Map<string, number>();
  for (const [dayKey, delta] of txDeltaByDay.entries()) {
    const mKey = dayKey.slice(0, 7);
    txDeltaByMonth.set(mKey, (txDeltaByMonth.get(mKey) ?? 0) + delta);
  }

  const forwardDeltaByMonth = new Map<string, number>();
  const forwardEventsByMonth = new Map<string, string[]>();
  for (const [dayKey, delta] of forwardDeltaByDay.entries()) {
    const mKey = dayKey.slice(0, 7);
    forwardDeltaByMonth.set(mKey, (forwardDeltaByMonth.get(mKey) ?? 0) + delta);
    const evs = forwardEventsByDay.get(dayKey) ?? [];
    if (evs.length > 0) {
      forwardEventsByMonth.set(mKey, [...(forwardEventsByMonth.get(mKey) ?? []), ...evs]);
    }
  }

  const loanDeltaByMonth = new Map<string, number>();
  for (const [dayKey, delta] of loanEventsByDay.entries()) {
    const mKey = dayKey.slice(0, 7);
    loanDeltaByMonth.set(mKey, (loanDeltaByMonth.get(mKey) ?? 0) + delta);
  }

  const todayIdx = currentMonth;
  const points: ProjectionPoint[] = new Array(12);

  let runningBack = availableCash;
  for (let m = todayIdx; m >= 0; m -= 1) {
    const mKey = monthKeys[m];
    points[m] = {
      key: mKey,
      label: fmtMonth.format(new Date(currentYear, m, 1)),
      isElapsed: true,
      isToday: m === todayIdx,
      realBalance: runningBack,
      planBalance: runningBack,
      events: [],
    };
    runningBack -= txDeltaByMonth.get(mKey) ?? 0;
  }
  const startBalance = runningBack;

  // Remaining days in current month also contribute partial forward delta before next months
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const remainingDaysThisMonth = Math.max(0, daysInCurrentMonth - todayDate.getDate());
  let realCursor =
    availableCash +
    (forwardDeltaByMonth.get(monthKeys[todayIdx]) ?? 0) +
    avgDailyVarNet * remainingDaysThisMonth;
  let planCursor =
    availableCash +
    (monthlyPlanNet / daysInCurrentMonth) * remainingDaysThisMonth +
    (loanDeltaByMonth.get(monthKeys[todayIdx]) ?? 0);

  // Update todayIdx point's end-of-month projection? Keep todayIdx at actual availableCash so Today marker is exact!
  for (let m = todayIdx + 1; m < 12; m += 1) {
    const mKey = monthKeys[m];
    const daysInM = new Date(currentYear, m + 1, 0).getDate();
    if (m > todayIdx + 1) {
      realCursor += (forwardDeltaByMonth.get(mKey) ?? 0) + avgDailyVarNet * daysInM;
      planCursor += monthlyPlanNet + (loanDeltaByMonth.get(mKey) ?? 0);
    } else {
      realCursor += (forwardDeltaByMonth.get(mKey) ?? 0) + avgDailyVarNet * daysInM;
      planCursor += monthlyPlanNet + (loanDeltaByMonth.get(mKey) ?? 0);
    }
    points[m] = {
      key: mKey,
      label: fmtMonth.format(new Date(currentYear, m, 1)),
      isElapsed: false,
      isToday: false,
      realBalance: realCursor,
      planBalance: planCursor,
      events: forwardEventsByMonth.get(mKey) ?? [],
    };
  }

  const projectedRealEnd = points[points.length - 1]?.realBalance ?? availableCash;
  const projectedPlanEnd = points[points.length - 1]?.planBalance ?? availableCash;

  return {
    horizon,
    points,
    todayIndex: todayIdx,
    startBalance,
    projectedRealEnd,
    projectedPlanEnd,
    projectedNetChange: projectedRealEnd - startBalance,
    hasBudgetsOrGoals,
  };
}

