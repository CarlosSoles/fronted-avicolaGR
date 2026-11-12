import React from 'react';
import { cn } from '../../lib/utils';

export interface ModuleTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  activeClassName?: string;
}

interface ModuleTabsProps<T extends string = string> {
  tabs: ModuleTabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
}

/**
 * Barra estándar de pestañas/apartados para los módulos del sistema.
 */
export function ModuleTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className,
}: ModuleTabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 text-xs font-bold overflow-x-auto',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'pb-3 px-3.5 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors',
              isActive
                ? tab.activeClassName || 'border-red-600 text-red-600 dark:text-red-400 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}

