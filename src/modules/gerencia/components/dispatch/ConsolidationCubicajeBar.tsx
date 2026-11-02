import React from 'react';
import { Layers, AlertTriangle, CheckCircle2, Link2, Truck } from 'lucide-react';
import { SalesOrder, TransportVehicle } from '@/types/comercial';

interface ConsolidationCubicajeBarProps {
  currentOrder: SalesOrder;
  selectedVehicle: TransportVehicle | null | undefined;
  allOrders: SalesOrder[];
}

export const ConsolidationCubicajeBar: React.FC<ConsolidationCubicajeBarProps> = ({
  currentOrder,
  selectedVehicle,
  allOrders,
}) => {
  if (!selectedVehicle) return null;

  // Jaulas del pedido actual
  const currentBirds = currentOrder.allocated_quantity || currentOrder.requested_quantity || 0;
  const currentCages = currentOrder.estimated_cages || Math.ceil(currentBirds / 8);

  // Otros pedidos ya asignados a este camión para la misma fecha
  const otherOrdersAssigned = allOrders.filter(
    (o) =>
      o.id !== currentOrder.id &&
      o.transport_assigned &&
      (o.transport_truck_id === selectedVehicle.id || o.transport_plate === selectedVehicle.plate) &&
      o.target_delivery_date === currentOrder.target_delivery_date &&
      o.status !== 'CANCELADO'
  );

  // Jaulas ya comprometidas en otros pedidos
  const existingCages = otherOrdersAssigned.reduce((sum, o) => {
    const b = o.allocated_quantity || o.requested_quantity || 0;
    return sum + (o.estimated_cages || Math.ceil(b / 8));
  }, 0);

  const totalCages = existingCages + currentCages;
  const capacity = selectedVehicle.capacity_cages || 450;
  const percentage = Math.round((totalCages / capacity) * 100);

  const isOvercapacity = totalCages > capacity;
  const isMultipedido = otherOrdersAssigned.length > 0;

  // Color de barra según ocupación
  const getBarColor = () => {
    if (isOvercapacity) return 'bg-rose-500';
    if (percentage > 85) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getTextColor = () => {
    if (isOvercapacity) return 'text-rose-600 dark:text-rose-400';
    if (percentage > 85) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-700 dark:text-emerald-400';
  };

  return (
    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
          <Layers className="w-4 h-4 text-emerald-600" />
          <span>Control Visual de Cubicaje Jaulero</span>
        </div>

        <div className="font-mono font-black text-xs">
          <span className={getTextColor()}>
            {existingCages > 0 ? `${existingCages} + ${currentCages} = ${totalCages}` : `${currentCages}`}{' '}
            / {capacity} jaulas
          </span>
          <span className="text-[10px] text-slate-400 ml-1 font-bold">({percentage}%)</span>
        </div>
      </div>

      {/* Barra de Progreso de Capacidad */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden flex">
        {existingCages > 0 && (
          <div
            className="bg-blue-500 h-full transition-all duration-300"
            style={{ width: `${Math.min(100, (existingCages / capacity) * 100)}%` }}
            title={`Ocupado previamente: ${existingCages} jaulas`}
          />
        )}
        <div
          className={`${getBarColor()} h-full transition-all duration-300`}
          style={{ width: `${Math.min(100 - (existingCages / capacity) * 100, (currentCages / capacity) * 100)}%` }}
          title={`Pedido actual: ${currentCages} jaulas`}
        />
      </div>

      {/* Alerta de Multipedido Consolidado */}
      {isMultipedido && !isOvercapacity && (
        <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/50 flex items-start gap-2 text-[11px] text-blue-900 dark:text-blue-300">
          <Link2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong>Consolidación Multipedido Activa:</strong> Este camión ya transporta el pedido{' '}
            <span className="font-mono font-bold text-blue-800 dark:text-blue-200">
              {otherOrdersAssigned.map((o) => `${o.order_number} (${o.client_name})`).join(', ')}
            </span>{' '}
            en la misma fecha y zona. Ambos pedidos compartirán flete aprovechando la capacidad total de {capacity} jaulas.
          </div>
        </div>
      )}

      {/* Alerta de Sobrecapacidad */}
      {isOvercapacity && (
        <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-[11px] text-rose-900 dark:text-rose-300 font-bold">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            ⚠️ Sobrecapacidad Jaulera: El total acumulado ({totalCages} jaulas) supera el límite máximo del camión ({capacity} jaulas) en {totalCages - capacity} jaulas. Seleccione una unidad de mayor capacidad o reduzca el lote.
          </div>
        </div>
      )}
    </div>
  );
};
