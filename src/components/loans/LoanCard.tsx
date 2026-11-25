import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Loan } from '../../types/finance';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import {
  getDaysUntilLoanDue,
  getLoanProgressPct,
  getLoanRemaining,
  isLoanOverdue,
  isLoanSettled,
} from '../../utils/loanMetrics';
import { parseLocalDate } from '../../utils/transactionMetrics';
import { CategoryIconBadge } from '../budgets/CategoryIconBadge';

interface LoanCardProps {
  loan: Loan;
  globalCurrency: string;
  timezone?: string;
  isHighlighted?: boolean;
  convertToGlobal: (amount: number, fromCurrency: string) => number;
  onRecordPayment: (loan: Loan) => void;
  onEdit: (loan: Loan) => void;
  onDelete: (loan: Loan) => void;
}

export function LoanCard({
  loan,
  globalCurrency,
  timezone,
  isHighlighted = false,
  convertToGlobal,
  onRecordPayment,
  onEdit,
  onDelete,
}: LoanCardProps) {
  const { locale, t } = useLanguage();
  const remaining = getLoanRemaining(loan);
  const progressPct = getLoanProgressPct(loan);
  const settled = isLoanSettled(loan);
  const overdue = isLoanOverdue(loan, timezone);
  const daysLeft = getDaysUntilLoanDue(loan.dueDate, timezone);

  const showConverted = loan.currency !== globalCurrency;
  const convertedRemaining = convertToGlobal(remaining, loan.currency);

  const fmtDate = new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const startFormatted = fmtDate.format(parseLocalDate(loan.startDate));
  const dueFormatted = fmtDate.format(parseLocalDate(loan.dueDate));

  let dueBadgeLabel = t('loans.settled');
  let dueBadgeTone = 'border-dynamic-accent bg-dynamic-accent-soft text-dynamic-accent';

  if (!settled) {
    if (overdue) {
      dueBadgeLabel = t('loans.overdueDays').replace('{days}', String(Math.abs(daysLeft)));
      dueBadgeTone = 'border-coral/35 bg-coral/15 text-coral';
    } else if (daysLeft === 0) {
      dueBadgeLabel = t('loans.dueToday');
      dueBadgeTone = 'border-amber-400/35 bg-amber-400/15 text-amber-300';
    } else if (daysLeft === 1) {
      dueBadgeLabel = t('loans.dueTomorrow');
      dueBadgeTone = 'border-amber-400/35 bg-amber-400/15 text-amber-300';
    } else {
      dueBadgeLabel = t('loans.daysLeft').replace('{days}', String(daysLeft));
      dueBadgeTone =
        daysLeft <= 7
          ? 'border-amber-400/35 bg-amber-400/15 text-amber-300'
          : 'border-white/[0.1] bg-white/[0.05] text-[#B8B8BE]';
    }
  }

  const directionBadgeClass =
    loan.direction === 'payable'
      ? 'border-coral/30 bg-coral/10 text-coral'
      : 'border-dynamic-accent bg-dynamic-accent-soft text-dynamic-accent';

  return (
    <motion.article
      id={`loan-card-${loan.id}`}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: settled ? 0.72 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      className={`glass-card relative overflow-hidden p-6 flex flex-col justify-between gap-5 transition-all ${
        isHighlighted ? 'ring-2 ring-[var(--accent-color)] ring-offset-2 ring-offset-[#1A1A1C]' : ''
      }`}
      style={{
        backgroundImage: `radial-gradient(circle at 100% 0%, ${loan.color}18, transparent 58%)`,
      }}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <CategoryIconBadge iconId={loan.iconId} color={loan.color} size="lg" />
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-white truncate">{loan.title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${directionBadgeClass}`}
              >
                {t(`loans.direction.${loan.direction}` as const)}
              </span>
              {loan.counterparty && (
                <span className="truncate text-[13px] text-[#B8B8BE]">
                  · {loan.counterparty}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(loan)}
            aria-label={t('loans.edit')}
            title={t('loans.edit')}
            className="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#B8B8BE] opacity-80 hover:opacity-100 hover:bg-white/[0.1] hover:text-white active:scale-95 transition-all"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(loan)}
            aria-label={t('loans.delete')}
            title={t('loans.delete')}
            className="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#B8B8BE] opacity-80 hover:opacity-100 hover:border-coral/30 hover:bg-coral/15 hover:text-coral active:scale-95 transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Middle: Remaining / Principal + Progress Bar */}
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold tracking-tight text-white tabular-nums">
              {formatCurrencyAmount(remaining, loan.currency)}
            </span>
            <span className="text-[13px] text-[#8E8E93] tabular-nums">
              {t('loans.remainingOf')} {formatCurrencyAmount(loan.principalAmount, loan.currency)}
            </span>
          </div>
          <span className="font-display text-sm font-semibold text-dynamic-accent tabular-nums">
            {progressPct.toFixed(0)}% {t('loans.paidPct')}
          </span>
        </div>

        {showConverted && (
          <p className="text-[13px] text-[#8E8E93] tabular-nums">
            {t('subs.approx')} {formatCurrencyAmount(convertedRemaining, globalCurrency)}
          </p>
        )}

        <div className="h-2 w-full overflow-hidden rounded-full bg-black/40 border border-white/[0.06]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className={`h-full rounded-full ${
              settled
                ? 'bg-dynamic-accent'
                : overdue
                  ? 'bg-coral'
                  : 'bg-dynamic-accent'
            }`}
          />
        </div>
      </div>

      {/* Footer: Start -> Due Date + Record Payment CTA */}
      <div className="pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[13px] text-[#B8B8BE] tabular-nums">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#8E8E93]" />
            {startFormatted} → {dueFormatted}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-semibold tabular-nums ${dueBadgeTone}`}
          >
            {dueBadgeLabel}
          </span>
        </div>

        {settled ? (
          <span className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-dynamic-accent bg-dynamic-accent-soft px-3.5 text-[13px] font-semibold text-dynamic-accent">
            <CheckCircle2 className="h-4 w-4" />
            <span>{t('loans.settled')}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onRecordPayment(loan)}
            style={{ color: 'var(--accent-foreground)' }}
            className="bg-dynamic-accent w-full sm:w-auto inline-flex h-11 sm:h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{t('loans.recordPayment')}</span>
          </button>
        )}
      </div>
    </motion.article>
  );
}

