import { Account, Transaction } from '../types/finance';

/**
 * Deterministic balance calculation:
 * currentBalance = initialBalance + totalIncome + totalTransferIn - totalExpense - totalTransferOut
 */
export function calculateAccountBalance(account: Account, transactions: Transaction[]): number {
  let balance = account.initialBalance;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income' && tx.accountId === account.id) {
      balance += amount;
    } else if (tx.type === 'expense' && tx.accountId === account.id) {
      balance -= amount;
    } else if (tx.type === 'transfer') {
      if (tx.accountId === account.id) {
        balance -= amount;
      }
      if (tx.toAccountId === account.id) {
        const credit = tx.toAmount !== undefined ? Number(tx.toAmount) || 0 : amount;
        balance += credit;
      }
    }
  }

  return balance;
}

/**
 * Converts each account's derived currentBalance into the user's selected global currency
 * and sums them into a single portfolio total.
 */
export function calculateTotalPortfolioInGlobalCurrency(
  accounts: Account[],
  transactions: Transaction[],
  convertCurrency: (amount: number, fromCurrency: string) => number
): number {
  return accounts.reduce((total, account) => {
    const currentBalance = calculateAccountBalance(account, transactions);
    return total + convertCurrency(currentBalance, account.currency);
  }, 0);
}

export interface CurrencySubtotal {
  currency: string;
  total: number;
  count: number;
}

/**
 * Groups accounts by native currency and sums their derived currentBalance.
 */
export function calculateCurrencySubtotals(
  accounts: Account[],
  transactions: Transaction[]
): CurrencySubtotal[] {
  const grouped = new Map<string, CurrencySubtotal>();

  for (const account of accounts) {
    const balance = calculateAccountBalance(account, transactions);
    const existing = grouped.get(account.currency);
    if (existing) {
      existing.total += balance;
      existing.count += 1;
    } else {
      grouped.set(account.currency, {
        currency: account.currency,
        total: balance,
        count: 1,
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => a.currency.localeCompare(b.currency));
}

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'CLP', 'PYG']);

export function formatCurrencyAmount(
  amount: number,
  currencyCode: string,
  options?: { compact?: boolean }
): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      notation: options?.compact ? 'compact' : 'standard',
      maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currencyCode) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

