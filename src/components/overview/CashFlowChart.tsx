import { useId, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import { CashFlowBucket } from '../../utils/overviewMetrics';

interface CashFlowChartProps {
  buckets: CashFlowBucket[];
  globalCurrency: string;
  periodDeltaPct: number | null;
}

export function CashFlowChart({
  buckets,
  globalCurrency,
  periodDeltaPct,
}: CashFlowChartProps) {
  const { t } = useLanguage();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const gradientIncomeId = useId();
  const gradientExpenseId = useId();

  const hasData = useMemo(
    () => buckets.some((b) => b.income > 0 || b.expenses > 0),
    [buckets]
  );

  const width = 680;
  const height = 220;
  const padX = 18;
  const padTop = 18;
  const padBottom = 26;
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;

  const maxVal = useMemo(() => {
    const rawMax = buckets.reduce((m, b) => Math.max(m, b.income, b.expenses), 0);
    return rawMax > 0 ? rawMax * 1.15 : 100;
  }, [buckets]);

  const points = useMemo(() => {
    const count = Math.max(1, buckets.length);
    return buckets.map((b, idx) => {
      const x = count === 1 ? padX + chartW / 2 : padX + (idx / (count - 1)) * chartW;
      const yInc = padTop + chartH - (b.income / maxVal) * chartH;
      const yExp = padTop + chartH - (b.expenses / maxVal) * chartH;
      return { x, yInc, yExp, bucket: b };
    });
  }, [buckets, chartW, chartH, maxVal]);

  const buildPath = (coords: Array<{ x: number; y: number }>) => {
    if (coords.length === 0) return '';
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
    return coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  };

  const buildArea = (coords: Array<{ x: number; y: number }>) => {
    if (coords.length === 0) return '';
    const baseY = padTop + chartH;
    const line = buildPath(coords);
    return `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${baseY} L ${coords[0].x.toFixed(1)} ${baseY} Z`;
  };

  const incomeLine = buildPath(points.map((p) => ({ x: p.x, y: p.yInc })));
  const incomeArea = buildArea(points.map((p) => ({ x: p.x, y: p.yInc })));
  const expenseLine = buildPath(points.map((p) => ({ x: p.x, y: p.yExp })));
  const expenseArea = buildArea(points.map((p) => ({ x: p.x, y: p.yExp })));

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <section className="glass-card xl:col-span-8 p-6 flex flex-col justify-between gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            {t('overview.cashFlowTitle')}
          </h2>
          <p className="text-sm text-[#B8B8BE]">{t('overview.cashFlowSubtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 text-white/90">
              <span className="bg-dynamic-accent h-2.5 w-2.5 rounded-full" />
              {t('transactions.type.income')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-white/90">
              <span className="bg-coral h-2.5 w-2.5 rounded-full" />
              {t('transactions.type.expense')}
            </span>
          </div>

          {periodDeltaPct !== null && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold tabular-nums ${
                periodDeltaPct >= 0
                  ? 'border-dynamic-accent bg-dynamic-accent-subtle text-dynamic-accent'
                  : 'border-coral/35 bg-coral/15 text-coral'
              }`}
            >
              {periodDeltaPct > 0 ? `+${periodDeltaPct}%` : `${periodDeltaPct}%`}
            </span>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-12 w-12 items-center justify-center rounded-2xl border">
            <TrendingUp className="text-dynamic-accent h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-white">{t('overview.noChartDataTitle')}</p>
          <p className="mt-1 max-w-sm text-[13px] text-[#B8B8BE]">
            {t('overview.noChartDataDesc')}
          </p>
        </div>
      ) : (
        <div className="relative w-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-52 sm:h-56 overflow-visible select-none touch-pan-y"
            onMouseLeave={() => setHoverIdx(null)}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              if (!touch || points.length === 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = ((touch.clientX - rect.left) / Math.max(1, rect.width)) * width;
              const clamped = Math.max(padX, Math.min(width - padX, relX));
              const ratio = (clamped - padX) / Math.max(1, chartW);
              setHoverIdx(Math.round(ratio * (points.length - 1)));
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              if (!touch || points.length === 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = ((touch.clientX - rect.left) / Math.max(1, rect.width)) * width;
              const clamped = Math.max(padX, Math.min(width - padX, relX));
              const ratio = (clamped - padX) / Math.max(1, chartW);
              setHoverIdx(Math.round(ratio * (points.length - 1)));
            }}
          >
            <defs>
              <linearGradient id={gradientIncomeId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id={gradientExpenseId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {[0, 0.5, 1].map((ratio) => {
              const y = padTop + chartH * (1 - ratio);
              return (
                <line
                  key={ratio}
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Area & Line Paths */}
            <path d={incomeArea} fill={`url(#${gradientIncomeId})`} />
            <path d={expenseArea} fill={`url(#${gradientExpenseId})`} />
            <path
              d={incomeLine}
              fill="none"
              stroke="var(--accent-color)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={expenseLine}
              fill="none"
              stroke="#FF6B6B"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover Crosshair */}
            {hovered && (
              <g>
                <line
                  x1={hovered.x}
                  x2={hovered.x}
                  y1={padTop}
                  y2={padTop + chartH}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={hovered.x}
                  cy={hovered.yInc}
                  r="4.5"
                  fill="var(--accent-color)"
                  stroke="#1A1A1C"
                  strokeWidth="2"
                />
                <circle
                  cx={hovered.x}
                  cy={hovered.yExp}
                  r="4.5"
                  fill="#FF6B6B"
                  stroke="#1A1A1C"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* X-Axis Labels (start, middle, end) */}
            {points.length > 0 &&
              [0, Math.floor((points.length - 1) / 2), points.length - 1]
                .filter((val, idx, arr) => arr.indexOf(val) === idx)
                .map((idx) => (
                  <text
                    key={points[idx].bucket.key}
                    x={points[idx].x}
                    y={height - 6}
                    textAnchor={
                      idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'
                    }
                    fill="#8E8E93"
                    fontSize="12"
                  >
                    {points[idx].bucket.label}
                  </text>
                ))}

            {/* Invisible Hit Targets */}
            {points.map((p, idx) => {
              const sliceW = chartW / Math.max(1, points.length);
              return (
                <rect
                  key={p.bucket.key}
                  x={p.x - sliceW / 2}
                  y={padTop}
                  width={Math.max(8, sliceW)}
                  height={chartH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(idx)}
                  onClick={() => setHoverIdx((prev) => (prev === idx ? null : idx))}
                />
              );
            })}
          </svg>

          {hovered && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-black/40 px-3.5 py-2 text-xs">
              <span className="font-semibold text-white">{hovered.bucket.label}</span>
              <div className="flex flex-wrap items-center gap-4 tabular-nums">
                <span className="text-dynamic-accent">
                  +{formatCurrencyAmount(hovered.bucket.income, globalCurrency)}
                </span>
                <span className="text-coral">
                  −{formatCurrencyAmount(hovered.bucket.expenses, globalCurrency)}
                </span>
                <span className="font-semibold text-white">
                  {t('overview.netLabel')}: {formatCurrencyAmount(hovered.bucket.net, globalCurrency)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

