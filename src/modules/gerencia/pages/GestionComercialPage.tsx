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
  UserCheck,
  MapPin,
  ShieldAlert,
  Sparkles,
  Bird,
  ChevronRight,
  Info,
  X,
  ArrowRight,
  Eye,
  Undo2,
  Phone,
  Layers,
  MessageSquare,
  Scissors,
  Link2,
  Building2,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { apiClient } from '@/lib/api';
import {
  SalesOrder,
  OrderStatus,
  SexPreference,
  TransportVehicle,
  AssignTransportPayload,
  OrderActionPayload,
  DispatchPhase,
} from '@/types/comercial';
import { TablaGeneralSaldoItem, generateInitialOfficialData } from '@/types/pecuaria';
import { FlotaGpsMap } from '../components/gps/FlotaGpsMap';
import { gpsSimulationStore } from '../components/gps/gpsSimulationStore';
import { DispatchLifecycleStepper } from '../components/dispatch/DispatchLifecycleStepper';
import { DispatchPhasePipeline } from '../components/dispatch/DispatchPhasePipeline';
import { WhatsAppManifestModal } from '../components/dispatch/WhatsAppManifestModal';
import { ConsolidationCubicajeBar } from '../components/dispatch/ConsolidationCubicajeBar';
import { AuditTimeline } from '../components/audit/AuditTimeline';
import { RoxiCopilotCard } from '@/components/roxi/RoxiCopilotCard';
import { RoxiAvatar } from '@/components/roxi/RoxiAvatar';
import { RoxiGestorDashboard } from '@/components/roxi/RoxiGestorDashboard';

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

// Resuelve el nombre real completo del vendedor que capturó la venta
export const resolveSellerFullName = (order?: SalesOrder | null): string => {
  if (!order) return '-';
  if (order.seller_full_name && order.seller_full_name.trim() !== '') {
    return order.seller_full_name;
  }
  const u = (order.seller_username || '').toLowerCase();
  if (u === 'areacomercial1') return 'Felipe';
  if (u === 'vendedor1' || u === 'vendedor') return 'Juan Carlos Pérez Gálvez';
  if (u === 'vendedor2') return 'María Elena Rodríguez Soto';
  if (u === 'admin') return 'Administrador General';
  return u.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Felipe';
};

// Resuelve el cargo y especialidad comercial del vendedor
export const resolveSellerRole = (order?: SalesOrder | null): string => {
  const u = (order?.seller_username || '').toLowerCase();
  if (u === 'areacomercial1') return 'Vendedor Comercial • Área Comercial';
  if (u === 'vendedor2') return 'Ejecutiva Comercial • Canal Retail & Supermercados';
  return 'Ejecutivo Comercial Senior • Canal Mayoristas & Avícolas';
};

// Resuelve detalles completos del cliente solicitante
export const resolveClientDetails = (order?: SalesOrder | null) => {
  if (!order) return { address: '-', phone: '-', contact: '-' };
  const meta = order.client_id ? KNOWN_CLIENTS_METADATA[order.client_id] : null;
  return {
    address: order.delivery_address || meta?.address || `Punto de entrega en Zona ${order.zone_code}`,
    phone: meta?.phone || '+51 987 654 321',
    contact: meta?.contact || 'Área de Compras y Recepción',
  };
};

