import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Transaction } from '../../types/finance';
import { calculateAccountBalance, formatCurrencyAmount } from '../../utils/accountMetrics';
import {
  filterTransactionsByTimePeriod,
  normalizeLegacyPeriodPreset,
  TimePeriodValue,
} from '../../utils/dateRangeFilter';
import { analyzeFinancialIntent } from '../../utils/intelligenceEngine';
import { calculateLoanSummary } from '../../utils/loanMetrics';
import {
  buildCashFlowBuckets,
  buildSpendingSlices,
  buildUpcoming14Days,
} from '../../utils/overviewMetrics';
import { calculateTransactionSummary } from '../../utils/transactionMetrics';
import { TimePeriodFilter } from '../common/TimePeriodFilter';
import { TransactionModal } from '../transactions/TransactionModal';
import { AccountsOverviewCard } from './AccountsOverviewCard';
import { BottomInsightsRow } from './BottomInsightsRow';
import { BudgetsPulseCard } from './BudgetsPulseCard';
import { CashFlowChart } from './CashFlowChart';
import { ProjectionChartCard } from './ProjectionChartCard';
import { SpendingDonutCard } from './SpendingDonutCard';
import { UpcomingTimelineCard } from './UpcomingTimelineCard';

export type OverviewTargetTab =
  | 'accounts'
  | 'transactions'
  | 'budgets'
  | 'subscriptions'
  | 'loans'
  | 'intelligence';

interface OverviewViewProps {
  onNavigate: (tab: OverviewTargetTab) => void;
}

