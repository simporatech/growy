import { motion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Account } from '../../types/finance';
import { formatCurrencyAmount } from '../../utils/accountMetrics';
import { AccountIconBadge } from './AccountIconBadge';

interface AccountCardProps {
  account: Account;
  currentBalance: number;
  globalCurrency: string;
  convertedBalance: number;
  onEdit?: () => void;
  onDelete?: () => void;
  preview?: boolean;
}

function EmvChipSvg({ color }: { color: string }) {
  return (
    <svg width="36" height="26" viewBox="0 0 36 26" fill="none" aria-hidden="true" className="shrink-0">
      <rect
        x="0.75"
        y="0.75"
        width="34.5"
        height="24.5"
        rx="5.25"
        fill="rgba(255,255,255,0.08)"
        stroke={`color-mix(in srgb, ${color} 45%, rgba(255,255,255,0.22))`}
        strokeWidth="1.2"
      />
      <path
        d="M12 1V25M24 1V25M1 9H12M24 9H35M1 17H12M24 17H35"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1"
      />
    </svg>
  );
}

function ContactlessSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-white/45">
      <path d="M8.5 16.5C10.5 14.5 10.5 9.5 8.5 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 19C15.2 15.8 15.2 8.2 12 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.5 21.5C19.8 17.2 19.8 6.8 15.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AccountCard({
  account,
  currentBalance,
  globalCurrency,
  convertedBalance,
  onEdit,
  onDelete,
  preview = false,
}: AccountCardProps) {
  const { t } = useLanguage();
  const showConverted = account.currency !== globalCurrency;
  const formattedNative = formatCurrencyAmount(currentBalance, account.currency);
  const formattedConverted = formatCurrencyAmount(convertedBalance, globalCurrency);

  const typeLabel = t(`accounts.type.${account.type}` as const);

  return (
    <motion.article
      layout={!preview}
      initial={preview ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className="glass-card group relative overflow-hidden p-5 sm:p-6 flex flex-col justify-between min-h-[200px]"
      style={{
        backgroundImage: `radial-gradient(90% 80% at 95% 5%, color-mix(in srgb, ${account.color} 15%, transparent) 0%, transparent 65%)`,
      }}
    >
      {/* Type-Specific Architectural / Material Watermark */}
      {account.type === 'debit_card' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -bottom-10 h-44 w-44 rounded-full border border-white/[0.06]"
          style={{
            boxShadow: `inset 0 0 40px color-mix(in srgb, ${account.color} 14%, transparent)`,
          }}
        />
      )}

      {account.type === 'bank' && (
        <svg
          aria-hidden="true"
          viewBox="0 0 120 120"
          className="pointer-events-none absolute right-3 bottom-2 h-28 w-28 opacity-[0.06] text-white"
          fill="none"
        >
          <path d="M12 42L60 16L108 42H12Z" stroke="currentColor" strokeWidth="2.5" />
          <path d="M24 46V92M48 46V92M72 46V92M96 46V92" stroke="currentColor" strokeWidth="3" />
          <path d="M12 96H108" stroke="currentColor" strokeWidth="3" />
        </svg>
      )}

      {account.type === 'cash' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 rounded-2xl border border-dashed opacity-[0.14]"
          style={{ borderColor: account.color }}
        />
      )}

      {account.type === 'digital_wallet' && (
        <div aria-hidden="true" className="pointer-events-none absolute -right-6 -bottom-6">
          <div
            className="h-32 w-32 rounded-full border opacity-[0.14]"
            style={{ borderColor: account.color }}
          />
          <div
            className="absolute inset-4 rounded-full border opacity-[0.18]"
            style={{ borderColor: account.color }}
          />
        </div>
      )}

      {/* Top Row */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <AccountIconBadge
            iconId={account.iconId}
            color={account.color}
            accountType={account.type}
            size="md"
          />
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold text-white">
              {account.name || t('accountModal.namePlaceholder')}
            </h3>
            <p className="text-[13px] text-[#B8B8BE] truncate">
              {typeLabel} · <span className="font-mono text-white/80">{account.currency}</span>
            </p>
          </div>
        </div>

        {/* Actions (or NFC for preview) */}
        {!preview && (onEdit || onDelete) && (
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label={t('accounts.edit')}
                title={t('accounts.edit')}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#B8B8BE] hover:bg-white/[0.08] hover:text-white active:scale-95 transition-all"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label={t('accounts.delete')}
                title={t('accounts.delete')}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#B8B8BE] hover:bg-coral/15 hover:text-coral active:scale-95 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Middle Details per Account Type */}
      {account.type === 'debit_card' && (
        <div className="relative z-10 mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <EmvChipSvg color={account.color} />
            <ContactlessSvg />
          </div>
          <span className="font-mono text-[13px] tracking-[0.2em] text-white/55 select-none">
            •••• •••• ••••
          </span>
        </div>
      )}

      {account.type !== 'debit_card' && (
        <div className="relative z-10 mt-4">
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[13px] font-medium"
            style={{
              backgroundColor: `color-mix(in srgb, ${account.color} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${account.color} 28%, transparent)`,
              color: account.color,
            }}
          >
            {t(`accounts.badge.${account.type}` as const)}
          </span>
        </div>
      )}

      {/* Bottom Balance Row */}
      <div className="relative z-10 mt-5 pt-3.5 border-t border-white/[0.08] flex items-end justify-between gap-3">
        <div>
          <p
            className={`font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums ${
              currentBalance < 0 ? 'text-coral' : 'text-white'
            }`}
          >
            {formattedNative}
          </p>
          {showConverted && (
            <p className="mt-0.5 text-[13px] text-[#B8B8BE] tabular-nums">
              {t('accounts.equivalentIn')} {formattedConverted}
            </p>
          )}
        </div>
      </div>
    </motion.article>
  );
}

