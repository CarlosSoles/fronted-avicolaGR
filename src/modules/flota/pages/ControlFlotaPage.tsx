import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  UserCheck,
  MapPin,
  Info,
  Undo2,
  Phone,
  MessageSquare,
  Scissors,
  Link2,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  Search,
  PackageCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ModuleTabs } from '@/components/ui/ModuleTabs';
import { OrderDateFilter } from '@/components/ui/OrderDateFilter';
import { KpiCard } from '@/components/ui/KpiCard';
import {
  DateFilterValue,
  DEFAULT_DATE_FILTER,
  resolveRange,
  orderDateKey,
  matchesRange,
} from '@/lib/dateFilters';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { apiClient } from '@/lib/api';
import {
  SalesOrder,
  OrderStatus,
  TransportVehicle,
  TransportVehicleCreatePayload,
  TransportVehicleUpdatePayload,
  AssignTransportPayload,
  DispatchPhase,
  ESTADO_COMERCIAL_META,
  computeCages,
  deriveEstadoComercial,
} from '@/types/comercial';
import { LazyFlotaGpsMap as FlotaGpsMap } from '@/modules/gerencia/components/gps/LazyFlotaGpsMap';
import { gpsSimulationStore } from '@/modules/gerencia/components/gps/gpsSimulationStore';
import { getFarmOriginCoordinate } from '@/modules/gerencia/components/gps/gpsRoutesData';

const FLOTA_ORDERS_CACHE_KEY = 'avicola_flota_orders';
const FLOTA_VEHICLES_CACHE_KEY = 'avicola_flota_vehicles';

function readCachedJson<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
import { DispatchLifecycleStepper } from '@/modules/gerencia/components/dispatch/DispatchLifecycleStepper';
import { WhatsAppManifestModal } from '@/modules/gerencia/components/dispatch/WhatsAppManifestModal';
import { ConsolidationCubicajeBar } from '@/modules/gerencia/components/dispatch/ConsolidationCubicajeBar';

const ALL_ZONES = ['NORTE', 'CENTRO', 'SUR', 'METROPOLITANA'] as const;

const PHASE_ORDER: DispatchPhase[] = [
  'TRANSPORTE_ASIGNADO',
  'EN_GRANJA_CARGANDO',
  'EN_TRANSITO',
  'ENTREGADO_CONFORME',
];

const PHASE_LABELS: Record<DispatchPhase, string> = {
  TRANSPORTE_ASIGNADO: 'Transporte asignado',
  EN_GRANJA_CARGANDO: 'Cargando en granja',
  EN_TRANSITO: 'En tránsito',
  ENTREGADO_CONFORME: 'Entregado',
};

const formatDateDisplay = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

interface VehicleFormState {
  plate: string;
  model: string;
  capacity_cages: string;
  capacity_birds: string;
  birdsTouched: boolean;
  driver_name: string;
  driver_phone: string;
  default_crew: string;
  zone_coverage: string[];
  status: 'DISPONIBLE' | 'ASIGNADO' | 'EN_MANTENIMIENTO';
}

const createEmptyVehicleForm = (): VehicleFormState => ({
  plate: '',
  model: '',
  capacity_cages: '450',
  capacity_birds: '3600',
  birdsTouched: false,
  driver_name: '',
  driver_phone: '',
  default_crew: '',
  zone_coverage: ['NORTE', 'CENTRO', 'SUR', 'METROPOLITANA'],
  status: 'DISPONIBLE',
});

