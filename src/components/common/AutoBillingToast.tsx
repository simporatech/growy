import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Repeat, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import { AutoBillingSummaryItem } from '../../utils/subscriptionAutomation';

interface AutoBillingToastProps {
  items: AutoBillingSummaryItem[] | null;
  totalGlobalCharged: number;
  globalCurrency: string;
  onViewTransactions: () => void;
  onDismiss: () => void;
}

export function AutoBillingToast({
  items,
  totalGlobalCharged,
  globalCurrency,
  onViewTransactions,
  onDismiss,
}: AutoBillingToastProps) {
  const { t } = useLanguage();

  useEffect(() => {
    if (!items || items.length === 0) return;
    const timer = window.setTimeout(() => onDismiss(), 8000);
    return () => window.clearTimeout(timer);
  }, [items, onDismiss]);

  const count = items?.length ?? 0;
  const firstTwoNames = items
    ? items
        .slice(0, 2)
        .map((i) => i.name)
        .join(', ')
    : '';
  const extraCount = count > 2 ? count - 2 : 0;
  const namesSummary =
    extraCount > 0 ? `${firstTwoNames} +${extraCount}` : firstTwoNames;

  return (
    <AnimatePresence>
      {items && items.length > 0 && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-4 right-4 z-[90] w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-[#242426]/95 backdrop-blur-2xl border border-white/[0.12] p-4 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]"
        >
          <div className="flex items-start gap-3">
            <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
              <Repeat className="text-dynamic-accent h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-sm font-semibold text-white">
                  {t('autoBilling.toastTitle')}
                </p>
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label="Close"
                  className="shrink-0 text-[#B8B8BE] hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-[13px] text-[#B8B8BE] leading-snug">
                <span className="text-white font-medium">{namesSummary}</span> ·{' '}
                <span className="text-dynamic-accent font-semibold tabular-nums">
                  {formatCurrencyAmount(totalGlobalCharged, globalCurrency)}
                </span>
              </p>

              <button
                type="button"
                onClick={() => {
                  onViewTransactions();
                  onDismiss();
                }}
                className="text-dynamic-accent inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline pt-0.5"
              >
                <span>{t('autoBilling.viewTransactions')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

