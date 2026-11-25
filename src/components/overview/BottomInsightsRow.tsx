import { ArrowUpRight, HandCoins, Repeat, Sparkles } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Account, BudgetCategory, Loan, Transaction } from '../../types/finance';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import { calculateLoanSummary } from '../../utils/loanMetrics';

interface BottomInsightsRowProps {
  loans: Loan[];
  transactions: Transaction[];
  accounts: Account[];
  categories: BudgetCategory[];
  globalCurrency: string;
  convertToGlobal: (amount: number, fromCurrency: string) => number;
  healthScore: number;
  topInsight: string;
  onNavigateLoans: () => void;
  onNavigateTransactions: () => void;
  onNavigateIntelligence: () => void;
}

export function BottomInsightsRow({
  loans,
  transactions,
  accounts,
  categories,
  globalCurrency,
  convertToGlobal,
  healthScore,
  topInsight,
  onNavigateLoans,
  onNavigateTransactions,
  onNavigateIntelligence,
}: BottomInsightsRowProps) {
  const { t } = useLanguage();
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const loanSummary = calculateLoanSummary(loans, convertToGlobal);
  const totalPrincipal = loans.reduce(
    (s, l) => s + convertToGlobal(l.principalAmount, l.currency),
    0
  );
  const totalPaid = loans.reduce((s, l) => s + convertToGlobal(l.paidAmount, l.currency), 0);
  const overallPayoffPct =
    totalPrincipal > 0 ? Math.min(100, Math.round((totalPaid / totalPrincipal) * 100)) : 0;

  const recentTxs = [...transactions]
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
    .slice(0, 5);

  const ringRadius = 22;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (Math.min(100, Math.max(0, healthScore)) / 100) * ringCirc;

  return (
    <div className="lg:col-span-7 flex flex-col gap-5">
      {/* Loans Snapshot + Growy Intelligence Spotlight */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Loans Snapshot */}
        <section className="glass-card p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                {t('nav.loans')}
              </h2>
              <p className="text-xs text-[#B8B8BE]">
                {loanSummary.activeCount} {t('loans.filter.active')} · {loanSummary.settledCount}{' '}
                {t('loans.filter.settled')}
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateLoans}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs font-medium text-dynamic-accent hover:bg-white/[0.08] transition-colors"
            >
              <span>{t('overview.openLoans')}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
              <p className="truncate text-xs text-[#B8B8BE]">{t('loans.direction.receivable')}</p>
              <p className="mt-0.5 truncate font-display text-sm font-bold text-dynamic-accent tabular-nums">
                {formatCurrencyAmount(loanSummary.totalReceivable, globalCurrency)}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
              <p className="truncate text-xs text-[#B8B8BE]">{t('loans.direction.payable')}</p>
              <p className="mt-0.5 truncate font-display text-sm font-bold text-coral tabular-nums">
                {formatCurrencyAmount(loanSummary.totalPayable, globalCurrency)}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#B8B8BE]">{t('overview.overallPayoff')}</span>
              <span className="font-semibold text-white tabular-nums">{overallPayoffPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="bg-dynamic-accent h-full rounded-full transition-all duration-500"
                style={{ width: `${overallPayoffPct}%` }}
              />
            </div>
          </div>
        </section>

        {/* Growy Intelligence Live Insight Card */}
        <section className="glass-card p-5 flex flex-col justify-between gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="bg-dynamic-accent-soft border-dynamic-accent text-dynamic-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-display text-base font-semibold text-white">
                  {t('nav.intelligence')}
                </h2>
                <p className="text-xs text-[#B8B8BE]">{t('intelligence.healthScore')}</p>
              </div>
            </div>

            {/* Health Score Ring */}
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
                <circle
                  cx="28"
                  cy="28"
                  r={ringRadius}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="5"
                />
                <circle
                  cx="28"
                  cy="28"
                  r={ringRadius}
                  fill="none"
                  stroke="var(--accent-color)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <span className="absolute font-display text-xs font-bold text-white tabular-nums">
                {healthScore}
              </span>
            </div>
          </div>

          <p className="line-clamp-3 text-[13px] leading-relaxed text-[#E5E5EA]">{topInsight}</p>

          <button
            type="button"
            onClick={onNavigateIntelligence}
            style={{ color: 'var(--accent-foreground)' }}
            className="bg-dynamic-accent inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <span>{t('overview.chatWithGrowy')}</span>
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </section>
      </div>

      {/* Recent Activity Feed */}
      <section className="glass-card p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-white">
            {t('overview.recentTitle')}
          </h2>
          <button
            type="button"
            onClick={onNavigateTransactions}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs font-medium text-dynamic-accent hover:bg-white/[0.08] transition-colors"
          >
            <span>{t('overview.allTransactions')}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentTxs.length === 0 ? (
          <p className="py-4 text-center text-sm text-[#B8B8BE]">
            {t('overview.noRecentTxs')}
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {recentTxs.map((tx) => {
              const srcAcc = accountMap.get(tx.accountId);
              const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
              const label =
                cat?.name ??
                tx.category ??
                (tx.loanId
                  ? tx.loanEntryKind === 'disbursement'
                    ? t('transactions.loanDisbursementTitle')
                    : t('transactions.loanPaymentTitle')
                  : tx.type === 'transfer'
                    ? t('transactions.type.transfer')
                    : t('transactions.uncategorized'));

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">{label}</span>
                      {tx.loanId && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-dynamic-accent-soft px-1.5 py-0.5 text-xs font-medium text-dynamic-accent">
                          <HandCoins className="h-3 w-3" />
                          {t('transactions.badge.loan')}
                        </span>
                      )}
                      {tx.recurringId && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-xs font-medium text-[#B8B8BE]">
                          <Repeat className="h-3 w-3 text-dynamic-accent" />
                          {t('transactions.badge.recurring')}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-[#8E8E93]">
                      {srcAcc?.name ?? t('transactions.unknownAccount')} · {tx.date}
                      {tx.description ? ` · ${tx.description}` : ''}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 font-display text-sm font-semibold tabular-nums ${
                      tx.type === 'income'
                        ? 'text-dynamic-accent'
                        : tx.type === 'expense'
                          ? 'text-coral'
                          : 'text-white'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}
                    {formatCurrencyAmount(tx.amount, srcAcc?.currency ?? globalCurrency)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

