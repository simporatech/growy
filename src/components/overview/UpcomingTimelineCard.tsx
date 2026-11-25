import { ArrowUpRight, CalendarClock, HandCoins, Repeat } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { UpcomingItem } from '../../utils/overviewMetrics';

interface UpcomingTimelineCardProps {
  items: UpcomingItem[];
  onNavigateRecurring: () => void;
}

export function UpcomingTimelineCard({
  items,
  onNavigateRecurring,
}: UpcomingTimelineCardProps) {
  const { t } = useLanguage();

  return (
    <section className="glass-card lg:col-span-5 p-6 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            {t('overview.upcomingTitle')}
          </h2>
          <p className="text-sm text-[#B8B8BE]">{t('overview.upcomingSubtitle')}</p>
        </div>

        <button
          type="button"
          onClick={onNavigateRecurring}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-medium text-dynamic-accent hover:bg-white/[0.08] transition-colors"
        >
          <span>{t('overview.viewRecurring')}</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-11 w-11 items-center justify-center rounded-2xl border">
            <CalendarClock className="text-dynamic-accent h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-white">{t('overview.noUpcomingTitle')}</p>
          <p className="mt-1 text-[13px] text-[#B8B8BE]">{t('overview.noUpcomingDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.slice(0, 6).map((item) => {
            const isOverdue = item.daysRemaining < 0;
            const isToday = item.daysRemaining === 0;
            const pillLabel = isOverdue
              ? t('loans.overdueDays').replace('{days}', String(Math.abs(item.daysRemaining)))
              : isToday
                ? t('loans.dueToday')
                : item.daysRemaining === 1
                  ? t('loans.dueTomorrow')
                  : t('loans.daysLeft').replace('{days}', String(item.daysRemaining));

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-black/30">
                    {item.kind === 'loan' ? (
                      <HandCoins className="h-4 w-4 text-dynamic-accent" />
                    ) : (
                      <Repeat className="h-4 w-4 text-dynamic-accent" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{item.title}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          isOverdue
                            ? 'bg-coral/15 text-coral'
                            : isToday
                              ? 'bg-amber-400/15 text-amber-300'
                              : 'bg-white/[0.06] text-[#B8B8BE]'
                        }`}
                      >
                        {pillLabel}
                      </span>
                      <span className="text-[#8E8E93] tabular-nums">{item.date}</span>
                    </div>
                  </div>
                </div>

                <span
                  className={`shrink-0 font-display text-sm font-semibold tabular-nums ${
                    item.direction === 'in'
                      ? 'text-dynamic-accent'
                      : item.direction === 'out'
                        ? 'text-coral'
                        : 'text-white'
                  }`}
                >
                  {item.direction === 'in' ? '+' : item.direction === 'out' ? '−' : ''}
                  {item.nativeFormatted}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

