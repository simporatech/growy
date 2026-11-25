import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Archive,
  Check,
  ChevronRight,
  Download,
  Globe,
  Palette,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SUPPORTED_CURRENCIES, useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { Locale, useLanguage } from '../../i18n/LanguageContext';
import { GlassSelectModal } from '../common/GlassSelectModal';
import { GlassColorPicker } from './GlassColorPicker';

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
  },
};

function formatRateValue(rate: number, code: string): string {
  const decimals = code === 'JPY' || code === 'PYG' || code === 'CLP' ? 2 : 4;
  return rate.toFixed(decimals);
}

export function SettingsView() {
  const { user, deleteAccount, exportUserBackup, importUserBackup, resetFinancialData } = useAuth();
  const { accentColor, setAccentColor, presets } = useTheme();
  const { currency, setCurrency, getRateFor, lastUpdated, isRefreshing, rateError, refreshRates } =
    useCurrency();
  const { locale, setLocale, t } = useLanguage();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [pendingBackupFile, setPendingBackupFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [backupStatus, setBackupStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!backupStatus) return;
    const timer = window.setTimeout(() => setBackupStatus(null), 4500);
    return () => window.clearTimeout(timer);
  }, [backupStatus]);

  useEffect(() => {
    if (!currencyModalOpen && !deleteModalOpen && !pendingBackupFile && !clearModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCurrencyModalOpen(false);
        setDeleteModalOpen(false);
        setPendingBackupFile(null);
        setClearModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currencyModalOpen, deleteModalOpen, pendingBackupFile, clearModalOpen]);

  const handleBackupFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as Record<string, unknown> | null;
      const profileObj =
        parsed?.profile && typeof parsed.profile === 'object'
          ? (parsed.profile as Record<string, unknown>)
          : null;
      const dataCandidate =
        parsed?.data && typeof parsed.data === 'object'
          ? (parsed.data as Record<string, unknown>)
          : profileObj?.data && typeof profileObj.data === 'object'
            ? (profileObj.data as Record<string, unknown>)
            : null;

      if (
        !dataCandidate ||
        !Array.isArray(dataCandidate.accounts) ||
        !Array.isArray(dataCandidate.transactions) ||
        !Array.isArray(dataCandidate.budgets)
      ) {
        setBackupStatus({ type: 'error', message: t('settings.backupInvalidFile') });
        return;
      }

      setPendingBackupFile(file);
    } catch {
      setBackupStatus({ type: 'error', message: t('settings.backupInvalidFile') });
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingBackupFile) return;
    setIsImporting(true);
    const result = await importUserBackup(pendingBackupFile);
    setIsImporting(false);
    setPendingBackupFile(null);
    if (result.ok) {
      setBackupStatus({ type: 'success', message: t('settings.backupRestored') });
    } else {
      setBackupStatus({
        type: 'error',
        message: t(
          (result.errorKey as 'settings.backupInvalidFile') ?? 'settings.backupInvalidFile'
        ),
      });
    }
  };

  const expectedClearWord = locale === 'es' ? 'BORRAR' : 'CLEAR';

  const selectedMeta = useMemo(
    () => SUPPORTED_CURRENCIES.find((c) => c.code === currency) ?? SUPPORTED_CURRENCIES[0],
    [currency]
  );

  const currencyOptions = useMemo(
    () =>
      SUPPORTED_CURRENCIES.map((item) => ({
        id: item.code,
        label: `${item.code} — ${item.name}`,
        badge: item.symbol,
        subtitle: `1 USD = ${formatRateValue(getRateFor(item.code), item.code)} ${item.code}`,
        keywords: [item.code, item.name, item.symbol],
      })),
    [getRateFor]
  );

  const currentRate = getRateFor(currency);
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return '—';
    return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(lastUpdated));
  }, [lastUpdated, locale]);

  return (
    <motion.div
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={CARD_VARIANTS}>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {t('settings.title')}
        </h1>
        <p className="mt-1 text-sm text-[#B8B8BE]">{t('settings.subtitle')}</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Theme Accent Card */}
        <motion.section
          variants={CARD_VARIANTS}
          className="glass-card relative z-30 p-6 sm:p-7 space-y-5"
        >
          <div className="flex items-start gap-3.5">
            <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border">
              <Palette className="text-dynamic-accent h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                {t('settings.themeTitle')}
              </h2>
              <p className="mt-1 text-sm text-[#B8B8BE] leading-relaxed">
                {t('settings.themeSubtitle')}
              </p>
            </div>
          </div>

          {/* Preset Swatches & Glass Color Picker */}
          <div className="flex flex-wrap items-center gap-3">
            {presets.map((preset) => {
              const isSelected = accentColor.toLowerCase() === preset.hex.toLowerCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAccentColor(preset.hex)}
                  title={preset.name}
                  aria-label={preset.name}
                  aria-pressed={isSelected}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-150 hover:scale-105 active:scale-95"
                  style={{ backgroundColor: preset.hex }}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="swatch-active-ring"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute -inset-1 rounded-full border-2 border-white"
                    />
                  )}
                  {isSelected && <Check className="relative z-10 h-4 w-4 text-[#1A1A1C] stroke-[2.5]" />}
                </button>
              );
            })}

            <GlassColorPicker
              value={accentColor}
              onChange={setAccentColor}
              label={t('settings.customHex')}
            />
          </div>
        </motion.section>

        {/* Language (i18n) Card */}
        <motion.section
          variants={CARD_VARIANTS}
          className="glass-card relative z-10 p-6 sm:p-7 space-y-5 flex flex-col justify-between"
        >
          <div className="flex items-start gap-3.5">
            <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border">
              <Globe className="text-dynamic-accent h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                {t('settings.languageTitle')}
              </h2>
              <p className="mt-1 text-sm text-[#B8B8BE] leading-relaxed">
                {t('settings.languageSubtitle')}
              </p>
            </div>
          </div>

          <div
            role="radiogroup"
            aria-label={t('settings.languageTitle')}
            className="relative grid grid-cols-2 p-1 rounded-2xl bg-black/30 border border-white/[0.06]"
          >
            {([
              { code: 'en', label: 'English (EN)' },
              { code: 'es', label: 'Español (ES)' },
            ] as { code: Locale; label: string }[]).map((option) => {
              const active = locale === option.code;
              return (
                <button
                  key={option.code}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setLocale(option.code)}
                  className={`relative z-10 py-2.5 text-sm font-medium rounded-xl transition-colors duration-200 ${
                    active ? 'text-white' : 'text-[#B8B8BE] hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="settings-lang-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-xl bg-[#333333]/85 border border-white/[0.1]"
                    />
                  )}
                  <span className="relative z-10">{option.label}</span>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* Global Currency Card */}
        <motion.section
          variants={CARD_VARIANTS}
          className="glass-card relative z-20 p-6 sm:p-7 space-y-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                {t('settings.currencyTitle')}
              </h2>
              <p className="mt-1 text-sm text-[#B8B8BE] leading-relaxed">
                {t('settings.currencySubtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshRates()}
              disabled={isRefreshing}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`text-dynamic-accent h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? t('settings.syncingRates') : t('settings.syncRates')}</span>
            </button>
          </div>

          {/* Spotlight Modal Trigger */}
          <button
            type="button"
            onClick={() => setCurrencyModalOpen(true)}
            className="w-full flex items-center justify-between rounded-xl bg-black/25 border border-white/[0.08] px-4 py-3 text-sm text-white hover:border-white/[0.18] active:scale-[0.995] transition-all"
          >
            <span className="flex items-center gap-2.5">
              <span className="text-dynamic-accent font-display font-semibold tabular-nums">
                {selectedMeta.code}
              </span>
              <span className="text-[#B8B8BE]">—</span>
              <span>{selectedMeta.name}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-[#B8B8BE]" />
          </button>

          {/* Live Rate & Sync Timestamp */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3 text-[13px]">
            <div className="flex items-center gap-2">
              <span className="text-[#B8B8BE]">{t('settings.exchangeRateLabel')}:</span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`${currency}-${currentRate}`}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.16 }}
                  className="font-display font-semibold text-white tabular-nums"
                >
                  1 USD = {formatRateValue(currentRate, currency)}{' '}
                  <span className="text-dynamic-accent">{currency}</span>
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="text-[#B8B8BE]">
              {t('settings.lastUpdated')}:{' '}
              <span className="text-white/90 tabular-nums">{formattedLastUpdated}</span>
            </div>
          </div>

          {rateError && <p className="text-[13px] text-coral">{t('settings.ratesUnavailable')}</p>}
        </motion.section>

        {/* Account Info Card */}
        <motion.section
          variants={CARD_VARIANTS}
          className="glass-card relative z-10 p-6 sm:p-7 space-y-5"
        >
          <div className="flex items-start gap-3.5">
            <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border">
              <User className="text-dynamic-accent h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                {t('settings.accountTitle')}
              </h2>
              <p className="mt-1 text-sm text-[#B8B8BE] leading-relaxed">
                {t('settings.accountSubtitle')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3">
              <p className="text-[13px] font-medium text-[#B8B8BE]">{t('settings.memberName')}</p>
              <p className="mt-0.5 text-sm font-medium text-white">{user?.fullName}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3">
              <p className="text-[13px] font-medium text-[#B8B8BE]">{t('settings.memberEmail')}</p>
              <p className="mt-0.5 text-sm font-medium text-white">{user?.email}</p>
            </div>
          </div>
        </motion.section>

        {/* Data & Backup Card */}
        <motion.section
          variants={CARD_VARIANTS}
          className="glass-card relative z-10 p-6 sm:p-7 space-y-5 lg:col-span-2"
        >
          <div className="flex items-start gap-3.5">
            <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border">
              <Archive className="text-dynamic-accent h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                {t('settings.backupTitle')}
              </h2>
              <p className="mt-1 text-sm text-[#B8B8BE] leading-relaxed">
                {t('settings.backupSubtitle')}
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleBackupFileSelected(e)}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                exportUserBackup();
                setBackupStatus({ type: 'success', message: t('settings.backupDownloaded') });
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all"
            >
              <Download className="text-dynamic-accent h-4 w-4 shrink-0" />
              <span>{t('settings.backupDownload')}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all"
            >
              <Upload className="text-dynamic-accent h-4 w-4 shrink-0" />
              <span>{t('settings.backupRestore')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setClearConfirmText('');
                setClearModalOpen(true);
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-coral/25 bg-coral/10 px-4 text-sm font-medium text-coral hover:bg-coral/15 active:scale-[0.98] transition-all sm:ml-auto"
            >
              <RotateCcw className="h-4 w-4 shrink-0" />
              <span>{t('settings.backupClear')}</span>
            </button>
          </div>

          <AnimatePresence>
            {backupStatus && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                  backupStatus.type === 'success'
                    ? 'border-dynamic-accent bg-dynamic-accent-soft text-white'
                    : 'border-coral/30 bg-coral/10 text-coral'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {backupStatus.type === 'success' ? (
                    <Check className="text-dynamic-accent h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-coral" />
                  )}
                  <span className="truncate">{backupStatus.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBackupStatus(null)}
                  aria-label="Dismiss"
                  className="shrink-0 text-[#B8B8BE] hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Danger Zone Card */}
        <motion.section
          variants={CARD_VARIANTS}
          className="glass-card relative z-10 p-6 sm:p-7 border-coral/20 lg:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-coral/30 bg-coral/10">
              <AlertTriangle className="h-5 w-5 text-coral" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                {t('settings.dangerZoneTitle')}
              </h2>
              <p className="mt-1 text-sm text-[#B8B8BE] leading-relaxed">
                {t('settings.dangerZoneSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDeleteConfirmText('');
              setDeleteModalOpen(true);
            }}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-coral/30 bg-coral/10 px-4 text-sm font-medium text-coral hover:bg-coral/15 active:scale-[0.98] transition-all"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span>{t('settings.deleteAccount')}</span>
          </button>
        </motion.section>
      </div>

      {/* Spotlight Currency Selector Modal */}
      <GlassSelectModal
        isOpen={currencyModalOpen}
        title={t('settings.currencyTitle')}
        subtitle={t('settings.currencySubtitle')}
        value={currency}
        options={currencyOptions}
        searchable
        searchPlaceholder={t('settings.searchCurrency')}
        emptyText={t('settings.noCurrencyMatch')}
        onSelect={setCurrency}
        onClose={() => setCurrencyModalOpen(false)}
      />

      {/* Confirmation Modals (Portaled to document.body) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {deleteModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setDeleteModalOpen(false)}
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 pt-3 sm:p-7 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-7 space-y-5"
            >
              <div className="sm:hidden mx-auto h-1.5 w-10 rounded-full bg-white/20" />
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-coral/30 bg-coral/10">
                  <AlertTriangle className="h-5 w-5 text-coral" />
                </div>
                <div>
                  <h3 id="delete-account-title" className="font-display text-lg font-semibold text-white">
                    {t('settings.deleteModalTitle')}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#B8B8BE]">
                    {t('settings.deleteModalWarning')}
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="delete-confirm-input"
                  className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                >
                  {t('settings.deleteConfirmLabel')}
                </label>
                <input
                  id="delete-confirm-input"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  placeholder={t('settings.deleteConfirmPlaceholder')}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full rounded-xl bg-black/30 border border-white/[0.1] px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-coral/50 focus:ring-1 focus:ring-coral/30"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="h-11 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                >
                  {t('settings.cancel')}
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmText !== 'DELETE'}
                  onClick={() => {
                    setDeleteModalOpen(false);
                    deleteAccount();
                  }}
                  className="h-11 rounded-xl bg-coral px-4 text-sm font-semibold text-[#1A1A1C] transition-all hover:bg-coral/90 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                >
                  {t('settings.confirmDelete')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restore Backup Confirmation Modal */}
      <AnimatePresence>
        {pendingBackupFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => !isImporting && setPendingBackupFile(null)}
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="restore-backup-title"
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 pt-3 sm:p-7 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-7 space-y-5"
            >
              <div className="sm:hidden mx-auto h-1.5 w-10 rounded-full bg-white/20" />
              <div className="flex items-start gap-3.5">
                <div className="bg-dynamic-accent-soft border-dynamic-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border">
                  <Upload className="text-dynamic-accent h-5 w-5" />
                </div>
                <div>
                  <h3 id="restore-backup-title" className="font-display text-lg font-semibold text-white">
                    {t('settings.restoreModalTitle')}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#B8B8BE]">
                    {t('settings.restoreModalWarning')}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3">
                <p className="text-[13px] font-medium text-[#B8B8BE]">
                  {t('settings.restoreFileLabel')}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-white">
                  {pendingBackupFile.name}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => setPendingBackupFile(null)}
                  className="h-11 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {t('settings.cancel')}
                </button>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => void handleConfirmRestore()}
                  className="bg-dynamic-accent h-11 rounded-xl px-4 text-sm font-semibold text-[#1A1A1C] transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-40"
                >
                  {t('settings.confirmRestore')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear Financial Data Confirmation Modal */}
      <AnimatePresence>
        {clearModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setClearModalOpen(false)}
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-data-title"
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 pt-3 sm:p-7 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-7 space-y-5"
            >
              <div className="sm:hidden mx-auto h-1.5 w-10 rounded-full bg-white/20" />
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-coral/30 bg-coral/10">
                  <RotateCcw className="h-5 w-5 text-coral" />
                </div>
                <div>
                  <h3 id="clear-data-title" className="font-display text-lg font-semibold text-white">
                    {t('settings.clearModalTitle')}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#B8B8BE]">
                    {t('settings.clearModalWarning')}
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="clear-confirm-input"
                  className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                >
                  {t('settings.clearConfirmLabel')}
                </label>
                <input
                  id="clear-confirm-input"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  placeholder={t('settings.clearConfirmPlaceholder')}
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  className="w-full h-11 rounded-xl bg-black/30 border border-white/[0.1] px-3.5 text-base sm:text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-coral/50 focus:ring-1 focus:ring-coral/30"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setClearModalOpen(false)}
                  className="h-11 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                >
                  {t('settings.cancel')}
                </button>
                <button
                  type="button"
                  disabled={clearConfirmText !== expectedClearWord}
                  onClick={() => {
                    setClearModalOpen(false);
                    resetFinancialData();
                    setBackupStatus({ type: 'success', message: t('settings.backupCleared') });
                  }}
                  className="h-11 rounded-xl bg-coral px-4 text-sm font-semibold text-[#1A1A1C] transition-all hover:bg-coral/90 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                >
                  {t('settings.confirmClear')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
          </>,
          document.body
        )}
    </motion.div>
  );
}