export const ControlFlotaPage: React.FC = () => {
  const { user } = useAuth();

  const initialCachedOrders = useMemo(() => readCachedJson<SalesOrder>(FLOTA_ORDERS_CACHE_KEY), []);
  const initialCachedVehicles = useMemo(() => readCachedJson<TransportVehicle>(FLOTA_VEHICLES_CACHE_KEY), []);

  const [activeTab, setActiveTab] = useState<'despacho' | 'flota'>('despacho');
  const [orders, setOrders] = useState<SalesOrder[]>(() => initialCachedOrders ?? []);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>(() => initialCachedVehicles ?? []);
  const [loading, setLoading] = useState<boolean>(
    () => initialCachedOrders === null && initialCachedVehicles === null
  );
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const ordersRef = useRef<SalesOrder[]>(orders);
  ordersRef.current = orders;
  const lastFetchAtRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);

  // Filtros de Asignación de Transporte
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(DEFAULT_DATE_FILTER);
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modales auxiliares
  const [whatsappModalOrder, setWhatsappModalOrder] = useState<SalesOrder | null>(null);
  const [gpsModalOrder, setGpsModalOrder] = useState<SalesOrder | null>(null);

  // Modal de Designación de Transporte a Pedido
  const [transportingOrder, setTransportingOrder] = useState<SalesOrder | null>(null);
  const [transportVehicleId, setTransportVehicleId] = useState<string>('');
  const [transportShift, setTransportShift] = useState<string>('MADRUGADA');
  const [transportLoadingSlot, setTransportLoadingSlot] = useState<string>('03:00 - 05:00 hrs');
  const [transportDriverName, setTransportDriverName] = useState<string>('');
  const [transportDriverPhone, setTransportDriverPhone] = useState<string>('');
  const [transportCrewName, setTransportCrewName] = useState<string>('');
  const [transportNotes, setTransportNotes] = useState<string>('');
  const [isSubmittingTransport, setIsSubmittingTransport] = useState<boolean>(false);

  // Modal de Registro / Edición de Vehículo en Flota
  const [vehicleModalOpen, setVehicleModalOpen] = useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = useState<TransportVehicle | null>(null);
  const [vehicleForm, setVehicleForm] = useState<VehicleFormState>(createEmptyVehicleForm);
  const [isSavingVehicle, setIsSavingVehicle] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const fetchData = useCallback(async (silent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!silent) setRefreshing(true);
    try {
      const [ordersRes, vehiclesRes, farmsRes] = await Promise.allSettled([
        apiClient<SalesOrder[]>('/comercial/orders?statuses=APROBADO_RESERVADO,DESPACHADO'),
        apiClient<TransportVehicle[]>('/comercial/transport/vehicles'),
        apiClient<Array<{ code: string; latitude?: number | null; longitude?: number | null }>>('/admin/farms'),
      ]);

      if (farmsRes.status === 'fulfilled' && Array.isArray(farmsRes.value)) {
        gpsSimulationStore.setFarmCoordinates(farmsRes.value);
      }

      if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value)) {
        setOrders(ordersRes.value);
        try {
          localStorage.setItem(FLOTA_ORDERS_CACHE_KEY, JSON.stringify(ordersRes.value));
        } catch {}
      } else if (!silent) {
        const cached = readCachedJson<SalesOrder>(FLOTA_ORDERS_CACHE_KEY);
        if (cached) setOrders(cached);
      }

      if (vehiclesRes.status === 'fulfilled' && Array.isArray(vehiclesRes.value)) {
        setVehicles(vehiclesRes.value);
        try {
          localStorage.setItem(FLOTA_VEHICLES_CACHE_KEY, JSON.stringify(vehiclesRes.value));
        } catch {}
      }

      lastFetchAtRef.current = Date.now();
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sondeo ligero en segundo plano (cada 45s) para sincronizar con Gestión Comercial
  useEffect(() => {
    const interval = setInterval(() => {
      if (!transportingOrder && !vehicleModalOpen) {
        fetchData(true);
      }
    }, 45000);
    const onFocus = () => {
      if (Date.now() - lastFetchAtRef.current > 15000) {
        fetchData(true);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchData, transportingOrder, vehicleModalOpen]);

  useEffect(() => {
    gpsSimulationStore.syncOrders(orders);
  }, [orders]);

  // Sincronización telemática automática: Ciclo de vida del despacho con la marcha GPS
  useEffect(() => {
    const unsub = gpsSimulationStore.subscribe(() => {
      const trucks = gpsSimulationStore.getTrucks();
      const pendingUpdates: Array<{ id: string; dispatch_phase: DispatchPhase }> = [];
      let hasChanges = false;
      const nowIso = new Date().toISOString();

      const nextOrders = ordersRef.current.map((order) => {
        if (!order.transport_assigned) return order;

        const matchedTruck = trucks.find(
          (t) =>
            t.id === order.transport_truck_id ||
            (order.transport_plate && t.plate.toLowerCase() === order.transport_plate.toLowerCase())
        );

        if (!matchedTruck) return order;

        let targetPhase: DispatchPhase = order.dispatch_phase || 'TRANSPORTE_ASIGNADO';
        if (matchedTruck.progressPercent >= 100) {
          targetPhase = 'ENTREGADO_CONFORME';
        } else if (matchedTruck.progressPercent > 0) {
          targetPhase = 'EN_TRANSITO';
        } else if (matchedTruck.isPlaying) {
          targetPhase = 'EN_GRANJA_CARGANDO';
        }

        if (order.dispatch_phase !== targetPhase) {
          hasChanges = true;
          pendingUpdates.push({ id: order.id, dispatch_phase: targetPhase });

          const newStatus: OrderStatus =
            targetPhase === 'ENTREGADO_CONFORME'
              ? 'DESPACHADO'
              : order.status === 'DESPACHADO'
              ? 'APROBADO_RESERVADO'
              : order.status;

          return {
            ...order,
            dispatch_phase: targetPhase,
            dispatch_phase_updated_at: nowIso,
            status: newStatus,
            updated_at: nowIso,
          };
        }

        return order;
      });

      if (hasChanges) {
        setOrders(nextOrders);
        pendingUpdates.forEach(({ id, dispatch_phase }) => {
          apiClient<SalesOrder>(`/comercial/orders/${id}/dispatch-phase`, {
            method: 'PATCH',
            body: JSON.stringify({ dispatch_phase }),
          }).catch(() => {});
        });
      }
    });

    return () => unsub();
  }, []);

  const dateRange = useMemo(() => resolveRange(dateFilter), [dateFilter]);

  const dispatchOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders
      .filter((o) => o.status === 'APROBADO_RESERVADO' || o.status === 'DESPACHADO')
      .filter((o) => matchesRange(orderDateKey(o, dateFilter.criterion), dateRange))
      .filter((o) => (selectedZone === 'ALL' ? true : o.zone_code === selectedZone))
      .filter((o) => {
        if (!q) return true;
        return (
          o.order_number.toLowerCase().includes(q) ||
          o.client_name.toLowerCase().includes(q) ||
          (o.assigned_farm_code || '').toLowerCase().includes(q) ||
          (o.transport_plate || '').toLowerCase().includes(q) ||
          (o.transport_driver_name || '').toLowerCase().includes(q)
        );
      });
  }, [orders, dateFilter.criterion, dateRange, selectedZone, searchQuery]);

  const metrics = useMemo(() => {
    const approvedOrDispatched = orders.filter(
      (o) => o.status === 'APROBADO_RESERVADO' || o.status === 'DESPACHADO'
    );
    const pendingTransport = approvedOrDispatched.filter(
      (o) => o.status === 'APROBADO_RESERVADO' && !o.transport_assigned
    ).length;
    const assigned = approvedOrDispatched.filter((o) => o.transport_assigned).length;
    const inTransit = approvedOrDispatched.filter(
      (o) => o.dispatch_phase === 'EN_TRANSITO' || o.dispatch_phase === 'EN_GRANJA_CARGANDO'
    ).length;
    const delivered = approvedOrDispatched.filter(
      (o) => o.dispatch_phase === 'ENTREGADO_CONFORME'
    ).length;
    const availableVehicles = vehicles.filter((v) => v.status === 'DISPONIBLE').length;
    return {
      pendingTransport,
      assigned,
      inTransit,
      delivered,
      totalVehicles: vehicles.length,
      availableVehicles,
    };
  }, [orders, vehicles]);

  // ===========================================================================
  // CICLO DE VIDA DEL DESPACHO (3 ACCIONES DEL CONTROLADOR DE FLOTA)
  // ===========================================================================

  const syncOrderUpdate = (updated: SalesOrder) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === updated.id ? updated : o));
      gpsSimulationStore.syncOrders(next);
      return next;
    });
  };

  /** Confirmar que el camión llegó a la granja → EN_GRANJA_CARGANDO (Confirmado) */
  const handleConfirmarLlegadaGranja = async (order: SalesOrder) => {
    if (!window.confirm(`¿Confirmar que el camión ${order.transport_plate} llegó a ${order.assigned_farm_code}?\n\nEsto actualiza el GPS en el origen de granja y marca el pedido como Confirmado.`)) {
      return;
    }
    const farmCoords = getFarmOriginCoordinate(order.assigned_farm_code);
    try {
      const updated = await apiClient<SalesOrder>(`/comercial/orders/${order.id}/confirmar-llegada-granja`, {
        method: 'POST',
        body: JSON.stringify({
          latitud_llegada: farmCoords?.lat,
          longitud_llegada: farmCoords?.lng,
          notas: 'Llegada confirmada por Control de Flota',
        }),
      });
      syncOrderUpdate(updated);
      gpsSimulationStore.seekTruckProgress(order.transport_truck_id || 'VH-001', 0);
      showToast(`🚛 Camión ${order.transport_plate} llegó a ${order.assigned_farm_code}. Pedido Confirmado.`);
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Error de conexión'}`);
    }
  };

  /** Confirmar que el camión salió de granja con la carga → EN_TRANSITO, DESPACHADO */
  const handleIniciarRuta = async (order: SalesOrder) => {
    if (!window.confirm(`¿Confirmar que el camión ${order.transport_plate} salió de ${order.assigned_farm_code} con la carga?\n\nSe descontará el stock físico de Pecuaria y el pedido pasará a estado Despachado (en ruta).`)) {
      return;
    }
    const farmCoords = getFarmOriginCoordinate(order.assigned_farm_code);
    try {
      const updated = await apiClient<SalesOrder>(`/comercial/orders/${order.id}/iniciar-ruta`, {
        method: 'POST',
        body: JSON.stringify({
          latitud_salida: farmCoords?.lat,
          longitud_salida: farmCoords?.lng,
          notas: 'Salida confirmada por Control de Flota',
        }),
      });
      syncOrderUpdate(updated);
      gpsSimulationStore.seekTruckProgress(order.transport_truck_id || 'VH-001', 35);
      showToast(`🚚 ${order.order_number}: Despachado en ruta hacia ${order.client_name}.`);
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Error de conexión'}`);
    }
  };

  /** Confirmar entrega conforme en el punto de destino → ENTREGADO_CONFORME (Terminado) */
  const handleConfirmarEntrega = async (order: SalesOrder) => {
    if (!window.confirm(`¿Confirmar la entrega conforme del pedido ${order.order_number} a ${order.client_name}?\n\nEl pedido pasará a estado Terminado.`)) {
      return;
    }
    const latEntrega = typeof order.delivery_latitude === 'number' && Math.abs(order.delivery_latitude) > 0.1 ? order.delivery_latitude : undefined;
    const lngEntrega = typeof order.delivery_longitude === 'number' && Math.abs(order.delivery_longitude) > 0.1 ? order.delivery_longitude : undefined;
    try {
      const updated = await apiClient<SalesOrder>(`/comercial/orders/${order.id}/confirmar-entrega`, {
        method: 'POST',
        body: JSON.stringify({
          latitud_entrega: latEntrega,
          longitud_entrega: lngEntrega,
          nombre_recibe: 'Conforme',
          notas: 'Entrega confirmada por Control de Flota',
        }),
      });
      syncOrderUpdate(updated);
      gpsSimulationStore.seekTruckProgress(order.transport_truck_id || 'VH-001', 100);
      showToast(`✅ ${order.order_number}: Terminado — entregado conforme a ${order.client_name}.`);
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Error de conexión'}`);
    }
  };

  // ===========================================================================
  // ASIGNACIÓN DE TRANSPORTE A PEDIDO PROGRAMADO
  // ===========================================================================
  const [hasActiveTransportWarning, setHasActiveTransportWarning] = useState<boolean>(false);

  const handleOpenTransportModal = (order: SalesOrder) => {
    setTransportingOrder(order);
    setHasActiveTransportWarning(!!(order.transport_assigned && order.transport_truck_id));
    const existingVehicle = vehicles.find(
      (v) => v.id === order.transport_truck_id || v.plate === order.transport_plate
    );
    const defaultVehicle = existingVehicle || vehicles[0];

    if (defaultVehicle) {
      setTransportVehicleId(defaultVehicle.id);
      setTransportDriverName(order.transport_driver_name || defaultVehicle.driver_name);
      setTransportDriverPhone(order.transport_driver_phone || defaultVehicle.driver_phone || '');
      setTransportCrewName(order.transport_crew || defaultVehicle.default_crew || 'Cuadrilla Oficial');
    } else {
      setTransportVehicleId('');
      setTransportDriverName(order.transport_driver_name || '');
      setTransportDriverPhone(order.transport_driver_phone || '');
      setTransportCrewName(order.transport_crew || 'Cuadrilla Oficial');
    }
    setTransportShift(order.transport_shift || 'MADRUGADA');
    setTransportLoadingSlot(order.loading_slot_time || '03:00 - 05:00 hrs');
    setTransportNotes(order.transport_notes || '');
  };

  const handleVehicleSelectChange = (vehicleId: string) => {
    setTransportVehicleId(vehicleId);
    const veh = vehicles.find((v) => v.id === vehicleId);
    if (veh) {
      setTransportDriverName(veh.driver_name);
      setTransportDriverPhone(veh.driver_phone || '');
      setTransportCrewName(veh.default_crew || 'Cuadrilla Oficial');
    }
  };

  const selectedTransportVehicle = useMemo(
    () => vehicles.find((v) => v.id === transportVehicleId),
    [vehicles, transportVehicleId]
  );

  const transportCagesNeeded = useMemo(() => {
    if (!transportingOrder) return 0;
    const birds = transportingOrder.allocated_quantity || transportingOrder.requested_quantity || 0;
    return transportingOrder.estimated_cages || computeCages(birds, transportingOrder.density_birds_per_cage);
  }, [transportingOrder]);

  const isVehicleOvercapacity = useMemo(() => {
    if (!selectedTransportVehicle) return false;
    return transportCagesNeeded > selectedTransportVehicle.capacity_cages;
  }, [selectedTransportVehicle, transportCagesNeeded]);

  const isZoneMismatch = useMemo(() => {
    if (!selectedTransportVehicle || !transportingOrder) return false;
    if (selectedTransportVehicle.zone_coverage.includes('TODAS')) return false;
    return !selectedTransportVehicle.zone_coverage.includes(transportingOrder.zone_code);
  }, [selectedTransportVehicle, transportingOrder]);

  const handleConfirmTransport = async () => {
    if (!transportingOrder || !selectedTransportVehicle) {
      showToast('⚠️ Seleccione una unidad de transporte para asignar.');
      return;
    }

    setIsSubmittingTransport(true);
    try {
      const payload: AssignTransportPayload = {
        vehicle_id: selectedTransportVehicle.id,
        plate: selectedTransportVehicle.plate,
        driver_name: transportDriverName.trim() || selectedTransportVehicle.driver_name,
        driver_phone: transportDriverPhone.trim() || selectedTransportVehicle.driver_phone,
        crew_name: transportCrewName.trim() || selectedTransportVehicle.default_crew,
        shift: transportShift,
        loading_slot_time: transportLoadingSlot,
        transport_notes: transportNotes.trim(),
      };

      const updated = await apiClient<SalesOrder>(`/comercial/orders/${transportingOrder.id}/assign-transport`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setOrders((prev) => prev.map((o) => (o.id === transportingOrder.id ? updated : o)));
      showToast(`🚚 Transporte asignado: Camión ${payload.plate} • Chofer: ${payload.driver_name}.`);
      setTransportingOrder(null);
    } catch (err: any) {
      showToast(`❌ Error al designar transporte: ${err.message || 'Error de conexión'}`);
    } finally {
      setIsSubmittingTransport(false);
    }
  };

  const handleUnassignTransport = async (order: SalesOrder) => {
    if (!window.confirm(`¿Está seguro de liberar la unidad de transporte del pedido ${order.order_number}?`)) {
      return;
    }
    try {
      const updated = await apiClient<SalesOrder>(`/comercial/orders/${order.id}/unassign-transport`, {
        method: 'POST',
      });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
      // Si la liberación se hizo desde el modal de asignación, actualizar el pedido en el modal
      // y quitar la advertencia para permitir reasignar
      if (transportingOrder?.id === order.id) {
        setTransportingOrder(updated);
        setHasActiveTransportWarning(false);
        // Restablecer el selector de vehículo al primero disponible
        const firstVehicle = vehicles[0];
        if (firstVehicle) {
          setTransportVehicleId(firstVehicle.id);
          setTransportDriverName(firstVehicle.driver_name);
          setTransportDriverPhone(firstVehicle.driver_phone || '');
          setTransportCrewName(firstVehicle.default_crew || 'Cuadrilla Oficial');
        }
      }
      showToast(`ℹ️ Transporte liberado para el pedido ${order.order_number}.`);
    } catch (err: any) {
      showToast(`❌ Error al liberar transporte: ${err.message}`);
    }
  };

  const handleUpdateDispatchPhase = async (order: SalesOrder, newPhase: DispatchPhase) => {
    const nowStr = new Date().toISOString();

    const updatedLocal: SalesOrder = {
      ...order,
      dispatch_phase: newPhase,
      dispatch_phase_updated_at: nowStr,
      status:
        newPhase === 'ENTREGADO_CONFORME'
          ? 'DESPACHADO'
          : order.status === 'DESPACHADO'
          ? 'APROBADO_RESERVADO'
          : order.status,
      updated_at: nowStr,
    };
    setOrders((prev) => prev.map((o) => (o.id === order.id ? updatedLocal : o)));
    showToast(`🚚 ${order.order_number}: Fase actualizada a "${PHASE_LABELS[newPhase]}".`);

    if (newPhase === 'EN_TRANSITO') {
      gpsSimulationStore.seekTruckProgress(order.transport_truck_id || 'VH-001', 35);
    } else if (newPhase === 'ENTREGADO_CONFORME') {
      gpsSimulationStore.seekTruckProgress(order.transport_truck_id || 'VH-001', 100);
    } else if (newPhase === 'EN_GRANJA_CARGANDO' || newPhase === 'TRANSPORTE_ASIGNADO') {
      gpsSimulationStore.seekTruckProgress(order.transport_truck_id || 'VH-001', 0);
    }

    try {
      const updated = await apiClient<SalesOrder>(`/comercial/orders/${order.id}/dispatch-phase`, {
        method: 'PATCH',
        body: JSON.stringify({ dispatch_phase: newPhase }),
      });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    } catch (err: any) {
      showToast(`⚠️ No se pudo guardar la fase en servidor: ${err.message || 'reintente'}`);
    }
  };

  // ===========================================================================
  // GESTIÓN CRUD DE FLOTA DE DISTRIBUCIÓN (CAMIONES Y CHOFERES)
  // ===========================================================================
  const handleOpenCreateVehicle = () => {
    setEditingVehicle(null);
    setVehicleForm(createEmptyVehicleForm());
    setVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (veh: TransportVehicle) => {
    setEditingVehicle(veh);
    setVehicleForm({
      plate: veh.plate,
      model: veh.model,
      capacity_cages: String(veh.capacity_cages),
      capacity_birds: String(veh.capacity_birds),
      birdsTouched: true,
      driver_name: veh.driver_name,
      driver_phone: veh.driver_phone || '',
      default_crew: veh.default_crew || '',
      zone_coverage: veh.zone_coverage.length > 0 ? veh.zone_coverage : ['NORTE', 'CENTRO', 'SUR', 'METROPOLITANA'],
      status: veh.status,
    });
    setVehicleModalOpen(true);
  };

  const toggleZoneCoverage = (zone: string) => {
    setVehicleForm((prev) => {
      const exists = prev.zone_coverage.includes(zone);
      const next = exists ? prev.zone_coverage.filter((z) => z !== zone) : [...prev.zone_coverage, zone];
      return { ...prev, zone_coverage: next };
    });
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const plate = vehicleForm.plate.trim().toUpperCase();
    const model = vehicleForm.model.trim();
    const cages = Number(vehicleForm.capacity_cages);
    const birds = Number(vehicleForm.capacity_birds) || cages * 8;
    const driverName = vehicleForm.driver_name.trim();

    if (plate.length < 4) {
      showToast('⚠️ Ingrese una placa válida (mínimo 4 caracteres).');
      return;
    }
    if (!model) {
      showToast('⚠️ Ingrese el modelo o tipo de camión.');
      return;
    }
    if (!Number.isFinite(cages) || cages < 50 || cages > 2000) {
      showToast('⚠️ La capacidad de jaulas debe estar entre 50 y 2,000.');
      return;
    }
    if (!driverName) {
      showToast('⚠️ Ingrese el nombre del chofer titular.');
      return;
    }
    if (vehicleForm.zone_coverage.length === 0) {
      showToast('⚠️ Seleccione al menos una zona de cobertura.');
      return;
    }

    setIsSavingVehicle(true);
    try {
      if (editingVehicle) {
        const payload: TransportVehicleUpdatePayload = {
          plate,
          model,
          capacity_cages: cages,
          capacity_birds: birds,
          driver_name: driverName,
          driver_phone: vehicleForm.driver_phone.trim(),
          default_crew: vehicleForm.default_crew.trim() || 'Cuadrilla Oficial',
          zone_coverage: vehicleForm.zone_coverage,
          status: vehicleForm.status,
        };
        const updated = await apiClient<TransportVehicle>(`/comercial/transport/vehicles/${editingVehicle.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
        showToast(`✅ Unidad ${updated.plate} actualizada en la flota.`);
      } else {
        const payload: TransportVehicleCreatePayload = {
          plate,
          model,
          capacity_cages: cages,
          capacity_birds: birds,
          driver_name: driverName,
          driver_phone: vehicleForm.driver_phone.trim(),
          default_crew: vehicleForm.default_crew.trim() || 'Cuadrilla Oficial',
          zone_coverage: vehicleForm.zone_coverage,
          status: vehicleForm.status,
        };
        const created = await apiClient<TransportVehicle>('/comercial/transport/vehicles', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setVehicles((prev) => [...prev, created]);
        showToast(`🚚 Nueva unidad ${created.plate} registrada en Flota de Distribución.`);
      }
      setVehicleModalOpen(false);
    } catch (err: any) {
      showToast(`❌ Error guardando transporte: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const handleDeleteVehicle = async (veh: TransportVehicle) => {
    if (!window.confirm(`¿Eliminar la unidad ${veh.plate} (${veh.model}) de la flota de distribución?`)) {
      return;
    }
    try {
      await apiClient(`/comercial/transport/vehicles/${veh.id}`, {
        method: 'DELETE',
      });
      setVehicles((prev) => prev.filter((v) => v.id !== veh.id));
      showToast(`🗑️ Unidad ${veh.plate} eliminada de la flota.`);
    } catch (err: any) {
      showToast(`❌ ${err.message || 'No se pudo eliminar la unidad.'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-600 border-r-transparent" />
          <p className="text-xs text-slate-500 font-bold">Cargando Control de Flota &amp; Distribución...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-300">
      {/* TOAST DE NOTIFICACIÓN */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md p-3.5 bg-slate-900 text-white dark:bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-950 dark:text-slate-50 tracking-tight flex items-center gap-2">
              <Truck className="w-6 h-6 text-red-600" />
              Control de Flota &amp; Transporte
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
              {user?.role === 'admin_sistema' ? 'Administrador' : 'Controlador de Flota'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Asignación de camiones a pedidos programados por Gestión Comercial y administración del parque vehicular.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'flota' && (
            <Button
              size="sm"
              onClick={handleOpenCreateVehicle}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Transporte</span>
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>
        </div>
      </div>

      {/* PESTAÑAS DEL MÓDULO CONTROL DE FLOTA */}
      <ModuleTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          {
            id: 'despacho',
            label: 'Asignación de Transporte',
            icon: <Truck className="w-4 h-4 shrink-0" />,
          },
          {
            id: 'flota',
            label: 'Flota de Distribución',
            icon: <Truck className="w-4 h-4 text-emerald-600 shrink-0" />,
          },
        ]}
      />

      {/* ===================================================================== */}
      {/* PESTAÑA 1: ASIGNACIÓN DE TRANSPORTE A PEDIDOS PROGRAMADOS             */}
      {/* ===================================================================== */}
      {activeTab === 'despacho' && (
        <div className="space-y-4">
          {/* KPIs DE CONTROL DE FLOTA */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard
              title="Por asignar camión"
              value={metrics.pendingTransport}
              subtitle="Pedidos programados esperando unidad"
              accent="amber"
            />
            <KpiCard
              title="Con unidad asignada"
              value={metrics.assigned}
              subtitle="Sincronizados con Gestión Comercial"
              accent="emerald"
            />
            <KpiCard
              title="Carga / En tránsito"
              value={metrics.inTransit}
              subtitle="Unidades en granja o carretera"
              accent="blue"
            />
            <KpiCard
              title="Entregado"
              value={metrics.delivered}
              subtitle="Entregados conforme en destino"
              accent="teal"
            />
            <KpiCard
              title="Flota registrada"
              value={metrics.totalVehicles}
              subtitle={`${metrics.availableVehicles} unidades disponibles`}
              accent="slate"
              className="col-span-2 md:col-span-1"
            />
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-blue-50/80 via-slate-50/40 to-white dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Despacho de Saca &amp; Asignación de Transporte
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Designación de camiones, conductores, cuadrillas y avance de fases para pedidos programados por el Gestor.
                </p>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 px-4 py-3 bg-slate-50/70 dark:bg-slate-800/30">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por N° de pedido, cliente, granja, placa o chofer..."
                  className="pl-9 h-9 text-xs w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Zona
                  </span>
                  <select
                    value={selectedZone}
                    onChange={(e) => setSelectedZone(e.target.value)}
                    className="h-9 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 shadow-2xs"
                  >
                    <option value="ALL">Todas las zonas</option>
                    {ALL_ZONES.map((z) => (
                      <option key={z} value={z}>
                        Zona {z}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

                <OrderDateFilter value={dateFilter} onChange={setDateFilter} />

                {(searchQuery || selectedZone !== 'ALL' || dateFilter.preset !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedZone('ALL');
                      setDateFilter({ ...dateFilter, preset: 'ALL', from: '', to: '' });
                    }}
                    className="h-9 px-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dispatchOrders.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 italic bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                No hay pedidos aprobados pendientes o despachados para los filtros seleccionados.
              </div>
            ) : (
              dispatchOrders.map((order) => {
                const birds = order.allocated_quantity || order.requested_quantity || 0;
                const cages = order.estimated_cages || computeCages(birds, order.density_birds_per_cage);
                const avgW = (order.min_weight_kg + order.max_weight_kg) / 2.0;
                const tons = order.estimated_total_kg
                  ? Math.round(order.estimated_total_kg / 100) / 10
                  : Math.round(((birds * avgW) / 1000) * 10) / 10;

                const currentPhaseIdx = order.dispatch_phase ? PHASE_ORDER.indexOf(order.dispatch_phase) : -1;

                return (
                  <div
                    key={order.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      order.transport_assigned
                        ? 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-400/20'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="font-mono font-black text-slate-950 dark:text-white text-sm">
                          {order.order_number}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block">
                          Saca: {formatDateDisplay(order.target_delivery_date)}
                        </span>
                      </div>
                      {(() => {
                        const eco = deriveEstadoComercial(order);
                        const meta = ESTADO_COMERCIAL_META[eco];
                        return (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.bgColor} ${meta.color} ${meta.borderColor}`}
                          >
                            {meta.label}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Cliente &amp; Destino</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 block truncate">
                          {order.client_name}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Zona {order.zone_code} {order.external_reference ? `• OC: ${order.external_reference}` : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                        <div>
                          <span className="text-[9.5px] text-slate-400 uppercase font-bold block">Origen Granja</span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                            {order.assigned_farm_code} &bull; {order.assigned_barn_code}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9.5px] text-slate-400 uppercase font-bold block">Carga Total</span>
                          <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs">
                            {birds.toLocaleString()} ({tons} Ton)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] p-2 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40">
                        <span className="font-bold text-blue-900 dark:text-blue-300">Jaulas Requeridas:</span>
                        <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-sm">
                          ~{cages} jaulas
                        </span>
                      </div>

                      {order.transport_assigned && (
                        <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-emerald-900 dark:text-emerald-200 font-mono font-black text-sm">
                              {order.transport_plate}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">
                              Turno {order.transport_shift || 'Madrugada'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-600 dark:text-slate-300">
                            <strong>Chofer:</strong> {order.transport_driver_name}
                            {order.transport_driver_phone ? ` (${order.transport_driver_phone})` : ''}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            <strong>Cuadrilla:</strong> {order.transport_crew || 'Oficial'}
                          </div>
                          {order.codigo_aris && (
                            <div className="text-[10px] text-violet-700 dark:text-violet-400 font-bold font-mono flex items-center gap-1 pt-0.5">
                              <Sparkles className="w-3 h-3 text-violet-500" />
                              <span>Código Aris: {order.codigo_aris}</span>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 pt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Slot Balanza: {order.loading_slot_time || '03:00 - 05:00 hrs'}</span>
                          </div>
                          {orders.some(
                            (o) =>
                              o.id !== order.id &&
                              o.transport_assigned &&
                              o.transport_plate === order.transport_plate &&
                              o.target_delivery_date === order.target_delivery_date
                          ) && (
                            <div className="text-[9.5px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100/60 dark:bg-blue-950/60 px-2 py-0.5 rounded-md flex items-center gap-1 mt-1">
                              <Link2 className="w-3 h-3 text-blue-600" />
                              <span>Ruta Multipedido Consolidada</span>
                            </div>
                          )}
                          {order.is_split_child && (
                            <div className="text-[9.5px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/60 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md flex items-center gap-1 mt-1">
                              <Scissors className="w-3 h-3 text-indigo-600" />
                              <span>Saldo Fraccionado (Split)</span>
                            </div>
                          )}
                        </div>
                      )}

                      {order.transport_assigned && (
                        <DispatchLifecycleStepper
                          currentPhase={order.dispatch_phase || 'TRANSPORTE_ASIGNADO'}
                          phaseUpdatedAt={order.dispatch_phase_updated_at}
                        />
                      )}

                      {/* ========================================================= */}
                      {/* BOTONES DEL CICLO DE VIDA - SECUENCIA CONTROLADA          */}
                      {/* ========================================================= */}
                      {/* 1. Llegó a Granja: solo si tiene Aris y está en TRANSPORTE_ASIGNADO */}
                      {order.transport_assigned && order.codigo_aris && order.dispatch_phase === 'TRANSPORTE_ASIGNADO' && (
                        <Button
                          size="sm"
                          onClick={() => handleConfirmarLlegadaGranja(order)}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Llegó a granja</span>
                        </Button>
                      )}

                      {/* 2. Iniciar Ruta: solo si está en EN_GRANJA_CARGANDO */}
                      {order.transport_assigned && order.dispatch_phase === 'EN_GRANJA_CARGANDO' && (
                        <Button
                          size="sm"
                          onClick={() => handleIniciarRuta(order)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Iniciar Ruta</span>
                        </Button>
                      )}

                      {/* 3. Confirmar Entrega: solo si está en EN_TRANSITO */}
                      {order.transport_assigned && order.dispatch_phase === 'EN_TRANSITO' && !order.dispatch_phase_updated_at?.startsWith('ENTREGADO') && (
                        <Button
                          size="sm"
                          onClick={() => handleConfirmarEntrega(order)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Confirmar Entrega</span>
                        </Button>
                      )}

                      {/* Indicador si ya está entregado */}
                      {order.dispatch_phase === 'ENTREGADO_CONFORME' && (
                        <div className="w-full p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 text-center flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>✅ Entregado conforme</span>
                        </div>
                      )}

                      <div className="pt-1 flex items-center justify-between gap-1.5">
                        {order.transport_assigned ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => setWhatsappModalOrder(order)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                              title="Enviar Manifiesto y Hoja de Ruta al Chofer por WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5 fill-white" />
                              <span>WhatsApp</span>
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setGpsModalOrder(order)}
                              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                              title="Controlar y monitorear ruta en GPS"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span>GPS</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenTransportModal(order)}
                              className="text-xs font-bold text-slate-700 dark:text-slate-200"
                            >
                              Cambiar
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleUnassignTransport(order)}
                              className="text-xs text-rose-600 hover:text-rose-700 px-2"
                              title="Liberar Transporte"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleOpenTransportModal(order)}
                            className="w-full text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Designar Transporte</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA 2: FLOTA DE DISTRIBUCIÓN (VEHÍCULOS Y CHOFERES - CRUD)        */}
      {/* ===================================================================== */}
      {activeTab === 'flota' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                Flota Oficial de Camiones &bull; Área de Distribución
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Registro y mantenimiento de unidades de transporte, capacidades jauleras, choferes titulares y cuadrillas.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                Total Unidades: <strong>{vehicles.length}</strong>
              </span>
              <Button
                size="sm"
                onClick={handleOpenCreateVehicle}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Transporte</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((veh) => {
              const assignedOrders = orders.filter(
                (o) =>
                  o.transport_assigned &&
                  o.status !== 'CANCELADO' &&
                  (o.transport_truck_id === veh.id || o.transport_plate === veh.plate)
              );
              const totalAssignedCages = assignedOrders.reduce(
                (acc, o) => acc + (o.estimated_cages || computeCages(o.allocated_quantity || 0, o.density_birds_per_cage)),
                0
              );
              const occupancyPct = Math.min(Math.round((totalAssignedCages / veh.capacity_cages) * 100), 100);

              return (
                <div
                  key={veh.id}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-black text-lg text-slate-950 dark:text-white block">
                        {veh.plate}
                      </span>
                      <span className="text-[11px] text-slate-500 font-bold block">{veh.model}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        veh.status === 'EN_MANTENIMIENTO'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                          : veh.status === 'ASIGNADO'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      {veh.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-black block">Capacidad Jaulas</span>
                      <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                        {veh.capacity_cages} jlas
                      </span>
                      <span className="text-[9.5px] text-slate-400 block">~{veh.capacity_birds.toLocaleString()} aves</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-black block">Ocupación Actual</span>
                      <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-sm">
                        {totalAssignedCages} / {veh.capacity_cages}
                      </span>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${occupancyPct > 90 ? 'bg-amber-500' : 'bg-blue-600'}`}
                          style={{ width: `${occupancyPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Chofer: <strong>{veh.driver_name}</strong>
                      </span>
                    </div>
                    {veh.driver_phone && (
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{veh.driver_phone}</span>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500">
                      Cuadrilla: <strong>{veh.default_crew || 'Oficial'}</strong>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      <span>Zonas: {veh.zone_coverage.join(', ')}</span>
                    </div>
                  </div>

                  {assignedOrders.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                        Pedidos en Curso ({assignedOrders.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {assignedOrders.map((ao) => (
                          <span
                            key={ao.id}
                            className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-mono font-bold text-[10px]"
                          >
                            {ao.order_number} ({ao.target_delivery_date})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEditVehicle(veh)}
                      className="text-xs font-bold flex items-center gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDeleteVehicle(veh)}
                      className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1"
                      title="Eliminar transporte de la flota"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: DESIGNACIÓN DE TRANSPORTE AL PEDIDO                          */}
      {/* ===================================================================== */}
      {transportingOrder && (
        <Modal
          isOpen={!!transportingOrder}
          onClose={() => setTransportingOrder(null)}
          title={`Designar Transporte — ${transportingOrder.order_number}`}
          size="xl"
        >
          <div className="space-y-4 text-xs">
            {/* ============================================================ */}
            {/* REGLA DE NEGOCIO: Un pedido no puede ir en 2 camiones.        */}
            {/* Si el pedido ya tiene transporte, advertir y pedir liberar    */}
            {/* ============================================================ */}
            {hasActiveTransportWarning && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-300">
                    <span className="font-black block">Este pedido ya tiene un camión asignado</span>
                    <span className="font-semibold">
                      {transportingOrder.transport_plate} — {transportingOrder.transport_driver_name}
                      {' · '}
                      <button
                        type="button"
                        onClick={() => handleUnassignTransport(transportingOrder)}
                        className="underline font-bold text-amber-900 dark:text-amber-200 hover:text-amber-950"
                      >
                        Liberar transporte actual
                      </button>
                      {' '}antes de designar una nueva unidad.
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Cliente / Zona</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 block truncate">
                  {transportingOrder.client_name}
                </span>
                <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold">
                  Zona {transportingOrder.zone_code}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Origen Granja</span>
                <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 block">
                  {transportingOrder.assigned_farm_code || 'TRAD1'} &bull; {transportingOrder.assigned_barn_code || 'G-01'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Aves Asignadas</span>
                <span className="font-mono font-black text-slate-900 dark:text-slate-100 block text-sm">
                  {(transportingOrder.allocated_quantity || transportingOrder.requested_quantity || 0).toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-bold block">
                  Jaulas Estimadas
                </span>
                <span className="font-mono font-black text-blue-800 dark:text-blue-300 block text-base">
                  ~{transportCagesNeeded} jaulas
                </span>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Seleccionar Camión / Unidad de Distribución:
                </label>
                <select
                  value={transportVehicleId}
                  onChange={(e) => handleVehicleSelectChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} &bull; {v.model} (Cap: {v.capacity_cages} jaulas / ~{v.capacity_birds} aves) — {v.driver_name}
                    </option>
                  ))}
                </select>
              </div>

              <ConsolidationCubicajeBar
                currentOrder={transportingOrder}
                selectedVehicle={selectedTransportVehicle}
                allOrders={orders}
              />

              {isVehicleOvercapacity && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black block">⚠️ Inconsistencia de Capacidad de Carga:</span>
                    <span>
                      El pedido requiere <strong>~{transportCagesNeeded} jaulas</strong>, superando la capacidad de la
                      unidad seleccionada (<strong>{selectedTransportVehicle?.capacity_cages} jaulas</strong>).
                    </span>
                  </div>
                </div>
              )}

              {isZoneMismatch && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black block">⚠️ Advertencia de Cobertura de Ruta:</span>
                    <span>
                      La unidad {selectedTransportVehicle?.plate} opera habitualmente en [
                      {selectedTransportVehicle?.zone_coverage.join(', ')}], mientras que el destino es{' '}
                      <strong>Zona {transportingOrder.zone_code}</strong>.
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Turno de Saca / Despacho:
                  </label>
                  <select
                    value={transportShift}
                    onChange={(e) => setTransportShift(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                  >
                    <option value="MADRUGADA">Madrugada (01:00 - 04:00 AM) — Fresco Mayorista</option>
                    <option value="MANANA">Mañana (05:00 - 08:00 AM)</option>
                    <option value="TARDE">Tarde (13:00 - 16:00 PM)</option>
                    <option value="NOCHE">Noche (20:00 - 23:00 PM)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Ventana Horaria en Balanza:
                  </label>
                  <select
                    value={transportLoadingSlot}
                    onChange={(e) => setTransportLoadingSlot(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                  >
                    <option value="21:00 - 23:00 hrs">🌙 21:00 - 23:00 hrs (Nocturno 1)</option>
                    <option value="23:00 - 01:00 hrs">🌙 23:00 - 01:00 hrs (Nocturno 2)</option>
                    <option value="01:00 - 03:00 hrs">🌌 01:00 - 03:00 hrs (Madrugada 1)</option>
                    <option value="03:00 - 05:00 hrs">🌌 03:00 - 05:00 hrs (Madrugada 2)</option>
                    <option value="05:00 - 07:00 hrs">☀️ 05:00 - 07:00 hrs (Diurno)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Cuadrilla de Atrape / Carga:
                  </label>
                  <Input
                    value={transportCrewName}
                    onChange={(e) => setTransportCrewName(e.target.value)}
                    placeholder="Ej: Cuadrilla Norte 1"
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Conductor / Chofer Designado:
                  </label>
                  <Input
                    value={transportDriverName}
                    onChange={(e) => setTransportDriverName(e.target.value)}
                    className="text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Teléfono del Conductor:
                  </label>
                  <Input
                    value={transportDriverPhone}
                    onChange={(e) => setTransportDriverPhone(e.target.value)}
                    placeholder="+51 987 654 321"
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Instrucciones de Rampa / Despacho:
                </label>
                <Input
                  value={transportNotes}
                  onChange={(e) => setTransportNotes(e.target.value)}
                  placeholder="Ej: Ingreso por rampa auxiliar 2..."
                  className="text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button size="sm" variant="secondary" onClick={() => setTransportingOrder(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmTransport}
                disabled={isSubmittingTransport || hasActiveTransportWarning}
                className={`font-extrabold flex items-center gap-1.5 shadow-sm ${
                  hasActiveTransportWarning
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title={hasActiveTransportWarning ? 'Debe liberar el transporte actual antes de asignar una nueva unidad' : 'Designar transporte'}
              >
                <Truck className="w-4 h-4" />
                <span>{isSubmittingTransport ? 'Designando...' : 'Confirmar Designación de Transporte'}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: REGISTRAR / EDITAR UNIDAD EN FLOTA DE DISTRIBUCIÓN           */}
      {/* ===================================================================== */}
      {vehicleModalOpen && (
        <Modal
          isOpen={vehicleModalOpen}
          onClose={() => setVehicleModalOpen(false)}
          title={editingVehicle ? `Editar Transporte — ${editingVehicle.plate}` : 'Registrar Nuevo Transporte en Flota'}
          description="Complete los datos operativos de la unidad, capacidad de jaulas, conductor titular y cobertura."
          size="lg"
        >
          <form onSubmit={handleSaveVehicle} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Placa de Rodaje *
                </label>
                <Input
                  value={vehicleForm.plate}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value.toUpperCase() })}
                  placeholder="Ej: T8C-940"
                  className="font-mono font-bold uppercase text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Modelo / Tipo de Camión *
                </label>
                <Input
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                  placeholder="Ej: Camión Baranda 3 Ejes"
                  className="text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Capacidad Jaulas *
                </label>
                <Input
                  type="number"
                  min={50}
                  max={2000}
                  value={vehicleForm.capacity_cages}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const cagesNum = Number(raw);
                    setVehicleForm((prev) => ({
                      ...prev,
                      capacity_cages: raw,
                      capacity_birds:
                        !prev.birdsTouched && Number.isFinite(cagesNum) && cagesNum > 0
                          ? String(cagesNum * 8)
                          : prev.capacity_birds,
                    }));
                  }}
                  className="font-mono font-bold text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Capacidad Referencial (Aves)
                </label>
                <Input
                  type="number"
                  min={100}
                  max={20000}
                  value={vehicleForm.capacity_birds}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, capacity_birds: e.target.value, birdsTouched: true })
                  }
                  className="font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Estado de Unidad
                </label>
                <select
                  value={vehicleForm.status}
                  onChange={(e) =>
                    setVehicleForm({
                      ...vehicleForm,
                      status: e.target.value as 'DISPONIBLE' | 'ASIGNADO' | 'EN_MANTENIMIENTO',
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="DISPONIBLE">DISPONIBLE</option>
                  <option value="ASIGNADO">ASIGNADO</option>
                  <option value="EN_MANTENIMIENTO">EN_MANTENIMIENTO</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Chofer Titular *
                </label>
                <Input
                  value={vehicleForm.driver_name}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, driver_name: e.target.value })}
                  placeholder="Ej: Carlos Méndez Rojas"
                  className="text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Teléfono del Chofer
                </label>
                <Input
                  value={vehicleForm.driver_phone}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, driver_phone: e.target.value })}
                  placeholder="Ej: +51 984 123 456"
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Cuadrilla Asignada
                </label>
                <Input
                  value={vehicleForm.default_crew}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, default_crew: e.target.value })}
                  placeholder="Ej: Cuadrilla Norte 1"
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                Zonas de Cobertura *
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_ZONES.map((z) => {
                  const active = vehicleForm.zone_coverage.includes(z);
                  return (
                    <button
                      key={z}
                      type="button"
                      onClick={() => toggleZoneCoverage(z)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-colors ${
                        active
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {z}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" size="sm" variant="secondary" onClick={() => setVehicleModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingVehicle}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center gap-1.5"
              >
                <Truck className="w-4 h-4" />
                <span>{isSavingVehicle ? 'Guardando...' : editingVehicle ? 'Guardar Cambios' : 'Registrar Transporte'}</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: CONTROL Y MONITOREO GPS EN VIVO (SINCRONIZADO CON GESTOR)    */}
      {/* ===================================================================== */}
      {gpsModalOrder && (
        <Modal
          isOpen={!!gpsModalOrder}
          onClose={() => setGpsModalOrder(null)}
          title={`Control & Ruta GPS — ${gpsModalOrder.order_number}`}
          description={`${gpsModalOrder.client_name} • Unidad ${gpsModalOrder.transport_plate || 'Asignada'}`}
          size="2xl"
        >
          <FlotaGpsMap
            initialSelectedTruckId={
              gpsModalOrder.transport_truck_id ||
              gpsSimulationStore.getTrucks().find((t) => t.orderId === gpsModalOrder.order_number)?.id
            }
            readOnly={false}
            orders={orders}
          />
        </Modal>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: MANIFIESTO WHATSAPP                                          */}
      {/* ===================================================================== */}
      <WhatsAppManifestModal
        order={whatsappModalOrder}
        isOpen={!!whatsappModalOrder}
        onClose={() => setWhatsappModalOrder(null)}
      />
    </div>
  );
};

