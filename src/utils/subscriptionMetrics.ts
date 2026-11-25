import { Account, BillingFrequency, Subscription } from '../types/finance';
import { formatDateYYYYMMDD } from './localeDetection';
import { parseLocalDate } from './transactionMetrics';

export interface SubscriptionSummary {
  monthlyRecurringExpenses: number;
  monthlyRecurringIncome: number;
  netMonthlyRecurringFlow: number;
  monthlyEquivalentTotal: number;
  annualProjectedTotal: number;
  activeCount: number;
  pausedCount: number;
  upcoming7DaysCount: number;
}

export interface SubscriptionBillingStatus {
  daysRemaining: number;
  dueSoon: boolean;
  overdue: boolean;
}

export function getMonthlyEquivalentMultiplier(frequency: BillingFrequency): number {
  switch (frequency) {
    case 'weekly':
      return 52 / 12;
    case 'biweekly':
      return 26 / 12;
    case 'monthly':
      return 1;
    case 'quarterly':
      return 1 / 3;
    case 'annual':
      return 1 / 12;
  }
}

export function calculateMonthlyEquivalent(amount: number, frequency: BillingFrequency): number {
  const safeAmount = Number(amount) || 0;
  return safeAmount * getMonthlyEquivalentMultiplier(frequency);
}

export function calculateAnnualEquivalent(amount: number, frequency: BillingFrequency): number {
  return calculateMonthlyEquivalent(amount, frequency) * 12;
}

export function getSubscriptionBillingStatus(
  subscription: Pick<Subscription, 'nextBillingDate' | 'isActive'>,
  timeZone?: string
): SubscriptionBillingStatus {
  const todayStr = formatDateYYYYMMDD(new Date(), timeZone);
  const todayDate = parseLocalDate(todayStr);
  const targetDate = parseLocalDate(subscription.nextBillingDate);

  if (Number.isNaN(targetDate.getTime()) || Number.isNaN(todayDate.getTime())) {
    return { daysRemaining: 0, dueSoon: false, overdue: false };
  }

  const diffMs = targetDate.getTime() - todayDate.getTime();
  const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return {
    daysRemaining,
    dueSoon: subscription.isActive && daysRemaining >= 0 && daysRemaining <= 7,
    overdue: subscription.isActive && daysRemaining < 0,
  };
}

export function calculateSubscriptionSummary(
  subscriptions: Subscription[],
  accounts: Account[],
  convertToGlobal: (amount: number, fromCurrency: string) => number,
  timeZone?: string
): SubscriptionSummary {
  const accountCurrencyMap = new Map(accounts.map((a) => [a.id, a.currency]));
  let monthlyRecurringExpenses = 0;
  let monthlyRecurringIncome = 0;
  let activeCount = 0;
  let pausedCount = 0;
  let upcoming7DaysCount = 0;

  for (const sub of subscriptions) {
    if (!sub.isActive) {
      pausedCount += 1;
      continue;
    }

    activeCount += 1;
    const kind = sub.kind ?? 'expense';
    const currency = accountCurrencyMap.get(sub.accountId) ?? 'USD';
    const nativeMonthly = calculateMonthlyEquivalent(sub.amount, sub.frequency);
    const globalMonthly = convertToGlobal(nativeMonthly, currency);

    if (kind === 'expense') {
      monthlyRecurringExpenses += globalMonthly;
    } else if (kind === 'income') {
      monthlyRecurringIncome += globalMonthly;
    }

    const status = getSubscriptionBillingStatus(sub, timeZone);
    if (status.daysRemaining <= 7) {
      upcoming7DaysCount += 1;
    }
  }

  const netMonthlyRecurringFlow = monthlyRecurringIncome - monthlyRecurringExpenses;

  return {
    monthlyRecurringExpenses,
    monthlyRecurringIncome,
    netMonthlyRecurringFlow,
    monthlyEquivalentTotal: monthlyRecurringExpenses,
    annualProjectedTotal: monthlyRecurringExpenses * 12,
    activeCount,
    pausedCount,
    upcoming7DaysCount,
  };
}
