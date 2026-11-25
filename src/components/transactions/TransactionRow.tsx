import { motion } from 'framer-motion';
import { ArrowLeftRight, ArrowUpRight, HandCoins, Pencil, Repeat, Trash2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Account, BudgetCategory, Transaction } from '../../types/finance';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import { CategoryIconBadge } from '../budgets/CategoryIconBadge';

interface TransactionRowProps {
  transaction: Transaction;
  sourceAccount?: Account;
  destinationAccount?: Account;
  category?: BudgetCategory;
  globalCurrency: string;
  convertedAmount: number;
  onEdit: () => void;
  onDelete: () => void;
  onNavigateToLoan?: (loanId: string) => void;
  onNavigateToRecurring?: (recurringId: string) => void;
}

export function TransactionRow({
  transaction,
  sourceAccount,
  destinationAccount,
  category,
  globalCurrency,
  convertedAmount,
  onEdit,
  onDelete,
  onNavigateToLoan,
  onNavigateToRecurring,
}: TransactionRowProps) {
  const { t } = useLanguage();

  const srcCurrency = sourceAccount?.currency ?? 'USD';
  const dstCurrency = destinationAccount?.currency ?? srcCurrency;
  const isTransfer = transaction.type === 'transfer';
  const isCrossCurrencyTransfer = isTransfer && srcCurrency !== dstCurrency;

  const title = isTransfer
    ? `${sourceAccount?.name ?? t('transactions.unknownAccount')} → ${
        destinationAccount?.name ?? t('transactions.unknownAccount')
      }`
    : category?.name ??
      transaction.category ??
      (transaction.loanId
        ? transaction.loanEntryKind === 'disbursement'
          ? t('transactions.loanDisbursementTitle')
          : t('transactions.loanPaymentTitle')
        : t('transactions.uncategorized'));

  const showConverted = !isTransfer && srcCurrency !== globalCurrency;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      className="group flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 hover:bg-white/[0.03] transition-colors"
    >
      {/* Left: Icon + Title + Metadata */}
      <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
        {isTransfer ? (
          <div className="bg-dynamic-accent-soft border-dynamic-accent text-dynamic-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
        ) : transaction.loanId ? (
          <div className="bg-dynamic-accent-soft border-dynamic-accent text-dynamic-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
            <HandCoins className="h-5 w-5" />
          </div>
        ) : (
          <CategoryIconBadge
            iconId={category?.iconId ?? (transaction.type === 'income' ? 'briefcase' : 'utensils')}
            color={category?.color ?? (transaction.type === 'income' ? '#97f2cc' : '#A78BFA')}
            size="md"
          />
        )}

        <div className="min-w-0">
          <p className="truncate text-sm sm:text-[15px] font-medium text-white">{title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-[#B8B8BE]">
            {!isTransfer && sourceAccount && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-[12px] font-medium text-white/85">
                {sourceAccount.name} · {sourceAccount.currency}
              </span>
            )}
            {isTransfer && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-[12px] font-medium text-white/85">
                {t('transactions.type.transfer')}
              </span>
            )}
            {transaction.loanId && (
              <span className="inline-flex items-center gap-1 rounded-md bg-dynamic-accent-soft border border-dynamic-accent px-2 py-0.5 text-[11px] font-medium text-dynamic-accent">
                <HandCoins className="h-3 w-3 shrink-0" />
                <span>{t('transactions.badge.loan')}</span>
              </span>
            )}
            {transaction.recurringId && (
              <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-white/85">
                <Repeat className="h-3 w-3 shrink-0 text-dynamic-accent" />
                <span>{t('transactions.badge.recurring')}</span>
              </span>
            )}
            {transaction.description && (
              <span className="truncate max-w-[240px] sm:max-w-[340px]">
                {transaction.description}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Amount + Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="text-right">
          {isCrossCurrencyTransfer ? (
            <p className="font-display text-sm sm:text-base font-semibold text-white tabular-nums">
              <span>{formatCurrencyAmount(transaction.amount, srcCurrency)}</span>
              <span className="mx-1.5 text-[#B8B8BE]">→</span>
              <span className="text-dynamic-accent">
                {formatCurrencyAmount(transaction.toAmount ?? transaction.amount, dstCurrency)}
              </span>
            </p>
          ) : (
            <p
              className={`font-display text-sm sm:text-base font-semibold tabular-nums ${
                transaction.type === 'expense'
                  ? 'text-coral'
                  : transaction.type === 'income'
                    ? 'text-dynamic-accent'
                    : 'text-white'
              }`}
            >
              {transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : ''}
              {formatCurrencyAmount(transaction.amount, srcCurrency)}
            </p>
          )}
          {showConverted && (
            <p className="text-[12px] text-[#B8B8BE] tabular-nums">
              {t('accounts.equivalentIn')} {formatCurrencyAmount(convertedAmount, globalCurrency)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {transaction.loanId && onNavigateToLoan && (
            <button
              type="button"
              onClick={() => onNavigateToLoan(transaction.loanId!)}
              aria-label={t('transactions.jumpToLoan')}
              title={t('transactions.jumpToLoan')}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-dynamic-accent opacity-80 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 hover:bg-dynamic-accent-soft active:scale-95 transition-all"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          )}
          {!transaction.loanId && transaction.recurringId && onNavigateToRecurring && (
            <button
              type="button"
              onClick={() => onNavigateToRecurring(transaction.recurringId!)}
              aria-label={t('transactions.jumpToRecurring')}
              title={t('transactions.jumpToRecurring')}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-dynamic-accent opacity-80 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 hover:bg-dynamic-accent-soft active:scale-95 transition-all"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('transactions.edit')}
            title={t('transactions.edit')}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[#B8B8BE] hover:bg-white/[0.08] hover:text-white active:scale-95 transition-all"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t('transactions.delete')}
            title={t('transactions.delete')}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[#B8B8BE] hover:bg-coral/15 hover:text-coral active:scale-95 transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

