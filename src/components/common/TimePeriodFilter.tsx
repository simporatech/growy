import { useMemo, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  TIME_PERIOD_PRESETS,
  TimePeriodPreset,
  TimePeriodValue,
} from '../../utils/dateRangeFilter';
import { getTodayLocalDateString } from '../../utils/transactionMetrics';
import { GlassDatePicker } from './GlassDatePicker';
import { GlassSelectModal } from './GlassSelectModal';

interface TimePeriodFilterProps {
  value: TimePeriodValue;
  onChange: (next: TimePeriodValue) => void;
  defaultPreset?: TimePeriodPreset;
}

export function TimePeriodFilter({
  value,
  onChange,
  defaultPreset = 'this_month',
}: TimePeriodFilterProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);

  const todayStr = getTodayLocalDateString(user?.preferences.timezone);
  const monthStartStr = `${todayStr.slice(0, 7)}-01`;

  const options = useMemo(
    () =>
      TIME_PERIOD_PRESETS.map((preset) => ({
        id: preset,
        label: t(`period.${preset}` as 'period.this_month'),
      })),
    [t]
  );

  const activeLabel =
    options.find((opt) => opt.id === value.preset)?.label ?? t(`period.${defaultPreset}` as 'period.this_month');
  const isFiltered = value.preset !== defaultPreset;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        aria-expanded={modalOpen}
        className={`h-11 inline-flex items-center justify-between gap-2 rounded-xl backdrop-blur-xl border px-3.5 text-sm font-medium transition-all active:scale-[0.98] ${
          isFiltered
            ? 'bg-dynamic-accent-subtle border-dynamic-accent text-white'
            : 'bg-[#333333]/35 border-white/[0.08] text-white hover:border-white/[0.18]'
        }`}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <Calendar className="text-dynamic-accent h-4 w-4 shrink-0" />
          <span className="truncate">{activeLabel}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#B8B8BE] transition-transform duration-200 ${
            modalOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {value.preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <GlassDatePicker
            label={t('period.fromLabel')}
            inlineLabel={`${t('period.fromLabel')}:`}
            value={value.customStart || monthStartStr}
            onChange={(nextStart) =>
              onChange({
                preset: 'custom',
                customStart: nextStart,
                customEnd: value.customEnd || todayStr,
              })
            }
          />
          <GlassDatePicker
            label={t('period.toLabel')}
            inlineLabel={`${t('period.toLabel')}:`}
            value={value.customEnd || todayStr}
            onChange={(nextEnd) =>
              onChange({
                preset: 'custom',
                customStart: value.customStart || monthStartStr,
                customEnd: nextEnd,
              })
            }
          />
        </div>
      )}

      <GlassSelectModal
        isOpen={modalOpen}
        title={t('overview.periodTitle')}
        value={value.preset}
        options={options}
        searchable={false}
        onSelect={(id) => {
          const nextPreset = id as TimePeriodPreset;
          if (nextPreset === 'custom') {
            onChange({
              preset: 'custom',
              customStart: value.customStart || monthStartStr,
              customEnd: value.customEnd || todayStr,
            });
          } else {
            onChange({
              preset: nextPreset,
              customStart: value.customStart,
              customEnd: value.customEnd,
            });
          }
        }}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

