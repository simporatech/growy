import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Banknote,
  Check,
  ChevronDown,
  CreditCard,
  Landmark,
  Layers,
  Smartphone,
  X,
} from 'lucide-react';
import { SUPPORTED_CURRENCIES, useCurrency } from '../../context/CurrencyContext';
import { THEME_PRESETS, useTheme } from '../../context/ThemeContext';
import {
  ACCOUNT_ICONS,
  getAccountIconById,
  getAccountIconLabel,
} from '../../data/accountIcons';
import { useLanguage } from '../../i18n/LanguageContext';
import { Account, AccountType } from '../../types/finance';
import { GlassSelectModal } from '../common/GlassSelectModal';
import { GlassColorPicker } from '../settings/GlassColorPicker';
import { AccountIconBadge } from './AccountIconBadge';

interface AccountModalProps {
  isOpen: boolean;
  editingAccount: Account | null;
  onClose: () => void;
  onSave: (payload: Omit<Account, 'id' | 'createdAt'>) => void;
}

const ACCOUNT_TYPES: {
  type: AccountType;
  icon: React.ComponentType<{ className?: string }>;
  defaultIconId: string;
}[] = [
  { type: 'bank', icon: Landmark, defaultIconId: 'landmark' },
  { type: 'debit_card', icon: CreditCard, defaultIconId: 'creditcard' },
  { type: 'cash', icon: Banknote, defaultIconId: 'banknote' },
  { type: 'digital_wallet', icon: Smartphone, defaultIconId: 'smartphone' },
  { type: 'other', icon: Layers, defaultIconId: 'wallet' },
];

