import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/api';
import {
  clampDensity,
  computeCages,
  DEFAULT_DENSITY,
  DEFAULT_ZONE_DENSITIES,
  deriveEstadoComercial,
  ESTADO_COMERCIAL_META,
  getOrderLines,
  MAX_DENSITY,
  MIN_DENSITY,
  OrderLine,
  OrderUpdatePayload,
  resolveZoneDensity,
  SalesOrder,
  SexPreference,
  ZoneCageDensity,
} from '@/types/comercial';
import { TablaGeneralSaldoItem } from '@/types/pecuaria';

interface EditableLineDraft {
  id: string;
  birdsStr: string;
  cagesStr: string;
  densityStr: string;
  sexPreference: SexPreference;
  minWeightStr: string;
  maxWeightStr: string;
  notes: string;
  lastEdited: 'birds' | 'cages';
}

interface PedidosPanelProps {
  orders: SalesOrder[];
  pecuariaItems: TablaGeneralSaldoItem[];
  onOrdersSynced: () => Promise<void> | void;
  onApproveOrder: (order: SalesOrder) => void;
  onObserveOrder?: (order: SalesOrder) => void;
  onShowToast: (message: string) => void;
}

const formatDateShort = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatCreatedAt = (iso?: string | null): string => {
  if (!iso) return '-';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
};

