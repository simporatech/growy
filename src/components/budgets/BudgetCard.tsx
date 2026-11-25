import { motion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { BudgetCategory } from '../../types/finance';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import { CategoryProgressMetrics } from '../../utils/budgetMetrics';
import { CategoryIconBadge } from './CategoryIconBadge';

interface BudgetCardProps {
  category: BudgetCategory;
  metrics: CategoryProgressMetrics;
  globalCurrency: string;
  onEdit?: () => void;
  onDelete?: () => void;
  preview?: boolean;
}

export function BudgetCard({
  category,
  metrics,
  globalCurrency,
  onEdit,
  onDelete,
  preview = false,
}: BudgetCardProps) {
  const { t } = useLanguage();

  const isExpenseExceeded = category.kind === 'expense' && metrics.status === 'exceeded';
  const isExpenseNearLimit = category.kind === 'expense' && metrics.status === 'near_limit';
  const isIncomeDone =
    category.kind === 'income' && (metrics.status === 'achieved' || metrics.status === 'surpassed');

  const barColor = isExpenseExceeded ? '#FF6B6B' : category.color;
  const clampedWidth = Math.min(100, Math.max(0, metrics.progressPct));

  const statusBadgeClass = isExpenseExceeded
    ? 'border-coral/35 bg-coral/15 text-coral'
    : isExpenseNearLimit
      ? 'border-amber-400/35 bg-amber-400/15 text-amber-300'
      : isIncomeDone
        ? 'bg-dynamic-accent-soft text-dynamic-accent border-dynamic-accent border'
        : 'border-white/[0.1] bg-white/[0.06] text-[#B8B8BE]';

  const statusLabel = t(`budgets.status.${metrics.status}` as const);

  const remainingLabel =
    category.kind === 'expense'
      ? metrics.remaining < 0
        ? t('budgets.overBy')
        : t('budgets.remaining')
      : metrics.actual > metrics.target
        ? t('budgets.surplus')
        : t('budgets.toGoal');

  const remainingDisplayValue =
    category.kind === 'expense'
      ? Math.abs(metrics.remaining)
      : metrics.actual > metrics.target
        ? metrics.actual - metrics.target
        : metrics.remaining;

  return (
    <motion.article
      layout={!preview}
      initial={preview ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className="glass-card relative overflow-hidden p-5 sm:p-6 flex flex-col justify-between gap-5"
      style={{
        backgroundImage: `radial-gradient(85% 75% at 95% 5%, color-mix(in srgb, ${category.color} 13%, transparent) 0%, transparent 65%)`,
      }}
    >
      {/* Top Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CategoryIconBadge iconId={category.iconId} color={category.color} size="md" />
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold text-white">
              {category.name || t('categoryModal.namePlaceholder')}
            </h3>
            <span
              className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${statusBadgeClass}`}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {!preview && (onEdit || onDelete) && (
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label={t('budgets.edit')}
                title={t('budgets.edit')}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#B8B8BE] hover:bg-white/[0.08] hover:text-white active:scale-95 transition-all"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label={t('budgets.delete')}
                title={t('budgets.delete')}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#B8B8BE] hover:bg-coral/15 hover:text-coral active:scale-95 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-[#B8B8BE]">
            {category.kind === 'expense' ? t('budgets.spent') : t('budgets.earned')}
          </span>
          <span
            className={`font-display font-semibold tabular-nums ${
              isExpenseExceeded ? 'text-coral' : 'text-white'
            }`}
          >
            {metrics.progressPct.toFixed(0)}%
          </span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/35 border border-white/[0.06]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${clampedWidth}%` }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="h-full rounded-full"
            style={{ backgroundColor: barColor }}
          />
        </div>
      </div>

      {/* Financial Breakdown */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.08]">
        <div>
          <p className="text-[13px] text-[#B8B8BE]">
            {category.kind === 'expense' ? t('budgets.budgetLabel') : t('budgets.goalLabel')}
          </p>
          <p className="mt-0.5 font-display text-sm font-semibold text-white tabular-nums truncate">
            {formatCurrencyAmount(metrics.target, globalCurrency)}
          </p>
        </div>
        <div>
          <p className="text-[13px] text-[#B8B8BE]">
            {category.kind === 'expense' ? t('budgets.spent') : t('budgets.earned')}
          </p>
          <p
            className={`mt-0.5 font-display text-sm font-semibold tabular-nums truncate ${
              isExpenseExceeded ? 'text-coral' : 'text-white'
            }`}
          >
            {formatCurrencyAmount(metrics.actual, globalCurrency)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-[#B8B8BE]">{remainingLabel}</p>
          <p
            className={`mt-0.5 font-display text-sm font-semibold tabular-nums truncate ${
              isExpenseExceeded
                ? 'text-coral'
                : isIncomeDone
                  ? 'text-dynamic-accent'
                  : 'text-white'
            }`}
          >
            {formatCurrencyAmount(remainingDisplayValue, globalCurrency)}
          </p>
        </div>
      </div>
    </motion.article>
  );
}

