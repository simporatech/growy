import { Transaction } from '../types/finance';
import { formatDateYYYYMMDD } from './localeDetection';
import { parseLocalDate } from './transactionMetrics';

export type TimePeriodPreset =
  | 'today'
  | 'last_7_days'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'this_year'
  | 'last_year'
  | 'all_time'
  | 'custom';

export interface TimePeriodValue {
  preset: TimePeriodPreset;
  customStart?: string; // 'YYYY-MM-DD'
  customEnd?: string; // 'YYYY-MM-DD'
}

export const TIME_PERIOD_PRESETS: TimePeriodPreset[] = [
  'today',
  'last_7_days',
  'this_month',
  'last_month',
  'last_3_months',
  'this_year',
  'last_year',
  'all_time',
  'custom',
];

export function normalizeLegacyPeriodPreset(
  raw?: string,
  fallback: TimePeriodPreset = 'this_month'
): TimePeriodPreset {
  if (!raw) return fallback;
  if (raw === 'all') return 'all_time';
  if (raw === 'last_7') return 'last_7_days';
  if (raw === 'last_30') return 'this_month';
  if ((TIME_PERIOD_PRESETS as string[]).includes(raw)) {
    return raw as TimePeriodPreset;
  }
  return fallback;
}

function toYYYYMMDD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export function resolveTimePeriodBounds(
  value: TimePeriodValue,
  timeZone?: string
): { startDate: string | null; endDate: string | null } {
  const todayStr = formatDateYYYYMMDD(new Date(), timeZone);
  const today = parseLocalDate(todayStr);
  const y = today.getFullYear();
  const m = today.getMonth();

  switch (value.preset) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr };

    case 'last_7_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { startDate: toYYYYMMDD(start), endDate: todayStr };
    }

    case 'this_month': {
      const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { startDate: start, endDate: end };
    }

    case 'last_month': {
      const prev = new Date(y, m - 1, 1);
      const py = prev.getFullYear();
      const pm = prev.getMonth();
      const lastDay = new Date(py, pm + 1, 0).getDate();
      return {
        startDate: `${py}-${String(pm + 1).padStart(2, '0')}-01`,
        endDate: `${py}-${String(pm + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      };
    }

    case 'last_3_months': {
      const start = new Date(y, m - 2, 1);
      return { startDate: toYYYYMMDD(start), endDate: todayStr };
    }

    case 'this_year':
      return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };

    case 'last_year':
      return { startDate: `${y - 1}-01-01`, endDate: `${y - 1}-12-31` };

    case 'all_time':
      return { startDate: null, endDate: null };

    case 'custom': {
      const s = value.customStart?.trim() || null;
      const e = value.customEnd?.trim() || null;
      if (s && e && s > e) {
        return { startDate: e, endDate: s };
      }
      return { startDate: s, endDate: e };
    }
  }
}

export function isDateInTimePeriod(
  dateStr: string,
  value: TimePeriodValue,
  timeZone?: string
): boolean {
  if (value.preset === 'all_time') return true;
  const normalized = dateStr.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;

  const { startDate, endDate } = resolveTimePeriodBounds(value, timeZone);
  if (startDate && normalized < startDate) return false;
  if (endDate && normalized > endDate) return false;
  return true;
}

export function filterTransactionsByTimePeriod(
  transactions: Transaction[],
  value: TimePeriodValue,
  timeZone?: string
): Transaction[] {
  if (value.preset === 'all_time') return transactions;
  return transactions.filter((tx) => isDateInTimePeriod(tx.date, value, timeZone));
}