const toEditableLine = (line?: Partial<OrderLine>, idx = 0): EditableLineDraft => {
  const density = clampDensity(line?.density_birds_per_cage ?? DEFAULT_DENSITY);
  const birds = line?.requested_quantity ? Number(line.requested_quantity) : 0;
  const cages = line?.cages ?? (birds > 0 ? computeCages(birds, density) : 0);
  return {
    id: line?.id || `line-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    birdsStr: birds > 0 ? String(birds) : '',
    cagesStr: cages > 0 ? String(cages) : '',
    densityStr: String(density),
    sexPreference: (line?.sex_preference as SexPreference) || 'MACHO',
    minWeightStr: line?.min_weight_kg ? String(line.min_weight_kg) : '2.8',
    maxWeightStr: line?.max_weight_kg ? String(line.max_weight_kg) : '3.2',
    notes: line?.notes || '',
    lastEdited: 'birds',
  };
};

/**
 * Apartado de Pedidos en Gestión Comercial:
 * muestra los pedidos generados por los vendedores para que el Gestor Comercial
 * los complete (granja, galpón, líneas), los programe (pasando a Programado y a
 * Programación de saca / Control de Flota) o gestione ARIS / cancelaciones.
 */
export const PedidosPanel: React.FC<PedidosPanelProps> = ({
  orders,
  pecuariaItems,
  onOrdersSynced,
  onApproveOrder,
  onObserveOrder,
  onShowToast,
}) => {
  const [zoneDensities, setZoneDensities] = useState<ZoneCageDensity[]>(DEFAULT_ZONE_DENSITIES);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [sellerFilter, setSellerFilter] = useState('ALL');
  const [transportFilter, setTransportFilter] = useState('ALL');
  const [arisFilter, setArisFilter] = useState('ALL');

  // Modal Completar / Editar pedido (multilínea + granja/galpón)
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [formSellerName, setFormSellerName] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formZoneCode, setFormZoneCode] = useState('METROPOLITANA');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formFarmCode, setFormFarmCode] = useState('');
  const [formBarnCode, setFormBarnCode] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formLines, setFormLines] = useState<EditableLineDraft[]>([toEditableLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiClient<ZoneCageDensity[]>('/admin/zone-densities')
      .then((list) => {
        if (active && Array.isArray(list) && list.length > 0) setZoneDensities(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Granjas y galpones operativos disponibles desde Saldos por Galpón
  const operationalItems = useMemo(
    () => pecuariaItems.filter((p) => !p.is_closed && p.barn_status !== 'CERRADO'),
    [pecuariaItems]
  );

  const farmChoices = useMemo(() => {
    const map = new Map<string, string>();
    operationalItems.forEach((p) => {
      if (p.farm_code && !map.has(p.farm_code)) {
        map.set(p.farm_code, p.farm_name || p.farm_code);
      }
    });
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [operationalItems]);

  const barnChoicesForSelectedFarm = useMemo(
    () =>
      operationalItems
        .filter((p) => p.farm_code === formFarmCode)
        .sort((a, b) => (a.barn_code || '').localeCompare(b.barn_code || '')),
    [operationalItems, formFarmCode]
  );

  // El gestor comercial solo ve pedidos enviados por vendedores (excluye borradores)
  const submittedOrders = useMemo(
    () => orders.filter((o) => o.status !== 'BORRADOR'),
    [orders]
  );

  const filterOptions = useMemo(() => {
    const clientNames = new Set<string>();
    const zones = new Set<string>();
    const sellers = new Set<string>();
    submittedOrders.forEach((o) => {
      if (o.client_name) clientNames.add(o.client_name);
      if (o.zone_code) zones.add(o.zone_code);
      const sellerLabel = (o.seller_full_name || o.seller_username || '').trim();
      if (sellerLabel) sellers.add(sellerLabel);
    });
    return {
      clients: Array.from(clientNames).sort((a, b) => a.localeCompare(b)),
      zones: Array.from(zones).sort((a, b) => a.localeCompare(b)),
      sellers: Array.from(sellers).sort((a, b) => a.localeCompare(b)),
    };
  }, [submittedOrders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return submittedOrders.filter((order) => {
      const sellerLabel = (order.seller_full_name || order.seller_username || '').trim();
      const orderDate = (order.target_delivery_date || '').slice(0, 10);

      if (q) {
        const match =
          (order.client_name || '').toLowerCase().includes(q) ||
          (order.order_number || '').toLowerCase().includes(q) ||
          (order.codigo_aris || '').toLowerCase().includes(q) ||
          (order.transport_plate || '').toLowerCase().includes(q) ||
          (order.assigned_farm_code || order.suggested_farm_code || '').toLowerCase().includes(q) ||
          sellerLabel.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (dateFrom && orderDate < dateFrom) return false;
      if (dateTo && orderDate > dateTo) return false;
      if (clientFilter !== 'ALL' && order.client_name !== clientFilter) return false;
      if (zoneFilter !== 'ALL' && order.zone_code !== zoneFilter) return false;
      if (sellerFilter !== 'ALL' && sellerLabel !== sellerFilter) return false;
      if (transportFilter === 'WITH' && !order.transport_assigned) return false;
      if (transportFilter === 'WITHOUT' && order.transport_assigned) return false;
      if (arisFilter === 'WITH' && !order.codigo_aris) return false;
      if (arisFilter === 'WITHOUT' && order.codigo_aris) return false;

      if (statusFilter !== 'ALL') {
        if (statusFilter === 'CON_OBSERVACION') {
          if (order.status !== 'CON_OBSERVACION') return false;
        } else if (deriveEstadoComercial(order) !== statusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [
    submittedOrders,
    searchQuery,
    dateFrom,
    dateTo,
    clientFilter,
    statusFilter,
    zoneFilter,
    sellerFilter,
    transportFilter,
    arisFilter,
  ]);

  const activeCount = useMemo(
    () => filteredOrders.filter((o) => o.status !== 'CANCELADO').length,
    [filteredOrders]
  );

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setClientFilter('ALL');
    setStatusFilter('ALL');
    setZoneFilter('ALL');
    setSellerFilter('ALL');
    setTransportFilter('ALL');
    setArisFilter('ALL');
  };

  const openCompleteOrEditModal = (order: SalesOrder, initialError: string | null = null) => {
    setEditingOrder(order);
    setFormSellerName((order.seller_full_name || order.seller_username || 'Sin vendedor').trim());
    setFormClientName(order.client_name || '');
    setFormZoneCode(order.zone_code || 'METROPOLITANA');
    setFormTargetDate((order.target_delivery_date || '').slice(0, 10));
    const initialFarm =
      order.assigned_farm_code || order.suggested_farm_code || farmChoices[0]?.code || '';
    const matchingBarn = operationalItems.find(
      (p) =>
        p.farm_code === initialFarm &&
        p.barn_code === (order.assigned_barn_code || order.suggested_barn_code)
    );
    const fallbackBarn = operationalItems.find((p) => p.farm_code === initialFarm);
    setFormFarmCode(initialFarm);
    setFormBarnCode(
      order.assigned_barn_code ||
        order.suggested_barn_code ||
        matchingBarn?.barn_code ||
        fallbackBarn?.barn_code ||
        ''
    );
    setFormNotes(order.notes || '');
    setFormLines(getOrderLines(order).map((l, i) => toEditableLine(l, i)));
    setFormError(initialError);
  };

  const handleFarmSelectionChange = (nextFarm: string) => {
    setFormFarmCode(nextFarm);
    const firstBarn = operationalItems.find((p) => p.farm_code === nextFarm);
    setFormBarnCode(firstBarn?.barn_code || '');
  };

  const updateLine = (
    idx: number,
    field: 'birdsStr' | 'cagesStr' | 'densityStr' | 'sexPreference' | 'minWeightStr' | 'maxWeightStr' | 'notes',
    value: string
  ) => {
    setFormLines((prev) =>
      prev.map((line, i) => {
        if (i !== idx) return line;
        const next: EditableLineDraft = { ...line, [field]: value } as EditableLineDraft;
        const densityNum = Math.max(
          MIN_DENSITY,
          Math.min(MAX_DENSITY, parseInt(field === 'densityStr' ? value : next.densityStr, 10) || DEFAULT_DENSITY)
        );

        if (field === 'birdsStr') {
          next.lastEdited = 'birds';
          const birds = parseInt(value, 10) || 0;
          next.cagesStr = birds > 0 ? String(Math.ceil(birds / densityNum)) : '';
        } else if (field === 'cagesStr') {
          next.lastEdited = 'cages';
          const cages = parseInt(value, 10) || 0;
          next.birdsStr = cages > 0 ? String(cages * densityNum) : '';
        } else if (field === 'densityStr') {
          if (line.lastEdited === 'cages') {
            const cages = parseInt(next.cagesStr, 10) || 0;
            next.birdsStr = cages > 0 ? String(cages * densityNum) : '';
          } else {
            const birds = parseInt(next.birdsStr, 10) || 0;
            next.cagesStr = birds > 0 ? String(Math.ceil(birds / densityNum)) : '';
          }
        }
        return next;
      })
    );
  };

  const addLine = () => {
    const defaultDensity = resolveZoneDensity(zoneDensities, formZoneCode, 'MACHO');
    setFormLines((prev) => [
      ...prev,
      toEditableLine(
        {
          density_birds_per_cage: defaultDensity,
          sex_preference: 'MACHO',
          min_weight_kg: 2.8,
          max_weight_kg: 3.2,
        },
        prev.length
      ),
    ]);
  };

  const removeLine = (idx: number) => {
    setFormLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const modalTotals = useMemo(() => {
    return formLines.reduce(
      (acc, l) => {
        const birds = parseInt(l.birdsStr, 10) || 0;
        const density = clampDensity(parseInt(l.densityStr, 10) || DEFAULT_DENSITY);
        const cages = birds > 0 ? computeCages(birds, density) : parseInt(l.cagesStr, 10) || 0;
        return { birds: acc.birds + birds, cages: acc.cages + cages };
      },
      { birds: 0, cages: 0 }
    );
  }, [formLines]);

  const submitModal = async (andProgram: boolean) => {
    if (!editingOrder) return;
    setFormError(null);

    if (!formTargetDate) {
      setFormError('Indica la fecha solicitada de atención.');
      return;
    }

    if ((andProgram || editingOrder.status === 'REGISTRADO' || editingOrder.status === 'CON_OBSERVACION') && (!formFarmCode || !formBarnCode)) {
      setFormError('Selecciona la granja y el galpón para completar el pedido.');
      return;
    }

    const builtLines: OrderLine[] = [];
    for (let i = 0; i < formLines.length; i++) {
      const l = formLines[i];
      const birds = parseInt(l.birdsStr, 10) || 0;
      const density = clampDensity(parseInt(l.densityStr, 10) || DEFAULT_DENSITY);
      const minW = parseFloat(l.minWeightStr) || 0;
      const maxW = parseFloat(l.maxWeightStr) || 0;
      if (birds <= 0) {
        setFormError(`Línea ${i + 1}: ingresa una cantidad de pollos válida mayor a 0.`);
        return;
      }
      if (minW <= 0 || maxW < minW) {
        setFormError(`Línea ${i + 1}: verifica el rango de peso mínimo y máximo.`);
        return;
      }
      builtLines.push({
        id: l.id,
        requested_quantity: birds,
        cages: computeCages(birds, density),
        density_birds_per_cage: density,
        sex_preference: l.sexPreference,
        min_weight_kg: minW,
        max_weight_kg: maxW,
        notes: l.notes.trim() || undefined,
      });
    }

    setSavingOrder(true);
    try {
      const updatePayload: OrderUpdatePayload = {
        target_delivery_date: formTargetDate,
        farm_code: formFarmCode || undefined,
        barn_code: formBarnCode || undefined,
        notes: formNotes.trim() || undefined,
        order_lines: builtLines,
      };
      await apiClient(`/comercial/orders/${editingOrder.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updatePayload),
      });

      if (andProgram) {
        const primaryDensity = builtLines[0]?.density_birds_per_cage || DEFAULT_DENSITY;
        await apiClient<SalesOrder>(`/comercial/orders/${editingOrder.id}/dar-ok`, {
          method: 'POST',
          body: JSON.stringify({
            farm_code: formFarmCode,
            barn_code: formBarnCode,
            allocated_quantity: modalTotals.birds,
            density_birds_per_cage: primaryDensity,
            observation: `Pedido completado y programado en ${formFarmCode} - ${formBarnCode} (${modalTotals.birds.toLocaleString()} aves).`,
          }),
        });
        onShowToast(
          `Pedido ${editingOrder.order_number} completado y programado (${formFarmCode} · ${formBarnCode}). Ya está en Programación de saca y Control de Flota.`
        );
      } else {
        onShowToast(
          `Datos del pedido ${editingOrder.order_number} guardados (${formFarmCode} · ${formBarnCode}).`
        );
      }

      setEditingOrder(null);
      await onOrdersSynced();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo procesar el pedido.');
    } finally {
      setSavingOrder(false);
    }
  };

  /** Programa un pedido en Preprogramado que ya tiene granja y galpón completados. */
  const handleProgramOrder = async (order: SalesOrder) => {
    const farmCode = order.suggested_farm_code;
    const barnCode = order.suggested_barn_code;
    if (!farmCode || !barnCode) {
      openCompleteOrEditModal(
        order,
        'Completa primero la granja y el galpón antes de programar este pedido.'
      );
      return;
    }

    setBusyOrderId(order.id);
    try {
      await apiClient<SalesOrder>(`/comercial/orders/${order.id}/dar-ok`, {
        method: 'POST',
        body: JSON.stringify({
          farm_code: farmCode,
          barn_code: barnCode,
          allocated_quantity: order.requested_quantity,
          density_birds_per_cage: order.density_birds_per_cage || DEFAULT_DENSITY,
          observation: `Programado desde Pedidos en ${farmCode} - ${barnCode} (${order.requested_quantity.toLocaleString()} aves).`,
        }),
      });
      onShowToast(
        `Pedido ${order.order_number} programado en ${farmCode} · ${barnCode}. Ya pasó a Programación de saca.`
      );
      await onOrdersSynced();
    } catch (err) {
      // Si el saldo es insuficiente o requiere fraccionamiento, abrimos el modal de aprobación completo
      onShowToast(
        err instanceof Error
          ? `${err.message} Revisa el detalle en el modal de programación.`
          : 'Abre el modal de programación para ajustar la reserva.'
      );
      onApproveOrder(order);
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleGenerateAris = async (order: SalesOrder) => {
    setBusyOrderId(order.id);
    try {
      const updated = await apiClient<SalesOrder>(
        `/comercial/orders/${order.id}/generar-codigo-aris`,
        { method: 'POST' }
      );
      onShowToast(
        `Código ARIS ${updated.codigo_aris || ''} asignado al pedido ${order.order_number}.`
      );
      await onOrdersSynced();
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Error al generar el código ARIS.');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleCancelOrder = async (order: SalesOrder) => {
    const ok = window.confirm(
      `¿Seguro que deseas cancelar el pedido ${order.order_number} de ${order.client_name}?`
    );
    if (!ok) return;
    setBusyOrderId(order.id);
    try {
      await apiClient(`/comercial/orders/${order.id}/cancel`, { method: 'POST' });
      onShowToast(`Pedido ${order.order_number} cancelado.`);
      await onOrdersSynced();
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'No se pudo cancelar el pedido.');
    } finally {
      setBusyOrderId(null);
    }
  };

  const isEditingPreprogramado =
    editingOrder !== null &&
    (editingOrder.status === 'REGISTRADO' || editingOrder.status === 'CON_OBSERVACION');

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Pedidos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Bandeja de pedidos generados por vendedores: completa granja y galpón y prográmalos para pasarlos a Programación de saca.
          </p>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-10 gap-2.5 items-end">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Buscar
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cliente, ARIS, granja o placa..."
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Atención desde
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Hasta
            </label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Cliente
            </label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full h-9 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">Todos</option>
              {filterOptions.clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Estado
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">Todos</option>
              <option value="PREPROGRAMACION">Preprogramado</option>
              <option value="PROGRAMADO">Programado</option>
              <option value="PROGRAMADO_CON_CAMION">Programado con camión</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="DESPACHADO">Despachado</option>
              <option value="TERMINADO">Terminado</option>
              <option value="CANCELADO">Cancelado</option>
              <option value="CON_OBSERVACION">Con observación</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Zona
            </label>
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="w-full h-9 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">Todos</option>
              {filterOptions.zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Vendedor
            </label>
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              className="w-full h-9 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">Todos</option>
              {filterOptions.sellers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Transporte
            </label>
            <select
              value={transportFilter}
              onChange={(e) => setTransportFilter(e.target.value)}
              className="w-full h-9 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">Todos</option>
              <option value="WITH">Con camión</option>
              <option value="WITHOUT">Sin camión</option>
            </select>
          </div>

          <div className="flex items-end gap-1.5">
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                ARIS
              </label>
              <select
                value={arisFilter}
                onChange={(e) => setArisFilter(e.target.value)}
                className="w-full h-9 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
              >
                <option value="ALL">Todos</option>
                <option value="WITH">Con ARIS</option>
                <option value="WITHOUT">Sin ARIS</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-9 px-2 text-xs font-semibold text-slate-500 hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-400 shrink-0"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla principal */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'}
          </span>
          <span className="font-semibold">
            {activeCount} {activeCount === 1 ? 'activo' : 'activos'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Cliente / zona</th>
                <th className="py-3 px-3.5">Fecha solicitada</th>
                <th className="py-3 px-3.5">Detalle solicitado</th>
                <th className="py-3 px-3.5">Granja / galpón</th>
                <th className="py-3 px-3.5">Estado / ARIS</th>
                <th className="py-3 px-3.5">Camión / placa</th>
                <th className="py-3 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    No hay pedidos de vendedores que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const lines = getOrderLines(order);
                  const eco = deriveEstadoComercial(order);
                  const meta = ESTADO_COMERCIAL_META[eco];
                  const isObs = order.status === 'CON_OBSERVACION';
                  const isCanceled = order.status === 'CANCELADO';
                  const isFinished = eco === 'TERMINADO';
                  const isDispatched = eco === 'DESPACHADO';
                  const isPreprogramado = eco === 'PREPROGRAMACION' || isObs;

                  const farmCode = order.assigned_farm_code || order.suggested_farm_code;
                  const barnCode = order.assigned_barn_code || order.suggested_barn_code;
                  const hasFarmAndBarn = Boolean(farmCode && barnCode);

                  const canEdit = !isCanceled && !isFinished;
                  const canCancel = !isCanceled && !isFinished && !isDispatched;
                  const canAris =
                    !isCanceled &&
                    !isFinished &&
                    Boolean(order.transport_assigned) &&
                    !order.codigo_aris;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Cliente / zona */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{order.client_name}</span>
                          <span className="text-[10px] font-mono text-slate-400 font-normal">
                            {order.order_number}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                          Zona {order.zone_code}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {order.seller_full_name || order.seller_username || 'Sin vendedor'}
                        </div>
                        <div className="text-[10.5px] text-slate-400 mt-0.5">
                          Fecha de creación: {formatCreatedAt(order.created_at)}
                        </div>
                      </td>

                      {/* Fecha solicitada */}
                      <td className="py-3.5 px-3.5 align-top whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
                        {formatDateShort(order.target_delivery_date)}
                      </td>

                      {/* Detalle solicitado */}
                      <td className="py-3.5 px-3.5 align-top">
                        <div className="space-y-1">
                          {lines.map((line, idx) => {
                            const cages =
                              line.cages ??
                              computeCages(line.requested_quantity, line.density_birds_per_cage);
                            return (
                              <div
                                key={line.id || idx}
                                className="text-[11.5px] text-slate-700 dark:text-slate-200"
                              >
                                {lines.length > 1 && (
                                  <span className="font-bold text-slate-500 mr-1">
                                    L{idx + 1}:
                                  </span>
                                )}
                                <span className="font-semibold">
                                  {line.requested_quantity.toLocaleString()} {line.sex_preference}
                                </span>{' '}
                                &middot; {Number(line.min_weight_kg).toFixed(1)}–
                                {Number(line.max_weight_kg).toFixed(1)} kg &middot;{' '}
                                {line.density_birds_per_cage}/jaba &middot; {cages} jabas
                                {line.notes && (
                                  <span className="text-[10.5px] text-slate-400 ml-1">
                                    ({line.notes})
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {lines.length > 1 && (
                            <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 pt-0.5">
                              Total: {order.requested_quantity.toLocaleString()} pollos &middot;{' '}
                              {order.estimated_cages ??
                                lines.reduce(
                                  (acc, l) =>
                                    acc +
                                    (l.cages ??
                                      computeCages(l.requested_quantity, l.density_birds_per_cage)),
                                  0
                                )}{' '}
                              jabas
                            </div>
                          )}
                          {order.notes && (
                            <div className="text-[10.5px] text-slate-400 italic">
                              Obs: {order.notes}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Granja / galpón */}
                      <td className="py-3.5 px-3.5 align-top whitespace-nowrap">
                        {hasFarmAndBarn ? (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {farmCode} &middot; {barnCode}
                            </div>
                            <div className="text-[10.5px] text-emerald-700 dark:text-emerald-400 font-semibold">
                              {order.assigned_farm_code ? 'Reservado' : 'Listo para programar'}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10.5px] font-semibold">
                            Pendiente de completar
                          </span>
                        )}
                      </td>

                      {/* Estado / ARIS */}
                      <td className="py-3.5 px-3.5 align-top whitespace-nowrap">
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
                      </td>

                      {/* Camión / placa */}
                      <td className="py-3.5 px-3.5 align-top whitespace-nowrap">
                        {order.transport_assigned && order.transport_plate ? (
                          <div className="text-slate-800 dark:text-slate-200">
                            <span className="font-bold font-mono">{order.transport_plate}</span>{' '}
                            <span className="text-slate-500">
                              &middot;{' '}
                              {(
                                order.allocated_quantity || order.requested_quantity
                              ).toLocaleString()}{' '}
                              aves
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Sin camión asignado</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!isCanceled && isPreprogramado && canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyOrderId === order.id}
                              onClick={() => openCompleteOrEditModal(order)}
                              className="h-7 px-2.5 text-[11px] font-bold bg-white dark:bg-slate-800 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300"
                            >
                              Completar pedido
                            </Button>
                          )}
                          {!isCanceled && isPreprogramado && hasFarmAndBarn && (
                            <Button
                              size="sm"
                              disabled={busyOrderId === order.id}
                              onClick={() => handleProgramOrder(order)}
                              className="h-7 px-2.5 text-[11px] font-bold bg-violet-600 hover:bg-violet-700 text-white"
                            >
                              {busyOrderId === order.id ? 'Programando...' : 'Programar'}
                            </Button>
                          )}
                          {!isPreprogramado && canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyOrderId === order.id}
                              onClick={() => openCompleteOrEditModal(order)}
                              className="h-7 px-2.5 text-[11px] font-bold bg-white dark:bg-slate-800"
                            >
                              Editar
                            </Button>
                          )}
                          {!isCanceled && isPreprogramado && onObserveOrder && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyOrderId === order.id}
                              onClick={() => onObserveOrder(order)}
                              className="h-7 px-2.5 text-[11px] font-bold bg-white dark:bg-slate-800"
                            >
                              Observar
                            </Button>
                          )}
                          {canAris && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyOrderId === order.id}
                              onClick={() => handleGenerateAris(order)}
                              className="h-7 px-2.5 text-[11px] font-bold bg-white dark:bg-slate-800"
                            >
                              {busyOrderId === order.id ? 'Generando...' : 'Ingresar pedido ARIS'}
                            </Button>
                          )}
                          {canCancel && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyOrderId === order.id}
                              onClick={() => handleCancelOrder(order)}
                              className="h-7 px-2.5 text-[11px] font-bold bg-white dark:bg-slate-800"
                            >
                              Cancelar pedido
                            </Button>
                          )}
                          {!canEdit && !canCancel && !canAris && (
                            <span className="text-slate-400">—</span>
                          )}
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

      {/* Modal: Completar / Editar pedido (multilínea + granja/galpón) */}
      <Modal
        isOpen={!!editingOrder}
        onClose={() => !savingOrder && setEditingOrder(null)}
        title={isEditingPreprogramado ? 'Completar pedido' : 'Editar pedido'}
        description="COMERCIAL · PEDIDOS — Asigna granja, galpón y revisa las líneas antes de programar."
        maxWidth="2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitModal(false);
          }}
          className="space-y-5"
        >
          <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-3">
            <span>
              <strong>Fecha de creación:</strong>{' '}
              {formatCreatedAt(editingOrder?.created_at)}
            </span>
            {editingOrder && (
              <span className="font-mono text-slate-400">({editingOrder.order_number})</span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
              Zona {formZoneCode}
            </span>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          {/* Cabecera del pedido + Granja / Galpón */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Vendedor
              </label>
              <Input
                value={formSellerName}
                readOnly
                className="h-10 text-xs bg-slate-50 dark:bg-slate-800/60"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cliente
              </label>
              <Input
                value={formClientName}
                readOnly
                className="h-10 text-xs bg-slate-50 dark:bg-slate-800/60"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Fecha solicitada
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <Input
                  type="date"
                  value={formTargetDate}
                  onChange={(e) => setFormTargetDate(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Granja asignada
              </label>
              <select
                value={formFarmCode}
                onChange={(e) => handleFarmSelectionChange(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
              >
                <option value="">Selecciona granja...</option>
                {farmChoices.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.code} — {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Galpón asignado
              </label>
              <select
                value={formBarnCode}
                onChange={(e) => setFormBarnCode(e.target.value)}
                disabled={!formFarmCode}
                className="w-full h-10 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-60"
              >
                <option value="">Selecciona galpón...</option>
                {barnChoicesForSelectedFarm.map((b) => (
                  <option key={b.barn_id} value={b.barn_code}>
                    {b.barn_code} ({(b.barn_balance_available || 0).toLocaleString()} aves disp.)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Observaciones
              </label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Observaciones generales del pedido..."
                className="h-10 text-xs"
              />
            </div>
          </div>

          {/* Líneas del pedido */}
          <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1">
            {formLines.map((line, idx) => (
              <div
                key={line.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-4 space-y-3"
              >
                <div>
                  <div className="text-xs font-black text-slate-900 dark:text-white">
                    Línea {idx + 1}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ingresa pollos o jabas y la densidad. El último campo de cantidad editado determina el cálculo; las jabas se redondean hacia arriba.
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nro. de pollos
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={line.birdsStr}
                      onChange={(e) => updateLine(idx, 'birdsStr', e.target.value)}
                      placeholder="300"
                      className="h-9 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nro. de jabas
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={line.cagesStr}
                      onChange={(e) => updateLine(idx, 'cagesStr', e.target.value)}
                      placeholder="38"
                      className="h-9 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Densidad (pollos/jaba)
                    </label>
                    <Input
                      type="number"
                      min={MIN_DENSITY}
                      max={MAX_DENSITY}
                      value={line.densityStr}
                      onChange={(e) => updateLine(idx, 'densityStr', e.target.value)}
                      placeholder="8"
                      className="h-9 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Sexo
                    </label>
                    <select
                      value={line.sexPreference}
                      onChange={(e) => updateLine(idx, 'sexPreference', e.target.value)}
                      className="w-full h-9 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
                    >
                      <option value="MACHO">MACHO</option>
                      <option value="HEMBRA">HEMBRA</option>
                      <option value="MIXTO">MIXTO</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Peso mínimo (kg)
                    </label>
                    <Input
                      type="number"
                      step="0.05"
                      min="0.5"
                      value={line.minWeightStr}
                      onChange={(e) => updateLine(idx, 'minWeightStr', e.target.value)}
                      placeholder="2.8"
                      className="h-9 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Peso máximo (kg)
                    </label>
                    <Input
                      type="number"
                      step="0.05"
                      min="0.5"
                      value={line.maxWeightStr}
                      onChange={(e) => updateLine(idx, 'maxWeightStr', e.target.value)}
                      placeholder="3.2"
                      className="h-9 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Observaciones de la línea
                    </label>
                    <Input
                      value={line.notes}
                      onChange={(e) => updateLine(idx, 'notes', e.target.value)}
                      placeholder="Opcional..."
                      className="h-9 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={formLines.length <= 1}
                    onClick={() => removeLine(idx)}
                    className="h-8 px-3 text-xs font-bold bg-white dark:bg-slate-900"
                  >
                    Quitar línea
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer del modal */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addLine}
                className="text-xs font-bold"
              >
                Agregar línea
              </Button>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                Total: {modalTotals.birds.toLocaleString()} pollos &middot; {modalTotals.cages} jabas
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="submit"
                variant={isEditingPreprogramado ? 'outline' : 'primary'}
                disabled={savingOrder}
                className={
                  isEditingPreprogramado
                    ? 'text-xs font-bold'
                    : 'bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-5'
                }
              >
                {savingOrder ? 'Guardando...' : isEditingPreprogramado ? 'Guardar datos' : 'Guardar pedido'}
              </Button>
              {isEditingPreprogramado && (
                <Button
                  type="button"
                  disabled={savingOrder}
                  onClick={() => submitModal(true)}
                  className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-5"
                >
                  {savingOrder ? 'Procesando...' : 'Completar y Programar'}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={savingOrder}
                onClick={() => setEditingOrder(null)}
                className="text-xs font-bold"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
