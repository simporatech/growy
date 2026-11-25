import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, ChevronDown, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { THEME_PRESETS, useTheme } from '../../context/ThemeContext';
import {
  CATEGORY_ICONS,
  getCategoryIconById,
  getCategoryIconLabel,
} from '../../data/categoryIcons';
import { useLanguage } from '../../i18n/LanguageContext';
import { BudgetCategory, CategoryKind } from '../../types/finance';
import { GlassSelectModal } from '../common/GlassSelectModal';
import { GlassColorPicker } from '../settings/GlassColorPicker';
import { CategoryIconBadge } from './CategoryIconBadge';

interface CategoryModalProps {
  isOpen: boolean;
  defaultKind: CategoryKind;
  editingCategory: BudgetCategory | null;
  onClose: () => void;
  onSave: (payload: Omit<BudgetCategory, 'id' | 'createdAt'>) => void;
}

export function CategoryModal({
  isOpen,
  defaultKind,
  editingCategory,
  onClose,
  onSave,
}: CategoryModalProps) {
  const { currency: globalCurrency } = useCurrency();
  const { accentColor } = useTheme();
  const { locale, t } = useLanguage();

  const [kind, setKind] = useState<CategoryKind>(defaultKind);
  const [name, setName] = useState('');
  const [targetInput, setTargetInput] = useState('');
  const [color, setColor] = useState(accentColor);
  const [iconId, setIconId] = useState(defaultKind === 'expense' ? 'utensils' : 'briefcase');
  const [iconOpen, setIconOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingCategory) {
      setKind(editingCategory.kind);
      setName(editingCategory.name);
      setTargetInput(String(editingCategory.targetAmount));
      setColor(editingCategory.color);
      setIconId(editingCategory.iconId);
    } else {
      setKind(defaultKind);
      setName('');
      setTargetInput('');
      setColor(accentColor);
      setIconId(defaultKind === 'expense' ? 'utensils' : 'briefcase');
    }
    setIconOpen(false);
    setError(null);
  }, [isOpen, defaultKind, editingCategory, accentColor]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !iconOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, iconOpen, onClose]);

  const iconGroups = useMemo(
    () =>
      (['all', 'essentials', 'lifestyle', 'income', 'financial'] as const).map((grp) => ({
        id: grp,
        label: t(`categoryModal.group.${grp}` as const),
      })),
    [t]
  );

  const iconOptions = useMemo(
    () =>
      CATEGORY_ICONS.map((entry) => ({
        id: entry.id,
        label: getCategoryIconLabel(entry, locale),
        groupId: entry.group,
        icon: <CategoryIconBadge iconId={entry.id} color={color} size="sm" />,
        keywords: [entry.label.en, entry.label.es, entry.id, ...entry.keywords],
      })),
    [locale, color]
  );

  const parsedTarget = Number(targetInput);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError(t('categoryModal.errorName'));
      return;
    }
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setError(t('categoryModal.errorTarget'));
      return;
    }

    onSave({
      kind,
      name: name.trim(),
      color,
      iconId,
      targetAmount: parsedTarget,
      currency: editingCategory?.currency ?? globalCurrency,
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
            if (iconOpen) return;
            onClose();
          }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden"
          >
            {/* Sticky Top Header */}
            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.08]">
              <h2 id="category-modal-title" className="font-display text-xl font-semibold text-white">
                {editingCategory ? t('categoryModal.editTitle') : t('categoryModal.newTitle')}
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

              <form id="category-modal-form" onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Category Kind Switcher */}
              <div>
                <span className="block text-[13px] font-medium text-[#B8B8BE] mb-2">
                  {t('categoryModal.kindLabel')}
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setKind('expense');
                      if (!editingCategory) setIconId('utensils');
                    }}
                    className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all active:scale-[0.98] ${
                      kind === 'expense'
                        ? 'bg-dynamic-accent-soft border-dynamic-accent text-white'
                        : 'border-white/[0.08] bg-black/25 text-[#B8B8BE] hover:text-white'
                    }`}
                  >
                    <TrendingDown
                      className={`h-4 w-4 ${kind === 'expense' ? 'text-dynamic-accent' : ''}`}
                    />
                    <span>{t('categoryModal.kindExpense')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setKind('income');
                      if (!editingCategory) setIconId('briefcase');
                    }}
                    className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all active:scale-[0.98] ${
                      kind === 'income'
                        ? 'bg-dynamic-accent-soft border-dynamic-accent text-white'
                        : 'border-white/[0.08] bg-black/25 text-[#B8B8BE] hover:text-white'
                    }`}
                  >
                    <TrendingUp
                      className={`h-4 w-4 ${kind === 'income' ? 'text-dynamic-accent' : ''}`}
                    />
                    <span>{t('categoryModal.kindIncome')}</span>
                  </button>
                </div>
              </div>

              {/* Name & Target Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="category-name-input"
                    className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                  >
                    {t('categoryModal.nameLabel')}
                  </label>
                  <input
                    id="category-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('categoryModal.namePlaceholder')}
                    className="focus-dynamic-accent w-full min-h-[46px] rounded-xl bg-black/30 border border-white/[0.08] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="category-target-input"
                    className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5"
                  >
                    {t('categoryModal.targetLabel')} ({globalCurrency})
                  </label>
                  <input
                    id="category-target-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    placeholder="500.00"
                    className="focus-dynamic-accent w-full min-h-[46px] rounded-xl bg-black/30 border border-white/[0.08] px-4 py-2.5 font-display text-sm text-white tabular-nums placeholder:text-white/30 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Color Swatches */}
              <div>
                <span className="block text-[13px] font-medium text-[#B8B8BE] mb-2">
                  {t('categoryModal.colorLabel')}
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
                        {isSelected && (
                          <Check className="relative z-10 h-4 w-4 text-[#1A1A1C] stroke-[2.5]" />
                        )}
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

              {/* Category Icon Selector */}
              <div>
                <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">
                  {t('categoryModal.iconLabel')}
                </span>
                <button
                  type="button"
                  onClick={() => setIconOpen(true)}
                  aria-expanded={iconOpen}
                  className="focus-dynamic-accent w-full h-12 flex items-center justify-between gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3 text-left transition-all hover:border-white/[0.18]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CategoryIconBadge iconId={iconId} color={color} size="sm" />
                    <span className="truncate text-sm font-medium text-white">
                      {getCategoryIconLabel(getCategoryIconById(iconId), locale)}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B8BE]" />
                </button>

                <GlassSelectModal
                  isOpen={iconOpen}
                  title={t('categoryModal.iconLabel')}
                  value={iconId}
                  options={iconOptions}
                  groups={iconGroups}
                  layout="grid"
                  searchable
                  searchPlaceholder={t('categoryModal.iconSearch')}
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
                form="category-modal-form"
                style={{ color: 'var(--accent-foreground)' }}
                className="bg-dynamic-accent min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                {editingCategory ? t('categoryModal.saveEdit') : t('categoryModal.saveNew')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}

