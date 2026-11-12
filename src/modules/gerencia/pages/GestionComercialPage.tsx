import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  Truck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Filter,
  Search,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  MapPin,
  ShieldAlert,
  Sparkles,
  Bird,
  Info,
  X,
  ArrowRight,
  Eye,
  Layers,
  MessageSquare,
  Scissors,
  Building2,
  User,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { OrderDateFilter } from '@/components/ui/OrderDateFilter';
import {
  DateFilterValue,
  DEFAULT_DATE_FILTER,
  resolveRange,
  orderDateKey,
  matchesRange,
  describeRange,
} from '@/lib/dateFilters';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { apiClient } from '@/lib/api';
import {
  SalesOrder,
  OrderStatus,
  SexPreference,
  OrderActionPayload,
  DispatchPhase,
  computeCages,
  suggestDensity,
  clampDensity,
  MIN_DENSITY,
  MAX_DENSITY,
  DEFAULT_DENSITY,
} from '@/types/comercial';
import { TablaGeneralSaldoItem } from '@/types/pecuaria';
import { FlotaGpsMap } from '../components/gps/FlotaGpsMap';
import { gpsSimulationStore } from '../components/gps/gpsSimulationStore';
import { DispatchLifecycleStepper } from '../components/dispatch/DispatchLifecycleStepper';
import { WhatsAppManifestModal } from '../components/dispatch/WhatsAppManifestModal';
import { AuditTimeline } from '../components/audit/AuditTimeline';
import { SaldosGalponPanel } from '../components/SaldosGalponPanel';
import { RoxiCopilotCard } from '@/components/roxi/RoxiCopilotCard';
import { RoxiAvatar } from '@/components/roxi/RoxiAvatar';
import { RoxiGestorDashboard } from '@/components/roxi/RoxiGestorDashboard';
import { ClientsPanel } from '@/modules/comercial/components/ClientsPanel';

// Helper de formato de fecha
export const formatDateDisplay = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

// Metadatos de catálogo predeterminado de clientes autorizados
export const KNOWN_CLIENTS_METADATA: Record<string, { address: string; phone: string; contact: string }> = {
  'c1000000-0000-0000-0000-000000000001': {
    address: 'Av. Nicolás Ayllón 3800, Mercado Mayorista Santa Anita (Rampa 2) - Lima',
    phone: '+51 987 654 321',
    contact: 'Sr. Fernando Huamán (Jefe de Compras & Distribución)',
  },
  'c1000000-0000-0000-0000-000000000002': {
    address: 'Av. Javier Prado Este 2890, San Borja, Lima',
    phone: '+51 991 223 344',
    contact: 'Lic. Patricia Vega (Operaciones y Cadena de Suministro)',
  },
  'c1000000-0000-0000-0000-000000000003': {
    address: 'Panamericana Norte Km 24.5, Centro de Distribución Los Olivos',
    phone: '+51 976 543 210',
    contact: 'Ing. Roberto Cáceres (Recepción de Perecibles Retail)',
  },
  'c1000000-0000-0000-0000-000000000004': {
    address: 'Mercado Mayorista Unicachi, Puesto 84 - Comas, Lima',
    phone: '+51 954 321 876',
    contact: 'Don Víctor Quispe (Representante Comercial Mayorista)',
  },
  'c1000000-0000-0000-0000-000000000005': {
    address: 'Av. Pachacútec 1200, Villa El Salvador, Lima',
    phone: '+51 945 678 123',
    contact: 'Sr. Manuel Barreto (Distribución Zona Sur)',
  },
};

// Resuelve el nombre real completo del vendedor que capturó la venta (sin inventar)
export const resolveSellerFullName = (order?: SalesOrder | null): string => {
  if (!order) return '-';
  if (order.seller_full_name && order.seller_full_name.trim() !== '') {
    return order.seller_full_name;
  }
  if (order.seller_username && order.seller_username.trim() !== '') {
    return order.seller_username;
  }
  return 'No registrado';
};

// Resuelve detalles completos del cliente solicitante (sin datos inventados)
export const resolveClientDetails = (order?: SalesOrder | null) => {
  if (!order) return { address: null as string | null, phone: null as string | null, contact: null as string | null };
  const meta = order.client_id ? KNOWN_CLIENTS_METADATA[order.client_id] : null;
  return {
    address: order.delivery_address || meta?.address || null,
    phone: meta?.phone || null,
    contact: meta?.contact || null,
  };
};

type DetailTab = 'resumen' | 'carga' | 'logistica' | 'auditoria';

