import { ArrowUpRight, Landmark } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Account, Transaction } from '../../types/finance';
import { calculateAccountBalance, formatCurrencyAmount } from '../../utils/accountMetrics';
import { AccountIconBadge } from '../accounts/AccountIconBadge';

interface AccountsOverviewCardProps {
  accounts: Account[];
  transactions: Transaction[];
  globalCurrency: string;
  convertToGlobal: (amount: number, fromCurrency: string) => number;
  onNavigateAccounts: () => void;
}

const CURRENCY_COLORS = ['#97f2cc', '#60a5fa', '#a78bfa', '#fbbf24'];

export function AccountsOverviewCard({
  accounts,
  transactions,
  globalCurrency,
  convertToGlobal,
  onNavigateAccounts,
}: AccountsOverviewCardProps) {
  const { t } = useLanguage();

  const enriched = accounts
    .map((acc) => {
      const nativeBal = calculateAccountBalance(acc, transactions);
      const globalBal = convertToGlobal(nativeBal, acc.currency);
      return { acc, nativeBal, globalBal };
    })
    .sort((a, b) => b.globalBal - a.globalBal);

  const positiveTotal = enriched.reduce((s, i) => s + Math.max(0, i.globalBal), 0);

  const byCurrency = new Map<string, number>();
  for (const item of enriched) {
    if (item.globalBal <= 0) continue;
    byCurrency.set(item.acc.currency, (byCurrency.get(item.acc.currency) ?? 0) + item.globalBal);
  }
  const currencySplits = Array.from(byCurrency.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <section className="glass-card lg:col-span-6 p-6 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            {t('overview.accountsTitle')}
          </h2>
          <p className="text-sm text-[#B8B8BE]">{t('overview.accountsSubtitle')}</p>
        </div>

        <button
          type="button"
          onClick={onNavigateAccounts}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-medium text-dynamic-accent hover:bg-white/[0.08] transition-colors"
        >
          <span>{t('overview.manageAccounts')}</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-11 w-11 items-center justify-center rounded-2xl border">
            <Landmark className="text-dynamic-accent h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-white">{t('overview.noAccountsTitle')}</p>
          <p className="mt-1 text-[13px] text-[#B8B8BE]">{t('overview.noAccountsDesc')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Multi-Currency Allocation Bar */}
          {currencySplits.length > 0 && positiveTotal > 0 && (
            <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-black/25 p-3.5">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                {currencySplits.map(([cur, val], idx) => (
                  <div
                    key={cur}
                    style={{
                      width: `${(val / positiveTotal) * 100}%`,
                      backgroundColor: CURRENCY_COLORS[idx % CURRENCY_COLORS.length],
                    }}
                    className="h-full"
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                {currencySplits.map(([cur, val], idx) => (
                  <span key={cur} className="inline-flex items-center gap-1.5 text-white/90 tabular-nums">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: CURRENCY_COLORS[idx % CURRENCY_COLORS.length] }}
                    />
                    <span className="font-semibold">{cur}</span>
                    <span className="text-[#B8B8BE]">{Math.round((val / positiveTotal) * 100)}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Account Rows */}
          <div className="space-y-2.5">
            {enriched.slice(0, 4).map(({ acc, nativeBal, globalBal }) => {
              const share =
                positiveTotal > 0 && globalBal > 0 ? Math.round((globalBal / positiveTotal) * 100) : 0;
              return (
                <div
                  key={acc.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AccountIconBadge
                      iconId={acc.iconId}
                      color={acc.color}
                      accountType={acc.type}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{acc.name}</p>
                      <p className="text-xs text-[#8E8E93] tabular-nums">
                        {acc.currency} · {share}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <p className="text-sm font-semibold text-white">
                      {formatCurrencyAmount(nativeBal, acc.currency)}
                    </p>
                    {acc.currency !== globalCurrency && (
                      <p className="text-xs text-[#B8B8BE]">
                        ≈ {formatCurrencyAmount(globalBal, globalCurrency)}
                      </p>
                    )}
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

