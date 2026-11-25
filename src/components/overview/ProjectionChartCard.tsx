import { useId, useMemo, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Account, BudgetCategory, Loan, Subscription, Transaction } from '../../types/finance';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import { buildFinancialProjection, ProjectionHorizon } from '../../utils/projectionEngine';

interface ProjectionChartCardProps {
  availableCash: number;
  subscriptions: Subscription[];
  transactions: Transaction[];
  accounts: Account[];
  categories: BudgetCategory[];
  loans: Loan[];
  globalCurrency: string;
  convertToGlobal: (amount: number, fromCurrency: string) => number;
  timeZone?: string;
}

export function ProjectionChartCard({
  availableCash,
  subscriptions,
  transactions,
  accounts,
  categories,
  loans,
  globalCurrency,
  convertToGlobal,
  timeZone,
}: ProjectionChartCardProps) {
  const { locale, t } = useLanguage();
  const [horizon, setHorizon] = useState<ProjectionHorizon>('this_month');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const realGradId = useId();

  const projection = useMemo(
    () =>
      buildFinancialProjection({
        horizon,
        availableCash,
        accounts,
        transactions,
        categories,
        subscriptions,
        loans,
        convertToGlobal,
        globalCurrency,
        locale,
        timeZone,
      }),
    [
      horizon,
      availableCash,
      accounts,
      transactions,
      categories,
      subscriptions,
      loans,
      convertToGlobal,
      globalCurrency,
      locale,
      timeZone,
    ]
  );

  const { points, todayIndex, projectedRealEnd, projectedPlanEnd, projectedNetChange, hasBudgetsOrGoals } =
    projection;

  const width = 780;
  const height = 250;
  const padLeft = 72;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const { minVal, maxVal } = useMemo(() => {
    const vals = points.flatMap((p) => [p.realBalance, p.planBalance]);
    const rawMin = Math.min(...vals, 0);
    const rawMax = Math.max(...vals, 1);
    const span = Math.max(10, rawMax - rawMin);
    return {
      minVal: rawMin - span * 0.08,
      maxVal: rawMax + span * 0.12,
    };
  }, [points]);

  const valRange = Math.max(1, maxVal - minVal);
  const toY = (val: number) => padTop + chartH - ((val - minVal) / valRange) * chartH;

  const coords = useMemo(() => {
    const count = Math.max(1, points.length);
    return points.map((p, idx) => {
      const x = count === 1 ? padLeft + chartW / 2 : padLeft + (idx / (count - 1)) * chartW;
      return {
        x,
        yReal: toY(p.realBalance),
        yPlan: toY(p.planBalance),
        point: p,
      };
    });
  }, [points, chartW, minVal, valRange]);

  const buildPath = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const realLine = buildPath(coords.map((c) => ({ x: c.x, y: c.yReal })));
  const realArea =
    coords.length > 0
      ? `${realLine} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + chartH).toFixed(
          1
        )} L ${coords[0].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`
      : '';
  const planLine = buildPath(coords.map((c) => ({ x: c.x, y: c.yPlan })));

  const todayCoord = coords[todayIndex];
  const hovered = hoverIdx !== null ? coords[hoverIdx] : null;

  const xLabelIndices = useMemo(() => {
    if (horizon === 'this_month') {
      const mid = Math.floor((points.length - 1) / 2);
      return [0, mid, points.length - 1].filter((v, i, a) => a.indexOf(v) === i);
    }
    return [0, 3, 6, 9, 11].filter((i) => i < points.length);
  }, [horizon, points.length]);

  const formatCompactCurrency = (val: number) => {
    if (Math.abs(val) >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(val) >= 1_000) {
      return `${(val / 1_000).toFixed(1)}k`;
    }
    return Math.round(val).toString();
  };

  return (
    <section className="glass-card p-6 space-y-5">
      {/* Header + Horizon Toggle + 3 Summary Pills */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              {t('overview.projDualTitle')}
            </h2>
            <p className="text-sm text-[#B8B8BE]">{t('overview.projDualSubtitle')}</p>
          </div>

          <div className="inline-flex rounded-xl border border-white/[0.08] bg-black/30 p-1">
            {(
              [
                { id: 'this_month', label: t('period.this_month') },
                { id: 'this_year', label: t('period.this_year') },
              ] as const
            ).map((tab) => {
              const active = horizon === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setHorizon(tab.id);
                    setHoverIdx(null);
                  }}
                  className={`min-h-[36px] rounded-lg px-3.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-dynamic-accent-soft border border-dynamic-accent text-white'
                      : 'text-[#B8B8BE] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3 Concise Summary KPI Pills */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-medium tabular-nums">
          <div className="rounded-xl border border-dynamic-accent/40 bg-dynamic-accent-subtle px-3 py-2">
            <span className="text-[#B8B8BE]">{t('overview.projRealEnd')}: </span>
            <span className="font-semibold text-dynamic-accent">
              {formatCurrencyAmount(projectedRealEnd, globalCurrency)}
            </span>
          </div>
          <div className="rounded-xl border border-sky-400/35 bg-sky-400/10 px-3 py-2">
            <span className="text-[#B8B8BE]">{t('overview.projPlanEnd')}: </span>
            <span className="font-semibold text-sky-300">
              {formatCurrencyAmount(projectedPlanEnd, globalCurrency)}
            </span>
          </div>
          <div className="rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2">
            <span className="text-[#B8B8BE]">{t('overview.projNetChange')}: </span>
            <span
              className={`font-semibold ${
                projectedNetChange >= 0 ? 'text-dynamic-accent' : 'text-coral'
              }`}
            >
              {projectedNetChange > 0 ? '+' : ''}
              {formatCurrencyAmount(projectedNetChange, globalCurrency)}
            </span>
          </div>
        </div>
      </div>

      {/* Legend + Optional Budgets Fallback Note */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#B8B8BE]">
        <div className="flex flex-wrap items-center gap-5">
          <span className="inline-flex items-center gap-2 text-white/90">
            <span className="bg-dynamic-accent h-0.5 w-5 rounded-full inline-block" />
            {t('overview.projRealLegend')}
          </span>
          <span className="inline-flex items-center gap-2 text-white/90">
            <span className="border-t-2 border-dashed border-sky-400 w-5 inline-block" />
            {t('overview.projPlanLegend')}
          </span>
        </div>
        {!hasBudgetsOrGoals && (
          <span className="text-xs text-[#8E8E93]">{t('overview.projNoBudgetsHint')}</span>
        )}
      </div>

      {/* Responsive SVG Chart */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-64 overflow-visible select-none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={realGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {[0, 0.5, 1].map((r) => {
            const val = minVal + valRange * r;
            const y = padTop + chartH * (1 - r);
            return (
              <g key={r}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 4"
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#8E8E93"
                  fontSize="12"
                >
                  {formatCompactCurrency(val)}
                </text>
              </g>
            );
          })}

          {/* Today Vertical Divider */}
          {todayCoord && (
            <g>
              <line
                x1={todayCoord.x}
                x2={todayCoord.x}
                y1={padTop}
                y2={padTop + chartH}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.25"
                strokeDasharray="4 4"
              />
              <text
                x={todayCoord.x}
                y={padTop - 5}
                textAnchor="middle"
                fill="var(--accent-color)"
                fontSize="11"
                fontWeight="600"
              >
                {t('transactions.today')}
              </text>
            </g>
          )}

          {/* Real Pace Area & Solid Curve */}
          <path d={realArea} fill={`url(#${realGradId})`} />
          <path
            d={planLine}
            fill="none"
            stroke="#38BDF8"
            strokeWidth="2.2"
            strokeDasharray="6 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={realLine}
            fill="none"
            stroke="var(--accent-color)"
            strokeWidth="2.6"
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
              />
              <circle
                cx={hovered.x}
                cy={hovered.yPlan}
                r="4.5"
                fill="#38BDF8"
                stroke="#1A1A1C"
                strokeWidth="2"
              />
              <circle
                cx={hovered.x}
                cy={hovered.yReal}
                r="5"
                fill="var(--accent-color)"
                stroke="#1A1A1C"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X-Axis Labels */}
          {xLabelIndices.map((idx) => (
            <text
              key={coords[idx].point.key}
              x={coords[idx].x}
              y={height - 6}
              textAnchor={idx === 0 ? 'start' : idx === coords.length - 1 ? 'end' : 'middle'}
              fill="#B8B8BE"
              fontSize="12"
            >
              {coords[idx].point.label}
            </text>
          ))}

          {/* Hit Targets */}
          {coords.map((c, idx) => {
            const sliceW = chartW / Math.max(1, coords.length);
            return (
              <rect
                key={c.point.key}
                x={c.x - sliceW / 2}
                y={padTop}
                width={Math.max(10, sliceW)}
                height={chartH + padBottom}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(idx)}
              />
            );
          })}
        </svg>

        {hovered && (
          <div className="mt-2 rounded-2xl border border-white/[0.08] bg-black/45 px-4 py-2.5 text-xs space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold text-white capitalize">
                {hovered.point.label}
                {hovered.point.isToday ? ` · ${t('transactions.today')}` : ''}
              </span>
              <div className="flex flex-wrap items-center gap-4 tabular-nums">
                <span className="text-dynamic-accent font-semibold">
                  {t('overview.projRealLegend')}:{' '}
                  {formatCurrencyAmount(hovered.point.realBalance, globalCurrency)}
                </span>
                <span className="text-sky-300 font-semibold">
                  {t('overview.projPlanLegend')}:{' '}
                  {formatCurrencyAmount(hovered.point.planBalance, globalCurrency)}
                </span>
              </div>
            </div>
            {hovered.point.events.length > 0 && (
              <p className="text-xs text-[#B8B8BE]">
                {hovered.point.events.join(' · ')}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