export function OverviewView({ onNavigate }: OverviewViewProps) {
  const { user, addTransaction, updateUserPreferences } = useAuth();
  const { currency: globalCurrency, convertBetween } = useCurrency();
  const { locale, t } = useLanguage();

  const savedOverview = user?.preferences.viewFilters?.overview;
  const [periodValue, setPeriodValue] = useState<TimePeriodValue>({
    preset: normalizeLegacyPeriodPreset(savedOverview?.periodFilter, 'this_month'),
    customStart: savedOverview?.customStart,
    customEnd: savedOverview?.customEnd,
  });
  const [txModalOpen, setTxModalOpen] = useState(false);

  useEffect(() => {
    const current = user?.preferences.viewFilters?.overview;
    if (
      current?.periodFilter === periodValue.preset &&
      current?.customStart === periodValue.customStart &&
      current?.customEnd === periodValue.customEnd
    ) {
      return;
    }
    updateUserPreferences({
      viewFilters: {
        overview: {
          periodFilter: periodValue.preset,
          customStart: periodValue.customStart,
          customEnd: periodValue.customEnd,
        },
      },
    });
  }, [periodValue, user?.preferences.viewFilters?.overview, updateUserPreferences]);

  const accounts = user?.data.accounts ?? [];
  const transactions = user?.data.transactions ?? [];
  const categories = user?.data.budgets ?? [];
  const subscriptions = user?.data.subscriptions ?? [];
  const loans = user?.data.loans ?? [];
  const timezone = user?.preferences.timezone;

  const convertToGlobal = useCallback(
    (amount: number, from: string) => convertBetween(amount, from, globalCurrency),
    [convertBetween, globalCurrency]
  );

  // Greeting & Date
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || 'Growy';
  const hour = new Date().getHours();
  const greetingKey =
    hour < 12
      ? 'overview.greetingMorning'
      : hour < 19
        ? 'overview.greetingAfternoon'
        : 'overview.greetingEvening';

  const formattedDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    [locale]
  );

  // Portfolio & KPI calculations
  const accountBalances = useMemo(
    () =>
      accounts.map((acc) => {
        const nativeBalance = calculateAccountBalance(acc, transactions);
        return {
          acc,
          nativeBalance,
          globalBalance: convertToGlobal(nativeBalance, acc.currency),
        };
      }),
    [accounts, transactions, convertToGlobal]
  );

  const availableCash = useMemo(
    () => accountBalances.reduce((s, item) => s + item.globalBalance, 0),
    [accountBalances]
  );

  const currencySummaryText = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of accountBalances) {
      map.set(item.acc.currency, (map.get(item.acc.currency) ?? 0) + item.globalBalance);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([cur, val]) => {
        const pct = availableCash > 0 ? Math.round((val / availableCash) * 100) : 0;
        return `${cur} ${pct}%`;
      })
      .join(' · ');
  }, [accountBalances, availableCash]);

  const loanSummary = useMemo(
    () => calculateLoanSummary(loans, convertToGlobal),
    [loans, convertToGlobal]
  );

  const totalAssets = availableCash + loanSummary.totalReceivable;
  const totalLiabilities = loanSummary.totalPayable;
  const trueNetWorth = totalAssets - totalLiabilities;

  const periodTransactions = useMemo(
    () => filterTransactionsByTimePeriod(transactions, periodValue, timezone),
    [transactions, periodValue, timezone]
  );

  const periodSummary = useMemo(
    () => calculateTransactionSummary(periodTransactions, accounts, convertToGlobal, globalCurrency),
    [periodTransactions, accounts, convertToGlobal, globalCurrency]
  );

  const savingsRatePct =
    periodSummary.totalIncome > 0
      ? Math.round(
          ((periodSummary.totalIncome - periodSummary.totalExpenses) / periodSummary.totalIncome) *
            100
        )
      : 0;

  const periodDeltaPct = useMemo(() => {
    if (periodValue.preset !== 'this_month') return null;
    const prevTxs = filterTransactionsByTimePeriod(transactions, { preset: 'last_month' }, timezone);
    if (prevTxs.length === 0) return null;
    const prevSummary = calculateTransactionSummary(prevTxs, accounts, convertToGlobal, globalCurrency);
    if (prevSummary.netCashFlow === 0) return null;
    return Math.round(
      ((periodSummary.netCashFlow - prevSummary.netCashFlow) / Math.abs(prevSummary.netCashFlow)) *
        100
    );
  }, [
    periodValue.preset,
    transactions,
    accounts,
    timezone,
    convertToGlobal,
    globalCurrency,
    periodSummary.netCashFlow,
  ]);

  const { items: upcoming14Items, due7DaysOutflow } = useMemo(
    () =>
      buildUpcoming14Days(
        subscriptions,
        loans,
        accounts,
        convertToGlobal,
        globalCurrency,
        timezone
      ),
    [subscriptions, loans, accounts, convertToGlobal, globalCurrency, timezone]
  );

  const safeToSpend = availableCash - due7DaysOutflow;

  const cashFlowBuckets = useMemo(
    () =>
      buildCashFlowBuckets(
        periodTransactions,
        accounts,
        periodValue,
        convertToGlobal,
        globalCurrency,
        locale,
        timezone
      ),
    [periodTransactions, accounts, periodValue, convertToGlobal, globalCurrency, locale, timezone]
  );

  const spendingSlices = useMemo(
    () =>
      buildSpendingSlices(
        periodTransactions,
        accounts,
        categories,
        convertToGlobal,
        globalCurrency,
        t('transactions.uncategorized')
      ),
    [periodTransactions, accounts, categories, convertToGlobal, globalCurrency, t]
  );

  const intelligenceSpotlight = useMemo(() => {
    if (!user) return { score: 65, tip: '' };
    const health = analyzeFinancialIntent(
      'health_check',
      user,
      convertToGlobal,
      globalCurrency,
      locale
    );
    const plan = analyzeFinancialIntent(
      'action_plan',
      user,
      convertToGlobal,
      globalCurrency,
      locale
    );
    const firstTipLine =
      plan.answerText
        .split('\n')
        .find((line) => /^\d+\./.test(line.trim()))
        ?.replace(/^\d+\.\s*/, '') ?? plan.answerText;
    return {
      score: health.healthScore ?? 65,
      tip: firstTipLine,
    };
  }, [user, convertToGlobal, globalCurrency, locale]);

  const handleSaveNewTransaction = (payload: Omit<Transaction, 'id' | 'createdAt'>) => {
    addTransaction(payload);
    setTxModalOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      {/* Executive Command Header */}
      <header className="glass-card relative z-30 p-6 sm:p-7 rounded-3xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="min-w-0">
          <p className="text-sm font-medium capitalize text-[#B8B8BE]">{formattedDate}</p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
            {t(greetingKey).replace('{name}', firstName)}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <TimePeriodFilter
            value={periodValue}
            onChange={setPeriodValue}
            defaultPreset="this_month"
          />

          <button
            type="button"
            onClick={() => onNavigate('intelligence')}
            className="h-11 inline-flex items-center gap-2 rounded-xl border border-dynamic-accent bg-dynamic-accent-subtle px-4 text-sm font-medium text-dynamic-accent hover:bg-dynamic-accent-soft active:scale-[0.98] transition-all"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>{t('overview.askGrowy')}</span>
          </button>

          <button
            type="button"
            onClick={() => setTxModalOpen(true)}
            style={{ color: 'var(--accent-foreground)' }}
            className="bg-dynamic-accent h-11 inline-flex items-center gap-2 rounded-xl px-4 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>{t('transactions.record')}</span>
          </button>
        </div>
      </header>

      {/* 4 Hero KPI Bento Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. True Net Worth */}
        <div className="glass-card p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[#B8B8BE]">{t('overview.netWorth')}</span>
            <div className="bg-dynamic-accent-soft text-dynamic-accent flex h-8 w-8 items-center justify-center rounded-xl">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p
            className={`font-display text-2xl sm:text-3xl font-bold tracking-tight tabular-nums ${
              trueNetWorth >= 0 ? 'text-white' : 'text-coral'
            }`}
          >
            {formatCurrencyAmount(trueNetWorth, globalCurrency)}
          </p>
          <div className="space-y-0.5 text-xs text-[#B8B8BE] tabular-nums">
            <div className="flex items-center justify-between gap-2">
              <span>{t('overview.assetsLabel')}</span>
              <span className="font-medium text-white">
                {formatCurrencyAmount(totalAssets, globalCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>{t('overview.liabilitiesLabel')}</span>
              <span className="font-medium text-coral">
                {formatCurrencyAmount(totalLiabilities, globalCurrency)}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Available Cash */}
        <div className="glass-card p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[#B8B8BE]">
              {t('overview.availableCash')}
            </span>
            <span className="rounded-full border border-dynamic-accent bg-dynamic-accent-subtle px-2.5 py-0.5 text-xs font-semibold text-dynamic-accent">
              {t('accounts.liveFxBadge')}
            </span>
          </div>
          <p className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums">
            {formatCurrencyAmount(availableCash, globalCurrency)}
          </p>
          <p className="text-xs text-[#B8B8BE] tabular-nums">
            {currencySummaryText || `${accounts.length} ${t('nav.accounts')}`}
          </p>
        </div>

        {/* 3. Period Net Balance */}
        <div className="glass-card p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[#B8B8BE]">
              {t('overview.periodNetBalance')}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                savingsRatePct >= 0
                  ? 'bg-dynamic-accent-subtle text-dynamic-accent border border-dynamic-accent'
                  : 'bg-coral/15 text-coral border border-coral/30'
              }`}
            >
              {t('overview.savingsRate')}: {savingsRatePct}%
            </span>
          </div>
          <p
            className={`font-display text-2xl sm:text-3xl font-bold tracking-tight tabular-nums ${
              periodSummary.netCashFlow >= 0 ? 'text-dynamic-accent' : 'text-coral'
            }`}
          >
            {formatCurrencyAmount(periodSummary.netCashFlow, globalCurrency)}
          </p>
          <p className="text-xs text-[#B8B8BE] tabular-nums">
            +{formatCurrencyAmount(periodSummary.totalIncome, globalCurrency)} · −
            {formatCurrencyAmount(periodSummary.totalExpenses, globalCurrency)}
          </p>
        </div>

        {/* 4. Safe to Spend */}
        <div className="glass-card p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[#B8B8BE]">
              {t('overview.safeToSpend')}
            </span>
            <div className="bg-dynamic-accent-soft text-dynamic-accent flex h-8 w-8 items-center justify-center rounded-xl">
              {safeToSpend >= 0 ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <Wallet className="h-4 w-4 text-coral" />
              )}
            </div>
          </div>
          <p
            className={`font-display text-2xl sm:text-3xl font-bold tracking-tight tabular-nums ${
              safeToSpend >= 0 ? 'text-white' : 'text-coral'
            }`}
          >
            {formatCurrencyAmount(safeToSpend, globalCurrency)}
          </p>
          <p className="text-xs text-[#B8B8BE] tabular-nums">
            {t('overview.due7DaysHint').replace(
              '{amount}',
              formatCurrencyAmount(due7DaysOutflow, globalCurrency)
            )}
          </p>
        </div>
      </section>

      {/* Row 1: Cash Flow Chart (8 cols) + Spending Donut (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <CashFlowChart
          buckets={cashFlowBuckets}
          globalCurrency={globalCurrency}
          periodDeltaPct={periodDeltaPct}
        />
        <SpendingDonutCard
          slices={spendingSlices}
          totalExpenses={periodSummary.totalExpenses}
          globalCurrency={globalCurrency}
        />
      </div>

      {/* Row 2: Dual-Trajectory Projection Chart */}
      <ProjectionChartCard
        availableCash={availableCash}
        subscriptions={subscriptions}
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        loans={loans}
        globalCurrency={globalCurrency}
        convertToGlobal={convertToGlobal}
        timeZone={timezone}
      />

      {/* Row 3: Budgets Pulse (6 cols) + Accounts & Currency Exposure (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <BudgetsPulseCard
          categories={categories}
          transactions={transactions}
          accounts={accounts}
          globalCurrency={globalCurrency}
          convertToGlobal={convertToGlobal}
          onNavigateBudgets={() => onNavigate('budgets')}
        />
        <AccountsOverviewCard
          accounts={accounts}
          transactions={transactions}
          globalCurrency={globalCurrency}
          convertToGlobal={convertToGlobal}
          onNavigateAccounts={() => onNavigate('accounts')}
        />
      </div>

      {/* Row 4: Upcoming 14-Day Timeline (5 cols) + Loans, Intelligence & Recent Activity (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <UpcomingTimelineCard
          items={upcoming14Items}
          onNavigateRecurring={() => onNavigate('subscriptions')}
        />
        <BottomInsightsRow
          loans={loans}
          transactions={transactions}
          accounts={accounts}
          categories={categories}
          globalCurrency={globalCurrency}
          convertToGlobal={convertToGlobal}
          healthScore={intelligenceSpotlight.score}
          topInsight={intelligenceSpotlight.tip}
          onNavigateLoans={() => onNavigate('loans')}
          onNavigateTransactions={() => onNavigate('transactions')}
          onNavigateIntelligence={() => onNavigate('intelligence')}
        />
      </div>

      {/* Quick Record Transaction Modal */}
      <TransactionModal
        isOpen={txModalOpen}
        editingTransaction={null}
        accounts={accounts}
        categories={categories}
        allTransactions={transactions}
        onClose={() => setTxModalOpen(false)}
        onSave={handleSaveNewTransaction}
      />
    </div>
  );
}
