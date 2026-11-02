import React from 'react';
import {
  Truck,
  Layers,
  Navigation,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { SalesOrder, DispatchPhase } from '@/types/comercial';
import { DISPATCH_PHASES } from './DispatchLifecycleStepper';

interface DispatchPhasePipelineProps {
  orders: SalesOrder[];
  selectedPhaseFilter: string; // 'ALL' or DispatchPhase
  onSelectPhaseFilter: (phase: string) => void;
}

export const DispatchPhasePipeline: React.FC<DispatchPhasePipelineProps> = ({
  orders,
  selectedPhaseFilter,
  onSelectPhaseFilter,
}) => {
  // Consideramos pedidos con transporte asignado (aprobados o en proceso de despacho / entregados)
  const dispatchedOrders = orders.filter(
    (o) => (o.status === 'APROBADO_RESERVADO' || o.status === 'DESPACHADO') && o.transport_assigned
  );

  // Calcular métricas por fase
  const metricsByPhase = DISPATCH_PHASES.map((phase) => {
    const phaseOrders = dispatchedOrders.filter(
      (o) => (o.dispatch_phase || 'TRANSPORTE_ASIGNADO') === phase.key
    );

    const count = phaseOrders.length;
    const totalBirds = phaseOrders.reduce((sum, o) => sum + (o.allocated_quantity || o.requested_quantity || 0), 0);
    const totalKg = phaseOrders.reduce((sum, o) => sum + (o.estimated_total_kg || 0), 0);
    const totalTons = Number((totalKg / 1000).toFixed(1));
    const totalCages = phaseOrders.reduce(
      (sum, o) => sum + (o.estimated_cages || Math.round((o.allocated_quantity || o.requested_quantity || 0) / 8)),
      0
    );

    return {
      ...phase,
      count,
      totalBirds,
      totalTons,
      totalCages,
    };
  });

  return (
    <div className="space-y-2">
      {selectedPhaseFilter !== 'ALL' && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onSelectPhaseFilter('ALL')}
            className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
          >
            <Filter className="w-3 h-3" />
            <span>Ver Todas las Fases</span>
          </button>
        </div>
      )}

      {/* Grid de 4 Fases con Métricas de Tonelaje y Jaulas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metricsByPhase.map((phase) => {
          const isSelected = selectedPhaseFilter === phase.key;
          const Icon = phase.icon;

          return (
            <div
              key={phase.key}
              onClick={() => onSelectPhaseFilter(isSelected ? 'ALL' : phase.key)}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                isSelected
                  ? `${phase.activeBg} ${phase.activeBorder} shadow-sm`
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
              }`}
            >
              {/* Encabezado de la Tarjeta */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-5 h-5 rounded-lg flex items-center justify-center text-white text-[10px] font-black"
                    style={{ backgroundColor: phase.color }}
                  >
                    0{phase.step}
                  </div>
                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate">
                    {phase.shortLabel}
                  </span>
                </div>

                <span
                  className="font-mono font-black text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${phase.color}15`,
                    color: phase.color,
                  }}
                >
                  {phase.count} {phase.count === 1 ? 'ped' : 'peds'}
                </span>
              </div>

              {/* Tonelaje Destacado */}
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-xl font-black font-mono text-slate-950 dark:text-white">
                    {phase.totalTons}
                  </span>
                  <span className="text-xs font-bold text-slate-400 ml-1">Ton</span>
                </div>

                <div className="text-[10px] font-mono text-slate-500 text-right">
                  ~{phase.totalCages.toLocaleString()} jlas
                </div>
              </div>

              {/* Subtítulo Descriptivo de la Fase */}
              <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1">
                <span style={{ color: phase.color }}>
                  <Icon className="w-3 h-3 shrink-0" />
                </span>
                <span>{phase.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
