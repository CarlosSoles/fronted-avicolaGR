// ==============================================================================
// FILTRO COMPACTO DE FECHAS PARA PEDIDOS (CRITERIO + PRESET / RANGO)
// Archivo: fronted/src/components/ui/OrderDateFilter.tsx
// ==============================================================================

import React from 'react';
import { Calendar, X } from 'lucide-react';
import { DateCriterion, DateFilterValue, DatePreset } from '@/lib/dateFilters';

interface PresetOption {
  value: DatePreset;
  label: string;
}

const SACA_PRESETS: PresetOption[] = [
  { value: 'ALL', label: 'Todas las fechas' },
  { value: 'TODAY', label: 'Hoy' },
  { value: 'NEXT_3_DAYS', label: 'Próximos 3 días' },
  { value: 'THIS_WEEK', label: 'Esta semana' },
  { value: 'THIS_MONTH', label: 'Este mes' },
  { value: 'CUSTOM', label: 'Rango personalizado…' },
];

const REGISTRO_PRESETS: PresetOption[] = [
  { value: 'ALL', label: 'Todas las fechas' },
  { value: 'TODAY', label: 'Hoy' },
  { value: 'LAST_3_DAYS', label: 'Últimos 3 días' },
  { value: 'THIS_WEEK', label: 'Esta semana' },
  { value: 'THIS_MONTH', label: 'Este mes' },
  { value: 'LAST_6_MONTHS', label: 'Últimos 6 meses' },
  { value: 'CUSTOM', label: 'Rango personalizado…' },
];

interface OrderDateFilterProps {
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
  className?: string;
}

const selectClass =
  'px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 h-9';
const dateInputClass =
  'px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 h-9';

export const OrderDateFilter: React.FC<OrderDateFilterProps> = ({ value, onChange, className }) => {
  const presets = value.criterion === 'saca' ? SACA_PRESETS : REGISTRO_PRESETS;
  const isActive = value.preset !== 'ALL';

  const handleCriterion = (criterion: DateCriterion) => {
    const target = criterion === 'saca' ? SACA_PRESETS : REGISTRO_PRESETS;
    const stillValid = target.some((p) => p.value === value.preset);
    onChange({ ...value, criterion, preset: stillValid ? value.preset : 'ALL' });
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className || ''}`}>
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <Calendar className="w-3.5 h-3.5" />
        <span>Fecha</span>
      </span>

      <select
        value={value.criterion}
        onChange={(e) => handleCriterion(e.target.value as DateCriterion)}
        className={selectClass}
        title="Criterio de fecha"
      >
        <option value="saca">Fecha de saca</option>
        <option value="registro">Fecha de registro</option>
      </select>

      <select
        value={value.preset}
        onChange={(e) => onChange({ ...value, preset: e.target.value as DatePreset })}
        className={selectClass}
        title="Rango de fechas"
      >
        {presets.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      {value.preset === 'CUSTOM' && (
        <>
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className={dateInputClass}
            title="Desde"
          />
          <span className="text-[11px] font-bold text-slate-400">→</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className={dateInputClass}
            title="Hasta"
          />
        </>
      )}

      {isActive && (
        <button
          type="button"
          onClick={() => onChange({ ...value, preset: 'ALL', from: '', to: '' })}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Quitar filtro de fecha"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
