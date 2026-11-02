import React from 'react';
import {
  FileText,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Truck,
  Undo2,
  Navigation,
  Scissors,
  Clock,
  User,
  ShieldCheck,
} from 'lucide-react';
import { AuditLogEntry } from '@/types/comercial';

interface AuditTimelineProps {
  auditLog?: AuditLogEntry[];
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ auditLog = [] }) => {
  if (!auditLog || auditLog.length === 0) {
    return (
      <div className="py-6 text-center text-slate-400 italic text-xs bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800">
        No hay registros de auditoría previos para este pedido.
      </div>
    );
  }

  const getActionConfig = (action: string) => {
    switch (action) {
      case 'CREADO':
        return {
          icon: FileText,
          bg: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
          border: 'border-blue-500',
          title: 'Registrado por Comercial',
        };
      case 'OBSERVADO':
        return {
          icon: AlertTriangle,
          bg: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
          border: 'border-amber-500',
          title: 'Observado por Gestor Comercial',
        };
      case 'CORREGIDO':
        return {
          icon: RefreshCw,
          bg: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
          border: 'border-purple-500',
          title: 'Corregido por Vendedor',
        };
      case 'APROBADO_RESERVADO':
        return {
          icon: CheckCircle2,
          bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
          border: 'border-emerald-500',
          title: 'Aprobado Formal con Reserva',
        };
      case 'TRANSPORTE_ASIGNADO':
        return {
          icon: Truck,
          bg: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
          border: 'border-sky-500',
          title: 'Unidad de Transporte Designada',
        };
      case 'TRANSPORTE_LIBERADO':
        return {
          icon: Undo2,
          bg: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
          border: 'border-rose-500',
          title: 'Transporte Liberado',
        };
      case 'FASE_ACTUALIZADA':
        return {
          icon: Navigation,
          bg: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
          border: 'border-teal-500',
          title: 'Fase de Despacho Actualizada',
        };
      case 'FRACCIONADO':
        return {
          icon: Scissors,
          bg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
          border: 'border-indigo-500',
          title: 'Fraccionamiento de Pedido (Split)',
        };
      default:
        return {
          icon: ShieldCheck,
          bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
          border: 'border-slate-500',
          title: action,
        };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          Línea de Tiempo y Auditoría Inmutable ({auditLog.length} Eventos)
        </span>
        <span className="text-[10px] text-slate-500 font-mono">Trazabilidad de Cadena Operativa</span>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        {auditLog.map((entry, idx) => {
          const config = getActionConfig(entry.action);
          const Icon = config.icon;
          const dateStr = entry.timestamp ? new Date(entry.timestamp).toLocaleString('es-PE') : '-';

          return (
            <div key={entry.id || idx} className="relative group">
              {/* Nodo del Timeline */}
              <div
                className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center text-xs shadow-xs border ${config.bg} ${config.border}`}
              >
                <Icon className="w-3 h-3" />
              </div>

              {/* Contenido del Evento */}
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {config.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      @{entry.actor_username} ({entry.actor_role})
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {dateStr}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {entry.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

