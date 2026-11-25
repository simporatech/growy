import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Pencil, Trash2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  Account,
  BillingFrequency,
  BudgetCategory,
  Subscription,
  TransactionType,
} from '../../types/finance';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import {
  calculateMonthlyEquivalent,
  getSubscriptionBillingStatus,
} from '../../utils/subscriptionMetrics';
import { parseLocalDate } from '../../utils/transactionMetrics';
import { AccountIconBadge } from '../accounts/AccountIconBadge';
import { CategoryIconBadge } from '../budgets/CategoryIconBadge';

interface SubscriptionCardProps {
  subscription: Subscription;
  account?: Account;
  toAccount?: Account;
  category?: BudgetCategory;
  globalCurrency: string;
  timezone?: string;
  isHighlighted?: boolean;
  convertToGlobal: (amount: number, fromCurrency: string) => number;
  onToggleActive: (sub: Subscription) => void;
  onEdit: (sub: Subscription) => void;
  onDelete: (sub: Subscription) => void;
}

const SHORT_FREQ_SUFFIX: Record<'en' | 'es', Record<BillingFrequency, string>> = {
  en: {
    weekly: '/ wk',
    biweekly: '/ 2 wk',
    monthly: '/ mo',
    quarterly: '/ qtr',
    annual: '/ yr',
  },
  es: {
    weekly: '/ sem',
    biweekly: '/ qna',
    monthly: '/ mes',
    quarterly: '/ trim',
    annual: '/ año',
  },
};

