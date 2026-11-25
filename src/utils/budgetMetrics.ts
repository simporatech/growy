import { Account, BudgetCategory, Transaction } from '../types/finance';
import { isDateInTimePeriod, TimePeriodValue } from './dateRangeFilter';
import { formatDateYYYYMMDD } from './localeDetection';
import { getTransactionGlobalAmount } from './transactionMetrics';

export type ExpenseBudgetStatus = 'on_track' | 'near_limit' | 'exceeded';
export type IncomeGoalStatus = 'in_progress' | 'achieved' | 'surpassed';

export interface CategoryProgressMetrics {
  target: number;
  actual: number;
  remaining: number;
  progressPct: number;
  status: ExpenseBudgetStatus | IncomeGoalStatus;
}

export interface GlobalBudgetSummary {
  totalExpenseBudgeted: number;
  totalExpenseSpent: number;
  globalExpensePct: number;
  expenseHealthStatus: ExpenseBudgetStatus;
  totalIncomeGoal: number;
  totalIncomeEarned: number;
  globalIncomePct: number;
  incomeProgressStatus: IncomeGoalStatus;
}

export function isTransactionInCurrentMonth(
  dateStr: string,
  referenceDate = new Date(),
  timeZone?: string
): boolean {
  const refMonth = formatDateYYYYMMDD(referenceDate, timeZone).slice(0, 7);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (match) {
    return `${match[1]}-${match[2]}` === refMonth;
  }
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return false;
  return formatDateYYYYMMDD(parsed, timeZone).slice(0, 7) === refMonth;
}

function matchesCategory(tx: Transaction, category: BudgetCategory): boolean {
  if (tx.categoryId && tx.categoryId === category.id) return true;
  if (tx.category && tx.category.trim().toLowerCase() === category.name.trim().toLowerCase()) {
    return true;
  }
  return false;
}

export function calculateCategoryMetrics(
  category: BudgetCategory,
  transactions: Transaction[],
  accounts: Account[],
  convertToGlobal: (amount: number, fromCurrency: string) => number,
  referenceDate = new Date(),
  globalCurrency?: string,
  periodFilter?: TimePeriodValue,
  timeZone?: string
): CategoryProgressMetrics {
  const accountCurrencyMap = new Map(accounts.map((acc) => [acc.id, acc.currency]));
  const target = convertToGlobal(category.targetAmount, category.currency || 'USD');

  let actual = 0;
  for (const tx of transactions) {
    if (tx.excludeFromCashFlow) continue;
    if (tx.type !== category.kind) continue;
    if (!matchesCategory(tx, category)) continue;
    if (periodFilter) {
      if (!isDateInTimePeriod(tx.date, periodFilter, timeZone)) continue;
    } else if (!isTransactionInCurrentMonth(tx.date, referenceDate, timeZone)) {
      continue;
    }

    const txCurrency = accountCurrencyMap.get(tx.accountId) ?? category.currency ?? 'USD';
    actual += getTransactionGlobalAmount(tx, txCurrency, convertToGlobal, globalCurrency);
  }

  const progressPct = target > 0 ? (actual / target) * 100 : 0;

  if (category.kind === 'expense') {
    const remaining = target - actual;
    const status: ExpenseBudgetStatus =
      progressPct > 100 ? 'exceeded' : progressPct >= 80 ? 'near_limit' : 'on_track';
    return { target, actual, remaining, progressPct, status };
  }

  const remaining = Math.max(0, target - actual);
  const status: IncomeGoalStatus =
    progressPct > 100 ? 'surpassed' : progressPct >= 100 ? 'achieved' : 'in_progress';
  return { target, actual, remaining, progressPct, status };
}

export function calculateGlobalBudgetSummary(
  categories: BudgetCategory[],
  transactions: Transaction[],
  accounts: Account[],
  convertToGlobal: (amount: number, fromCurrency: string) => number,
  referenceDate = new Date(),
  globalCurrency?: string,
  periodFilter?: TimePeriodValue,
  timeZone?: string
): GlobalBudgetSummary {
  let totalExpenseBudgeted = 0;
  let totalExpenseSpent = 0;
  let totalIncomeGoal = 0;
  let totalIncomeEarned = 0;

  for (const cat of categories) {
    const metrics = calculateCategoryMetrics(
      cat,
      transactions,
      accounts,
      convertToGlobal,
      referenceDate,
      globalCurrency,
      periodFilter,
      timeZone
    );
    if (cat.kind === 'expense') {
      totalExpenseBudgeted += metrics.target;
      totalExpenseSpent += metrics.actual;
    } else {
      totalIncomeGoal += metrics.target;
      totalIncomeEarned += metrics.actual;
    }
  }

  const globalExpensePct =
    totalExpenseBudgeted > 0 ? (totalExpenseSpent / totalExpenseBudgeted) * 100 : 0;
  const expenseHealthStatus: ExpenseBudgetStatus =
    globalExpensePct > 100 ? 'exceeded' : globalExpensePct >= 80 ? 'near_limit' : 'on_track';

  const globalIncomePct = totalIncomeGoal > 0 ? (totalIncomeEarned / totalIncomeGoal) * 100 : 0;
  const incomeProgressStatus: IncomeGoalStatus =
    globalIncomePct > 100 ? 'surpassed' : globalIncomePct >= 100 ? 'achieved' : 'in_progress';

  return {
    totalExpenseBudgeted,
    totalExpenseSpent,
    globalExpensePct,
    expenseHealthStatus,
    totalIncomeGoal,
    totalIncomeEarned,
    globalIncomePct,
    incomeProgressStatus,
  };
}

