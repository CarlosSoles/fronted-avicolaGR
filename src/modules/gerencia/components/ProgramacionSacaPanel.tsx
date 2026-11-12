import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  MapPin,
  Search,
  Sparkles,
  Truck,
  BarChart3,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/api';
import {
  computeCages,
  DEFAULT_DENSITY,
  deriveEstadoComercial,
  ESTADO_COMERCIAL_META,
  MAX_DENSITY,
  MIN_DENSITY,
  OrderUpdatePayload,
  SalesOrder,
  SexPreference,
} from '@/types/comercial';
import { TablaGeneralSaldoItem } from '@/types/pecuaria';
import { SimulatedTruck } from './gps/simulationTypes';
import { gpsSimulationStore } from './gps/gpsSimulationStore';

type SortOption = 'date_desc' | 'date_asc' | 'birds_desc' | 'client_asc';

interface ProgramacionSacaPanelProps {
  orders: SalesOrder[];
  pecuariaItems: TablaGeneralSaldoItem[];
  onOrdersSynced: () => Promise<void> | void;
  onOrderUpdated: (updated: SalesOrder) => void;
  onOpenApprovalModal: (order: SalesOrder) => void;
  onOpenDetailModal: (order: SalesOrder) => void;
  onOpenGpsModal: (order: SalesOrder) => void;
  onToast: (message: string) => void;
}

const getPeruTodayIso = (): string => {
  const now = new Date();
  const peruMs = now.getTime() - 5 * 60 * 60 * 1000;
  return new Date(peruMs).toISOString().slice(0, 10);
};

const formatDateShort = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const getTrackingSummary = (
  order: SalesOrder,
  trucks: SimulatedTruck[]
): { label: string; tone: 'emerald' | 'sky' | 'amber' | 'slate'; interactive: boolean } => {
  if (!order.transport_assigned) {
    return {
      label: order.status === 'APROBADO_RESERVADO' ? 'Esperando asignación en Control de Flota' : 'Sin transporte asignado',
      tone: 'slate',
      interactive: false,
    };
  }

  const matchedTruck = trucks.find(
    (t) =>
      t.id === order.transport_truck_id ||
      (order.transport_plate && t.plate.toLowerCase() === order.transport_plate.toLowerCase())
  );

  if (order.dispatch_phase === 'ENTREGADO_CONFORME') {
    return { label: 'Entregado conforme', tone: 'emerald', interactive: true };
  }
  if (order.dispatch_phase === 'EN_TRANSITO') {
    const pct = matchedTruck ? ` · ${matchedTruck.progressPercent}%` : '';
    return { label: `En tránsito GPS${pct}`, tone: 'sky', interactive: true };
  }
  if (order.dispatch_phase === 'EN_GRANJA_CARGANDO') {
    return { label: 'En granja / Cargando', tone: 'amber', interactive: true };
  }
  return { label: 'Unidad asignada · Lista en flota', tone: 'emerald', interactive: true };
};

