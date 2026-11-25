import { useMemo, useState } from 'react';
import { PieChart } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import { SpendingSlice } from '../../utils/overviewMetrics';

interface SpendingDonutCardProps {
  slices: SpendingSlice[];
  totalExpenses: number;
  globalCurrency: string;
}

export function SpendingDonutCard({
  slices,
  totalExpenses,
  globalCurrency,
}: SpendingDonutCardProps) {
  const { t } = useLanguage();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const radius = 56;
  const circumference = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    let offset = 0;
    return slices.slice(0, 6).map((slice) => {
      const length = (slice.pct / 100) * circumference;
      const seg = {
        ...slice,
        dashArray: `${length} ${circumference - length}`,
        dashOffset: -offset,
      };
      offset += length;
      return seg;
    });
  }, [slices, circumference]);

  const activeSlice = segments.find((s) => s.id === hoveredId);

  return (
    <section className="glass-card xl:col-span-4 p-6 flex flex-col justify-between gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-white">
          {t('overview.spendingTitle')}
        </h2>
        <p className="text-sm text-[#B8B8BE]">{t('overview.spendingSubtitle')}</p>
      </div>

      {segments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-12 w-12 items-center justify-center rounded-2xl border">
            <PieChart className="text-dynamic-accent h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-white">{t('overview.noSpendingTitle')}</p>
          <p className="mt-1 text-[13px] text-[#B8B8BE]">{t('overview.noSpendingDesc')}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {/* Donut Ring */}
          <div className="relative flex h-40 w-40 items-center justify-center">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="16"
              />
              {segments.map((seg) => {
                const isActive = hoveredId === seg.id;
                return (
                  <circle
                    key={seg.id}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={isActive ? '19' : '16'}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    opacity={hoveredId && !isActive ? 0.38 : 1}
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredId(seg.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => setHoveredId((prev) => (prev === seg.id ? null : seg.id))}
                  />
                );
              })}
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
              <span className="truncate max-w-[96px] text-xs font-medium text-[#B8B8BE]">
                {activeSlice ? activeSlice.name : t('overview.totalLabel')}
              </span>
              <span className="mt-0.5 font-display text-sm sm:text-base font-bold text-white tabular-nums">
                {formatCurrencyAmount(
                  activeSlice ? activeSlice.amount : totalExpenses,
                  globalCurrency
                )}
              </span>
              {activeSlice && (
                <span className="text-xs font-semibold text-dynamic-accent tabular-nums">
                  {Math.round(activeSlice.pct)}%
                </span>
              )}
            </div>
          </div>

          {/* Top 4 Categories */}
          <div className="w-full space-y-2">
            {slices.slice(0, 4).map((slice) => (
              <div
                key={slice.id}
                onMouseEnter={() => setHoveredId(slice.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setHoveredId((prev) => (prev === slice.id ? null : slice.id))}
                className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate text-sm text-white/90">{slice.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                  <span className="text-xs font-medium text-[#B8B8BE]">
                    {formatCurrencyAmount(slice.amount, globalCurrency)}
                  </span>
                  <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-xs font-semibold text-white">
                    {Math.round(slice.pct)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

