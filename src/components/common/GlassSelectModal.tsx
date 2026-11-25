import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Search, X } from 'lucide-react';

export interface GlassSelectOption {
  id: string;
  label: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  keywords?: string[];
  groupId?: string;
}

export interface GlassSelectGroup {
  id: string;
  label: string;
}

interface GlassSelectModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  value: string;
  options: GlassSelectOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  layout?: 'list' | 'grid';
  groups?: GlassSelectGroup[];
}

export function GlassSelectModal({
  isOpen,
  title,
  subtitle,
  value,
  options,
  onSelect,
  onClose,
  searchable,
  searchPlaceholder = 'Search...',
  emptyText = 'No matching options.',
  layout = 'list',
  groups,
}: GlassSelectModalProps) {
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState('all');

  const showSearch = searchable ?? options.length > 8;

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveGroup('all');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((opt) => {
      if (groups && activeGroup !== 'all' && opt.groupId !== activeGroup) return false;
      if (!q) return true;
      if (opt.label.toLowerCase().includes(q)) return true;
      if (opt.subtitle?.toLowerCase().includes(q)) return true;
      if (opt.badge?.toLowerCase().includes(q)) return true;
      if (opt.keywords?.some((kw) => kw.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [options, groups, activeGroup, query]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-portal-popover="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-md"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 24 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full sm:max-w-lg max-h-[90dvh] sm:max-h-[82vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-[0_28px_64px_-16px_rgba(0,0,0,0.75)] pb-[env(safe-area-inset-bottom)] sm:pb-0"
          >
            {/* Sticky Header */}
            <div className="shrink-0 px-5 pt-3 sm:pt-5 pb-4 border-b border-white/[0.08] space-y-3">
              <div className="sm:hidden mx-auto h-1.5 w-10 rounded-full bg-white/20" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold text-white truncate">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="mt-0.5 text-[13px] text-[#B8B8BE] truncate">{subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  aria-label="Close"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#B8B8BE] hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {showSearch && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 h-4 w-4 text-[#8E8E93] shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    autoFocus
                    className="focus-dynamic-accent w-full h-11 rounded-xl bg-black/30 border border-white/[0.1] pl-10 pr-4 text-base sm:text-sm text-white placeholder:text-white/35 outline-none transition-all"
                  />
                </div>
              )}

              {groups && groups.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {groups.map((grp) => {
                    const active = activeGroup === grp.id;
                    return (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={() => setActiveGroup(grp.id)}
                        className={`rounded-xl px-3 py-1.5 text-[12px] font-medium transition-colors ${
                          active
                            ? 'bg-dynamic-accent-soft border-dynamic-accent border text-white'
                            : 'border border-white/[0.06] bg-white/[0.04] text-[#B8B8BE] hover:text-white'
                        }`}
                      >
                        {grp.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Scrollable Options */}
            <div className="flex-1 max-h-[55vh] overflow-y-auto custom-scrollbar p-3 sm:p-4">
              {filteredOptions.length === 0 ? (
                <p className="py-10 text-center text-sm text-[#B8B8BE]">{emptyText}</p>
              ) : layout === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {filteredOptions.map((opt) => {
                    const active = opt.id === value;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        title={opt.label}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(opt.id);
                          onClose();
                        }}
                        className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all active:scale-[0.98] ${
                          active
                            ? 'bg-dynamic-accent-soft border-dynamic-accent text-white'
                            : 'border-white/[0.06] bg-black/25 text-[#B8B8BE] hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                        <span className="truncate text-[13px] font-medium flex-1">{opt.label}</span>
                        {active && <Check className="text-dynamic-accent h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredOptions.map((opt) => {
                    const active = opt.id === value;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(opt.id);
                          onClose();
                        }}
                        className={`w-full min-h-[46px] flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                          active
                            ? 'bg-dynamic-accent-soft border-dynamic-accent text-white'
                            : 'border-transparent text-[#B8B8BE] hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="truncate text-sm font-medium text-white">
                                {opt.label}
                              </span>
                              {opt.badge && (
                                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-[#B8B8BE] shrink-0">
                                  {opt.badge}
                                </span>
                              )}
                            </div>
                            {opt.subtitle && (
                              <p className="truncate text-[12px] text-[#8E8E93] tabular-nums">
                                {opt.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                        {active && <Check className="text-dynamic-accent h-4 w-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