export const ProgramacionSacaPanel: React.FC<ProgramacionSacaPanelProps> = ({
  orders,
  pecuariaItems,
  onOrdersSynced,
  onOrderUpdated,
  onOpenApprovalModal,
  onOpenDetailModal,
  onOpenGpsModal,
  onToast,
}) => {
  // Filtros del apartado
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [farmFilter, setFarmFilter] = useState('ALL');
  const [transportFilter, setTransportFilter] = useState<'ALL' | 'WITH' | 'WITHOUT'>('ALL');
  const [arisFilter, setArisFilter] = useState<'ALL' | 'WITH' | 'WITHOUT'>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [showCharts, setShowCharts] = useState(false);

  // Sincronía ligera con el store GPS para mostrar avance en la columna Seguimiento
  const [trucks, setTrucks] = useState<SimulatedTruck[]>(() => gpsSimulationStore.getTrucks());
  useEffect(() => {
    const unsub = gpsSimulationStore.subscribe(() => {
      setTrucks(gpsSimulationStore.getTrucks());
    });
    return () => unsub();
  }, []);

  // Modales locales de Programación de Saca
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    targetDeliveryDate: '',
    farmCode: '',
    barnCode: '',
    quantity: 0,
    density: DEFAULT_DENSITY,
    sexPreference: 'MACHO' as SexPreference,
    minWeightKg: 2.2,
    maxWeightKg: 2.5,
    externalReference: '',
    notes: '',
  });

  const [arisModalOrder, setArisModalOrder] = useState<SalesOrder | null>(null);
  const [arisInput, setArisInput] = useState('');
  const [isSavingAris, setIsSavingAris] = useState(false);

  const peruToday = useMemo(() => getPeruTodayIso(), []);

  // Programación de saca trabaja únicamente con pedidos ya Programados (o posteriores)
  const scheduledOrders = useMemo(
    () =>
      orders.filter((o) => {
        const eco = deriveEstadoComercial(o);
        return (
          eco !== 'BORRADOR' &&
          eco !== 'PREPROGRAMACION' &&
          o.status !== 'CON_OBSERVACION'
        );
      }),
    [orders]
  );

  // Listas dinámicas reales para los dropdowns de filtros
  const clientOptions = useMemo(() => {
    const names = new Set<string>();
    scheduledOrders.forEach((o) => {
      if (o.client_name) names.add(o.client_name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [scheduledOrders]);

  const farmOptions = useMemo(() => {
    const codes = new Set<string>();
    pecuariaItems.forEach((p) => {
      if (p.farm_code) codes.add(p.farm_code);
    });
    scheduledOrders.forEach((o) => {
      if (o.assigned_farm_code) codes.add(o.assigned_farm_code);
      if (o.suggested_farm_code) codes.add(o.suggested_farm_code);
    });
    return Array.from(codes).sort();
  }, [pecuariaItems, scheduledOrders]);

  const farmNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    pecuariaItems.forEach((p) => {
      if (p.farm_code && p.farm_name && !map.has(p.farm_code)) {
        map.set(p.farm_code, p.farm_name);
      }
    });
    return map;
  }, [pecuariaItems]);

  const availableBarnsForFarm = (farmCode: string) =>
    pecuariaItems.filter((p) => p.farm_code === farmCode && !p.is_closed);

  // Filtrado completo sobre datos reales (solo desde Programado en adelante)
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scheduledOrders.filter((order) => {
      const orderFarm = order.assigned_farm_code || order.suggested_farm_code || '';
      const orderDate = (order.target_delivery_date || '').slice(0, 10);

      if (q) {
        const matchesSearch =
          (order.client_name || '').toLowerCase().includes(q) ||
          (order.order_number || '').toLowerCase().includes(q) ||
          (order.codigo_aris || '').toLowerCase().includes(q) ||
          (order.transport_plate || '').toLowerCase().includes(q) ||
          (order.client_tax_id || '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      if (dateFrom && orderDate < dateFrom) return false;
      if (dateTo && orderDate > dateTo) return false;
      if (clientFilter !== 'ALL' && order.client_name !== clientFilter) return false;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'CON_OBSERVACION') {
          if (order.status !== 'CON_OBSERVACION') return false;
        } else if (deriveEstadoComercial(order) !== statusFilter) {
          return false;
        }
      }
      if (farmFilter !== 'ALL' && orderFarm !== farmFilter) return false;
      if (transportFilter === 'WITH' && !order.transport_assigned) return false;
      if (transportFilter === 'WITHOUT' && order.transport_assigned) return false;
      if (arisFilter === 'WITH' && !order.codigo_aris) return false;
      if (arisFilter === 'WITHOUT' && order.codigo_aris) return false;

      return true;
    });
  }, [
    scheduledOrders,
    searchQuery,
    dateFrom,
    dateTo,
    clientFilter,
    statusFilter,
    farmFilter,
    transportFilter,
    arisFilter,
  ]);

  // Ordenamiento
  const sortedOrders = useMemo(() => {
    const list = [...filteredOrders];
    list.sort((a, b) => {
      if (sortBy === 'date_asc') {
        return (a.target_delivery_date || '').localeCompare(b.target_delivery_date || '');
      }
      if (sortBy === 'birds_desc') {
        const qa = a.allocated_quantity || a.requested_quantity || 0;
        const qb = b.allocated_quantity || b.requested_quantity || 0;
        return qb - qa;
      }
      if (sortBy === 'client_asc') {
        return (a.client_name || '').localeCompare(b.client_name || '');
      }
      // date_desc por defecto
      const cmp = (b.target_delivery_date || '').localeCompare(a.target_delivery_date || '');
      if (cmp !== 0) return cmp;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    return list;
  }, [filteredOrders, sortBy]);

  // 4 KPIs reales (reservas activas, excluyendo canceladas)
  const summaryKpis = useMemo(() => {
    const active = filteredOrders.filter((o) => o.status !== 'CANCELADO');
    let totalBirds = 0;
    let birdsWithoutTruck = 0;
    let ordersWithoutAris = 0;

    active.forEach((o) => {
      const birds = o.allocated_quantity || o.requested_quantity || 0;
      totalBirds += birds;
      if (!o.transport_assigned) birdsWithoutTruck += birds;
      if (!o.codigo_aris) ordersWithoutAris += 1;
    });

    return {
      totalBirds,
      ordersCount: active.length,
      birdsWithoutTruck,
      ordersWithoutAris,
    };
  }, [filteredOrders]);

  // Datos reales para "Ver gráficos"
  const chartStats = useMemo(() => {
    const active = filteredOrders.filter((o) => o.status !== 'CANCELADO');
    const byFarm = new Map<string, number>();
    const byStatus = new Map<string, number>();

    active.forEach((o) => {
      const birds = o.allocated_quantity || o.requested_quantity || 0;
      const farm = o.assigned_farm_code || o.suggested_farm_code || 'Sin granja';
      byFarm.set(farm, (byFarm.get(farm) || 0) + birds);

      const stateLabel =
        o.status === 'CON_OBSERVACION'
          ? 'Con observación'
          : ESTADO_COMERCIAL_META[deriveEstadoComercial(o)].label;
      byStatus.set(stateLabel, (byStatus.get(stateLabel) || 0) + birds);
    });

    const maxFarmBirds = Math.max(1, ...Array.from(byFarm.values()));
    const maxStatusBirds = Math.max(1, ...Array.from(byStatus.values()));

    return {
      farms: Array.from(byFarm.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
      statuses: Array.from(byStatus.entries()).sort((a, b) => b[1] - a[1]),
      maxFarmBirds,
      maxStatusBirds,
    };
  }, [filteredOrders]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setClientFilter('ALL');
    setStatusFilter('ALL');
    setFarmFilter('ALL');
    setTransportFilter('ALL');
    setArisFilter('ALL');
  };

  // Abrir modal Editar
  const handleOpenEditModal = (order: SalesOrder) => {
    setEditingOrder(order);
    const farm = order.assigned_farm_code || order.suggested_farm_code || farmOptions[0] || '';
    const barn = order.assigned_barn_code || order.suggested_barn_code || '';
    setEditForm({
      targetDeliveryDate: (order.target_delivery_date || '').slice(0, 10),
      farmCode: farm,
      barnCode: barn,
      quantity: order.allocated_quantity || order.requested_quantity || 0,
      density: order.density_birds_per_cage || DEFAULT_DENSITY,
      sexPreference: (order.sex_preference as SexPreference) || 'MACHO',
      minWeightKg: order.min_weight_kg || 2.2,
      maxWeightKg: order.max_weight_kg || 2.5,
      externalReference: order.external_reference || '',
      notes: order.notes || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    if (editForm.quantity <= 0) {
      onToast('⚠️ La cantidad de aves debe ser mayor a cero.');
      return;
    }
    if (editForm.minWeightKg > editForm.maxWeightKg) {
      onToast('⚠️ El peso mínimo no puede ser mayor al máximo.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const payload: OrderUpdatePayload = {
        target_delivery_date: editForm.targetDeliveryDate,
        farm_code: editForm.farmCode || undefined,
        barn_code: editForm.barnCode || undefined,
        requested_quantity: editForm.quantity,
        allocated_quantity:
          editingOrder.status === 'APROBADO_RESERVADO' ? editForm.quantity : undefined,
        density_birds_per_cage: editForm.density,
        sex_preference: editForm.sexPreference,
        min_weight_kg: editForm.minWeightKg,
        max_weight_kg: editForm.maxWeightKg,
        external_reference: editForm.externalReference,
        notes: editForm.notes,
      };

      const updated = await apiClient<SalesOrder>(`/comercial/orders/${editingOrder.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      onOrderUpdated(updated);
      setEditingOrder(null);
      onToast(`✅ Reserva ${updated.order_number} actualizada y sincronizada con el sistema.`);
      await onOrdersSynced();
    } catch (err: any) {
      onToast(`❌ Error al guardar cambios: ${err?.message || 'Error de conexión'}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Modal Ingresar pedido ARIS
  const handleOpenArisModal = (order: SalesOrder) => {
    setArisModalOrder(order);
    setArisInput(order.codigo_aris || '');
  };

  const handleSubmitAris = async (autoGenerate: boolean) => {
    if (!arisModalOrder) return;
    const manual = autoGenerate ? '' : arisInput.trim();
    if (!autoGenerate && !manual) {
      onToast('⚠️ Ingrese el código ARIS o utilice la opción Auto-generar.');
      return;
    }

    setIsSavingAris(true);
    try {
      const updated = await apiClient<SalesOrder>(
        `/comercial/orders/${arisModalOrder.id}/generar-codigo-aris`,
        {
          method: 'POST',
          body: JSON.stringify(manual ? { codigo_aris: manual } : {}),
        }
      );
      onOrderUpdated(updated);
      setArisModalOrder(null);
      onToast(`✅ Pedido ARIS ${updated.codigo_aris} registrado en ${updated.order_number}.`);
      await onOrdersSynced();
    } catch (err: any) {
      onToast(`❌ Error al registrar ARIS: ${err?.message || 'Error de conexión'}`);
    } finally {
      setIsSavingAris(false);
    }
  };

  const dateRangeSubtitle = useMemo(() => {
    if (dateFrom && dateTo) return `${formatDateShort(dateFrom)} al ${formatDateShort(dateTo)}`;
    if (dateFrom) return `Desde ${formatDateShort(dateFrom)}`;
    if (dateTo) return `Hasta ${formatDateShort(dateTo)}`;
    return 'Todas las fechas';
  }, [dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      {/* Encabezado del apartado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950 dark:text-white tracking-tight">
            Programación de saca
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organiza tus reservas, revisa el histórico y controla el avance de cada pedido.
          </p>
        </div>
      </div>

      {/* Barra de filtros adaptada a nuestros campos reales */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-2.5 items-end">
          {/* Buscar */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Buscar
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cliente, pedido, ARIS o placa..."
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>

          {/* Saca desde */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Saca desde
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-9 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Hasta */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-9 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Cliente
            </label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full h-9 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">Todos</option>
              {clientOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Estado
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">Todos</option>
              <option value="PROGRAMADO">Programado</option>
              <option value="PROGRAMADO_CON_CAMION">Programado con camión</option>
              <option value="CONFIRMADO">Confirmado (en granja)</option>
              <option value="DESPACHADO">Despachado (en ruta)</option>
              <option value="TERMINADO">Terminado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          {/* Granja */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Granja
            </label>
            <select
              value={farmFilter}
              onChange={(e) => setFarmFilter(e.target.value)}
              className="w-full h-9 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">Todos</option>
              {farmOptions.map((code) => (
                <option key={code} value={code}>
                  {farmNameByCode.get(code) ? `${code} · ${farmNameByCode.get(code)}` : code}
                </option>
              ))}
            </select>
          </div>

          {/* Transporte + ARIS + Limpiar */}
          <div className="flex items-end gap-1.5">
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                Transporte / ARIS
              </label>
              <div className="flex gap-1">
                <select
                  value={transportFilter}
                  onChange={(e) => setTransportFilter(e.target.value as 'ALL' | 'WITH' | 'WITHOUT')}
                  title="Filtrar por transporte"
                  className="w-1/2 h-9 px-1.5 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
                >
                  <option value="ALL">Camión: Todos</option>
                  <option value="WITH">Con camión</option>
                  <option value="WITHOUT">Sin camión</option>
                </select>
                <select
                  value={arisFilter}
                  onChange={(e) => setArisFilter(e.target.value as 'ALL' | 'WITH' | 'WITHOUT')}
                  title="Filtrar por código ARIS"
                  className="w-1/2 h-9 px-1.5 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
                >
                  <option value="ALL">ARIS: Todos</option>
                  <option value="WITH">Con ARIS</option>
                  <option value="WITHOUT">Sin ARIS</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-9 px-2.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors shrink-0"
              title="Limpiar filtros"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 border-l-4 border-l-violet-600 flex items-baseline gap-2.5">
            <span className="text-2xl font-black font-mono text-slate-950 dark:text-white">
              {summaryKpis.totalBirds.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Aves reservadas
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 border-l-4 border-l-blue-500 flex items-baseline gap-2.5">
            <span className="text-2xl font-black font-mono text-slate-950 dark:text-white">
              {summaryKpis.ordersCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Pedidos
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 border-l-4 border-l-emerald-500 flex items-baseline gap-2.5">
            <span className="text-2xl font-black font-mono text-slate-950 dark:text-white">
              {summaryKpis.birdsWithoutTruck.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Aves sin camión
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 border-l-4 border-l-amber-500 flex items-baseline gap-2.5">
            <span className="text-2xl font-black font-mono text-slate-950 dark:text-white">
              {summaryKpis.ordersWithoutAris}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Pedidos sin ARIS
            </span>
          </div>
        </div>

        {/* Nota al pie + Toggle Ver gráficos */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
          <span>Totales de reservas activas; excluyen canceladas.</span>
          <button
            type="button"
            onClick={() => setShowCharts((prev) => !prev)}
            className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{showCharts ? 'Ocultar gráficos' : 'Ver gráficos'}</span>
          </button>
        </div>

        {/* Panel colapsable de gráficos reales */}
        {showCharts && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 mb-2.5">
                Aves programadas por Granja
              </h4>
              {chartStats.farms.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Sin reservas activas en el rango.</p>
              ) : (
                <div className="space-y-2">
                  {chartStats.farms.map(([farm, birds]) => (
                    <div key={farm} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-slate-700 dark:text-slate-300">{farm}</span>
                        <span className="font-mono text-slate-900 dark:text-white">
                          {birds.toLocaleString()} aves
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-violet-600 rounded-full"
                          style={{ width: `${Math.round((birds / chartStats.maxFarmBirds) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 mb-2.5">
                Distribución por Estado Operativo
              </h4>
              {chartStats.statuses.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Sin reservas activas en el rango.</p>
              ) : (
                <div className="space-y-2">
                  {chartStats.statuses.map(([label, birds]) => (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-slate-700 dark:text-slate-300">{label}</span>
                        <span className="font-mono text-slate-900 dark:text-white">
                          {birds.toLocaleString()} aves
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full"
                          style={{ width: `${Math.round((birds / chartStats.maxStatusBirds) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabla principal de Reservas */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-950 dark:text-white">Reservas</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {sortedOrders.length} {sortedOrders.length === 1 ? 'reserva' : 'reservas'} &middot; {dateRangeSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Ordenar por
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-8 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="date_desc">Fecha más reciente</option>
              <option value="date_asc">Fecha más antigua</option>
              <option value="birds_desc">Mayor cantidad de aves</option>
              <option value="client_asc">Cliente (A-Z)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2.5 px-3.5">Cliente / pedido</th>
                <th className="py-2.5 px-3.5">Granja / galpón</th>
                <th className="py-2.5 px-3.5">Saca</th>
                <th className="py-2.5 px-3.5 text-right">Aves reservadas</th>
                <th className="py-2.5 px-3.5">Estado / ARIS</th>
                <th className="py-2.5 px-3.5">Camión / placa</th>
                <th className="py-2.5 px-3.5">Seguimiento</th>
                <th className="py-2.5 px-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                    No se encontraron reservas con los filtros actuales.
                  </td>
                </tr>
              ) : (
                sortedOrders.map((order) => {
                  const birds = order.allocated_quantity || order.requested_quantity || 0;
                  const cages = order.estimated_cages || computeCages(birds, order.density_birds_per_cage);
                  const farmCode = order.assigned_farm_code || order.suggested_farm_code || '-';
                  const barnCode = order.assigned_barn_code || order.suggested_barn_code || '-';
                  const farmLabel = farmNameByCode.get(farmCode)
                    ? `${farmNameByCode.get(farmCode)} · ${barnCode}`
                    : `${farmCode} · ${barnCode}`;
                  const isToday = (order.target_delivery_date || '').slice(0, 10) === peruToday;
                  const tracking = getTrackingSummary(order, trucks);
                  const canEdit = order.status !== 'DESPACHADO' && order.status !== 'CANCELADO';
                  const canEnterAris =
                    order.status === 'APROBADO_RESERVADO' && !order.codigo_aris;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Cliente / pedido */}
                      <td className="py-3 px-3.5 min-w-[190px]">
                        <div className="font-bold text-slate-900 dark:text-white leading-tight">
                          {order.client_name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                          {order.order_number} &middot;{' '}
                          {birds.toLocaleString()} {order.sex_preference || 'INDISTINTO'} &middot;{' '}
                          {Number(order.min_weight_kg || 0).toFixed(1)}-{Number(order.max_weight_kg || 0).toFixed(1)} kg
                          {order.order_lines && order.order_lines.length > 1 && (
                            <span className="ml-1 text-violet-600 dark:text-violet-400 font-sans font-semibold">
                              &middot; {order.order_lines.length} líneas
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Granja / galpón */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {order.status === 'APROBADO_RESERVADO' || order.status === 'DESPACHADO'
                            ? farmLabel
                            : farmCode !== '-'
                            ? `Sug: ${farmLabel}`
                            : 'Por asignar galpón'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Zona {order.zone_code} &middot; ~{cages} jaulas
                        </div>
                      </td>

                      {/* Saca */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {formatDateShort(order.target_delivery_date)}
                        </div>
                        {isToday && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 text-[10px] font-bold">
                            Hoy
                          </span>
                        )}
                      </td>

                      {/* Aves reservadas */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="font-mono font-black text-slate-950 dark:text-white text-sm">
                          {birds.toLocaleString()}
                        </div>
                        <div className="text-[10.5px] text-slate-400">
                          {order.status === 'APROBADO_RESERVADO' || order.status === 'DESPACHADO'
                            ? 'aves reservadas'
                            : 'aves solicitadas'}
                        </div>
                      </td>

                      {/* Estado / ARIS */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {(() => {
                          const eco = deriveEstadoComercial(order);
                          const meta = ESTADO_COMERCIAL_META[eco];
                          const isObs = order.status === 'CON_OBSERVACION';
                          return (
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
                                  isObs
                                    ? 'bg-rose-100 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                                    : `${meta.bgColor} ${meta.borderColor} ${meta.color}`
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isObs ? 'bg-rose-500' : meta.dotColor
                                  }`}
                                />
                                {isObs ? 'Con observación' : meta.label}
                              </span>
                              {order.codigo_aris && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/50 text-violet-800 dark:text-violet-300 text-[10.5px] font-bold font-mono">
                                  <Sparkles className="w-3 h-3" />
                                  ARIS: {order.codigo_aris}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Camión / placa */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {order.transport_assigned && order.transport_plate ? (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white font-mono">
                              {order.transport_plate}{' '}
                              <span className="font-sans font-normal text-slate-500">
                                &middot; {birds.toLocaleString()} aves
                              </span>
                            </div>
                            {order.transport_driver_name && (
                              <div className="text-[10.5px] text-slate-500 dark:text-slate-400">
                                {order.transport_driver_name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Sin asignar</span>
                        )}
                      </td>

                      {/* Seguimiento */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {tracking.interactive ? (
                          <button
                            type="button"
                            onClick={() => onOpenGpsModal(order)}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-bold hover:underline ${
                              tracking.tone === 'emerald'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : tracking.tone === 'sky'
                                ? 'text-sky-700 dark:text-sky-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                            title="Ver ubicación y ruta en mapa GPS"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{tracking.label}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {tracking.label}
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canEdit}
                            onClick={() => handleOpenEditModal(order)}
                            className="h-8 px-3 text-xs font-bold bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                            title={
                              canEdit
                                ? 'Editar fecha, galpón o cantidad de la reserva'
                                : 'No editable en estado actual'
                            }
                          >
                            <Edit3 className="w-3 h-3 mr-1" />
                            Editar
                          </Button>

                          {canEnterAris && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!order.transport_assigned}
                              onClick={() => handleOpenArisModal(order)}
                              className="h-8 px-3 text-xs font-bold bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                              title={
                                order.transport_assigned
                                  ? 'Registrar o generar código ARIS del pedido'
                                  : 'Requiere camión asignado por Control de Flota antes de ingresar ARIS'
                              }
                            >
                              Ingresar pedido ARIS
                            </Button>
                          )}

                          {order.status !== 'APROBADO_RESERVADO' &&
                            order.status !== 'DESPACHADO' &&
                            order.status !== 'CANCELADO' && (
                              <Button
                                size="sm"
                                onClick={() => onOpenApprovalModal(order)}
                                className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                title="Aprobar y reservar galpón"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Aprobar
                              </Button>
                            )}

                          <button
                            type="button"
                            onClick={() => onOpenDetailModal(order)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors"
                            title="Ver detalle e historial"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL 2: EDITAR RESERVA (ACTUALIZA BD Y RESINCRONIZA SALDOS/FLOTA)  */}
      {/* =================================================================== */}
      <Modal
        isOpen={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        title={`Editar reserva — ${editingOrder?.order_number || ''}`}
        description={
          editingOrder
            ? `${editingOrder.client_name} · Estado actual: ${editingOrder.status}`
            : ''
        }
        size="lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Fecha de Saca *
              </label>
              <input
                type="date"
                value={editForm.targetDeliveryDate}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, targetDeliveryDate: e.target.value }))
                }
                className="w-full h-9 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Cantidad de Aves *
              </label>
              <Input
                type="number"
                min={1}
                value={editForm.quantity}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, quantity: Number(e.target.value) || 0 }))
                }
                className="font-mono font-bold text-xs h-9"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Granja
              </label>
              <select
                value={editForm.farmCode}
                onChange={(e) => {
                  const nextFarm = e.target.value;
                  const firstBarn = availableBarnsForFarm(nextFarm)[0]?.barn_code || '';
                  setEditForm((prev) => ({
                    ...prev,
                    farmCode: nextFarm,
                    barnCode: firstBarn,
                  }));
                }}
                className="w-full h-9 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
              >
                {farmOptions.map((code) => (
                  <option key={code} value={code}>
                    {farmNameByCode.get(code) ? `${code} - ${farmNameByCode.get(code)}` : code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Galpón
              </label>
              <select
                value={editForm.barnCode}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, barnCode: e.target.value }))
                }
                className="w-full h-9 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
              >
                {availableBarnsForFarm(editForm.farmCode).length === 0 ? (
                  <option value={editForm.barnCode}>{editForm.barnCode || 'G-01'}</option>
                ) : (
                  availableBarnsForFarm(editForm.farmCode).map((b) => (
                    <option key={b.barn_id} value={b.barn_code}>
                      {b.barn_code} · {b.sex} · Saldo: {(b.barn_balance_available || 0).toLocaleString()} aves
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Sexo
                </label>
                <select
                  value={editForm.sexPreference}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      sexPreference: e.target.value as SexPreference,
                    }))
                  }
                  className="w-full h-9 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="MACHO">MACHO</option>
                  <option value="HEMBRA">HEMBRA</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Aves / Jaula
                </label>
                <Input
                  type="number"
                  min={MIN_DENSITY}
                  max={MAX_DENSITY}
                  value={editForm.density}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      density: Number(e.target.value) || DEFAULT_DENSITY,
                    }))
                  }
                  className="font-mono font-bold text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Peso mín (kg)
                </label>
                <Input
                  type="number"
                  step="0.05"
                  min={0.5}
                  value={editForm.minWeightKg}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      minWeightKg: Number(e.target.value) || 2.0,
                    }))
                  }
                  className="font-mono text-xs h-9"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Peso máx (kg)
                </label>
                <Input
                  type="number"
                  step="0.05"
                  min={0.5}
                  value={editForm.maxWeightKg}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      maxWeightKg: Number(e.target.value) || 2.5,
                    }))
                  }
                  className="font-mono text-xs h-9"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                OC / Referencia
              </label>
              <Input
                value={editForm.externalReference}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, externalReference: e.target.value }))
                }
                className="text-xs h-9"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Notas
              </label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditingOrder(null)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSavingEdit}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-violet-600 dark:hover:bg-violet-700 text-white font-extrabold"
            >
              {isSavingEdit ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 3: INGRESAR O GENERAR CÓDIGO ARIS                             */}
      {/* =================================================================== */}
      <Modal
        isOpen={!!arisModalOrder}
        onClose={() => setArisModalOrder(null)}
        title={`Ingresar pedido ARIS — ${arisModalOrder?.order_number || ''}`}
        description={
          arisModalOrder
            ? `${arisModalOrder.client_name} · Placa ${arisModalOrder.transport_plate || 'N/A'}`
            : ''
        }
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Código de Pedido ARIS
            </label>
            <Input
              value={arisInput}
              onChange={(e) => setArisInput(e.target.value.toUpperCase())}
              placeholder="Ej: AR-2026-00015 o código externo ARIS"
              maxLength={20}
              className="font-mono font-bold text-xs h-10"
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Registra el código ARIS emitido o genera uno automático único. Al confirmarlo, Control de Flota podrá registrar llegada a granja.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isSavingAris}
              onClick={() => handleSubmitAris(true)}
              className="text-xs font-bold border-violet-300 text-violet-700 dark:text-violet-300"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Auto-generar código ARIS
            </Button>

            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => setArisModalOrder(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSavingAris || !arisInput.trim()}
                onClick={() => handleSubmitAris(false)}
                className="bg-violet-600 hover:bg-violet-700 text-white font-extrabold"
              >
                {isSavingAris ? 'Guardando...' : 'Guardar ARIS'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

