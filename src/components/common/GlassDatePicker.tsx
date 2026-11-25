import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { getTodayLocalDateString, parseLocalDate } from '../../utils/transactionMetrics';

interface GlassDatePickerProps {
  label: string;
  value: string; // 'YYYY-MM-DD'
  onChange: (nextDate: string) => void;
  inlineLabel?: string;
}

type PickerView = 'days' | 'months' | 'years';

function formatIsoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function GlassDatePicker({ label, value, onChange, inlineLabel }: GlassDatePickerProps) {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pickerView, setPickerView] = useState<PickerView>('days');

  const selectedDate = useMemo(() => {
    const parsed = parseLocalDate(value || getTodayLocalDateString(user?.preferences.timezone));
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [value, user?.preferences.timezone]);

  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 20;
  const maxYear = currentYear + 15;

  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const [yearPageStart, setYearPageStart] = useState(() => {
    const target = selectedDate.getFullYear();
    const offset = Math.max(0, Math.floor((target - minYear) / 12) * 12);
    return Math.min(maxYear - 11, minYear + offset);
  });

  useEffect(() => {
    if (!open) return;
    const yr = selectedDate.getFullYear();
    setViewYear(yr);
    setViewMonth(selectedDate.getMonth());
    setPickerView('days');
    const offset = Math.max(0, Math.floor((yr - minYear) / 12) * 12);
    setYearPageStart(Math.min(maxYear - 11, minYear + offset));
  }, [open, selectedDate, minYear, maxYear]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open]);

  const intlLocale = locale === 'es' ? 'es-ES' : 'en-US';

  const formattedTriggerDate = useMemo(() => {
    return new Intl.DateTimeFormat(intlLocale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(selectedDate);
  }, [intlLocale, selectedDate]);

  const monthHeaderLabel = useMemo(() => {
    return new Intl.DateTimeFormat(intlLocale, {
      month: 'long',
      year: 'numeric',
    }).format(new Date(viewYear, viewMonth, 1));
  }, [intlLocale, viewYear, viewMonth]);

  const monthLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale, { month: 'short' });
    return Array.from({ length: 12 }, (_, idx) => fmt.format(new Date(2024, idx, 1)));
  }, [intlLocale]);

  const weekdayHeaders = useMemo(() => {
    const baseSunday = new Date(2024, 0, 7);
    const fmt = new Intl.DateTimeFormat(intlLocale, { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseSunday);
      d.setDate(baseSunday.getDate() + i);
      return fmt.format(d);
    });
  }, [intlLocale]);

  const daysGrid = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);
    return cells;
  }, [viewYear, viewMonth]);

  const yearGrid = useMemo(() => {
    return Array.from({ length: 12 }, (_, idx) => yearPageStart + idx).filter(
      (y) => y >= minYear && y <= maxYear
    );
  }, [yearPageStart, minYear, maxYear]);

  const todayStr = getTodayLocalDateString(user?.preferences.timezone);

  const handlePrev = () => {
    if (pickerView === 'days') {
      if (viewMonth === 0) {
        setViewYear((y) => y - 1);
        setViewMonth(11);
      } else {
        setViewMonth((m) => m - 1);
      }
    } else if (pickerView === 'months') {
      setViewYear((y) => Math.max(minYear, y - 1));
    } else {
      setYearPageStart((s) => Math.max(minYear, s - 12));
    }
  };

  const handleNext = () => {
    if (pickerView === 'days') {
      if (viewMonth === 11) {
        setViewYear((y) => y + 1);
        setViewMonth(0);
      } else {
        setViewMonth((m) => m + 1);
      }
    } else if (pickerView === 'months') {
      setViewYear((y) => Math.min(maxYear, y + 1));
    } else {
      setYearPageStart((s) => Math.min(maxYear - 11, s + 12));
    }
  };

  const cycleView = () => {
    setPickerView((prev) =>
      prev === 'days' ? 'months' : prev === 'months' ? 'years' : 'days'
    );
  };

  const headerButtonText =
    pickerView === 'days'
      ? monthHeaderLabel
      : pickerView === 'months'
        ? String(viewYear)
        : `${yearGrid[0] ?? minYear} – ${yearGrid[yearGrid.length - 1] ?? maxYear}`;

  return (
    <div>
      {!inlineLabel && (
        <span className="block text-[13px] font-medium text-[#B8B8BE] mb-1.5">{label}</span>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label={label}
        className={
          inlineLabel
            ? 'focus-dynamic-accent h-11 inline-flex items-center gap-2 rounded-xl bg-[#333333]/35 backdrop-blur-xl border border-white/[0.08] px-3 text-left text-sm text-white hover:border-white/[0.18] active:scale-[0.98] transition-all'
            : 'focus-dynamic-accent w-full h-12 flex items-center gap-2.5 rounded-xl bg-black/30 border border-white/[0.08] px-3.5 text-left text-sm text-white hover:border-white/[0.18] transition-all'
        }
      >
        <Calendar className="text-dynamic-accent h-4 w-4 shrink-0" />
        {inlineLabel && (
          <span className="text-xs font-medium text-[#B8B8BE] shrink-0">{inlineLabel}</span>
        )}
        <span className="font-medium tabular-nums truncate">{formattedTriggerDate}</span>
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                data-portal-popover="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md"
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label={label}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  onClick={(e) => e.stopPropagation()}
                  className="glass-card w-full max-w-sm overflow-hidden p-5 space-y-4 shadow-[0_28px_64px_-16px_rgba(0,0,0,0.75)]"
                >
                  {/* Top Title + Close */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-base font-semibold text-white truncate">
                      {label}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                      }}
                      aria-label="Close"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#B8B8BE] hover:text-white transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Month / Year Navigation + View Switcher */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handlePrev}
                      aria-label="Previous"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#B8B8BE] hover:text-white active:scale-95 transition-all"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={cycleView}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 font-display text-sm font-semibold capitalize text-white hover:bg-white/[0.1] active:scale-[0.98] transition-all"
                    >
                      <span className="tabular-nums">{headerButtonText}</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-dynamic-accent transition-transform duration-200 ${
                          pickerView === 'years' ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={handleNext}
                      aria-label="Next"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#B8B8BE] hover:text-white active:scale-95 transition-all"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* View Body */}
                  {pickerView === 'days' ? (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {weekdayHeaders.map((wd, idx) => (
                          <span
                            key={idx}
                            className="text-[12px] font-medium uppercase text-[#B8B8BE]/80 py-1"
                          >
                            {wd}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {daysGrid.map((day, idx) => {
                          if (day === null) {
                            return <span key={`empty-${idx}`} className="h-9" />;
                          }
                          const iso = formatIsoDate(viewYear, viewMonth, day);
                          const isSelected = iso === value;
                          const isToday = iso === todayStr;

                          return (
                            <button
                              key={iso}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onChange(iso);
                                setOpen(false);
                              }}
                              style={isSelected ? { color: 'var(--accent-foreground)' } : undefined}
                              className={`h-9 w-full rounded-xl font-display text-[13px] font-medium tabular-nums transition-all active:scale-95 ${
                                isSelected
                                  ? 'bg-dynamic-accent font-semibold'
                                  : isToday
                                    ? 'border border-dynamic-accent text-dynamic-accent hover:bg-white/[0.06]'
                                    : 'text-white/90 hover:bg-white/[0.08]'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : pickerView === 'months' ? (
                    <div className="grid grid-cols-3 gap-2 py-2">
                      {monthLabels.map((mLabel, idx) => {
                        const active = idx === viewMonth;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setViewMonth(idx);
                              setPickerView('days');
                            }}
                            style={active ? { color: 'var(--accent-foreground)' } : undefined}
                            className={`h-11 rounded-xl border text-sm font-medium capitalize transition-all active:scale-95 ${
                              active
                                ? 'bg-dynamic-accent border-dynamic-accent font-semibold'
                                : 'border-white/[0.06] bg-black/25 text-white/90 hover:bg-white/[0.08]'
                            }`}
                          >
                            {mLabel}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 py-2">
                      {yearGrid.map((yr) => {
                        const active = yr === viewYear;
                        return (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => {
                              setViewYear(yr);
                              setPickerView('days');
                            }}
                            style={active ? { color: 'var(--accent-foreground)' } : undefined}
                            className={`h-11 rounded-xl border font-display text-sm font-medium tabular-nums transition-all active:scale-95 ${
                              active
                                ? 'bg-dynamic-accent border-dynamic-accent font-semibold'
                                : 'border-white/[0.06] bg-black/25 text-white/90 hover:bg-white/[0.08]'
                            }`}
                          >
                            {yr}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer: Today & Close */}
                  <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(todayStr);
                        setOpen(false);
                      }}
                      className="h-10 rounded-xl bg-dynamic-accent-soft border border-dynamic-accent px-3.5 text-[13px] font-medium text-dynamic-accent hover:opacity-90 active:scale-95 transition-all"
                    >
                      {t('transactions.today')}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                      }}
                      className="h-10 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 text-[13px] font-medium text-white hover:bg-white/[0.08] active:scale-95 transition-all"
                    >
                      {locale === 'es' ? 'Cerrar' : 'Close'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
