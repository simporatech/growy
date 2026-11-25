import { Account, Transaction, TransactionPeriodFilter } from '../types/finance';
import { formatDateYYYYMMDD } from './localeDetection';

export interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  totalFxVariance: number;
  count: number;
}

export function parseLocalDate(dateStr: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(dateStr);
}

export function getTodayLocalDateString(timeZone?: string): string {
  return formatDateYYYYMMDD(new Date(), timeZone);
}

export function isDateInPeriod(
  dateStr: string,
  period: TransactionPeriodFilter,
  referenceDate = new Date()
): boolean {
  if (period === 'all') return true;
  const parsed = parseLocalDate(dateStr);
  if (Number.isNaN(parsed.getTime())) return false;

  const todayStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  if (period === 'this_month') {
    return (
      parsed.getFullYear() === referenceDate.getFullYear() &&
      parsed.getMonth() === referenceDate.getMonth()
    );
  }

  const days = period === 'last_7' ? 6 : 29;
  const cutoff = new Date(todayStart);
  cutoff.setDate(cutoff.getDate() - days);
  return parsed >= cutoff;
}

/**
 * Returns the transaction's frozen global-currency snapshot when it matches
 * the active globalCurrency; otherwise falls back to live FX conversion.
 */
export function getTransactionGlobalAmount(
  tx: Transaction,
  sourceCurrency: string,
  convertToGlobal: (amount: number, fromCurrency: string) => number,
  globalCurrency?: string
): number {
  if (
    globalCurrency &&
    tx.snapshotCurrency === globalCurrency &&
    typeof tx.globalAmountSnapshot === 'number' &&
    Number.isFinite(tx.globalAmountSnapshot)
  ) {
    return tx.globalAmountSnapshot;
  }
  return convertToGlobal(Number(tx.amount) || 0, sourceCurrency);
}

export function calculateTransactionSummary(
  transactions: Transaction[],
  accounts: Account[],
  convertToGlobal: (amount: number, fromCurrency: string) => number,
  globalCurrency?: string
): TransactionSummary {
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalFxVariance = 0;

  for (const tx of transactions) {
    if (tx.excludeFromCashFlow) continue;
    const srcAccount = accountMap.get(tx.accountId);
    const srcCurrency = srcAccount?.currency ?? 'USD';

    if (tx.type === 'income') {
      totalIncome += getTransactionGlobalAmount(tx, srcCurrency, convertToGlobal, globalCurrency);
    } else if (tx.type === 'expense') {
      totalExpenses += getTransactionGlobalAmount(tx, srcCurrency, convertToGlobal, globalCurrency);
    } else if (tx.type === 'transfer' && tx.toAccountId) {
      const dstAccount = accountMap.get(tx.toAccountId);
      if (srcAccount && dstAccount && srcAccount.currency !== dstAccount.currency) {
        const sentGlobal = convertToGlobal(Number(tx.amount) || 0, srcCurrency);
        const receivedGlobal = convertToGlobal(
          Number(tx.toAmount ?? tx.amount) || 0,
          dstAccount.currency
        );
        totalFxVariance += receivedGlobal - sentGlobal;
      }
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netCashFlow: totalIncome - totalExpenses,
    totalFxVariance,
    count: transactions.length,
  };
}