export const GestionComercialPage: React.FC = () => {  const { user } = useAuth();

  // =========================================================================
  // ESTADOS PRINCIPALES
  // =========================================================================
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [pecuariaItems, setPecuariaItems] = useState<TablaGeneralSaldoItem[]>([]);
  const [pecuariaLastUpdated, setPecuariaLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pestaña activa: la primera vista del Gestor Comercial es Saldos por Galpón para planificar en base a disponibilidad
  const [activeTab, setActiveTab] = useState<'pecuaria' | 'pedidos' | 'clientes' | 'mapa_gps' | 'roxi'>('pecuaria');
  const [roxiSelectedOrderId, setRoxiSelectedOrderId] = useState<string>('');

  // Filtros
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(DEFAULT_DATE_FILTER);
  const dateRange = useMemo(() => resolveRange(dateFilter), [dateFilter]);
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modales
  const [approvingOrder, setApprovingOrder] = useState<SalesOrder | null>(null);
  const [observingOrder, setObservingOrder] = useState<SalesOrder | null>(null);
  const [detailOrder, setDetailOrder] = useState<SalesOrder | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('resumen');
  const [routeOrder, setRouteOrder] = useState<SalesOrder | null>(null);
  const [detailDensity, setDetailDensity] = useState<number>(DEFAULT_DENSITY);
  const [isSavingDensity, setIsSavingDensity] = useState<boolean>(false);

  // Sincroniza el editor de densidad al abrir el detalle de un pedido
  useEffect(() => {
    if (detailOrder) {
      setDetailDensity(detailOrder.density_birds_per_cage || DEFAULT_DENSITY);
    }
  }, [detailOrder?.id]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [whatsappModalOrder, setWhatsappModalOrder] = useState<SalesOrder | null>(null);

  // Estados de formulario de Aprobación Formal y Split
  const [formFarmCode, setFormFarmCode] = useState<string>('TRAD1');
  const [formBarnCode, setFormBarnCode] = useState<string>('G-01');
  const [formAllocatedQty, setFormAllocatedQty] = useState<number>(0);
  const [formDensity, setFormDensity] = useState<number>(DEFAULT_DENSITY);
  const [formGestorObservation, setFormGestorObservation] = useState<string>('');
  const [formSplitRemaining, setFormSplitRemaining] = useState<boolean>(true);
  const [formSplitDate, setFormSplitDate] = useState<string>('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState<boolean>(false);

  // Estados de formulario de Observación
  const [obsReason, setObsReason] = useState<string>('');
  const [isSubmittingObs, setIsSubmittingObs] = useState<boolean>(false);

  // =========================================================================
  // TOAST TEMPORIZADO
  // =========================================================================
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // =========================================================================
  // CARGA DE DATOS (PEDIDOS, FLOTA DE TRANSPORTE Y DISPONIBILIDAD PECUARIA)
  // =========================================================================
  const fetchData = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      // 1. Cargar Pedidos Comerciales
      try {
        const ordersData = await apiClient<SalesOrder[]>('/comercial/orders');
        if (Array.isArray(ordersData)) {
          setOrders(ordersData);
          localStorage.setItem('avicola_comercial_orders', JSON.stringify(ordersData));
        }
      } catch (err) {
        if (!silent) {
          console.warn('Fallback a pedidos locales:', err);
          const stored = localStorage.getItem('avicola_comercial_orders');
          if (stored) {
            try {
              setOrders(JSON.parse(stored));
            } catch {}
          }
        }
      }

      // 2. Cargar Balance de Saldo de Pecuaria
      try {
        const pecuariaData = await apiClient<any>('/pecuaria/tabla-general-saldo');
        const rawList = pecuariaData?.data || pecuariaData?.items;
        if (Array.isArray(rawList) && rawList.length > 0) {
          setPecuariaItems(rawList);
        } else {
          // Sin lotes en la base: no se inventan galpones
          setPecuariaItems([]);
        }
        setPecuariaLastUpdated(new Date());
      } catch (err) {
        // Sin conexión: se mantiene lo último cargado, sin generar datos sintéticos
        console.warn('No se pudo cargar la disponibilidad de Pecuaria:', err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sincronía automática con Control de Flota: sondeo silencioso y refresco al recuperar el foco
  useEffect(() => {
    const interval = setInterval(() => {
      if (!approvingOrder && !observingOrder) {
        fetchData(true);
      }
    }, 12000);
    const onFocus = () => fetchData(true);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [approvingOrder, observingOrder]);

  useEffect(() => {
    gpsSimulationStore.syncOrders(orders);
  }, [orders]);

  // Sincronización telemática en modo lectura con la marcha GPS controlada por Control de Flota
  useEffect(() => {
    const unsub = gpsSimulationStore.subscribe(() => {
      const trucks = gpsSimulationStore.getTrucks();

      setOrders((prevOrders) => {
        let hasChanges = false;
        const updated = prevOrders.map((order) => {
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
            const newStatus: OrderStatus =
              targetPhase === 'ENTREGADO_CONFORME'
                ? 'DESPACHADO'
                : order.status === 'DESPACHADO'
                ? 'APROBADO_RESERVADO'
                : order.status;

            return {
              ...order,
              dispatch_phase: targetPhase,
              dispatch_phase_updated_at: new Date().toISOString(),
              status: newStatus,
              updated_at: new Date().toISOString(),
            };
          }

          return order;
        });

        return hasChanges ? updated : prevOrders;
      });

      setDetailOrder((prev) => {
        if (!prev || !prev.transport_assigned) return prev;
        const matched = trucks.find(
          (t) =>
            t.id === prev.transport_truck_id ||
            (prev.transport_plate && t.plate.toLowerCase() === prev.transport_plate.toLowerCase())
        );
        if (!matched) return prev;

        let targetPhase: DispatchPhase = prev.dispatch_phase || 'TRANSPORTE_ASIGNADO';
        if (matched.progressPercent >= 100) {
          targetPhase = 'ENTREGADO_CONFORME';
        } else if (matched.progressPercent > 0) {
          targetPhase = 'EN_TRANSITO';
        } else if (matched.isPlaying) {
          targetPhase = 'EN_GRANJA_CARGANDO';
        }

        if (prev.dispatch_phase !== targetPhase) {
          const detailStatus: OrderStatus =
            targetPhase === 'ENTREGADO_CONFORME' ? 'DESPACHADO' : prev.status;
          return {
            ...prev,
            dispatch_phase: targetPhase,
            dispatch_phase_updated_at: new Date().toISOString(),
            status: detailStatus,
          };
        }
        return prev;
      });
    });

    return unsub;
  }, []);

  // =========================================================================
  // KPIs Y MÉTRICAS CALCULADAS
  // =========================================================================
  const metrics = useMemo(() => {
    const pendingOk = orders.filter((o) => o.status === 'REGISTRADO').length;
    const observed = orders.filter((o) => o.status === 'CON_OBSERVACION').length;
    const approved = orders.filter((o) => o.status === 'APROBADO_RESERVADO');
    const pendingTransport = approved.filter((o) => !o.transport_assigned).length;
    const assignedTransport = approved.filter((o) => o.transport_assigned).length;

    let totalBirdsApproved = 0;
    let totalCagesApproved = 0;
    let totalTonsApproved = 0;

    approved.forEach((o) => {
      const birds = o.allocated_quantity || o.requested_quantity || 0;
      const cages = o.estimated_cages || computeCages(birds, o.density_birds_per_cage);
      const avgWeight = (o.min_weight_kg + o.max_weight_kg) / 2.0;
      const tons = o.estimated_total_kg ? o.estimated_total_kg / 1000 : (birds * avgWeight) / 1000;

      totalBirdsApproved += birds;
      totalCagesApproved += cages;
      totalTonsApproved += tons;
    });

    return {
      pendingOk,
      observed,
      approvedTotal: approved.length,
      pendingTransport,
      assignedTransport,
      totalBirdsApproved,
      totalCagesApproved,
      totalTonsApproved: Math.round(totalTonsApproved * 10) / 10,
    };
  }, [orders]);

  // Lista de fechas únicas para filtro
  const uniqueDates = useMemo(() => {
    const setDates = new Set<string>();
    orders.forEach((o) => {
      if (o.target_delivery_date) setDates.add(o.target_delivery_date);
    });
    return Array.from(setDates).sort();
  }, [orders]);

  // =========================================================================
  // FILTRADO DE PEDIDOS
  // =========================================================================
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Filtro por estado
      if (selectedStatus === 'PENDIENTES_APROBACION' && o.status !== 'REGISTRADO') return false;
      if (selectedStatus === 'CON_OBSERVACION' && o.status !== 'CON_OBSERVACION') return false;
      if (selectedStatus === 'APROBADO_RESERVADO' && o.status !== 'APROBADO_RESERVADO') return false;
      if (selectedStatus === 'SIN_TRANSPORTE' && (o.status !== 'APROBADO_RESERVADO' || o.transport_assigned)) return false;
      if (selectedStatus === 'CON_TRANSPORTE' && (o.status !== 'APROBADO_RESERVADO' || !o.transport_assigned)) return false;

      // Filtro por fecha (saca o registro)
      if (!matchesRange(orderDateKey(o, dateFilter.criterion), dateRange)) return false;

      // Filtro por zona
      if (selectedZone !== 'ALL' && o.zone_code !== selectedZone) return false;

      // Búsqueda por texto
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesNumber = o.order_number?.toLowerCase().includes(q);
        const matchesClient = o.client_name?.toLowerCase().includes(q);
        const matchesTax = o.client_tax_id?.toLowerCase().includes(q);
        const matchesRef = o.external_reference?.toLowerCase().includes(q);
        if (!matchesNumber && !matchesClient && !matchesTax && !matchesRef) return false;
      }

      return true;
    });
  }, [orders, selectedStatus, selectedZone, searchQuery, dateFilter.criterion, dateRange]);

  // =========================================================================
  // GESTIÓN DE ACCIONES: APROBACIÓN FORMAL Y RESERVA DE GALPÓN
  // =========================================================================
  const handleOpenApprovalModal = (order: SalesOrder) => {
    setApprovingOrder(order);
    setFormFarmCode(order.suggested_farm_code || 'TRAD1');
    setFormBarnCode(order.suggested_barn_code || 'G-01');
    setFormAllocatedQty(order.requested_quantity);
    setFormDensity(
      order.density_birds_per_cage || suggestDensity(order.min_weight_kg, order.max_weight_kg)
    );
    setFormGestorObservation('');
    setFormSplitRemaining(true);
    // Fecha sugerida para el split: siguiente fecha o +1 día
    if (order.target_delivery_date) {
      const parts = order.target_delivery_date.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        d.setDate(d.getDate() + 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setFormSplitDate(`${y}-${m}-${day}`);
      } else {
        setFormSplitDate('2026-11-06');
      }
    } else {
      setFormSplitDate('2026-11-06');
    }
  };

  // Buscar datos del galpón seleccionado en el modal de aprobación
  const selectedPecuariaBarn = useMemo(() => {
    if (!approvingOrder) return null;
    return pecuariaItems.find(
      (b) => b.farm_code === formFarmCode && b.barn_code === formBarnCode
    );
  }, [approvingOrder, formFarmCode, formBarnCode, pecuariaItems]);

  // Inconsistencia pecuaria: ¿el galpón tiene menos aves que las solicitadas?
  const isStockInsufficient = useMemo(() => {
    if (!selectedPecuariaBarn) return false;
    return (selectedPecuariaBarn.barn_balance_available || 0) < formAllocatedQty;
  }, [selectedPecuariaBarn, formAllocatedQty]);

  // Inconsistencia de peso: ¿el peso promedio del galpón está fuera del rango del cliente?
  const isWeightDeviated = useMemo(() => {
    if (!selectedPecuariaBarn || !approvingOrder) return false;
    const avg = selectedPecuariaBarn.average_weight_kg || 0;
    return avg < approvingOrder.min_weight_kg || avg > approvingOrder.max_weight_kg;
  }, [selectedPecuariaBarn, approvingOrder]);

  const handleConfirmApproval = async () => {
    if (!approvingOrder) return;
    if (formAllocatedQty <= 0) {
      showToast('⚠️ La cantidad de aves asignadas debe ser mayor a 0.');
      return;
    }
    if (!Number.isInteger(formDensity) || formDensity < MIN_DENSITY || formDensity > MAX_DENSITY) {
      showToast(`⚠️ La densidad debe ser un entero entre ${MIN_DENSITY} y ${MAX_DENSITY} aves por jaula.`);
      return;
    }

    setIsSubmittingApproval(true);
    try {
      const isSplit = formAllocatedQty < approvingOrder.requested_quantity && formSplitRemaining;
      const payload: OrderActionPayload = {
        farm_code: formFarmCode,
        barn_code: formBarnCode,
        allocated_quantity: formAllocatedQty,
        density_birds_per_cage: formDensity,
        split_remaining: isSplit,
        split_delivery_date: formSplitDate,
        observation:
          formGestorObservation.trim() ||
          `Aprobación formal otorgada por Gestor Comercial (${user?.username || 'gestor'}). Galpón ${formBarnCode} asignado con ${formAllocatedQty.toLocaleString()} aves reservadas para saca.`,
      };

      try {
        const updated = await apiClient<SalesOrder>(`/comercial/orders/${approvingOrder.id}/dar-ok`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (isSplit) {
          try {
            const freshOrders = await apiClient<SalesOrder[]>('/comercial/orders');
            setOrders(freshOrders);
          } catch {
            const remaining = approvingOrder.requested_quantity - formAllocatedQty;
            const childOrder: SalesOrder = {
              ...approvingOrder,
              id: `ord-split-${Date.now()}`,
              order_number: `${approvingOrder.order_number}-B`,
              requested_quantity: remaining,
              allocated_quantity: 0,
              status: 'REGISTRADO',
              target_delivery_date: formSplitDate,
              is_split_child: true,
              parent_order_id: approvingOrder.id,
              original_requested_quantity: approvingOrder.requested_quantity,
              notes: `Saldo fraccionado (${remaining.toLocaleString()} aves) de ${approvingOrder.order_number}.`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              audit_log: [
                {
                  id: `log-${Date.now()}`,
                  action: 'FRACCIONADO',
                  actor_username: user?.username || 'gestor_comercial',
                  actor_role: 'gestor_comercial',
                  timestamp: new Date().toISOString(),
                  description: `Saldo fraccionado de ${remaining.toLocaleString()} aves generado automáticamente.`,
                },
              ],
            };
            setOrders((prev) => [childOrder, ...prev.map((o) => (o.id === approvingOrder.id ? updated : o))]);
          }
          showToast(`✂️ Pedido ${approvingOrder.order_number} aprobado parcialmente (${formAllocatedQty.toLocaleString()} aves). Saldo fraccionado en nueva orden.`);
        } else {
          setOrders((prev) => prev.map((o) => (o.id === approvingOrder.id ? updated : o)));
          showToast(`✅ Pedido ${approvingOrder.order_number} formalmente APROBADO con reserva en ${formFarmCode} - ${formBarnCode}.`);
        }
      } catch (apiErr: any) {
        // Sin respaldo local: la aprobación solo existe si la base de datos la confirmó
        throw apiErr;
      }

      setApprovingOrder(null);
    } catch (err: any) {
      showToast(`❌ Error al aprobar pedido: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // La densidad deja de ser editable cuando el despacho ya salió de granja
  const isDensityBlocked = detailOrder
    ? detailOrder.dispatch_phase === 'EN_TRANSITO' || detailOrder.dispatch_phase === 'ENTREGADO_CONFORME'
    : false;

  // Ajuste de densidad posterior a la aprobación (permitido hasta antes del tránsito)
  const handleUpdateDensity = async () => {
    if (!detailOrder) return;
    if (!Number.isInteger(detailDensity) || detailDensity < MIN_DENSITY || detailDensity > MAX_DENSITY) {
      showToast(`⚠️ La densidad debe ser un entero entre ${MIN_DENSITY} y ${MAX_DENSITY} aves por jaula.`);
      return;
    }

    setIsSavingDensity(true);
    try {
      const updated = await apiClient<SalesOrder>(`/comercial/orders/${detailOrder.id}/density`, {
        method: 'PATCH',
        body: JSON.stringify({ density_birds_per_cage: detailDensity }),
      });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setDetailOrder(updated);
      showToast(
        `✅ Densidad actualizada a ${updated.density_birds_per_cage} aves/jaula (~${(updated.estimated_cages || 0).toLocaleString()} jaulas).`
      );
    } catch (err: any) {
      const msg = String(err?.message || '');
      // Reglas de negocio del backend: no se reintenta en local
      if (msg.includes('no puede modificarse') || msg.includes('permisos')) {
        showToast(`⚠️ ${msg}`);
        return;
      }
      // Respaldo local si el servidor no está disponible
      const birds = detailOrder.allocated_quantity || detailOrder.requested_quantity || 0;
      const localUpdated: SalesOrder = {
        ...detailOrder,
        density_birds_per_cage: detailDensity,
        estimated_cages: computeCages(birds, detailDensity),
        updated_at: new Date().toISOString(),
      };
      setOrders((prev) => prev.map((o) => (o.id === localUpdated.id ? localUpdated : o)));
      setDetailOrder(localUpdated);
      showToast(`ℹ️ Densidad actualizada solo en este navegador (${msg || 'servidor no disponible'}).`);
    } finally {
      setIsSavingDensity(false);
    }
  };

  const handleApproveOrderFromRoxi = async (order: SalesOrder, farmCode: string, barnCode: string) => {
    setIsSubmittingApproval(true);
    try {
      const payload: OrderActionPayload = {
        farm_code: farmCode,
        barn_code: barnCode,
        allocated_quantity: order.requested_quantity,
        density_birds_per_cage: order.density_birds_per_cage || DEFAULT_DENSITY,
        observation: `Aprobado formalmente con recomendación de ROXI (Granja ${farmCode} - Galpón ${barnCode}).`,
      };
      try {
        const updated = await apiClient<SalesOrder>(`/comercial/orders/${order.id}/dar-ok`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
        showToast(`✅ Pedido ${order.order_number} formalmente APROBADO con reserva en ${farmCode} - ${barnCode}.`);
      } catch {
        const updatedLocal: SalesOrder = {
          ...order,
          status: 'APROBADO_RESERVADO',
          assigned_farm_code: farmCode,
          assigned_barn_code: barnCode,
          allocated_quantity: order.requested_quantity,
          density_birds_per_cage: payload.density_birds_per_cage,
          estimated_cages: computeCages(order.requested_quantity, payload.density_birds_per_cage),
          gestor_username: user?.username || 'gestor_comercial',
          gestor_observation: payload.observation,
          updated_at: new Date().toISOString(),
        };
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updatedLocal : o)));
        showToast(`✅ Pedido ${order.order_number} formalmente APROBADO con recomendación de ROXI (${farmCode} - ${barnCode}).`);
      }
    } catch (err: any) {
      showToast(`❌ Error al aprobar pedido: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // =========================================================================
  // GENERAR CÓDIGO ARIS (CONFIRMACIÓN DEL GESTOR COMERCIAL)
  // =========================================================================
  const handleGenerarCodigoAris = async (order: SalesOrder) => {
    if (!window.confirm(`¿Generar código Aris para el pedido ${order.order_number}?\n\nEsta acción confirma la planificación completa del pedido y lo deja listo para despacho.`)) {
      return;
    }

    setIsSubmittingApproval(true);
    try {
      const updated = await apiClient<SalesOrder>(`/comercial/orders/${order.id}/generar-codigo-aris`, {
        method: 'POST',
      });

      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      showToast(`✅ Código Aris generado: ${updated.codigo_aris} para el pedido ${order.order_number}.`);
    } catch (err: any) {
      showToast(`❌ Error al generar código Aris: ${err.message || 'Error de conexión'}`);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // =========================================================================
  // GESTIÓN DE ACCIONES: OBSERVACIÓN DE PEDIDO
  // =========================================================================
  const handleOpenObservationModal = (order: SalesOrder) => {
    setObservingOrder(order);
    setObsReason(order.gestor_observation || '');
  };

  const handleConfirmObservation = async () => {
    if (!observingOrder) return;
    if (!obsReason.trim()) {
      showToast('⚠️ Debe ingresar el motivo u observación para devolver el pedido al vendedor.');
      return;
    }

    setIsSubmittingObs(true);
    try {
      const payload: OrderActionPayload = {
        observation: obsReason.trim(),
      };

      try {
        const updated = await apiClient<SalesOrder>(`/comercial/orders/${observingOrder.id}/observar`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setOrders((prev) => prev.map((o) => (o.id === observingOrder.id ? updated : o)));
        showToast(`📝 Pedido ${observingOrder.order_number} devuelto con observación al vendedor.`);
      } catch (err) {
        const updatedLocal: SalesOrder = {
          ...observingOrder,
          status: 'CON_OBSERVACION',
          gestor_username: user?.username || 'gestor_comercial',
          gestor_observation: obsReason.trim(),
          updated_at: new Date().toISOString(),
        };
        setOrders((prev) => prev.map((o) => (o.id === observingOrder.id ? updatedLocal : o)));
        showToast(`📝 Observación registrada para el pedido ${observingOrder.order_number}.`);
      }

      setObservingOrder(null);
    } catch (err: any) {
      showToast(`❌ Error al registrar observación: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSubmittingObs(false);
    }
  };

  // =========================================================================
  // IMPRESIÓN AISLADA LANDSCAPE DE HOJA DE PROGRAMACIÓN
  // =========================================================================
  const handlePrintTransportSheet = () => {
    const approvedOrdersToPrint = orders.filter((o) => o.status === 'APROBADO_RESERVADO');
    const filteredPrint = approvedOrdersToPrint.filter((o) =>
      matchesRange(orderDateKey(o, 'saca'), dateRange)
    );

    if (filteredPrint.length === 0) {
      showToast('⚠️ No hay pedidos aprobados para imprimir en esta fecha.');
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const fechaDespacho =
      dateRange.from || dateRange.to ? describeRange(dateFilter, dateRange) : 'CONSOLIDADO GENERAL';
    const fechaEmision = new Date().toLocaleDateString('es-PE') + ' ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

    let sumBirds = 0;
    let sumCages = 0;
    let sumKg = 0;

    const rowsHtml = filteredPrint
      .map((o, idx) => {
        const birds = o.allocated_quantity || o.requested_quantity || 0;
        const cages = o.estimated_cages || computeCages(birds, o.density_birds_per_cage);
        const avgW = (o.min_weight_kg + o.max_weight_kg) / 2.0;
        const kg = o.estimated_total_kg || birds * avgW;
        const tons = Math.round((kg / 1000) * 10) / 10;

        sumBirds += birds;
        sumCages += cages;
        sumKg += kg;

        const sex = o.sex_preference === 'MACHO' ? 'Macho' : o.sex_preference === 'HEMBRA' ? 'Hembra' : 'Indistinto';
        const weightRange = `${o.min_weight_kg.toFixed(2)} - ${o.max_weight_kg.toFixed(2)} kg`;
        const transportInfo = o.transport_assigned
          ? `<strong>${o.transport_plate}</strong> • Chofer: ${o.transport_driver_name} • Turno: ${o.transport_shift || 'Madrugada'}`
          : '<span style="color: #b91c1c; font-weight: bold;">PENDIENTE DESIGNACIÓN</span>';

        return `
        <tr>
          <td class="text-center font-bold font-mono" style="color: #64748b;">${idx + 1}</td>
          <td class="font-mono font-black" style="color: #0f172a; white-space: nowrap;">${o.order_number}</td>
          <td class="text-center font-mono" style="white-space: nowrap;">${formatDateDisplay(o.target_delivery_date)}</td>
          <td class="font-mono font-black" style="color: #047857; white-space: nowrap;">${o.assigned_farm_code || 'POR ASIGNAR'} &bull; ${o.assigned_barn_code || 'G-??'}</td>
          <td>
            <div class="font-bold" style="color: #0f172a;">${o.client_name}</div>
            <div style="font-size: 8.5px; color: #64748b;">Zona ${o.zone_code} ${o.client_tax_id ? `&bull; RUC: ${o.client_tax_id}` : ''}</div>
          </td>
          <td class="text-right font-mono font-black" style="font-size: 11px;">${birds.toLocaleString()}</td>
          <td class="text-right font-mono font-bold" style="color: #1d4ed8;">~${cages}</td>
          <td class="text-center font-bold" style="font-size: 9.5px;">${sex}</td>
          <td class="text-center font-mono" style="font-size: 9.5px; white-space: nowrap;">${weightRange}</td>
          <td class="text-right font-mono font-black" style="color: #047857;">${tons} Ton</td>
          <td style="font-size: 8.5px; color: #334155;">${transportInfo}</td>
        </tr>
      `;
      })
      .join('');

    const sumTons = Math.round((sumKg / 1000) * 10) / 10;
    const estTrucks = Math.ceil(sumCages / 450);

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Hoja de Programación Diaria y Transporte - ${fechaDespacho}</title>
          <style>
            @page {
              size: landscape;
              margin: 8mm 10mm 8mm 10mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              font-size: 9.5px;
              line-height: 1.3;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              padding: 0;
            }
            .header-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 6px;
              margin-bottom: 8px;
            }
            .brand {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .brand-badge {
              background: #dc2626 !important;
              color: #ffffff !important;
              font-weight: 900;
              font-size: 13px;
              padding: 4px 8px;
              border-radius: 4px;
              display: inline-block;
            }
            .brand-title {
              font-size: 14px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #0f172a;
            }
            .brand-subtitle {
              font-size: 9.5px;
              color: #475569;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .header-meta {
              text-align: right;
              font-family: monospace;
              font-size: 9px;
              color: #334155;
              line-height: 1.35;
            }
            .kpis {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 10px;
            }
            .kpi-card {
              background: #f8fafc !important;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 6px 10px;
            }
            .kpi-label {
              font-size: 8px;
              font-weight: 800;
              color: #64748b;
              text-transform: uppercase;
            }
            .kpi-value {
              font-size: 14px;
              font-weight: 900;
              font-family: monospace;
              color: #0f172a;
              margin: 1px 0;
            }
            .kpi-sub {
              font-size: 8px;
              color: #94a3b8;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 10px;
              font-size: 9px;
            }
            th {
              background: #f1f5f9 !important;
              color: #0f172a;
              font-weight: 900;
              text-transform: uppercase;
              font-size: 8px;
              border: 1px solid #94a3b8;
              padding: 4px 6px;
              white-space: nowrap;
            }
            td {
              border: 1px solid #cbd5e1;
              padding: 4px 6px;
              vertical-align: middle;
            }
            tr:nth-child(even) td {
              background: #f8fafc !important;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-mono { font-family: monospace, monospace; }
            .font-bold { font-weight: 700; }
            .font-black { font-weight: 900; }
            .signatures {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-top: 14px;
              padding-top: 8px;
              text-align: center;
              page-break-inside: avoid;
            }
            .sig-line {
              border-top: 1px solid #475569;
              margin: 24px 20px 4px 20px;
              font-weight: 800;
              font-size: 9px;
              color: #0f172a;
            }
            .sig-role {
              font-size: 8px;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div class="brand">
              <div class="brand-badge">GR</div>
              <div>
                <div class="brand-title">Avícola GR &bull; Grupo Rocío</div>
                <div class="brand-subtitle">Hoja de Programación Diaria y Manifiesto de Transporte</div>
              </div>
            </div>
            <div class="header-meta">
              <div><strong>FECHA DESPACHO:</strong> ${fechaDespacho}</div>
              <div><strong>EMISIÓN:</strong> ${fechaEmision}</div>
              <div><strong>SISTEMA:</strong> GESTIÓN COMERCIAL &amp; TRANSPORTE OFICIAL</div>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi-card">
              <div class="kpi-label">Aves Confirmadas</div>
              <div class="kpi-value">${sumBirds.toLocaleString()}</div>
              <div class="kpi-sub">${filteredPrint.length} pedidos formalmente aprobados</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Tonelaje Total</div>
              <div class="kpi-value" style="color: #047857;">${sumTons} Ton</div>
              <div class="kpi-sub">${Math.round(sumKg).toLocaleString()} kg aprox.</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Total Jaulas</div>
              <div class="kpi-value" style="color: #1d4ed8;">~${sumCages.toLocaleString()}</div>
              <div class="kpi-sub">Densidad definida por pedido</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Camiones Estimados</div>
              <div class="kpi-value" style="color: #b45309;">~${estTrucks} viaje(s)</div>
              <div class="kpi-sub">Capacidad ~450 jaulas / camión</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="text-center">Item</th>
                <th>N° Pedido</th>
                <th class="text-center">Fecha Saca</th>
                <th>Granja &amp; Galpón</th>
                <th>Cliente Destino &amp; Zona</th>
                <th class="text-right">Aves</th>
                <th class="text-right">Jaulas</th>
                <th class="text-center">Sexo</th>
                <th class="text-center">Rango Solicitado</th>
                <th class="text-right">Peso (Ton)</th>
                <th>Unidad de Transporte &amp; Turno</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="signatures">
            <div>
              <div class="sig-line">Gestor Comercial</div>
              <div class="sig-role">Autorización &amp; Asignación Saca</div>
            </div>
            <div>
              <div class="sig-line">Supervisor Transporte</div>
              <div class="sig-role">Programación de Flota &amp; Rampa</div>
            </div>
            <div>
              <div class="sig-line">Conductor / Cuadrilla Atrape</div>
              <div class="sig-role">Conformidad de Carga en Granja</div>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 2000);
    }, 250);
  };

  // =========================================================================
  // RENDERIZADO PRINCIPAL
  // =========================================================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HEADER DE MÓDULO & ACCIONES PRINCIPALES */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tight flex items-center gap-2.5">
            <Sliders className="w-7 h-7 text-red-600" />
            Gestión Comercial &amp; Asignación de Saca
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Recepción de pedidos generados por el área comercial, evaluación pecuaria de galpones, aprobación formal de saca y seguimiento sincronizado con Control de Flota.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="font-bold flex items-center gap-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-red-600' : ''}`} />
            <span>{refreshing ? 'Sincronizando...' : 'Actualizar'}</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5 TARJETAS KPIS TÁCTICAS DEL GESTOR (EN PEDIDOS Y DEMÁS VISTAS) */}
      {/* ========================================================================= */}
      {activeTab !== 'pecuaria' && (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Pendientes de Aprobación */}
        <div
          onClick={() => {
            setActiveTab('pedidos');
            setSelectedStatus('PENDIENTES_APROBACION');
          }}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            selectedStatus === 'PENDIENTES_APROBACION'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
            <span>Por Aprobar</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-950 dark:text-white mt-1">
            {metrics.pendingOk}
          </div>
          <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-0.5">
            {metrics.pendingOk > 0 ? 'Requieren revisión táctica' : 'Al día, sin pendientes'}
          </div>
        </div>

        {/* KPI 2: Con Observación */}
        <div
          onClick={() => {
            setActiveTab('pedidos');
            setSelectedStatus('CON_OBSERVACION');
          }}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            selectedStatus === 'CON_OBSERVACION'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 ring-2 ring-rose-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
            <span>Con Observación</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-950 dark:text-white mt-1">
            {metrics.observed}
          </div>
          <div className="text-[10px] text-rose-700 dark:text-rose-400 font-bold mt-0.5">
            Devueltos a vendedores
          </div>
        </div>

        {/* KPI 3: Aprobados / Reservados */}
        <div
          onClick={() => {
            setActiveTab('pedidos');
            setSelectedStatus('APROBADO_RESERVADO');
          }}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            selectedStatus === 'APROBADO_RESERVADO'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
            <span>Aprobados con Reserva</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
            {metrics.approvedTotal}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {metrics.totalBirdsApproved.toLocaleString()} aves reservadas
          </div>
        </div>

        {/* KPI 4: Esperando Control de Flota */}
        <div
          onClick={() => {
            setActiveTab('pedidos');
            setSelectedStatus('SIN_TRANSPORTE');
          }}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            selectedStatus === 'SIN_TRANSPORTE'
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
            <span>Sin Transporte (Flota)</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black font-mono text-blue-700 dark:text-blue-400 mt-1">
            {metrics.pendingTransport}
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">
            {metrics.assignedTransport} con unidad asignada
          </div>
        </div>

        {/* KPI 5: Tonelaje & Jaulas en Gestión */}
        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider">
            <span>Carga Total Aprobada</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-950 dark:text-white mt-1">
            {metrics.totalTonsApproved} Ton
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            ~{metrics.totalCagesApproved.toLocaleString()} jaulas estimadas
          </div>
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* TABS DE NAVEGACIÓN OPERATIVA */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('pecuaria')}
          className={`pb-3 px-3.5 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'pecuaria'
              ? 'border-red-600 text-red-600 dark:text-red-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Bird className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Saldos por Galpón</span>
        </button>

        <button
          onClick={() => setActiveTab('pedidos')}
          className={`pb-3 px-3.5 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'pedidos'
              ? 'border-red-600 text-red-600 dark:text-red-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4 shrink-0" />
          <span>Bandeja de Pedidos</span>
        </button>

        <button
          onClick={() => setActiveTab('clientes')}
          className={`pb-3 px-3.5 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'clientes'
              ? 'border-red-600 text-red-600 dark:text-red-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4 shrink-0" />
          <span>Clientes</span>
        </button>

        <button
          onClick={() => setActiveTab('mapa_gps')}
          className={`pb-3 px-3.5 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'mapa_gps'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Monitoreo GPS</span>
        </button>

        <button
          onClick={() => setActiveTab('roxi')}
          className={`pb-3 px-3.5 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'roxi'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Copiloto ROXI (IA)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: BANDEJA DE PEDIDOS ENTRANTES */}
      {/* ========================================================================= */}
      {activeTab === 'pedidos' && (
        <div className="space-y-4">
          {/* Banner Prominente de Acceso a ROXI Copilot */}
          <div className="p-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 rounded-2xl text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4 border border-indigo-800/60">
            <div className="flex items-center gap-3.5">
              <RoxiAvatar mood="saludando" size="md" className="shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm text-white tracking-wide">ROXI • Copiloto de Inteligencia Comercial</h3>
                </div>
                <p className="text-xs text-indigo-200 mt-0.5">
                  Optimiza la asignación de galpones, fletes viales reales (km) y rotación sanitaria (lotes &gt; 45 días) para los pedidos registrados.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setActiveTab('roxi')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-sm px-4 py-2 shrink-0 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>Abrir Centro de Control ROXI</span>
            </Button>
          </div>

          {/* Barra de Filtros y Búsqueda */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Buscador */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar N° pedido, cliente, RUC..."
                  className="pl-8 py-1.5 text-xs h-9"
                />
              </div>

              {/* Filtro Estado */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 h-9"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="PENDIENTES_APROBACION">⏳ Pendientes de Aprobación ({metrics.pendingOk})</option>
                <option value="CON_OBSERVACION">📝 Con Observación ({metrics.observed})</option>
                <option value="APROBADO_RESERVADO">✅ Aprobados con Reserva ({metrics.approvedTotal})</option>
                <option value="SIN_TRANSPORTE">🚚 Aprobados sin Transporte ({metrics.pendingTransport})</option>
                <option value="CON_TRANSPORTE">🚛 Con Transporte Asignado ({metrics.assignedTransport})</option>
              </select>

              {/* Filtro Fecha (criterio + rango) */}
              <OrderDateFilter value={dateFilter} onChange={setDateFilter} />

              {/* Filtro Zona */}
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 h-9"
              >
                <option value="ALL">Todas las Zonas</option>
                <option value="NORTE">Zona NORTE</option>
                <option value="CENTRO">Zona CENTRO</option>
                <option value="SUR">Zona SUR</option>
                <option value="METROPOLITANA">Zona METROPOLITANA</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-mono self-end md:self-center">
              Mostrando <strong>{filteredOrders.length}</strong> de {orders.length} pedidos
            </div>
          </div>

          {/* Tabla Principal del Gestor Comercial */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-3">N° Pedido</th>
                    <th className="py-3 px-3">Cliente &amp; Zona</th>
                    <th className="py-3 px-3 text-center">Fecha Saca</th>
                    <th className="py-3 px-3 text-right">Aves Solicitadas</th>
                    <th className="py-3 px-3 text-center">Sexo &amp; Rango Peso</th>
                    <th className="py-3 px-3">Galpón Origen</th>
                    <th className="py-3 px-3 text-center">Estado Programación</th>
                    <th className="py-3 px-3">Transporte Distribución</th>
                    <th className="py-3 px-3 text-center">Acciones Tácticas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                        No se encontraron pedidos que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const birds = order.allocated_quantity || order.requested_quantity || 0;
                      const cages = order.estimated_cages || computeCages(birds, order.density_birds_per_cage);
                      const avgW = (order.min_weight_kg + order.max_weight_kg) / 2.0;
                      const tons = order.estimated_total_kg
                        ? Math.round(order.estimated_total_kg / 100) / 10
                        : Math.round(((birds * avgW) / 1000) * 10) / 10;

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          {/* N° Pedido (texto limpio) */}
                          <td className="py-3 px-3 font-mono font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            <div>{order.order_number}</div>
                            {order.is_split_child && (
                              <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.2 rounded font-sans inline-block mt-0.5">
                                ✂️ Fraccionado
                              </span>
                            )}
                          </td>

                          {/* Cliente & Zona */}
                          <td className="py-3 px-3 min-w-[200px]">
                            <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
                              {order.client_name}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span className="font-medium">Zona {order.zone_code}</span>
                              {order.external_reference && <span>&bull; OC: {order.external_reference}</span>}
                            </div>
                            <div className="text-[9.5px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <span className="text-slate-400">Vendedor:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {resolveSellerFullName(order)}
                              </span>
                            </div>
                          </td>

                          {/* Fecha Saca */}
                          <td className="py-3 px-3 text-center font-mono whitespace-nowrap font-bold text-slate-800 dark:text-slate-200">
                            {formatDateDisplay(order.target_delivery_date)}
                          </td>

                          {/* Aves & Tonelaje */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <span className="font-mono font-black text-slate-950 dark:text-white block text-sm">
                              {birds.toLocaleString()} aves
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono block">
                              ~{cages} jlas &bull; {tons} Ton
                            </span>
                          </td>

                          {/* Sexo & Rango Solicitado */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="font-bold">
                              {order.sex_preference === 'MACHO' && <span className="text-blue-600 dark:text-blue-400">Macho</span>}
                              {order.sex_preference === 'HEMBRA' && <span className="text-rose-600 dark:text-rose-400">Hembra</span>}
                              {(!order.sex_preference || order.sex_preference === 'INDISTINTO') && (
                                <span className="text-slate-600 dark:text-slate-400">Indistinto</span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono font-bold text-slate-500">
                              {order.min_weight_kg.toFixed(2)} - {order.max_weight_kg.toFixed(2)} kg
                            </div>
                          </td>

                          {/* Galpón Origen */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {order.status === 'APROBADO_RESERVADO' ? (
                              <div>
                                <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 block text-xs">
                                  {order.assigned_farm_code} &bull; {order.assigned_barn_code}
                                </span>
                                <span className="text-[9.5px] text-emerald-600 dark:text-emerald-500 font-medium block">
                                  Reserva confirmada
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-mono text-slate-500 block text-xs">
                                  Sug: {order.suggested_farm_code || 'TRAD1'} ({order.suggested_barn_code || 'G-??'})
                                </span>
                                <span className="text-[9.5px] text-amber-600 dark:text-amber-500 font-medium block">
                                  Por confirmar
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Estado Programación (Texto limpio sin cards) */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {order.status === 'REGISTRADO' && (
                              <span className="font-bold text-amber-700 dark:text-amber-400 text-xs flex items-center justify-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                                Pendiente de Aprobación
                              </span>
                            )}
                            {order.status === 'APROBADO_RESERVADO' && (
                              <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                Aprobado
                              </span>
                            )}
                            {order.status === 'DESPACHADO' && (
                              <span className="font-bold text-sky-700 dark:text-sky-400 text-xs flex items-center justify-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-sky-500 inline-block"></span>
                                Despachado
                              </span>
                            )}
                            {order.status === 'CON_OBSERVACION' && (
                              <span className="font-bold text-rose-700 dark:text-rose-400 text-xs flex items-center justify-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                                Con observación
                              </span>
                            )}
                            {order.status === 'CANCELADO' && (
                              <span className="font-bold text-slate-500 text-xs">Cancelado</span>
                            )}
                          </td>

                          {/* Transporte de Distribución (asignado desde Control de Flota) */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {order.transport_assigned ? (
                              <div>
                                <div className="font-mono font-black text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{order.transport_plate}</span>
                                </div>
                                <div className="text-[9.5px] text-slate-500">
                                  {order.transport_driver_name} &bull; {order.transport_shift || 'Madrugada'}
                                </div>
                                {order.dispatch_phase && (
                                  <div className="text-[9.5px] font-bold text-sky-600 dark:text-sky-400 mt-0.5">
                                    {order.dispatch_phase === 'TRANSPORTE_ASIGNADO' && '📍 Asignado'}
                                    {order.dispatch_phase === 'EN_GRANJA_CARGANDO' && '⏳ En Granja / Cargando'}
                                    {order.dispatch_phase === 'EN_TRANSITO' && '🚚 En Tránsito'}
                                    {order.dispatch_phase === 'ENTREGADO_CONFORME' && '✅ Entregado Conforme'}
                                  </div>
                                )}
                              </div>
                            ) : order.status === 'APROBADO_RESERVADO' ? (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700 dark:text-amber-400">
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                <span>Pendiente Control de Flota</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Requiere aprobación previa</span>
                            )}
                          </td>

                          {/* Acciones Tácticas */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Botón Asistente ROXI */}
                              <Button
                                size="sm"
                                onClick={() => {
                                  setRoxiSelectedOrderId(order.id);
                                  setActiveTab('roxi');
                                }}
                                className="h-8 px-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-2xs flex items-center gap-1"
                                title="Evaluar galpón y flete óptimo con ROXI (IA)"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                                <span>ROXI</span>
                              </Button>

                              {/* Botón Aprobar */}
                              {order.status !== 'APROBADO_RESERVADO' && order.status !== 'DESPACHADO' && order.status !== 'CANCELADO' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenApprovalModal(order)}
                                  className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-2xs"
                                  title="Evaluar y Aprobar Reserva Formal"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                  Aprobar
                                </Button>
                              )}

                              {/* Botón Generar Código Aris (solo si está aprobado, con camión y sin Aris aún) */}
                              {order.status === 'APROBADO_RESERVADO' && order.transport_assigned && !order.codigo_aris && (
                                <Button
                                  size="sm"
                                  onClick={() => handleGenerarCodigoAris(order)}
                                  className="h-8 px-2.5 text-xs bg-violet-600 hover:bg-violet-700 text-white font-extrabold shadow-2xs"
                                  title="Generar Código Aris para confirmar el pedido"
                                >
                                  <Sparkles className="w-3.5 h-3.5 mr-1 text-yellow-300" />
                                  Generar Aris
                                </Button>
                              )}

                              {/* Mostrar código Aris si ya fue generado */}
                              {order.codigo_aris && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400 text-[11px] font-extrabold font-mono">
                                  <Sparkles className="w-3 h-3" />
                                  {order.codigo_aris}
                                </span>
                              )}

                              {/* Botón Observar */}
                              {order.status !== 'CANCELADO' && (
                                <button
                                  onClick={() => handleOpenObservationModal(order)}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                                  title="Devolver con Observación al Vendedor"
                                >
                                  <AlertCircle className="w-4 h-4" />
                                </button>
                              )}

                              {/* Ver detalle */}
                              <button
                                onClick={() => setDetailOrder(order)}
                                className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors"
                                title="Ver detalle completo"
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 1: SALDOS POR GALPÓN (PRIMERA VISTA DEL GESTOR COMERCIAL) */}
      {/* ========================================================================= */}
      {activeTab === 'pecuaria' && (
        <SaldosGalponPanel
          items={pecuariaItems}
          lastUpdated={pecuariaLastUpdated}
          refreshing={refreshing}
          onRefresh={() => fetchData(false)}
          onBarnClosed={(barnId) =>
            setPecuariaItems((prev) => prev.filter((item) => item.barn_id !== barnId))
          }
          onToast={showToast}
        />
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 5: MONITOREO GPS EN VIVO (OPENSTREETMAP) */}
      {/* ========================================================================= */}
      {activeTab === 'mapa_gps' && (
        <FlotaGpsMap readOnly={true} orders={orders} />
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA: CATÁLOGO DE CLIENTES */}
      {/* ========================================================================= */}
      {activeTab === 'clientes' && <ClientsPanel />}

      {/* ========================================================================= */}
      {/* PESTAÑA 6: CENTRO DE CONTROL & ASISTENTE INTELIGENTE ROXI */}
      {/* ========================================================================= */}
      {activeTab === 'roxi' && (
        <RoxiGestorDashboard
          orders={orders}
          pecuariaItems={pecuariaItems}
          selectedOrderId={roxiSelectedOrderId}
          onSelectOrder={(id) => setRoxiSelectedOrderId(id)}
          onApproveOrder={handleApproveOrderFromRoxi}
          isApproving={isSubmittingApproval}
          onNavigateToPedidos={() => setActiveTab('pedidos')}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: APROBACIÓN FORMAL Y RESERVA DE GALPÓN */}
      {/* ========================================================================= */}
      {approvingOrder && (
        <Modal
          isOpen={!!approvingOrder}
          onClose={() => setApprovingOrder(null)}
          title={`Aprobación Formal & Reserva de Saca — ${approvingOrder.order_number}`}
          size="xl"
        >
          <div className="space-y-4 text-xs">
            {/* Resumen del Pedido */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Cliente</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 block truncate">
                  {approvingOrder.client_name}
                </span>
                <span className="text-[10px] text-slate-500">Zona {approvingOrder.zone_code}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Fecha Solicitada</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block">
                  {formatDateDisplay(approvingOrder.target_delivery_date)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Cantidad Pedida</span>
                <span className="font-mono font-black text-slate-900 dark:text-slate-100 block text-sm">
                  {approvingOrder.requested_quantity.toLocaleString()} aves
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Rango &amp; Sexo</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block">
                  {approvingOrder.min_weight_kg.toFixed(2)} - {approvingOrder.max_weight_kg.toFixed(2)} kg
                </span>
                <span className="text-[10px] text-blue-600 font-bold">{approvingOrder.sex_preference || 'Indistinto'}</span>
              </div>
            </div>

            {/* Asistente Inteligente ROXI para el Gestor Comercial */}
            <RoxiCopilotCard
              payload={{
                client_name: approvingOrder.client_name,
                quantity_birds: approvingOrder.requested_quantity,
                sex: approvingOrder.sex_preference || 'INDISTINTO',
                min_weight: approvingOrder.min_weight_kg,
                max_weight: approvingOrder.max_weight_kg,
                zone_code: approvingOrder.zone_code || 'CENTRO',
                scheduled_date: approvingOrder.target_delivery_date,
              }}
              currentFarmCode={formFarmCode}
              currentBarnCode={formBarnCode}
              onApplyBarn={(farm, barn) => {
                setFormFarmCode(farm);
                setFormBarnCode(barn);
              }}
              userRole="gestor_comercial"
            />

            {/* Selector de Galpón y Validación Pecuaria */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 block">
                Selección de Granja y Galpón de Procedencia (Pecuaria)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Granja de Origen:
                  </label>
                  <select
                    value={formFarmCode}
                    onChange={(e) => setFormFarmCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                  >
                    <option value="TRAD1">Tradiciones 1 (TRAD1)</option>
                    <option value="TRAD2">Tradiciones 2 (TRAD2)</option>
                    <option value="PACI6">Pacífico 6 (PACI6)</option>
                    <option value="SISA1">Sausalito 1 (SISA1)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Galpón Específico:
                  </label>
                  <select
                    value={formBarnCode}
                    onChange={(e) => setFormBarnCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                  >
                    {pecuariaItems
                      .filter((b) => b.farm_code === formFarmCode)
                      .map((b) => (
                        <option key={b.barn_code} value={b.barn_code}>
                          {b.barn_code} &bull; {b.barn_balance_available.toLocaleString()} aves libres ({b.average_weight_kg?.toFixed(2) || '-'} kg)
                        </option>
                      ))}
                    {pecuariaItems.filter((b) => b.farm_code === formFarmCode).length === 0 && (
                      <option value="G-01">G-01 (Sin datos pecuarios)</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Ficha en vivo del Galpón seleccionado */}
              {selectedPecuariaBarn && (
                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl grid grid-cols-4 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-[9.5px] text-slate-500 uppercase font-sans block">Saldo Libre</span>
                    <span className="font-black text-emerald-800 dark:text-emerald-300 text-sm">
                      {selectedPecuariaBarn.barn_balance_available.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-slate-500 uppercase font-sans block">Peso Promedio</span>
                    <span className="font-black text-slate-900 dark:text-slate-100 text-sm">
                      {selectedPecuariaBarn.average_weight_kg ? `${selectedPecuariaBarn.average_weight_kg.toFixed(2)} kg` : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-slate-500 uppercase font-sans block">Edad Lote</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {selectedPecuariaBarn.bird_age_days} días
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-slate-500 uppercase font-sans block">Sexo Lote</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {selectedPecuariaBarn.sex}
                    </span>
                  </div>
                </div>
              )}

              {/* DETECCIÓN DE INCONSISTENCIAS PECUARIAS */}
              {isStockInsufficient && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black block">⚠️ Saldo insuficiente en el galpón:</span>
                    <span>
                      Dispone de <strong>{selectedPecuariaBarn?.barn_balance_available.toLocaleString()}</strong> aves
                      libres y se intentan reservar <strong>{formAllocatedQty.toLocaleString()}</strong>.
                      La aprobación será rechazada: ajusta la cantidad, elige otro galpón o divide el pedido.
                    </span>
                  </div>
                </div>
              )}

              {isWeightDeviated && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black block">⚠️ Desviación de Peso Objetivo:</span>
                    <span>
                      El galpón tiene un peso promedio de{' '}
                      <strong>{selectedPecuariaBarn?.average_weight_kg?.toFixed(2)} kg</strong>, el cual difiere
                      del rango requerido por el cliente ({approvingOrder.min_weight_kg.toFixed(2)} -{' '}
                      {approvingOrder.max_weight_kg.toFixed(2)} kg).
                    </span>
                  </div>
                </div>
              )}

              {/* Cantidad Formal a Reservar */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Cantidad de Aves Asignadas para Reserva:
                </label>
                <Input
                  type="number"
                  value={formAllocatedQty}
                  onChange={(e) => setFormAllocatedQty(Number(e.target.value))}
                  className="font-mono font-bold text-sm"
                />
              </div>

              {/* Densidad de carga (aves por jaula) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Densidad de Carga (Aves por Jaula):
                  </label>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    Rango {MIN_DENSITY}-{MAX_DENSITY}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <Input
                    type="number"
                    min={MIN_DENSITY}
                    max={MAX_DENSITY}
                    step="1"
                    value={formDensity}
                    onChange={(e) => setFormDensity(Number(e.target.value))}
                    className="font-mono font-bold text-sm"
                  />
                  <div className="text-center">
                    <span className="text-[9.5px] font-bold uppercase text-slate-500 block">Jaulas</span>
                    <span className="text-xs font-mono font-black text-red-600 dark:text-red-400">
                      {computeCages(formAllocatedQty, formDensity).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9.5px] font-bold uppercase text-slate-500 block">Kg / Jaula</span>
                    <span className="text-xs font-mono font-black text-slate-900 dark:text-slate-100">
                      {(
                        formDensity *
                        ((approvingOrder.min_weight_kg + approvingOrder.max_weight_kg) / 2)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
                  Sugerida según el peso del pedido; ajústela si hay razones operativas (clima, jaula o pedido del cliente).
                </p>
              </div>

              {/* MEJORA 5: Aprobación Parcial y Despacho Fraccionado (Split) */}
              {formAllocatedQty > 0 && formAllocatedQty < approvingOrder.requested_quantity && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900/60 space-y-2">
                  <div className="flex items-start gap-2">
                    <Scissors className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold text-indigo-950 dark:text-indigo-200 text-xs block">
                        Aprobación Parcial &amp; Fraccionamiento de Pedido (Split)
                      </span>
                      <p className="text-[11px] text-indigo-800 dark:text-indigo-300">
                        Aprobando <strong>{formAllocatedQty.toLocaleString()}</strong> de{' '}
                        <strong>{approvingOrder.requested_quantity.toLocaleString()} aves</strong> solicitadas.
                        El saldo pendiente es de{' '}
                        <strong>{(approvingOrder.requested_quantity - formAllocatedQty).toLocaleString()} aves</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-indigo-100 dark:border-indigo-900/40">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={formSplitRemaining}
                        onChange={(e) => setFormSplitRemaining(e.target.checked)}
                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Generar pedido en cola con el saldo restante</span>
                    </label>

                    {formSplitRemaining && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500">Fecha Próxima Saca:</span>
                        <input
                          type="date"
                          value={formSplitDate}
                          onChange={(e) => setFormSplitDate(e.target.value)}
                          className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg font-bold text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Observación del Gestor */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Observación de Autorización (Opcional):
                </label>
                <Input
                  value={formGestorObservation}
                  onChange={(e) => setFormGestorObservation(e.target.value)}
                  placeholder="Ej: Aprobado conforme. Galpón verificado en peso y disponibilidad para saca..."
                  className="text-xs"
                />
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button size="sm" variant="secondary" onClick={() => setApprovingOrder(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmApproval}
                disabled={isSubmittingApproval}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmittingApproval ? 'Autorizando...' : 'Aprobar y Reservar Saca'}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: OBSERVACIÓN DE PEDIDO (DEVOLVER A COMERCIAL) */}
      {/* ========================================================================= */}
      {observingOrder && (
        <Modal
          isOpen={!!observingOrder}
          onClose={() => setObservingOrder(null)}
          title={`Observar Pedido — ${observingOrder.order_number}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-800 dark:text-rose-300">
              <span className="font-black block">Devolución al Área Comercial:</span>
              <span className="text-[11px]">
                Indique claramente el motivo por el cual no se puede aprobar inmediatamente (ej. peso insuficiente, quiebre de stock en fecha, o propuesta de reprogramación).
              </span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Motivo / Instrucción de Ajuste para el Vendedor:
              </label>
              <textarea
                rows={3}
                value={obsReason}
                onChange={(e) => setObsReason(e.target.value)}
                placeholder="Ej: El galpón sugerido cuenta con peso promedio de 2.25 kg. Consultar al cliente si acepta rango 2.20 - 2.40 kg o mover fecha..."
                className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button size="sm" variant="secondary" onClick={() => setObservingOrder(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmObservation}
                disabled={isSubmittingObs}
                className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold flex items-center gap-1.5"
              >
                <AlertCircle className="w-4 h-4" />
                <span>{isSubmittingObs ? 'Guardando...' : 'Registrar Observación'}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DETALLE COMPLETO Y TRAZABILIDAD DE PEDIDO */}
      {/* ========================================================================= */}
      {detailOrder && (() => {
        const sellerFullName = resolveSellerFullName(detailOrder);
        const clientDetails = resolveClientDetails(detailOrder);
        const birds = detailOrder.allocated_quantity || detailOrder.requested_quantity || 0;
        const cages = detailOrder.estimated_cages || computeCages(birds, detailOrder.density_birds_per_cage);
        const avgW = (detailOrder.min_weight_kg + detailOrder.max_weight_kg) / 2.0;
        const totalKg = detailOrder.estimated_total_kg || birds * avgW;
        const tons = Math.round((totalKg / 1000) * 10) / 10;

        // Datos reales, sin placeholders
        const approvalEvent = (detailOrder.audit_log || []).find(
          (a) => a.action === 'APROBADO_RESERVADO'
        );
        const assignedFarm = detailOrder.assigned_farm_code || detailOrder.suggested_farm_code || null;
        const assignedBarn = detailOrder.assigned_barn_code || detailOrder.suggested_barn_code || null;
        const barnStock = assignedFarm && assignedBarn
          ? pecuariaItems.find((b) => b.farm_code === assignedFarm && b.barn_code === assignedBarn) || null
          : null;
        const reservedQty = detailOrder.allocated_quantity || detailOrder.requested_quantity;
        const stockCoversReservation = barnStock ? barnStock.barn_balance_available >= reservedQty : null;

        return (
          <Modal
            isOpen={!!detailOrder}
            onClose={() => {
              setDetailOrder(null);
              setDetailTab('resumen');
            }}
            title={`Detalle Oficial del Pedido — ${detailOrder.order_number}`}
            size="2xl"
          >
            <div className="space-y-4 text-xs max-h-[78vh] overflow-y-auto pr-1">
              {/* 1. CABECERA RESUMEN DEL PEDIDO */}
              <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-black text-base text-white tracking-wider">
                      {detailOrder.order_number}
                    </span>
                    {detailOrder.external_reference && (
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-mono text-[10px] font-bold">
                        OC: {detailOrder.external_reference}
                      </span>
                    )}
                    {detailOrder.is_split_child && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 text-[10px] font-bold">
                        ✂️ Saldo Fraccionado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    Cliente Receptor: <strong className="text-white">{detailOrder.client_name}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2.5 sm:text-right">
                  <div className="space-y-0.5 text-right font-mono text-[10.5px]">
                    <div className="text-slate-400">
                      Fecha Saca: <strong className="text-emerald-400">{formatDateDisplay(detailOrder.target_delivery_date)}</strong>
                    </div>
                    <div className="text-slate-400 text-[9.5px]">
                      Registro: {detailOrder.created_at ? new Date(detailOrder.created_at).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                      detailOrder.status === 'APROBADO_RESERVADO'
                        ? 'bg-emerald-500 text-white'
                        : detailOrder.status === 'DESPACHADO'
                        ? 'bg-sky-500 text-white'
                        : detailOrder.status === 'CON_OBSERVACION'
                        ? 'bg-rose-500 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    {detailOrder.status === 'APROBADO_RESERVADO' && 'Aprobado'}
                    {detailOrder.status === 'DESPACHADO' && 'Despachado'}
                    {detailOrder.status === 'CON_OBSERVACION' && 'Observado'}
                    {detailOrder.status === 'REGISTRADO' && 'Por Aprobar'}
                    {detailOrder.status === 'CANCELADO' && 'Cancelado'}
                  </span>
                </div>
              </div>

              {/* Pestañas del detalle */}
              <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-1">
                {([
                  { key: 'resumen', label: 'Resumen' },
                  { key: 'carga', label: 'Carga' },
                  { key: 'logistica', label: 'Asignación y Transporte' },
                  { key: 'auditoria', label: 'Auditoría' },
                ] as { key: DetailTab; label: string }[]).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setDetailTab(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors ${
                      detailTab === t.key
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* 2. GRID PRINCIPAL: VENDEDOR Y CLIENTE */}
              <div
                className={
                  detailTab === 'resumen'
                    ? 'grid grid-cols-1 md:grid-cols-2 gap-3.5'
                    : 'hidden'
                }
              >
                {/* TARJETA 1: VENDEDOR QUE INGRESÓ LA VENTA */}
                <div className="p-3.5 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                        Vendedor Responsable de la Venta
                      </span>
                      <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 block">
                        {sellerFullName}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px] pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Fecha y Hora de Ingreso:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                        {detailOrder.created_at
                          ? new Date(detailOrder.created_at).toLocaleString('es-PE')
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* TARJETA 2: CLIENTE SOLICITANTE */}
                <div className="p-3.5 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold shrink-0">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                        Cliente Solicitante (Comprador)
                      </span>
                      <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate block">
                        {detailOrder.client_name}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px] pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">RUC / Documento:</span>
                      <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                        {detailOrder.client_tax_id || 'Sin RUC registrado'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Zona Comercial:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        Zona {detailOrder.zone_code}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Punto / Dirección de Entrega:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 block text-[11px] leading-tight">
                        {clientDetails.address || 'No registrada'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-slate-500">Contacto / Teléfono:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                        {clientDetails.phone || 'No registrado'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. ESPECIFICACIONES TÉCNICAS Y VOLUMETRÍA DEL PEDIDO */}
              <div
                className={
                  detailTab === 'carga'
                    ? 'p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3'
                    : 'hidden'
                }
              >
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Detalle de la Carga &bull; Volumetría y Requisitos Comerciales
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-sans text-slate-500 block">Aves Solicitadas</span>
                    <span className="text-base font-black text-slate-900 dark:text-slate-100 block">
                      {detailOrder.requested_quantity.toLocaleString()}
                    </span>
                    <span className="text-[9.5px] text-slate-400 font-sans block">
                      {detailOrder.allocated_quantity > 0
                        ? `Asignadas: ${detailOrder.allocated_quantity.toLocaleString()}`
                        : 'Por autorizar'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-sans text-slate-500 block">Rango de Peso</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block">
                      {detailOrder.min_weight_kg.toFixed(2)} - {detailOrder.max_weight_kg.toFixed(2)} kg
                    </span>
                    <span className="text-[9.5px] text-slate-400 font-sans block">
                      Promedio: {avgW.toFixed(2)} kg/ave
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-sans text-slate-500 block">Volumen Jaulas</span>
                    <span className="text-base font-black text-blue-700 dark:text-blue-400 block">
                      ~{cages} jlas
                    </span>
                    <span className="text-[9.5px] text-slate-400 font-sans block">
                      {detailOrder.density_birds_per_cage || DEFAULT_DENSITY} aves/jaula
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-sans text-slate-500 block">Peso Total Estimado</span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-400 block">
                      {tons} Ton
                    </span>
                    <span className="text-[9.5px] text-slate-400 font-sans block">
                      ~{Math.round(totalKg).toLocaleString()} kg total
                    </span>
                  </div>
                </div>

                {/* Ajuste de Densidad de Carga */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                        Densidad de Carga (Aves por Jaula)
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {isDensityBlocked
                          ? 'Bloqueada: el despacho ya está en tránsito o entregado.'
                          : `Editable hasta antes del tránsito • rango ${MIN_DENSITY}-${MAX_DENSITY}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={MIN_DENSITY}
                        max={MAX_DENSITY}
                        step="1"
                        value={detailDensity}
                        onChange={(e) => setDetailDensity(Number(e.target.value))}
                        disabled={isDensityBlocked || isSavingDensity}
                        className="w-20 font-mono font-bold text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={handleUpdateDensity}
                        disabled={isDensityBlocked || isSavingDensity}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                      >
                        {isSavingDensity ? 'Guardando...' : 'Actualizar'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Preferencia de Sexo & Observaciones Comerciales */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">
                      Preferencia de Sexo Solicitada:
                    </span>
                    <div className="font-bold">
                      {detailOrder.sex_preference === 'MACHO' && (
                        <span className="text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md inline-block">
                          ♂ Solo Macho (Crecimiento y rendimiento superior)
                        </span>
                      )}
                      {detailOrder.sex_preference === 'HEMBRA' && (
                        <span className="text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-md inline-block">
                          ♀ Solo Hembra (Textura y peso medio de mesa)
                        </span>
                      )}
                      {(!detailOrder.sex_preference || detailOrder.sex_preference === 'INDISTINTO') && (
                        <span className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md inline-block">
                          ⚖️ Indistinto (Macho o Hembra según lote pecuario)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">
                      Instrucciones Comerciales del Pedido:
                    </span>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 italic">
                      &ldquo;{detailOrder.notes || 'Sin instrucciones adicionales registradas por Comercial.'}&rdquo;
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. ASIGNACIÓN PECUARIA & TRANSPORTE */}
              <div
                className={
                  detailTab === 'logistica'
                    ? 'grid grid-cols-1 md:grid-cols-2 gap-3.5'
                    : 'hidden'
                }
              >
                {/* Asignación Pecuaria */}
                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-900 dark:text-emerald-300 font-black uppercase tracking-wider">
                      Asignación Pecuaria &bull; Gestor Comercial
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                      {detailOrder.status === 'APROBADO_RESERVADO' ? 'Reserva Confirmada' : 'Orientativo'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-800 dark:text-slate-200">
                    {assignedFarm && assignedBarn ? (
                      <>
                        <strong>Granja:</strong> {assignedFarm} &bull; <strong>Galpón:</strong> {assignedBarn}
                        {!detailOrder.assigned_farm_code && (
                          <span className="ml-1 text-[10px] italic text-emerald-700 dark:text-emerald-400">(sugerido)</span>
                        )}
                      </>
                    ) : (
                      <span className="italic text-slate-500">Sin asignación</span>
                    )}
                  </div>

                  {barnStock && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      <strong>Saldo del galpón:</strong> {barnStock.barn_balance_available.toLocaleString()} aves
                      <span className={stockCoversReservation ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                        {' '}({stockCoversReservation ? 'cubre' : 'no cubre'} la reserva de {reservedQty.toLocaleString()})
                      </span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    <strong>Teléfono Balanza Granja:</strong> {detailOrder.farm_contact_phone || 'No registrado'}
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    <strong>Aprobado por:</strong>{' '}
                    {detailOrder.gestor_username || 'Sin aprobación registrada'}
                    {approvalEvent && (
                      <> &bull; {new Date(approvalEvent.timestamp).toLocaleString('es-PE')}</>
                    )}
                  </div>
                  {detailOrder.gestor_observation && (
                    <div className="pt-1 text-[11px] text-emerald-900 dark:text-emerald-300 italic border-t border-emerald-200/50 dark:border-emerald-900/50">
                      <strong>Dictamen:</strong> &ldquo;{detailOrder.gestor_observation}&rdquo;
                    </div>
                  )}
                </div>

                {/* Asignación Logística */}
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-blue-900 dark:text-blue-300 font-black uppercase tracking-wider">
                      Logística &bull; Transporte Distribución
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${detailOrder.transport_assigned ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-amber-100 text-amber-800'}`}>
                      {detailOrder.transport_assigned ? 'Unidad Asignada' : 'Pendiente'}
                    </span>
                  </div>
                  {detailOrder.transport_assigned ? (
                    <div className="space-y-1 text-xs text-slate-800 dark:text-slate-200">
                      <div>
                        <strong>Placa:</strong> {detailOrder.transport_plate} ({detailOrder.transport_model || 'Camión de Distribución'})
                      </div>
                      <div>
                        <strong>Conductor:</strong> {detailOrder.transport_driver_name}{' '}
                        {detailOrder.transport_driver_phone ? `(${detailOrder.transport_driver_phone})` : ''}
                      </div>
                      <div>
                        <strong>Cuadrilla:</strong> {detailOrder.transport_crew || 'Oficial'} &bull;{' '}
                        <strong>Turno:</strong> {detailOrder.transport_shift || 'Madrugada'}
                      </div>
                      {detailOrder.loading_slot_time && (
                        <div className="text-[10.5px] font-mono text-blue-700 dark:text-blue-300">
                          <strong>Ventana Balanza:</strong> {detailOrder.loading_slot_time}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500 italic text-[11px] block pt-1">
                      Unidad de transporte pendiente de asignación en el módulo Control de Flota.
                    </span>
                  )}
                </div>
              </div>

              {/* 5. CICLO DE VIDA DEL DESPACHO */}
              {detailOrder.transport_assigned && detailTab === 'logistica' && (
                <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">
                    Ciclo de Vida del Despacho (Tracking Telemático en Vivo)
                  </span>
                  <DispatchLifecycleStepper
                    currentPhase={detailOrder.dispatch_phase || 'TRANSPORTE_ASIGNADO'}
                    phaseUpdatedAt={detailOrder.dispatch_phase_updated_at}
                  />
                </div>
              )}

              {/* 6. HISTORIAL DE AUDITORÍA Y TRAZABILIDAD */}
              <div
                className={
                  detailTab === 'auditoria'
                    ? 'pt-2 border-t border-slate-100 dark:border-slate-800'
                    : 'hidden'
                }
              >
                <AuditTimeline auditLog={detailOrder.audit_log} />
              </div>

              {/* 7. BOTONES DE ACCIÓN */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  {detailOrder.status === 'REGISTRADO' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        const target = detailOrder;
                        setDetailOrder(null);
                        handleOpenApprovalModal(target);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-xs text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Aprobar pedido</span>
                    </Button>
                  )}

                  {detailOrder.transport_assigned && (
                    <Button
                      size="sm"
                      onClick={() => setRouteOrder(detailOrder)}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5 shadow-xs text-xs"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Ver ruta</span>
                    </Button>
                  )}

                  {detailOrder.transport_assigned && (
                    <Button
                      size="sm"
                      onClick={() => setWhatsappModalOrder(detailOrder)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-xs text-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5 fill-white" />
                      <span>Manifiesto WhatsApp</span>
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const summary = [
                        `Pedido: ${detailOrder.order_number}`,
                        `Cliente: ${detailOrder.client_name}`,
                        `Zona: ${detailOrder.zone_code}`,
                        `Fecha de saca: ${formatDateDisplay(detailOrder.target_delivery_date)}`,
                        `Aves solicitadas: ${detailOrder.requested_quantity.toLocaleString()}`,
                        `Aves asignadas: ${detailOrder.allocated_quantity.toLocaleString()}`,
                        `Rango de peso: ${detailOrder.min_weight_kg.toFixed(2)} - ${detailOrder.max_weight_kg.toFixed(2)} kg`,
                        `Densidad: ${detailOrder.density_birds_per_cage || DEFAULT_DENSITY} aves/jaula (~${cages} jaulas)`,
                        `Granja / Galpón: ${assignedFarm && assignedBarn ? `${assignedFarm} / ${assignedBarn}` : 'Sin asignar'}`,
                        `Transporte: ${detailOrder.transport_assigned ? `${detailOrder.transport_plate || ''} ${detailOrder.transport_driver_name || ''}`.trim() : 'Pendiente'}`,
                        `Estado: ${detailOrder.status}`,
                      ].join('\n');
                      navigator.clipboard
                        .writeText(summary)
                        .then(() => showToast('Resumen del pedido copiado.'))
                        .catch(() => showToast('No se pudo copiar el resumen.'));
                    }}
                    className="text-xs font-bold flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar resumen</span>
                  </Button>

                  <Button size="sm" variant="secondary" onClick={() => setDetailOrder(null)} className="text-xs font-bold">
                    Cerrar Detalle
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Seguimiento de ruta abierto desde el detalle del pedido */}
      {routeOrder && (
        <Modal
          isOpen={!!routeOrder}
          onClose={() => setRouteOrder(null)}
          title={`Ruta del Transporte — ${routeOrder.order_number}`}
          description={`${routeOrder.client_name} • ${routeOrder.transport_plate || 'Unidad asignada'}`}
          size="2xl"
        >
          <FlotaGpsMap
            initialSelectedTruckId={
              gpsSimulationStore.getTrucks().find((t) => t.orderId === routeOrder.order_number)?.id
            }
            readOnly={true}
            orders={orders}
          />
        </Modal>
      )}

      {/* MEJORA 3: Modal de Hoja de Ruta y Manifiesto WhatsApp para Chofer */}
      <WhatsAppManifestModal
        order={whatsappModalOrder}
        isOpen={!!whatsappModalOrder}
        onClose={() => setWhatsappModalOrder(null)}
      />
    </div>
  );
};
