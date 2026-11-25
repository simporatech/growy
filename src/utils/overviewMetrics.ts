import { Account, BudgetCategory, Loan, Subscription, Transaction } from '../types/finance';
import { formatCurrencyAmount } from './accountMetrics';
import { resolveTimePeriodBounds, TimePeriodValue } from './dateRangeFilter';
import { formatDateYYYYMMDD } from './localeDetection';
import { getDaysUntilLoanDue, getLoanRemaining, isLoanSettled } from './loanMetrics';
import { getSubscriptionBillingStatus } from './subscriptionMetrics';
import { getTransactionGlobalAmount, parseLocalDate } from './transactionMetrics';

export interface CashFlowBucket {
  key: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

export interface SpendingSlice {
  id: string;
  name: string;
  color: string;
  amount: number;
  pct: number;
}

export interface UpcomingItem {
  id: string;
  kind: 'recurring' | 'loan';
  direction: 'in' | 'out' | 'transfer';
  title: string;
  date: string;
  daysRemaining: number;
  nativeFormatted: string;
  globalAmount: number;
}

export function buildCashFlowBuckets(
  transactions: Transaction[],
  accounts: Account[],
  period: TimePeriodValue,
  convertToGlobal: (amount: number, fromCurrency: string) => number,
  globalCurrency: string,
  locale: 'en' | 'es',
  timeZone?: string
): CashFlowBucket[] {
  const accountCurrencyMap = new Map(accounts.map((a) => [a.id, a.currency]));
  const operational = transactions.filter(
    (tx) => !tx.excludeFromCashFlow && (tx.type === 'income' || tx.type === 'expense')
  );

  const useMonthlyBuckets =
    period.preset === 'all_time' ||
    period.preset === 'this_year' ||
    period.preset === 'last_year' ||
    period.preset === 'last_3_months';

  if (useMonthlyBuckets) {
    const monthMap = new Map<string, { income: number; expenses: number }>();
    for (const tx of operational) {
      const monthKey = tx.date.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(monthKey)) continue;
      const srcCur = accountCurrencyMap.get(tx.accountId) ?? globalCurrency;
      const amt = getTransactionGlobalAmount(tx, srcCur, convertToGlobal, globalCurrency);
      const entry = monthMap.get(monthKey) ?? { income: 0, expenses: 0 };
      if (tx.type === 'income') entry.income += amt;
      else entry.expenses += amt;
      monthMap.set(monthKey, entry);
    }

    const keys = Array.from(monthMap.keys()).sort();
    const fmtMonth = new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
      month: 'short',
      year: '2-digit',
    });

    return keys.map((key) => {
      const [y, m] = key.split('-').map(Number);
      const label = fmtMonth.format(new Date(y, m - 1, 1));
      const vals = monthMap.get(key)!;
      return {
        key,
        label,
        income: vals.income,
        expenses: vals.expenses,
        net: vals.income - vals.expenses,
      };
    });
  }

  const now = new Date();
  const todayStr = formatDateYYYYMMDD(now, timeZone);
  const { startDate, endDate } = resolveTimePeriodBounds(period, timeZone);
  const startDt = parseLocalDate(startDate ?? todayStr);
  const endDt = parseLocalDate(endDate ?? todayStr);
  const diffDays = Math.max(
    1,
    Math.min(90, Math.round((endDt.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  );

  const dayKeys: string[] = [];
  for (let i = 0; i < diffDays; i += 1) {
    const d = new Date(startDt);
    d.setDate(d.getDate() + i);
    dayKeys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`
    );
  }

  const dayMap = new Map<string, { income: number; expenses: number }>();
  for (const key of dayKeys) {
    dayMap.set(key, { income: 0, expenses: 0 });
  }

  for (const tx of operational) {
    const key = tx.date.slice(0, 10);
    const entry = dayMap.get(key);
    if (!entry) continue;
    const srcCur = accountCurrencyMap.get(tx.accountId) ?? globalCurrency;
    const amt = getTransactionGlobalAmount(tx, srcCur, convertToGlobal, globalCurrency);
    if (tx.type === 'income') entry.income += amt;
    else entry.expenses += amt;
  }

  const fmtDay = new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });

  return dayKeys.map((key) => {
    const parsed = parseLocalDate(key);
    const vals = dayMap.get(key)!;
    return {
      key,
      label: fmtDay.format(parsed),
      income: vals.income,
      expenses: vals.expenses,
      net: vals.income - vals.expenses,
    };
  });
}

const FALLBACK_SLICE_COLORS = ['#97f2cc', '#60a5fa', '#a78bfa', '#fbbf24', '#f472b6', '#fb923c'];

export function buildSpendingSlices(
  transactions: Transaction[],
  accounts: Account[],
  categories: BudgetCategory[],
  convertToGlobal: (amount: number, fromCurrency: string) => number,
  globalCurrency: string,
  uncategorizedLabel: string
): SpendingSlice[] {
  const accountCurrencyMap = new Map(accounts.map((a) => [a.id, a.currency]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, { name: string; color: string; amount: number }>();

  let grandTotal = 0;
  for (const tx of transactions) {
    if (tx.excludeFromCashFlow || tx.type !== 'expense') continue;
    const srcCur = accountCurrencyMap.get(tx.accountId) ?? globalCurrency;
    const amt = getTransactionGlobalAmount(tx, srcCur, convertToGlobal, globalCurrency);
    if (amt <= 0) continue;
    grandTotal += amt;

    const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
    const key = cat?.id ?? (tx.category?.trim() || 'uncategorized');
    const name = cat?.name ?? (tx.category?.trim() || uncategorizedLabel);
    const color =
      cat?.color ?? FALLBACK_SLICE_COLORS[totals.size % FALLBACK_SLICE_COLORS.length];

    const existing = totals.get(key) ?? { name, color, amount: 0 };
    existing.amount += amt;
    totals.set(key, existing);
  }

  if (grandTotal <= 0) return [];

  return Array.from(totals.entries())
    .map(([id, item]) => ({
      id,
      name: item.name,
      color: item.color,
      amount: item.amount,
      pct: (item.amount / grandTotal) * 100,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function buildUpcoming14Days(
  subscriptions: Subscription[],
  loans: Loan[],
  accounts: Account[],
  convertToGlobal: (amount: number, fromCurrency: string) => number,
  globalCurrency: string,
  timeZone?: string
): { items: UpcomingItem[]; due7DaysOutflow: number } {
  const accountCurrencyMap = new Map(accounts.map((a) => [a.id, a.currency]));
  const items: UpcomingItem[] = [];
  let due7DaysOutflow = 0;

  for (const sub of subscriptions) {
    if (!sub.isActive) continue;
    const status = getSubscriptionBillingStatus(sub, timeZone);
    const srcCur = accountCurrencyMap.get(sub.accountId) ?? globalCurrency;
    const globalAmt = convertToGlobal(sub.amount, srcCur);
    const kind = sub.kind ?? 'expense';

    if (status.daysRemaining <= 7 && kind === 'expense') {
      due7DaysOutflow += globalAmt;
    }

    if (status.daysRemaining <= 14) {
      items.push({
        id: `sub-${sub.id}`,
        kind: 'recurring',
        direction: kind === 'income' ? 'in' : kind === 'transfer' ? 'transfer' : 'out',
        title: sub.name,
        date: sub.nextBillingDate,
        daysRemaining: status.daysRemaining,
        nativeFormatted: formatCurrencyAmount(sub.amount, srcCur),
        globalAmount: globalAmt,
      });
    }
  }

  for (const loan of loans) {
    if (isLoanSettled(loan)) continue;
    const days = getDaysUntilLoanDue(loan.dueDate, timeZone);
    const remaining = getLoanRemaining(loan);
    const globalAmt = convertToGlobal(remaining, loan.currency);

    if (days <= 7 && loan.direction === 'payable') {
      due7DaysOutflow += globalAmt;
    }

    if (days <= 14) {
      items.push({
        id: `loan-${loan.id}`,
        kind: 'loan',
        direction: loan.direction === 'receivable' ? 'in' : 'out',
        title: loan.title,
        date: loan.dueDate,
        daysRemaining: days,
        nativeFormatted: formatCurrencyAmount(remaining, loan.currency),
        globalAmount: globalAmt,
      });
    }
  }

  items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return { items, due7DaysOutflow };
}