export function AccountModal({ isOpen, editingAccount, onClose, onSave }: AccountModalProps) {
  const { currency: globalCurrency } = useCurrency();
  const { accentColor } = useTheme();
  const { locale, t } = useLanguage();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [accountCurrency, setAccountCurrency] = useState(globalCurrency);
  const [initialBalanceInput, setInitialBalanceInput] = useState('0');
  const [color, setColor] = useState(accentColor);
  const [iconId, setIconId] = useState('landmark');

  const [typeOpen, setTypeOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingAccount) {
      setName(editingAccount.name);
      setType(editingAccount.type);
      setAccountCurrency(editingAccount.currency);
      setInitialBalanceInput(String(editingAccount.initialBalance));
      setColor(editingAccount.color);
      setIconId(editingAccount.iconId);
    } else {
      setName('');
      setType('bank');
      setAccountCurrency(globalCurrency);
      setInitialBalanceInput('0');
      setColor(accentColor);
      setIconId('landmark');
    }
    setTypeOpen(false);
    setCurrencyOpen(false);
    setIconOpen(false);
    setError(null);
  }, [isOpen, editingAccount, globalCurrency, accentColor]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !typeOpen && !currencyOpen && !iconOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, typeOpen, currencyOpen, iconOpen, onClose]);

  const typeOptions = useMemo(
    () =>
      ACCOUNT_TYPES.map((item) => {
        const Icon = item.icon;
        return {
          id: item.type,
          label: t(`accounts.type.${item.type}` as const),
          icon: <Icon className="text-dynamic-accent h-4 w-4" />,
        };
      }),
    [t]
  );

  const selectedTypeMeta = ACCOUNT_TYPES.find((item) => item.type === type) ?? ACCOUNT_TYPES[0];
  const SelectedTypeIcon = selectedTypeMeta.icon;

  const currencyOptions = useMemo(
    () =>
      SUPPORTED_CURRENCIES.map((c) => ({
        id: c.code,
        label: c.code,
        subtitle: c.name,
        badge: c.symbol,
        keywords: [c.code, c.name, c.symbol],
      })),
    []
  );

  const iconGroups = useMemo(
    () =>
      (['all', 'banking', 'cards', 'cash', 'digital', 'reserves'] as const).map((cat) => ({
        id: cat,
        label: t(`accountModal.iconCat.${cat}` as const),
      })),
    [t]
  );

  const iconOptions = useMemo(
    () =>
      ACCOUNT_ICONS.map((entry) => ({
        id: entry.id,
        label: getAccountIconLabel(entry, locale),
        groupId: entry.category,
        icon: <AccountIconBadge iconId={entry.id} color={color} size="sm" />,
        keywords: [entry.label.en, entry.label.es, entry.id, ...entry.keywords],
      })),
    [locale, color]
  );

  const parsedBalance = Number(initialBalanceInput);

  const handleTypeSelect = (nextType: AccountType) => {
    setType(nextType);
    if (!editingAccount) {
      const matched = ACCOUNT_TYPES.find((item) => item.type === nextType);
      if (matched) setIconId(matched.defaultIconId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError(t('accountModal.errorName'));
      return;
    }
    if (initialBalanceInput.trim() === '' || !Number.isFinite(parsedBalance)) {
      setError(t('accountModal.errorBalance'));
      return;
    }

    onSave({
      name: name.trim(),
      type,
      currency: accountCurrency,
      initialBalance: parsedBalance,
      color,
      iconId,
    });
    onClose();
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => {
            if ((e.target as HTMLElement)?.closest?.('[data-portal-popover="true"]')) return;
            if (typeOpen || currencyOpen || iconOpen) return;
            onClose();
          }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden"
          >
            {/* Sticky Top Header */}
            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.08]">
              <h2 id="account-modal-title" className="font-display text-xl font-semibold text-white">
                {editingAccount ? t('accountModal.editTitle') : t('accountModal.newTitle')}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-[#B8B8BE] hover:text-white active:scale-95 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Middle Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 pb-6 space-y-5">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form id="account-modal-form" onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Name & Account Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="account-name-input"
                    className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                  >
                    {t('accountModal.nameLabel')}
                  </label>
                  <input
                    id="account-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('accountModal.namePlaceholder')}
                    className="focus-dynamic-accent w-full h-12 rounded-xl bg-black/30 border border-white/[0.08] px-4 text-sm text-white placeholder:text-white/30 outline-none transition-all"
                  />
                </div>

                <div>
                  <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                    {t('accountModal.typeLabel')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTypeOpen(true)}
                    aria-expanded={typeOpen}
                    className="focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-left transition-all hover:border-white/[0.18]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <SelectedTypeIcon className="text-dynamic-accent h-4 w-4 shrink-0" />
                      <span className="truncate text-sm font-medium text-white">
                        {t(`accounts.type.${type}` as const)}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B8BE]" />
                  </button>

                  <GlassSelectModal
                    isOpen={typeOpen}
                    title={t('accountModal.typeLabel')}
                    value={type}
                    options={typeOptions}
                    searchable={false}
                    onSelect={(next) => handleTypeSelect(next as AccountType)}
                    onClose={() => setTypeOpen(false)}
                  />
                </div>
              </div>

              {/* Currency & Initial Balance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                    {t('accountModal.currencyLabel')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrencyOpen(true)}
                    className="w-full min-h-[46px] flex items-center justify-between rounded-xl bg-black/30 border border-white/[0.08] px-3.5 py-2.5 text-sm text-white hover:border-white/[0.18] transition-colors"
                  >
                    <span className="font-display font-semibold text-dynamic-accent tabular-nums">
                      {accountCurrency}
                    </span>
                    <ChevronDown className="h-4 w-4 text-[#B8B8BE]" />
                  </button>

                  <GlassSelectModal
                    isOpen={currencyOpen}
                    title={t('accountModal.currencyLabel')}
                    value={accountCurrency}
                    options={currencyOptions}
                    searchable
                    searchPlaceholder={t('accountModal.currencySearch')}
                    emptyText={t('settings.noCurrencyMatch')}
                    onSelect={setAccountCurrency}
                    onClose={() => setCurrencyOpen(false)}
                  />
                </div>

                <div>
                  <label
                    htmlFor="account-balance-input"
                    className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                  >
                    {t('accountModal.initialBalanceLabel')}
                  </label>
                  <input
                    id="account-balance-input"
                    type="number"
                    step="0.01"
                    value={initialBalanceInput}
                    onChange={(e) => setInitialBalanceInput(e.target.value)}
                    className="focus-dynamic-accent w-full min-h-[46px] rounded-xl bg-black/30 border border-white/[0.08] px-4 py-2.5 font-display text-sm text-white tabular-nums outline-none transition-all"
                  />
                  {editingAccount && (
                    <p className="mt-1.5 text-[13px] text-[#B8B8BE] leading-snug">
                      {t('accountModal.initialBalanceEditHint')}
                    </p>
                  )}
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <span className="block text-[13px] font-medium text-[#B8B8BE] mb-2">
                  {t('accountModal.colorLabel')}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  {THEME_PRESETS.map((preset) => {
                    const isSelected = color.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setColor(preset.hex)}
                        aria-label={preset.name}
                        className="relative flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
                        style={{ backgroundColor: preset.hex }}
                      >
                        {isSelected && (
                          <span className="absolute -inset-1 rounded-full border-2 border-white" />
                        )}
                        {isSelected && <Check className="relative z-10 h-4 w-4 text-[#1A1A1C] stroke-[2.5]" />}
                      </button>
                    );
                  })}
                  <GlassColorPicker
                    value={color}
                    onChange={setColor}
                    label={t('settings.customHex')}
                  />
                </div>
              </div>

              {/* Brand / Icon Selector */}
              <div>
                <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                  {t('accountModal.iconLabel')}
                </span>
                <button
                  type="button"
                  onClick={() => setIconOpen(true)}
                  aria-expanded={iconOpen}
                  className="focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3 text-left transition-all hover:border-white/[0.18]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AccountIconBadge iconId={iconId} color={color} accountType={type} size="sm" />
                    <span className="truncate text-sm font-medium text-white">
                      {getAccountIconLabel(getAccountIconById(iconId, type), locale)}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B8BE]" />
                </button>

                <GlassSelectModal
                  isOpen={iconOpen}
                  title={t('accountModal.iconLabel')}
                  value={iconId}
                  options={iconOptions}
                  groups={iconGroups}
                  layout="grid"
                  searchable
                  searchPlaceholder={t('accountModal.iconSearch')}
                  onSelect={setIconId}
                  onClose={() => setIconOpen(false)}
                />
              </div>

              </form>
            </div>

            {/* Sticky Bottom Footer */}
            <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.08] bg-black/20">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.08] active:scale-[0.98] transition-all"
              >
                {t('settings.cancel')}
              </button>
              <button
                type="submit"
                form="account-modal-form"
                style={{ color: 'var(--accent-foreground)' }}
                className="bg-dynamic-accent min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                {editingAccount ? t('accountModal.saveEdit') : t('accountModal.saveNew')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}

