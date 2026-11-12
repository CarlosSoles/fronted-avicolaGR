import React from 'react';

export type KpiAccent =
  | 'violet'
  | 'emerald'
  | 'sky'
  | 'blue'
  | 'rose'
  | 'amber'
  | 'teal'
  | 'slate'
  | 'red';

const ACCENT_CLASSES: Record<
  KpiAccent,
  { borderTop: string; valueText: string; activeRing: string }
> = {
  violet: {
    borderTop: 'border-t-violet-600',
    valueText: 'text-violet-700 dark:text-violet-400',
    activeRing: 'border-violet-400 ring-2 ring-violet-500/20 bg-violet-50/30 dark:bg-violet-950/20',
  },
  emerald: {
    borderTop: 'border-t-emerald-600',
    valueText: 'text-emerald-700 dark:text-emerald-400',
    activeRing: 'border-emerald-400 ring-2 ring-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/20',
  },
  sky: {
    borderTop: 'border-t-sky-600',
    valueText: 'text-sky-700 dark:text-sky-400',
    activeRing: 'border-sky-400 ring-2 ring-sky-500/20 bg-sky-50/30 dark:bg-sky-950/20',
  },
  blue: {
    borderTop: 'border-t-blue-600',
    valueText: 'text-blue-700 dark:text-blue-400',
    activeRing: 'border-blue-400 ring-2 ring-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20',
  },
  rose: {
    borderTop: 'border-t-rose-600',
    valueText: 'text-rose-700 dark:text-rose-400',
    activeRing: 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/30 dark:bg-rose-950/20',
  },
  amber: {
    borderTop: 'border-t-amber-500',
    valueText: 'text-amber-700 dark:text-amber-400',
    activeRing: 'border-amber-400 ring-2 ring-amber-500/20 bg-amber-50/30 dark:bg-amber-950/20',
  },
  teal: {
    borderTop: 'border-t-teal-600',
    valueText: 'text-teal-700 dark:text-teal-400',
    activeRing: 'border-teal-400 ring-2 ring-teal-500/20 bg-teal-50/30 dark:bg-teal-950/20',
  },
  slate: {
    borderTop: 'border-t-slate-600 dark:border-t-slate-400',
    valueText: 'text-slate-900 dark:text-slate-100',
    activeRing: 'border-slate-400 ring-2 ring-slate-500/20',
  },
  red: {
    borderTop: 'border-t-red-600',
    valueText: 'text-red-700 dark:text-red-400',
    activeRing: 'border-red-400 ring-2 ring-red-500/20 bg-red-50/30 dark:bg-red-950/20',
  },
};

export interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  accent?: KpiAccent;
  onClick?: () => void;
  active?: boolean;
  htmlTitle?: string;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  accent = 'slate',
  onClick,
  active = false,
  htmlTitle,
  className = '',
}) => {
  const styles = ACCENT_CLASSES[accent];
  const baseClass = `text-left p-3.5 bg-white dark:bg-slate-900 rounded-2xl border shadow-xs border-t-2 ${styles.borderTop} ${
    active ? styles.activeRing : 'border-slate-200 dark:border-slate-800'
  } ${onClick ? 'hover:shadow-sm transition-all cursor-pointer' : ''} ${className}`;

  const content = (
    <>
      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
        {title}
      </div>
      <div
        className={`text-2xl font-black font-mono tabular-nums mt-1 ${styles.valueText}`}
      >
        {value}
      </div>
      {subtitle && (
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
          {subtitle}
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={htmlTitle} className={baseClass}>
        {content}
      </button>
    );
  }

  return (
    <div title={htmlTitle} className={baseClass}>
      {content}
    </div>
  );
};

