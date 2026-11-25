import { motion } from 'framer-motion';
import { ArrowUpRight, Target } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Account, BudgetCategory, Transaction } from '../../types/finance';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import {
  calculateCategoryMetrics,
  calculateGlobalBudgetSummary,
} from '../../utils/budgetMetrics';
import { CategoryIconBadge } from '../budgets/CategoryIconBadge';

interface BudgetsPulseCardProps {
  categories: BudgetCategory[];
  transactions: Transaction[];
  accounts: Account[];
  globalCurrency: string;
  convertToGlobal: (amount: number, fromCurrency: string) => number;
  onNavigateBudgets: () => void;
}

export function BudgetsPulseCard({
  categories,
  transactions,
  accounts,
  globalCurrency,
  convertToGlobal,
  onNavigateBudgets,
}: BudgetsPulseCardProps) {
  const { t } = useLanguage();
  const now = new Date();

  const summary = calculateGlobalBudgetSummary(
    categories,
    transactions,
    accounts,
    convertToGlobal,
    now,
    globalCurrency
  );

  const enriched = categories
    .map((cat) => ({
      cat,
      metrics: calculateCategoryMetrics(
        cat,
        transactions,
        accounts,
        convertToGlobal,
        now,
        globalCurrency
      ),
    }))
    .sort((a, b) => b.metrics.progressPct - a.metrics.progressPct)
    .slice(0, 4);

  return (
    <section className="glass-card lg:col-span-6 p-6 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            {t('overview.budgetsTitle')}
          </h2>
          <p className="text-sm text-[#B8B8BE]">{t('overview.budgetsSubtitle')}</p>
        </div>

        <button
          type="button"
          onClick={onNavigateBudgets}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-medium text-dynamic-accent hover:bg-white/[0.08] transition-colors"
        >
          <span>{t('overview.viewAll')}</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-11 w-11 items-center justify-center rounded-2xl border">
            <Target className="text-dynamic-accent h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-white">{t('overview.noBudgetsTitle')}</p>
          <p className="mt-1 text-[13px] text-[#B8B8BE]">{t('overview.noBudgetsDesc')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {summary.totalExpenseBudgeted > 0 && (
            <div className="rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-[13px] text-[#B8B8BE]">{t('overview.monthlyBudgetUsed')}</span>
              <span
                className={`font-display text-sm font-bold tabular-nums ${
                  summary.globalExpensePct > 100
                    ? 'text-coral'
                    : summary.globalExpensePct >= 80
                      ? 'text-amber-300'
                      : 'text-dynamic-accent'
                }`}
              >
                {Math.round(summary.globalExpensePct)}% ·{' '}
                {formatCurrencyAmount(summary.totalExpenseSpent, globalCurrency)} /{' '}
                {formatCurrencyAmount(summary.totalExpenseBudgeted, globalCurrency)}
              </span>
            </div>
          )}

          <div className="space-y-3">
            {enriched.map(({ cat, metrics }) => {
              const isExpense = cat.kind === 'expense';
              const isExceeded = isExpense && metrics.progressPct > 100;
              const isNear = isExpense && metrics.progressPct >= 80 && metrics.progressPct <= 100;
              const barColor = isExceeded
                ? '#FF6B6B'
                : isNear
                  ? '#fbbf24'
                  : isExpense
                    ? cat.color
                    : 'var(--accent-color)';

              return (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CategoryIconBadge iconId={cat.iconId} color={cat.color} size="sm" />
                      <span className="truncate text-sm font-medium text-white">{cat.name}</span>
                      {(isExceeded || isNear) && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                            isExceeded
                              ? 'bg-coral/15 text-coral border border-coral/30'
                              : 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                          }`}
                        >
                          {Math.round(metrics.progressPct)}%
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-[#B8B8BE] tabular-nums">
                      {formatCurrencyAmount(metrics.actual, globalCurrency)} /{' '}
                      {formatCurrencyAmount(metrics.target, globalCurrency)}
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(2, metrics.progressPct))}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