export function SubscriptionCard({
  subscription,
  account,
  toAccount,
  category,
  globalCurrency,
  timezone,
  isHighlighted = false,
  convertToGlobal,
  onToggleActive,
  onEdit,
  onDelete,
}: SubscriptionCardProps) {
  const { locale, t } = useLanguage();
  const kind: TransactionType = subscription.kind ?? 'expense';
  const nativeCurrency = account?.currency ?? 'USD';
  const dstCurrency = toAccount?.currency ?? nativeCurrency;
  const isCrossCurrencyTransfer = kind === 'transfer' && toAccount && dstCurrency !== nativeCurrency;

  const convertedNative = convertToGlobal(subscription.amount, nativeCurrency);
  const monthlyNative = calculateMonthlyEquivalent(subscription.amount, subscription.frequency);
  const monthlyGlobal = convertToGlobal(monthlyNative, nativeCurrency);
  const showConverted = nativeCurrency !== globalCurrency;

  const billingStatus = getSubscriptionBillingStatus(subscription, timezone);

  const formattedBillingDate = new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parseLocalDate(subscription.nextBillingDate));

  let countdownLabel = t('subs.paused');
  let countdownTone = 'border-white/[0.08] bg-white/[0.04] text-[#B8B8BE]';

  if (subscription.isActive) {
    if (billingStatus.daysRemaining < 0) {
      countdownLabel = t('subs.overdue').replace(
        '{days}',
        String(Math.abs(billingStatus.daysRemaining))
      );
      countdownTone = 'border-coral/35 bg-coral/15 text-coral';
    } else if (billingStatus.daysRemaining === 0) {
      countdownLabel = t('subs.dueToday');
      countdownTone = 'border-coral/35 bg-coral/15 text-coral';
    } else if (billingStatus.daysRemaining === 1) {
      countdownLabel = t('subs.dueTomorrow');
      countdownTone = 'border-amber-400/35 bg-amber-400/15 text-amber-300';
    } else if (billingStatus.daysRemaining <= 7) {
      countdownLabel = t('subs.inDays').replace('{days}', String(billingStatus.daysRemaining));
      countdownTone = 'border-amber-400/35 bg-amber-400/15 text-amber-300';
    } else {
      countdownLabel = t('subs.inDays').replace('{days}', String(billingStatus.daysRemaining));
      countdownTone = 'border-dynamic-accent bg-dynamic-accent-soft text-dynamic-accent';
    }
  }

  const amountColorClass =
    kind === 'income' ? 'text-dynamic-accent' : kind === 'expense' ? 'text-coral' : 'text-white';
  const amountPrefix = kind === 'income' ? '+' : kind === 'expense' ? '-' : '';

  return (
    <motion.article
      id={`sub-card-${subscription.id}`}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: subscription.isActive ? 1 : 0.55, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      className={`glass-card relative overflow-hidden p-6 flex flex-col justify-between gap-5 transition-all duration-300 ${
        isHighlighted
          ? 'ring-2 ring-dynamic-accent shadow-[0_0_24px_-4px_var(--accent-color)]'
          : ''
      }`}
      style={{
        backgroundImage: `radial-gradient(circle at 100% 0%, ${subscription.color}18, transparent 58%)`,
      }}
    >
      {/* Zone 1: Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <CategoryIconBadge iconId={subscription.iconId} color={subscription.color} size="lg" />
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-white truncate">
              {subscription.name}
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-[#B8B8BE]">
              <span>{t(`subs.freq.${subscription.frequency}` as const)}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  kind === 'income'
                    ? 'text-dynamic-accent'
                    : kind === 'expense'
                      ? 'text-white/90'
                      : 'text-[#B8B8BE]'
                }
              >
                {t(`subs.type.${kind}` as const)}
              </span>
              {kind !== 'transfer' && category && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <span>{category.name}</span>
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={subscription.isActive}
            aria-label={subscription.isActive ? t('subs.pauseAction') : t('subs.resumeAction')}
            title={subscription.isActive ? t('subs.pauseAction') : t('subs.resumeAction')}
            onClick={() => onToggleActive(subscription)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors p-0.5 ${
              subscription.isActive
                ? 'bg-dynamic-accent border-dynamic-accent'
                : 'bg-black/40 border-white/[0.14]'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-[#1A1A1C] shadow transition-transform ${
                subscription.isActive ? 'translate-x-5' : 'translate-x-0 bg-white/75'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => onEdit(subscription)}
            aria-label={t('subs.edit')}
            title={t('subs.edit')}
            className="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#B8B8BE] opacity-80 hover:opacity-100 hover:bg-white/[0.1] hover:text-white active:scale-95 transition-all"
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(subscription)}
            aria-label={t('subs.delete')}
            title={t('subs.delete')}
            className="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#B8B8BE] opacity-80 hover:opacity-100 hover:border-coral/30 hover:bg-coral/15 hover:text-coral active:scale-95 transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Zone 2: Hero Amount Row */}
      <div className="space-y-1">
        {isCrossCurrencyTransfer ? (
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums">
              {formatCurrencyAmount(subscription.amount, nativeCurrency)}
            </span>
            <ArrowRight className="h-4 w-4 text-dynamic-accent self-center shrink-0" />
            <span className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-dynamic-accent tabular-nums">
              {formatCurrencyAmount(subscription.toAmount ?? subscription.amount, dstCurrency)}
            </span>
            <span className="text-sm font-medium text-[#8E8E93]">
              {SHORT_FREQ_SUFFIX[locale][subscription.frequency]}
            </span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span
              className={`font-display text-3xl font-bold tracking-tight tabular-nums ${amountColorClass}`}
            >
              {amountPrefix}
              {formatCurrencyAmount(subscription.amount, nativeCurrency)}
            </span>
            <span className="text-sm font-medium text-[#8E8E93]">
              {SHORT_FREQ_SUFFIX[locale][subscription.frequency]}
            </span>
          </div>
        )}

        {(showConverted || (kind !== 'transfer' && subscription.frequency !== 'monthly')) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-[#8E8E93] tabular-nums">
            {showConverted && (
              <span>
                {t('subs.approx')} {formatCurrencyAmount(convertedNative, globalCurrency)}
              </span>
            )}
            {kind !== 'transfer' && subscription.frequency !== 'monthly' && (
              <span>
                {t('subs.monthlyEquiv')}:{' '}
                <span className="text-[#B8B8BE] font-medium">
                  {formatCurrencyAmount(monthlyGlobal, globalCurrency)}
                  {t('subs.perMonthSuffix')}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Zone 3: Structured Metadata Footer */}
      <div className="pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
        {kind === 'transfer' ? (
          <div className="inline-flex items-center gap-2 min-w-0">
            {account ? (
              <AccountIconBadge
                iconId={account.iconId}
                color={account.color}
                accountType={account.type}
                size="sm"
              />
            ) : null}
            <span className="truncate text-sm font-medium text-white">
              {account?.name ?? t('subs.unknownAccount')}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-[#8E8E93] shrink-0" />
            <span className="truncate text-sm font-medium text-white">
              {toAccount?.name ?? t('subs.unknownAccount')}
            </span>
          </div>
        ) : account ? (
          <div className="inline-flex items-center gap-2 min-w-0">
            <AccountIconBadge
              iconId={account.iconId}
              color={account.color}
              accountType={account.type}
              size="sm"
            />
            <span className="truncate text-sm font-medium text-white">{account.name}</span>
            <span className="text-[13px] text-[#8E8E93] shrink-0">· {account.currency}</span>
          </div>
        ) : (
          <span className="text-[13px] text-[#8E8E93]">{t('subs.unknownAccount')}</span>
        )}

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="inline-flex items-center gap-1.5 text-[13px] text-[#B8B8BE] tabular-nums">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#8E8E93]" />
            {formattedBillingDate}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-semibold tabular-nums ${countdownTone}`}
          >
            {countdownLabel}
          </span>
        </div>
      </div>
    </motion.article>
  );
}
