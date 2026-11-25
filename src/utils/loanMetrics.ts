import { Loan } from '../types/finance';
import { formatDateYYYYMMDD } from './localeDetection';
import { parseLocalDate } from './transactionMetrics';

export interface LoanSummary {
  totalReceivable: number;
  totalPayable: number;
  netLoanPosition: number;
  activeCount: number;
  settledCount: number;
}

export function getLoanRemaining(loan: Pick<Loan, 'principalAmount' | 'paidAmount'>): number {
  return Math.max(0, (Number(loan.principalAmount) || 0) - (Number(loan.paidAmount) || 0));
}

export function getLoanProgressPct(loan: Pick<Loan, 'principalAmount' | 'paidAmount'>): number {
  const principal = Number(loan.principalAmount) || 0;
  if (principal <= 0) return 0;
  return Math.min(100, Math.max(0, ((Number(loan.paidAmount) || 0) / principal) * 100));
}

export function isLoanSettled(loan: Pick<Loan, 'principalAmount' | 'paidAmount'>): boolean {
  return getLoanRemaining(loan) <= 0.005;
}

export function getDaysUntilLoanDue(dueDate: string, timeZone?: string): number {
  const todayStr = formatDateYYYYMMDD(new Date(), timeZone);
  const todayDate = parseLocalDate(todayStr);
  const targetDate = parseLocalDate(dueDate);
  if (Number.isNaN(todayDate.getTime()) || Number.isNaN(targetDate.getTime())) return 0;
  return Math.round((targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
}

export function isLoanOverdue(
  loan: Pick<Loan, 'principalAmount' | 'paidAmount' | 'dueDate'>,
  timeZone?: string
): boolean {
  if (isLoanSettled(loan)) return false;
  return getDaysUntilLoanDue(loan.dueDate, timeZone) < 0;
}

export function calculateLoanSummary(
  loans: Loan[],
  convertToGlobal: (amount: number, fromCurrency: string) => number
): LoanSummary {
  let totalReceivable = 0;
  let totalPayable = 0;
  let activeCount = 0;
  let settledCount = 0;

  for (const loan of loans) {
    const remaining = getLoanRemaining(loan);
    const remainingGlobal = convertToGlobal(remaining, loan.currency);

    if (isLoanSettled(loan)) {
      settledCount += 1;
    } else {
      activeCount += 1;
    }

    if (loan.direction === 'receivable') {
      totalReceivable += remainingGlobal;
    } else {
      totalPayable += remainingGlobal;
    }
  }

  return {
    totalReceivable,
    totalPayable,
    netLoanPosition: totalReceivable - totalPayable,
    activeCount,
    settledCount,
  };
}