export const GestionComercialPage: React.FC = () => {
  const { user } = useAuth();

  // =========================================================================
  // ESTADOS PRINCIPALES
  // =========================================================================
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [pecuariaItems, setPecuariaItems] = useState<TablaGeneralSaldoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pestaña activa
  const [activeTab, setActiveTab] = useState<'pedidos' | 'despacho' | 'flota' | 'pecuaria' | 'mapa_gps' | 'roxi'>('pedidos');
  const [selectedGpsTruckId, setSelectedGpsTruckId] = useState<string>('VH-001');
  const [roxiSelectedOrderId, setRoxiSelectedOrderId] = useState<string>('');

  // Filtros
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modales
  const [approvingOrder, setApprovingOrder] = useState<SalesOrder | null>(null);
  const [observingOrder, setObservingOrder] = useState<SalesOrder | null>(null);
  const [transportingOrder, setTransportingOrder] = useState<SalesOrder | null>(null);
  const [detailOrder, setDetailOrder] = useState<SalesOrder | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [whatsappModalOrder, setWhatsappModalOrder] = useState<SalesOrder | null>(null);

  // Estados de formulario de Aprobación Formal y Split
  const [formFarmCode, setFormFarmCode] = useState<string>('TRAD1');
  const [formBarnCode, setFormBarnCode] = useState<string>('G-01');
  const [formAllocatedQty, setFormAllocatedQty] = useState<number>(0);
  const [formGestorObservation, setFormGestorObservation] = useState<string>('');
  const [formSplitRemaining, setFormSplitRemaining] = useState<boolean>(true);
  const [formSplitDate, setFormSplitDate] = useState<string>('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState<boolean>(false);

  // Estados de formulario de Observación
  const [obsReason, setObsReason] = useState<string>('');
  const [isSubmittingObs, setIsSubmittingObs] = useState<boolean>(false);

  // Estados de formulario de Asignación de Transporte y Slotting
  const [transportVehicleId, setTransportVehicleId] = useState<string>('');
  const [transportShift, setTransportShift] = useState<string>('MADRUGADA');
  const [transportLoadingSlot, setTransportLoadingSlot] = useState<string>('03:00 - 05:00 hrs');
  const [transportDriverName, setTransportDriverName] = useState<string>('');
  const [transportDriverPhone, setTransportDriverPhone] = useState<string>('');
  const [transportCrewName, setTransportCrewName] = useState<string>('');
  const [transportNotes, setTransportNotes] = useState<string>('');
  const [isSubmittingTransport, setIsSubmittingTransport] = useState<boolean>(false);

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
  const fetchData = async () => {
    setRefreshing(true);
    try {
      // 1. Cargar Pedidos Comerciales
      try {
        const ordersData = await apiClient<SalesOrder[]>('/comercial/orders');
        if (Array.isArray(ordersData)) {
          setOrders(ordersData);
          localStorage.setItem('avicola_comercial_orders', JSON.stringify(ordersData));
        }
      } catch (err) {
        console.warn('Fallback a pedidos locales:', err);
        const stored = localStorage.getItem('avicola_comercial_orders');
        if (stored) {
          try {
            setOrders(JSON.parse(stored));
          } catch {}
        }
      }

      // 2. Cargar Flota de Transporte de Distribución
      try {
        const vehiclesData = await apiClient<TransportVehicle[]>('/comercial/transport/vehicles');
        if (Array.isArray(vehiclesData) && vehiclesData.length > 0) {
          setVehicles(vehiclesData);
        }
      } catch (err) {
        console.warn('Fallback a flota predeterminada:', err);
        // Fallback a flota estándar de distribución
        setVehicles([
          {
            id: 'VH-001',
            plate: 'T8C-940',
            model: 'Camión Baranda 3 Ejes',
            capacity_cages: 450,
            capacity_birds: 3600,
            driver_name: 'Carlos Méndez Rojas',
            driver_phone: '+51 984 123 456',
            default_crew: 'Cuadrilla Norte 1',
            zone_coverage: ['NORTE', 'CENTRO', 'METROPOLITANA'],
            status: 'DISPONIBLE',
          },
          {
            id: 'VH-002',
            plate: 'V6B-821',
            model: 'Camión Plataforma 2 Ejes',
            capacity_cages: 350,
            capacity_birds: 2800,
            driver_name: 'José Luis Quispe',
            driver_phone: '+51 992 345 678',
            default_crew: 'Cuadrilla Centro 2',
            zone_coverage: ['CENTRO', 'METROPOLITANA'],
            status: 'DISPONIBLE',
          },
          {
            id: 'VH-003',
            plate: 'W5A-712',
            model: 'Semirremolque Jaulero Pesado',
            capacity_cages: 650,
            capacity_birds: 5200,
            driver_name: 'Manuel Rodríguez Ramos',
            driver_phone: '+51 977 456 789',
            default_crew: 'Cuadrilla Pesada Alpha',
            zone_coverage: ['NORTE', 'SUR', 'CENTRO', 'METROPOLITANA'],
            status: 'DISPONIBLE',
          },
          {
            id: 'VH-004',
            plate: 'F4K-915',
            model: 'Camión Baranda 3 Ejes',
            capacity_cages: 450,
            capacity_birds: 3600,
            driver_name: 'Roberto Sánchez Díaz',
            driver_phone: '+51 981 567 890',
            default_crew: 'Cuadrilla Sur 1',
            zone_coverage: ['SUR', 'METROPOLITANA'],
            status: 'DISPONIBLE',
          },
          {
            id: 'VH-005',
            plate: 'B7Z-330',
            model: 'Camión Mediano 2 Ejes',
            capacity_cages: 300,
            capacity_birds: 2400,
            driver_name: 'David Paredes Vega',
            driver_phone: '+51 965 678 901',
            default_crew: 'Cuadrilla Express',
            zone_coverage: ['NORTE', 'CENTRO'],
            status: 'DISPONIBLE',
          },
          {
            id: 'VH-006',
            plate: 'D9X-504',
            model: 'Semirremolque Jaulero 4 Ejes',
            capacity_cages: 600,
            capacity_birds: 4800,
            driver_name: 'Hugo Alarcón Castro',
            driver_phone: '+51 953 789 012',
            default_crew: 'Cuadrilla Pesada Beta',
            zone_coverage: ['NORTE', 'SUR', 'CENTRO', 'METROPOLITANA'],
            status: 'DISPONIBLE',
          },
        ]);
      }

      // 3. Cargar Balance de Saldo de Pecuaria
      try {
        const pecuariaData = await apiClient<any>('/pecuaria/tabla-general-saldo');
        const rawList = pecuariaData?.data || pecuariaData?.items;
        if (Array.isArray(rawList) && rawList.length > 0) {
          setPecuariaItems(rawList);
        } else {
          const stored = localStorage.getItem('avicola_pecuaria_table_items');
          if (stored) {
            setPecuariaItems(JSON.parse(stored));
          } else {
            setPecuariaItems(generateInitialOfficialData());
          }
        }
      } catch (err) {
        console.warn('Fallback a pecuaria local:', err);
        const stored = localStorage.getItem('avicola_pecuaria_table_items');
        if (stored) {
          try {
            setPecuariaItems(JSON.parse(stored));
          } catch {}
        } else {
          setPecuariaItems(generateInitialOfficialData());
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    gpsSimulationStore.syncOrders(orders);
  }, [orders]);

  // Sincronización telemática automática en tiempo real: Ciclo de vida del despacho con la marcha GPS
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

          // Determinar la fase en base al avance telemático real de la unidad en la carretera
          let targetPhase: DispatchPhase = 'TRANSPORTE_ASIGNADO';
          if (matchedTruck.progressPercent >= 100) {
            targetPhase = 'ENTREGADO_CONFORME';
          } else if (matchedTruck.progressPercent > 0) {
            targetPhase = 'EN_TRANSITO';
          } else {
            targetPhase = 'EN_GRANJA_CARGANDO';
          }

          if (order.dispatch_phase !== targetPhase) {
            hasChanges = true;
            // Sincronizar en segundo plano con el backend
            apiClient<SalesOrder>(`/comercial/orders/${order.id}/dispatch-phase`, {
              method: 'PATCH',
              body: JSON.stringify({ dispatch_phase: targetPhase }),
            }).catch(() => {
              // Silencioso en modo offline o desarrollo
            });

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

      // Sincronizar también el modal de detalle si se encuentra abierto
      setDetailOrder((prev) => {
        if (!prev || !prev.transport_assigned) return prev;
        const matched = trucks.find(
          (t) =>
            t.id === prev.transport_truck_id ||
            (prev.transport_plate && t.plate.toLowerCase() === prev.transport_plate.toLowerCase())
        );
        if (!matched) return prev;

        let targetPhase: DispatchPhase = 'TRANSPORTE_ASIGNADO';
        if (matched.progressPercent >= 100) {
          targetPhase = 'ENTREGADO_CONFORME';
        } else if (matched.progressPercent > 0) {
          targetPhase = 'EN_TRANSITO';
        } else {
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
      const cages = o.estimated_cages || Math.ceil(birds / 8);
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

      // Filtro por fecha
      if (selectedDate !== 'ALL' && o.target_delivery_date !== selectedDate) return false;

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
  }, [orders, selectedStatus, selectedDate, selectedZone, searchQuery]);

  // Pedidos aprobados o despachados que requieren o ya tienen transporte (para la pestaña Despacho)
  const dispatchOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === 'APROBADO_RESERVADO' || o.status === 'DESPACHADO')
      .filter((o) => (selectedDate === 'ALL' ? true : o.target_delivery_date === selectedDate))
      .filter((o) => (selectedZone === 'ALL' ? true : o.zone_code === selectedZone))
      .filter((o) => {
        if (selectedPhaseFilter === 'ALL') return true;
        const currentPhase = o.dispatch_phase || (o.transport_assigned ? 'TRANSPORTE_ASIGNADO' : 'PENDIENTE');
        return currentPhase === selectedPhaseFilter;
      });
  }, [orders, selectedDate, selectedZone, selectedPhaseFilter]);

  // =========================================================================
  // GESTIÓN DE ACCIONES: APROBACIÓN FORMAL Y RESERVA DE GALPÓN
  // =========================================================================
  const handleOpenApprovalModal = (order: SalesOrder) => {
    setApprovingOrder(order);
    setFormFarmCode(order.suggested_farm_code || 'TRAD1');
    setFormBarnCode(order.suggested_barn_code || 'G-01');
    setFormAllocatedQty(order.requested_quantity);
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

    setIsSubmittingApproval(true);
    try {
      const isSplit = formAllocatedQty < approvingOrder.requested_quantity && formSplitRemaining;
      const payload: OrderActionPayload = {
        farm_code: formFarmCode,
        barn_code: formBarnCode,
        allocated_quantity: formAllocatedQty,
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
        // Fallback local
        const remaining = approvingOrder.requested_quantity - formAllocatedQty;
        const updatedLocal: SalesOrder = {
          ...approvingOrder,
          status: 'APROBADO_RESERVADO',
          assigned_farm_code: formFarmCode,
          assigned_barn_code: formBarnCode,
          allocated_quantity: formAllocatedQty,
          is_split_parent: isSplit,
          original_requested_quantity: isSplit ? approvingOrder.requested_quantity : undefined,
          gestor_username: user?.username || 'gestor_comercial',
          gestor_observation: payload.observation,
          updated_at: new Date().toISOString(),
        };

        if (isSplit) {
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
          setOrders((prev) => [childOrder, ...prev.map((o) => (o.id === approvingOrder.id ? updatedLocal : o))]);
          showToast(`✂️ Pedido ${approvingOrder.order_number} aprobado parcialmente (${formAllocatedQty.toLocaleString()} aves). Saldo en nueva orden.`);
        } else {
          setOrders((prev) => prev.map((o) => (o.id === approvingOrder.id ? updatedLocal : o)));
          showToast(`✅ Pedido ${approvingOrder.order_number} aprobado localmente con éxito.`);
        }
      }

      setApprovingOrder(null);
    } catch (err: any) {
      showToast(`❌ Error al aprobar pedido: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleApproveOrderFromRoxi = async (order: SalesOrder, farmCode: string, barnCode: string) => {
    setIsSubmittingApproval(true);
    try {
      const payload: OrderActionPayload = {
        farm_code: farmCode,
        barn_code: barnCode,
        allocated_quantity: order.requested_quantity,
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
  // GESTIÓN DE ACCIONES: DESIGNACIÓN DE TRANSPORTE (ÁREA DE DISTRIBUCIÓN)
  // =========================================================================
  const handleOpenTransportModal = (order: SalesOrder) => {
    setTransportingOrder(order);
    // Seleccionar vehículo por defecto (o el ya asignado)
    const existingVehicle = vehicles.find((v) => v.id === order.transport_truck_id || v.plate === order.transport_plate);
    const defaultVehicle = existingVehicle || vehicles[0];

    if (defaultVehicle) {
      setTransportVehicleId(defaultVehicle.id);
      setTransportDriverName(order.transport_driver_name || defaultVehicle.driver_name);
      setTransportDriverPhone(order.transport_driver_phone || defaultVehicle.driver_phone || '');
      setTransportCrewName(order.transport_crew || defaultVehicle.default_crew || 'Cuadrilla Oficial');
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

  // Vehículo actualmente seleccionado en el modal
  const selectedTransportVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === transportVehicleId);
  }, [vehicles, transportVehicleId]);

  // Inconsistencia Logística 1: Sobrecapacidad de Jaulas
  const transportCagesNeeded = useMemo(() => {
    if (!transportingOrder) return 0;
    const birds = transportingOrder.allocated_quantity || transportingOrder.requested_quantity || 0;
    return transportingOrder.estimated_cages || Math.ceil(birds / 8);
  }, [transportingOrder]);

  const isVehicleOvercapacity = useMemo(() => {
    if (!selectedTransportVehicle) return false;
    return transportCagesNeeded > selectedTransportVehicle.capacity_cages;
  }, [selectedTransportVehicle, transportCagesNeeded]);

  // Inconsistencia Logística 2: Zona fuera de cobertura habitual
  const isZoneMismatch = useMemo(() => {
    if (!selectedTransportVehicle || !transportingOrder) return false;
    if (selectedTransportVehicle.zone_coverage.includes('TODAS')) return false;
    return !selectedTransportVehicle.zone_coverage.includes(transportingOrder.zone_code);
  }, [selectedTransportVehicle, transportingOrder]);

  const handleConfirmTransport = async () => {
    if (!transportingOrder || !selectedTransportVehicle) return;

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

      try {
        const updated = await apiClient<SalesOrder>(`/comercial/orders/${transportingOrder.id}/assign-transport`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setOrders((prev) => prev.map((o) => (o.id === transportingOrder.id ? updated : o)));
        showToast(`🚚 Transporte asignado: Camión ${payload.plate} • Chofer: ${payload.driver_name} (${transportShift}).`);
      } catch (err) {
        // Fallback local
        const updatedLocal: SalesOrder = {
          ...transportingOrder,
          transport_assigned: true,
          transport_truck_id: selectedTransportVehicle.id,
          transport_plate: payload.plate,
          transport_model: selectedTransportVehicle.model,
          transport_driver_name: payload.driver_name,
          transport_driver_phone: payload.driver_phone,
          transport_crew: payload.crew_name,
          transport_shift: payload.shift,
          loading_slot_time: payload.loading_slot_time,
          transport_capacity_cages: selectedTransportVehicle.capacity_cages,
          transport_notes: payload.transport_notes,
          transport_assigned_at: new Date().toISOString(),
          transport_assigned_by: user?.username || 'gestor_comercial',
          dispatch_phase: 'TRANSPORTE_ASIGNADO',
          dispatch_phase_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setOrders((prev) => prev.map((o) => (o.id === transportingOrder.id ? updatedLocal : o)));
        showToast(`🚚 Transporte asignado localmente al pedido ${transportingOrder.order_number}.`);
      }

      setTransportingOrder(null);
    } catch (err: any) {
      showToast(`❌ Error al designar transporte: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSubmittingTransport(false);
    }
  };

  const handleUnassignTransport = async (order: SalesOrder) => {
    if (!window.confirm(`¿Está seguro de liberar la unidad de transporte del pedido ${order.order_number}?`)) {
      return;
    }
    try {
      try {
        const updated = await apiClient<SalesOrder>(`/comercial/orders/${order.id}/unassign-transport`, {
          method: 'POST',
        });
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
      } catch {
        const updatedLocal: SalesOrder = {
          ...order,
          transport_assigned: false,
          transport_truck_id: undefined,
          transport_plate: undefined,
          transport_model: undefined,
          transport_driver_name: undefined,
          transport_driver_phone: undefined,
          transport_crew: undefined,
          transport_shift: undefined,
          transport_capacity_cages: undefined,
          transport_notes: undefined,
          dispatch_phase: undefined,
          dispatch_phase_updated_at: undefined,
          updated_at: new Date().toISOString(),
        };
        setOrders((prev) => prev.map((o) => (o.id === order.id ? updatedLocal : o)));
      }
      showToast(`ℹ️ Transporte liberado para el pedido ${order.order_number}.`);
    } catch (err: any) {
      showToast(`❌ Error al liberar transporte: ${err.message}`);
    }
  };

  const handleUpdateDispatchPhase = async (order: SalesOrder, newPhase: DispatchPhase) => {
    const nowStr = new Date().toISOString();
    const phaseNames: Record<DispatchPhase, string> = {
      TRANSPORTE_ASIGNADO: 'Transporte Asignado',
      EN_GRANJA_CARGANDO: 'En Granja / Cargando Aves',
      EN_TRANSITO: 'En Tránsito Carretera',
      ENTREGADO_CONFORME: 'Entregado / Conforme en Destino',
    };

    // Actualización optimista inmediata
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
    showToast(`🚚 ${order.order_number}: Fase actualizada a "${phaseNames[newPhase]}".`);

    // Sincronizar con el simulador GPS si corresponde
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
    } catch (err) {
      console.warn('Fallback local al actualizar fase de despacho:', err);
    }
  };

  // =========================================================================
  // IMPRESIÓN AISLADA LANDSCAPE DE HOJA DE PROGRAMACIÓN
  // =========================================================================
  const handlePrintTransportSheet = () => {
    const approvedOrdersToPrint = orders.filter((o) => o.status === 'APROBADO_RESERVADO');
    const filteredPrint = approvedOrdersToPrint.filter((o) => (selectedDate === 'ALL' ? true : o.target_delivery_date === selectedDate));

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

    const fechaDespacho = selectedDate === 'ALL' ? 'CONSOLIDADO GENERAL' : formatDateDisplay(selectedDate);
    const fechaEmision = new Date().toLocaleDateString('es-PE') + ' ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

    let sumBirds = 0;
    let sumCages = 0;
    let sumKg = 0;

    const rowsHtml = filteredPrint
      .map((o, idx) => {
        const birds = o.allocated_quantity || o.requested_quantity || 0;
        const cages = o.estimated_cages || Math.ceil(birds / 8);
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
              <div class="kpi-sub">Estándar ~8 aves / jaula</div>
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
            Recepción de pedidos generados por el área comercial, evaluación pecuaria de galpones, aprobación formal de saca y designación de unidades de transporte de distribución.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchData}
            disabled={refreshing}
            className="font-bold flex items-center gap-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-red-600' : ''}`} />
            <span>{refreshing ? 'Sincronizando...' : 'Actualizar'}</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5 TARJETAS KPIS TÁCTICAS DEL GESTOR */}
      {/* ========================================================================= */}
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

        {/* KPI 4: Pendientes de Transporte */}
        <div
          onClick={() => {
            setActiveTab('despacho');
            setSelectedStatus('SIN_TRANSPORTE');
          }}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            selectedStatus === 'SIN_TRANSPORTE'
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-black uppercase tracking-wider">
            <span>Pendientes Transporte</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black font-mono text-blue-700 dark:text-blue-400 mt-1">
            {metrics.pendingTransport}
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">
            {metrics.assignedTransport} unidades ya asignadas
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

      {/* ========================================================================= */}
      {/* TABS DE NAVEGACIÓN OPERATIVA */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 text-xs font-bold overflow-x-auto">
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
          onClick={() => setActiveTab('despacho')}
          className={`pb-3 px-3.5 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'despacho'
              ? 'border-red-600 text-red-600 dark:text-red-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4 shrink-0" />
          <span>Asignación de Transporte</span>
        </button>

        <button
          onClick={() => setActiveTab('flota')}
          className={`pb-3 px-3.5 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'flota'
              ? 'border-red-600 text-red-600 dark:text-red-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Flota de Distribución</span>
        </button>

        <button
          onClick={() => setActiveTab('pecuaria')}
          className={`pb-3 px-3.5 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'pecuaria'
              ? 'border-red-600 text-red-600 dark:text-red-400 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Bird className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Oferta Pecuaria</span>
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

              {/* Filtro Fecha */}
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 h-9"
              >
                <option value="ALL">Todas las Fechas de Saca</option>
                {uniqueDates.map((d) => (
                  <option key={d} value={d}>
                    {formatDateDisplay(d)}
                  </option>
                ))}
              </select>

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
                      const cages = order.estimated_cages || Math.ceil(birds / 8);
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

                          {/* Transporte de Distribución */}
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
                              <button
                                onClick={() => handleOpenTransportModal(order)}
                                className="text-[11px] font-extrabold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>+ Designar Transporte</span>
                              </button>
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
                              {order.status !== 'APROBADO_RESERVADO' && order.status !== 'CANCELADO' && (
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

                              {/* Botón Asignar / Cambiar Transporte */}
                              {order.status === 'APROBADO_RESERVADO' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenTransportModal(order)}
                                  className="h-8 px-2.5 text-xs font-bold text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900 hover:bg-blue-50"
                                  title={order.transport_assigned ? 'Modificar asignación de transporte' : 'Designar camión de distribución'}
                                >
                                  <Truck className="w-3.5 h-3.5 mr-1 text-blue-600" />
                                  {order.transport_assigned ? 'Reasignar' : 'Transporte'}
                                </Button>
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
      {/* PESTAÑA 2: ASIGNACIÓN DE TRANSPORTE Y DESPACHO DE DISTRIBUCIÓN */}
      {/* ========================================================================= */}
      {activeTab === 'despacho' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Despacho de Saca &amp; Flota de Distribución
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Designación de camiones, conductores y cuadrillas para pedidos formalmente aprobados con reserva.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Fecha Despacho:</span>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
              >
                <option value="ALL">Todas las Fechas</option>
                {uniqueDates.map((d) => (
                  <option key={d} value={d}>
                    {formatDateDisplay(d)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* PIPELINE DEL CICLO DE VIDA DEL DESPACHO (TRACKING DE 4 FASES) */}
          <DispatchPhasePipeline
            orders={orders}
            selectedPhaseFilter={selectedPhaseFilter}
            onSelectPhaseFilter={setSelectedPhaseFilter}
          />

          {/* Tarjetas de Despacho y Asignación Rápida */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dispatchOrders.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 italic bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                No hay pedidos aprobados para la fecha seleccionada.
              </div>
            ) : (
              dispatchOrders.map((order) => {
                const birds = order.allocated_quantity || order.requested_quantity || 0;
                const cages = order.estimated_cages || Math.ceil(birds / 8);
                const avgW = (order.min_weight_kg + order.max_weight_kg) / 2.0;
                const tons = order.estimated_total_kg
                  ? Math.round(order.estimated_total_kg / 100) / 10
                  : Math.round(((birds * avgW) / 1000) * 10) / 10;

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
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          order.transport_assigned
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {order.transport_assigned ? '🚚 Unidad Asignada' : '⚠️ Sin Transporte'}
                      </span>
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

                      {/* Info de Transporte Asignado si existe */}
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
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 pt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Slot Balanza: {order.loading_slot_time || '03:00 - 05:00 hrs'}</span>
                          </div>
                          {orders.some((o) => o.id !== order.id && o.transport_assigned && o.transport_plate === order.transport_plate && o.target_delivery_date === order.target_delivery_date) && (
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

                      {/* Barra de Estado Telemática de 4 Fases (Ciclo de Vida) */}
                      {order.transport_assigned && (
                        <DispatchLifecycleStepper
                          currentPhase={order.dispatch_phase || 'TRANSPORTE_ASIGNADO'}
                          phaseUpdatedAt={order.dispatch_phase_updated_at}
                        />
                      )}

                      {/* Botón de Asignación */}
                      <div className="pt-2 flex items-center justify-between gap-1.5">
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
                              onClick={() => {
                                setSelectedGpsTruckId(order.transport_truck_id || 'VH-001');
                                setActiveTab('mapa_gps');
                              }}
                              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                              title="Monitorear ruta en mapa GPS"
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

      {/* ========================================================================= */}
      {/* PESTAÑA 3: FLOTA DE DISTRIBUCIÓN (VEHÍCULOS Y CHOFERES) */}
      {/* ========================================================================= */}
      {activeTab === 'flota' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                Flota Oficial de Camiones &bull; Área de Distribución
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Capacidades jauleras, choferes titulares y cuadrillas de atrape asignadas para el transporte de saca.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
              Total Unidades: <strong>{vehicles.length}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((veh) => {
              // Calcular cuántos pedidos tiene asignados este camión
              const assignedOrders = orders.filter(
                (o) => o.transport_assigned && (o.transport_truck_id === veh.id || o.transport_plate === veh.plate)
              );
              const totalAssignedCages = assignedOrders.reduce(
                (acc, o) => acc + (o.estimated_cages || Math.ceil((o.allocated_quantity || 0) / 8)),
                0
              );
              const occupancyPct = Math.min(Math.round((totalAssignedCages / veh.capacity_cages) * 100), 100);

              return (
                <div
                  key={veh.id}
                  className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-black text-lg text-slate-950 dark:text-white block">
                        {veh.plate}
                      </span>
                      <span className="text-[11px] text-slate-500 font-bold block">{veh.model}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
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
                          className={`h-full rounded-full ${
                            occupancyPct > 90 ? 'bg-amber-500' : 'bg-blue-600'
                          }`}
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 4: OFERTA PECUARIA EN VIVO (TABLA GENERAL DE SALDO) */}
      {/* ========================================================================= */}
      {activeTab === 'pecuaria' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                <Bird className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Oferta de Galpones Activos &bull; Módulo Pecuaria en Tiempo Real
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Datos sincronizados de saldos disponibles, edad de lote y peso promedio para la toma de decisión del Gestor Comercial.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2.5 px-3">Granja</th>
                    <th className="py-2.5 px-3">Galpón</th>
                    <th className="py-2.5 px-3 text-center">Edad</th>
                    <th className="py-2.5 px-3 text-center">Sexo</th>
                    <th className="py-2.5 px-3 text-right">Saldo Disponible</th>
                    <th className="py-2.5 px-3 text-right">Peso Promedio</th>
                    <th className="py-2.5 px-3 text-center">Estado Saca</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {pecuariaItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                        {item.farm_name} ({item.farm_code})
                      </td>
                      <td className="py-2.5 px-3 font-black text-emerald-700 dark:text-emerald-400">
                        {item.barn_code}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">{item.bird_age_days} días</td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {item.sex === 'MACHO' && <span className="text-blue-600">Macho</span>}
                        {item.sex === 'HEMBRA' && <span className="text-rose-600">Hembra</span>}
                        {item.sex !== 'MACHO' && item.sex !== 'HEMBRA' && <span>Mixto</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-slate-100 text-sm">
                        {item.barn_balance_available.toLocaleString()} aves
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-700 dark:text-slate-300">
                        {item.average_weight_kg ? `${item.average_weight_kg.toFixed(2)} kg` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {item.barn_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 5: MONITOREO GPS EN VIVO (OPENSTREETMAP) */}
      {/* ========================================================================= */}
      {activeTab === 'mapa_gps' && (
        <FlotaGpsMap initialSelectedTruckId={selectedGpsTruckId} readOnly={true} />
      )}

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
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black block">⚠️ Alerta de Inconsistencia de Stock:</span>
                    <span>
                      El galpón seleccionado dispone de solo{' '}
                      <strong>{selectedPecuariaBarn?.barn_balance_available.toLocaleString()}</strong> aves libres,
                      pero el pedido requiere <strong>{formAllocatedQty.toLocaleString()}</strong>. Se asignará el
                      total disponible o requerirá completar con un segundo galpón.
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
      {/* MODAL 3: DESIGNACIÓN DE TRANSPORTE (ÁREA DE DISTRIBUCIÓN) */}
      {/* ========================================================================= */}
      {transportingOrder && (
        <Modal
          isOpen={!!transportingOrder}
          onClose={() => setTransportingOrder(null)}
          title={`Designación de Transporte de Distribución — ${transportingOrder.order_number}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Resumen del pedido y cálculo de jaulas */}
            <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Cliente &amp; Zona</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 block truncate">
                  {transportingOrder.client_name}
                </span>
                <span className="text-[10px] text-blue-700 dark:text-blue-300 font-bold">
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

            {/* Selección de Unidad de Flota */}
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

              {/* MEJORA 4: Control Visual de Cubicaje y Consolidación de Carga Multipedido */}
              <ConsolidationCubicajeBar
                currentOrder={transportingOrder}
                selectedVehicle={selectedTransportVehicle}
                allOrders={orders}
              />

              {/* DETECCIÓN DE INCONSISTENCIAS DE TRANSPORTE */}
              {isVehicleOvercapacity && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black block">⚠️ Inconsistencia de Capacidad de Carga:</span>
                    <span>
                      El pedido requiere <strong>~{transportCagesNeeded} jaulas</strong>, lo cual supera la capacidad
                      máxima de la unidad seleccionada (<strong>{selectedTransportVehicle?.capacity_cages} jaulas</strong>).
                      Se sugiere asignar un <strong>Semirremolque Jaulero (600 - 650 jaulas)</strong> o programar un viaje
                      complementario con otra unidad.
                    </span>
                  </div>
                </div>
              )}

              {isZoneMismatch && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black block">⚠️ Advertencia de Cobertura de Ruta:</span>
                    <span>
                      La unidad {selectedTransportVehicle?.plate} opera habitualmente en zonas [
                      {selectedTransportVehicle?.zone_coverage.join(', ')}], mientras que el destino del cliente es{' '}
                      <strong>Zona {transportingOrder.zone_code}</strong>.
                    </span>
                  </div>
                </div>
              )}

              {/* Configuración de Turno, Chofer y Cuadrilla */}
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

                {/* MEJORA 6: Programación de Ventanas de Saca Nocturna (Slotting Horario) */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Ventana Horaria en Balanza (Slotting Nocturno):
                  </label>
                  <select
                    value={transportLoadingSlot}
                    onChange={(e) => setTransportLoadingSlot(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                  >
                    <option value="21:00 - 23:00 hrs">🌙 21:00 - 23:00 hrs (Nocturno 1 - Carga Fresca)</option>
                    <option value="23:00 - 01:00 hrs">🌙 23:00 - 01:00 hrs (Nocturno 2 - Pico Sin Calor)</option>
                    <option value="01:00 - 03:00 hrs">🌌 01:00 - 03:00 hrs (Madrugada 1 - Vía Despejada)</option>
                    <option value="03:00 - 05:00 hrs">🌌 03:00 - 05:00 hrs (Madrugada 2 - Pre-apertura)</option>
                    <option value="05:00 - 07:00 hrs">☀️ 05:00 - 07:00 hrs (Diurno - Riesgo Térmico)</option>
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

              {/* Notas de Transporte */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Instrucciones de Rampa / Despacho:
                </label>
                <Input
                  value={transportNotes}
                  onChange={(e) => setTransportNotes(e.target.value)}
                  placeholder="Ej: Ingreso por rampa auxiliar 2. Carga directa de galpón..."
                  className="text-xs"
                />
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button size="sm" variant="secondary" onClick={() => setTransportingOrder(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmTransport}
                disabled={isSubmittingTransport}
                className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold flex items-center gap-1.5 shadow-sm"
              >
                <Truck className="w-4 h-4" />
                <span>{isSubmittingTransport ? 'Designando...' : 'Confirmar Designación de Transporte'}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DETALLE COMPLETO Y TRAZABILIDAD DE PEDIDO */}
      {/* ========================================================================= */}
      {detailOrder && (() => {
        const sellerFullName = resolveSellerFullName(detailOrder);
        const sellerRole = resolveSellerRole(detailOrder);
        const clientDetails = resolveClientDetails(detailOrder);
        const birds = detailOrder.allocated_quantity || detailOrder.requested_quantity || 0;
        const cages = detailOrder.estimated_cages || Math.ceil(birds / 8);
        const avgW = (detailOrder.min_weight_kg + detailOrder.max_weight_kg) / 2.0;
        const totalKg = detailOrder.estimated_total_kg || birds * avgW;
        const tons = Math.round((totalKg / 1000) * 10) / 10;

        return (
          <Modal
            isOpen={!!detailOrder}
            onClose={() => setDetailOrder(null)}
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

              {/* 2. GRID PRINCIPAL: VENDEDOR Y CLIENTE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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
                      <span className="text-slate-500">Cargo / Área:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-right">
                        {sellerRole}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Usuario en Sistema:</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        @{detailOrder.seller_username}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Código Comercial:</span>
                      <span className="font-mono text-slate-600 dark:text-slate-300">
                        {detailOrder.seller_user_id || 'u-seller-01'}
                      </span>
                    </div>
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
                        {clientDetails.address}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-slate-500">Contacto / Teléfono:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                        {clientDetails.phone}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. ESPECIFICACIONES TÉCNICAS Y VOLUMETRÍA DEL PEDIDO */}
              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
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
                      Estándar ~8 aves/jla
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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
                    <strong>Granja:</strong> {detailOrder.assigned_farm_code || detailOrder.suggested_farm_code || 'TRAD1'} &bull;{' '}
                    <strong>Galpón:</strong> {detailOrder.assigned_barn_code || detailOrder.suggested_barn_code || 'G-01'}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    <strong>Teléfono Balanza Granja:</strong> {detailOrder.farm_contact_phone || '+51 987 654 321 (Encargado Tradición 1)'}
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
                      Unidad de transporte pendiente de asignación por el Gestor Comercial.
                    </span>
                  )}
                </div>
              </div>

              {/* 5. CICLO DE VIDA DEL DESPACHO */}
              {detailOrder.transport_assigned && (
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
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <AuditTimeline auditLog={detailOrder.audit_log} />
              </div>

              {/* 7. BOTONES DE ACCIÓN */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                {detailOrder.transport_assigned ? (
                  <Button
                    size="sm"
                    onClick={() => setWhatsappModalOrder(detailOrder)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-xs text-xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5 fill-white" />
                    <span>Enviar Manifiesto WhatsApp</span>
                  </Button>
                ) : (
                  <div />
                )}
                <Button size="sm" variant="secondary" onClick={() => setDetailOrder(null)} className="text-xs font-bold">
                  Cerrar Detalle
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* MEJORA 3: Modal de Hoja de Ruta y Manifiesto WhatsApp para Chofer */}
      <WhatsAppManifestModal
        order={whatsappModalOrder}
        isOpen={!!whatsappModalOrder}
        onClose={() => setWhatsappModalOrder(null)}
      />
    </div>
  );
};
