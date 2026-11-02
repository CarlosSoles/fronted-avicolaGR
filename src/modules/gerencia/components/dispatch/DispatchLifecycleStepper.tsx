import React from 'react';
import {
  Truck,
  Layers,
  Navigation,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { DispatchPhase } from '@/types/comercial';

export interface DispatchPhaseMeta {
  key: DispatchPhase;
  step: number;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

export const DISPATCH_PHASES: DispatchPhaseMeta[] = [
  {
    key: 'TRANSPORTE_ASIGNADO',
    step: 1,
    label: 'Transporte Asignado',
    shortLabel: 'Asignado',
    description: 'Camión y chofer designados. Unidad lista para presentarse en granja.',
    color: '#3b82f6', // blue
    activeBg: 'bg-blue-50 dark:bg-blue-950/50',
    activeBorder: 'border-blue-500 ring-2 ring-blue-500/20',
    activeText: 'text-blue-700 dark:text-blue-400',
    icon: Truck,
  },
  {
    key: 'EN_GRANJA_CARGANDO',
    step: 2,
    label: 'En Granja / Cargando Aves',
    shortLabel: 'En Carga',
    description: 'Camión en balanza de granja. Cuadrilla pesando y cargando jaulas.',
    color: '#f59e0b', // amber
    activeBg: 'bg-amber-50 dark:bg-amber-950/50',
    activeBorder: 'border-amber-500 ring-2 ring-amber-500/20',
    activeText: 'text-amber-700 dark:text-amber-400',
    icon: Layers,
  },
  {
    key: 'EN_TRANSITO',
    step: 3,
    label: 'En Tránsito Carretera',
    shortLabel: 'En Ruta',
    description: 'Despachado de granja con guía de remisión. En carretera hacia cliente.',
    color: '#0284c7', // sky
    activeBg: 'bg-sky-50 dark:bg-sky-950/50',
    activeBorder: 'border-sky-500 ring-2 ring-sky-500/20',
    activeText: 'text-sky-700 dark:text-sky-400',
    icon: Navigation,
  },
  {
    key: 'ENTREGADO_CONFORME',
    step: 4,
    label: 'Entregado / Conforme en Destino',
    shortLabel: 'Entregado',
    description: 'Aves descargadas y recepcionadas conforme por el cliente.',
    color: '#10b981', // emerald
    activeBg: 'bg-emerald-50 dark:bg-emerald-950/50',
    activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20',
    activeText: 'text-emerald-700 dark:text-emerald-400',
    icon: CheckCircle2,
  },
];

interface DispatchLifecycleStepperProps {
  currentPhase?: DispatchPhase;
  phaseUpdatedAt?: string;
  onPhaseChange?: (newPhase: DispatchPhase) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const DispatchLifecycleStepper: React.FC<DispatchLifecycleStepperProps> = ({
  currentPhase = 'TRANSPORTE_ASIGNADO',
  phaseUpdatedAt,
  compact = false,
}) => {
  const currentIndex = DISPATCH_PHASES.findIndex((p) => p.key === currentPhase);
  const activePhase = DISPATCH_PHASES[currentIndex] || DISPATCH_PHASES[0];

  return (
    <div className="space-y-3 p-3.5 bg-slate-50/70 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
      {/* Cabecera del Stepper */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Ciclo de Despacho
          </span>
          <span className="text-slate-300 dark:text-slate-700">&bull;</span>
          <span className={`font-mono font-bold text-xs ${activePhase.activeText}`}>
            Paso {activePhase.step} de 4: {activePhase.label}
          </span>
        </div>

        {phaseUpdatedAt && (
          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
            <Clock className="w-3 h-3 text-slate-400" />
            {new Date(phaseUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Barra Visual de las 4 Fases (Monitoreo Telemático) */}
      <div className="grid grid-cols-4 gap-1.5 relative">
        {DISPATCH_PHASES.map((phase, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const Icon = phase.icon;

          return (
            <div
              key={phase.key}
              title={`Fase ${phase.step}: ${phase.label}`}
              className={`p-2 rounded-xl text-left transition-all border flex flex-col items-center sm:items-start gap-1 relative select-none ${
                isCurrent
                  ? `${phase.activeBg} ${phase.activeBorder} shadow-xs`
                  : isCompleted
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/60 text-slate-700 dark:text-slate-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
              }`}
            >
              {/* Indicador de Paso y Estado */}
              <div className="flex items-center justify-between w-full">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isCurrent
                      ? 'bg-white dark:bg-slate-900 shadow-xs'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                  style={{ color: isCurrent ? phase.color : undefined }}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>

                <span className="hidden sm:inline font-mono text-[10px] font-bold text-slate-400">
                  0{phase.step}
                </span>
              </div>

              {/* Nombre de la Fase */}
              <div className="w-full text-center sm:text-left mt-0.5">
                <div
                  className={`text-[11px] font-black leading-tight truncate ${
                    isCurrent
                      ? phase.activeText
                      : isCompleted
                      ? 'text-emerald-800 dark:text-emerald-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {phase.shortLabel}
                </div>
                {!compact && (
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate hidden md:block">
                    {idx === 0 && 'Chofer listo'}
                    {idx === 1 && 'Balanza / Saca'}
                    {idx === 2 && 'En carretera'}
                    {idx === 3 && 'Conforme'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Estado Actual y Transmisión Telemática en Tiempo Real */}
      {currentPhase === 'ENTREGADO_CONFORME' ? (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Ciclo de entrega completado y recepcionado conforme por el cliente en destino.</span>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 pt-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  currentPhase === 'EN_TRANSITO'
                    ? 'bg-sky-400'
                    : currentPhase === 'EN_GRANJA_CARGANDO'
                    ? 'bg-amber-400'
                    : 'bg-blue-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  currentPhase === 'EN_TRANSITO'
                    ? 'bg-sky-500'
                    : currentPhase === 'EN_GRANJA_CARGANDO'
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
              />
            </span>
            <p className="text-[10.5px] text-slate-600 dark:text-slate-300 italic truncate">
              {activePhase.description}
            </p>
          </div>

          <span className="text-[9.5px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-700/50 shrink-0">
            📡 Avance telemático GPS en tiempo real
          </span>
        </div>
      )}
    </div>
  );
};
