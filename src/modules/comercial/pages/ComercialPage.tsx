// ==============================================================================
// PÁGINA CENTRAL DEL MÓDULO COMERCIAL Y PROGRAMACIÓN
// Archivo: fronted/src/modules/comercial/pages/ComercialPage.tsx
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { OrderDateFilter } from '@/components/ui/OrderDateFilter';
import { FlotaGpsMap } from '@/modules/gerencia/components/gps/FlotaGpsMap';
import { gpsSimulationStore } from '@/modules/gerencia/components/gps/gpsSimulationStore';
import {
  DateFilterValue,
  DEFAULT_DATE_FILTER,
  resolveRange,
  orderDateKey,
  matchesRange,
} from '@/lib/dateFilters';
import {
  Client,
  ClientCreatePayload,
  ClientUpdatePayload,
  SalesOrder,
  OrderCreatePayload,
  OrderActionPayload,
  SexPreference,
  ProgramacionTransporteItem,
  ProgramacionTransporteResponse,
  computeCages,
  clampDensity,
  MIN_DENSITY,
  MAX_DENSITY,
  DEFAULT_DENSITY,
  ZoneCageDensity,
  DEFAULT_ZONE_DENSITIES,
  resolveZoneDensity,
} from '@/types/comercial';
import { TablaGeneralSaldoItem, OFFICIAL_FARMS } from '@/types/pecuaria';
import {
  ShoppingCart,
  Calendar,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  Building2,
  User,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  RotateCcw,
  Eye,
  Info,
  Layers,
  Sparkles,
  Truck,
  Package,
  Download,
  FileText,
  MapPin,
  ExternalLink,
  Pencil,
  Trash2,
} from 'lucide-react';

interface OrderLineDraft {
  id: string;
  requestedQuantityStr: string;
  sexPreference: 'MACHO' | 'HEMBRA';
  minWeightStr: string;
  maxWeightStr: string;
}

const createOrderLine = (sex: 'MACHO' | 'HEMBRA' = 'MACHO'): OrderLineDraft => ({
  id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  requestedQuantityStr: '3000',
  sexPreference: sex,
  minWeightStr: '',
  maxWeightStr: '',
});

export const formatDateDisplay = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

export const ComercialPage: React.FC = () => {
  const { user } = useAuth();

  // Solo vendedores y administradores capturan pedidos; el gestor usa esta vista para clientes
  const canCreateOrders = user?.role === 'vendedor' || user?.role === 'admin_sistema';

  // Estados de navegación interna por pestañas
  const [activeTab, setActiveTab] = useState<'programacion' | 'nuevo_pedido' | 'clientes' | 'monitoreo'>('programacion');

  // Datos principales: la base de datos es la única fuente de verdad
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pecuariaItems, setPecuariaItems] = useState<TablaGeneralSaldoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filtros de la pestaña Programación
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(DEFAULT_DATE_FILTER);
  const dateRange = useMemo(() => resolveRange(dateFilter), [dateFilter]);

  // Mantiene el simulador de flota sincronizado con la cartera visible del vendedor
  useEffect(() => {
    gpsSimulationStore.syncOrders(orders);
  }, [orders]);

  // Formulario de Nuevo Pedido
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [clientTaxId, setClientTaxId] = useState<string>('');
  const [zoneCode, setZoneCode] = useState<string>('METROPOLITANA');
  const getLocalTodayIso = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const targetDeliveryDate = getLocalTodayIso();
  const [zoneDensities, setZoneDensities] = useState<ZoneCageDensity[]>(DEFAULT_ZONE_DENSITIES);
  const [orderLines, setOrderLines] = useState<OrderLineDraft[]>(() => [createOrderLine('MACHO')]);
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryLat, setDeliveryLat] = useState<string>('');
  const [deliveryLng, setDeliveryLng] = useState<string>('');
  const [rawCoordsInput, setRawCoordsInput] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleParseDeliveryCoords = (input: string) => {
    setRawCoordsInput(input);
    const match = input.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    if (match) {
      setDeliveryLat(match[1]);
      setDeliveryLng(match[2]);
    }
  };

  // Modales de Acción del Gestor Comercial (Dar OK / Observar / Cancelar / Detalle)
  const [selectedOrderForAction, setSelectedOrderForAction] = useState<SalesOrder | null>(null);
  const [okModalOpen, setOkModalOpen] = useState<boolean>(false);
  const [observarModalOpen, setObservarModalOpen] = useState<boolean>(false);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [trackingOrder, setTrackingOrder] = useState<SalesOrder | null>(null);

  // Modal de Registro Rápido de Nuevo Cliente (+ Nuevo Cliente)
  const [newClientModalOpen, setNewClientModalOpen] = useState<boolean>(false);
  const [newClientBusinessName, setNewClientBusinessName] = useState<string>('');
  const [newClientTaxId, setNewClientTaxId] = useState<string>('');
  const [newClientZone, setNewClientZone] = useState<string>('METROPOLITANA');
  const [newClientAddress, setNewClientAddress] = useState<string>('');
  const [newClientPhone, setNewClientPhone] = useState<string>('');
  const [newClientMinWeight, setNewClientMinWeight] = useState<string>('2.20');
  const [newClientMaxWeight, setNewClientMaxWeight] = useState<string>('2.50');
  const [newClientLat, setNewClientLat] = useState<string>('');
  const [newClientLng, setNewClientLng] = useState<string>('');
  const [newClientError, setNewClientError] = useState<string | null>(null);
  const [isSavingClient, setIsSavingClient] = useState<boolean>(false);

  // Pestaña "Clientes": listado y edición de la ficha del cliente
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [clientZoneFilter, setClientZoneFilter] = useState<string>('ALL');
  const [editClientModalOpen, setEditClientModalOpen] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editClientForm, setEditClientForm] = useState({
    business_name: '',
    tax_id: '',
    zone_code: 'METROPOLITANA',
    address: '',
    contact_phone: '',
    latitude: '',
    longitude: '',
    min_weight: '',
    max_weight: '',
    is_active: true,
  });
  const [editClientError, setEditClientError] = useState<string | null>(null);
  const [isSavingClientEdit, setIsSavingClientEdit] = useState<boolean>(false);

  // Campos para la acción de Dar OK
  const [okFarmCode, setOkFarmCode] = useState<string>('');
  const [okBarnCode, setOkBarnCode] = useState<string>('');
  const [okAllocatedQtyStr, setOkAllocatedQtyStr] = useState<string>('');
  const [okDensityStr, setOkDensityStr] = useState<string>(String(DEFAULT_DENSITY));
  const [okObservation, setOkObservation] = useState<string>('');

  // Campos para la observación
  const [observationText, setObservationText] = useState<string>('');

  // Roles y permisos
  const isGestorOrAdmin = useMemo(() => {
    return user?.role === 'gestor_comercial' || user?.role === 'gerente_comercial' || user?.role === 'admin_sistema';
  }, [user]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Carga inicial de datos desde Backend
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // 1. Cargar Pedidos
      try {
        const ordersData = await apiClient<SalesOrder[]>('/comercial/orders');
        setOrders(ordersData);
        localStorage.setItem('avicola_comercial_orders', JSON.stringify(ordersData));
      } catch {
        const local = localStorage.getItem('avicola_comercial_orders');
        if (local) setOrders(JSON.parse(local));
      }

      // 2. Cargar Clientes
      try {
        const clientsData = await apiClient<Client[]>('/comercial/clients');
        setClients((prev) => {
          const map = new Map<string, Client>();
          clientsData.forEach((c) => map.set(c.id, c));
          prev.forEach((c) => {
            if (!map.has(c.id)) map.set(c.id, c);
          });
          const combined = Array.from(map.values());
          localStorage.setItem('avicola_comercial_clients', JSON.stringify(combined));
          return combined;
        });
      } catch {
        const localClients = localStorage.getItem('avicola_comercial_clients');
        if (localClients) {
          try {
            setClients(JSON.parse(localClients));
          } catch {}
        }
      }

      // 3. Cargar Disponibilidad de Pecuaria
      try {
        const pecuariaData = await apiClient<any>('/pecuaria/tabla-general-saldo');
        const rawList = pecuariaData?.data || pecuariaData?.items;
        if (rawList && Array.isArray(rawList) && rawList.length > 0) {
          const sanitized = rawList
            .filter((d: any) => (d.sex === 'MACHO' || d.sex === 'HEMBRA') && !d.is_closed)
            .map((d: any) => ({
              ...d,
              farm_code: d.farm_code || d.farm_name?.substring(0, 5).toUpperCase(),
            }));
          setPecuariaItems(sanitized);
          localStorage.setItem('avicola_pecuaria_table_items', JSON.stringify(sanitized));
        } else {
          // Sin lotes en la base: no se inventan galpones
          setPecuariaItems([]);
        }
      } catch {
        // Sin conexión: se mantiene lo último cargado, sin generar datos sintéticos
      }

      // 4. Cargar Densidades por Zona configuradas desde Administración
      try {
        const densitiesData = await apiClient<ZoneCageDensity[]>('/admin/zone-densities');
        if (Array.isArray(densitiesData) && densitiesData.length > 0) {
          setZoneDensities(densitiesData);
          localStorage.setItem('avicola_zone_densities', JSON.stringify(densitiesData));
        }
      } catch {
        const localDensities = localStorage.getItem('avicola_zone_densities');
        if (localDensities) {
          try {
            setZoneDensities(JSON.parse(localDensities));
          } catch {}
        }
      }
    } catch (err: any) {
      console.warn('Error al cargar datos comerciales:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // ---------------------------------------------------------------------------
  // DISPONIBILIDAD EN VIVO (el saldo lo administra el backend, no el navegador)
  // ---------------------------------------------------------------------------
  // Disponibilidad en vivo del galpón seleccionado en el modal Dar OK del Gestor
  const okBarnAvailability = useMemo(() => {
    return pecuariaItems.find(
      (item) => item.farm_code === okFarmCode && item.barn_code === okBarnCode
    );
  }, [pecuariaItems, okFarmCode, okBarnCode]);

  // Gestión de líneas del pedido (Línea 1, Línea 2, ...)
  const handleAddOrderLine = () => {
    setOrderLines((prev) => {
      const nextSex = prev[prev.length - 1]?.sexPreference === 'MACHO' ? 'HEMBRA' : 'MACHO';
      return [...prev, createOrderLine(nextSex)];
    });
  };

  const handleRemoveOrderLine = (lineId: string) => {
    setOrderLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== lineId) : prev));
  };

  const handleUpdateOrderLine = (
    lineId: string,
    patch: Partial<Pick<OrderLineDraft, 'requestedQuantityStr' | 'sexPreference' | 'minWeightStr' | 'maxWeightStr'>>
  ) => {
    setOrderLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const next = { ...l, ...patch };
        if (patch.sexPreference === 'MACHO') {
          next.minWeightStr = '';
          next.maxWeightStr = '';
        }
        return next;
      })
    );
  };

  // Estimación de Jaulas en tiempo real por línea y totales
  const orderLinesSummary = useMemo(() => {
    let totalBirds = 0;
    let totalCages = 0;

    const lines = orderLines.map((line) => {
      const qty = parseInt(line.requestedQuantityStr, 10) || 0;
      const density = resolveZoneDensity(zoneDensities, zoneCode, line.sexPreference);
      const cagesNeeded = computeCages(qty, density);
      totalBirds += qty;
      totalCages += cagesNeeded;
      return { ...line, qty, density, cagesNeeded };
    });

    return {
      lines,
      totalBirds,
      totalCages,
    };
  }, [orderLines, zoneDensities, zoneCode]);

  // Aplica a la entrega del pedido la dirección y coordenadas registradas en la ficha del cliente
  const applyClientDeliveryData = (c: Client) => {
    setDeliveryAddress(c.address || '');
    setDeliveryLat(c.latitude !== null && c.latitude !== undefined ? String(c.latitude) : '');
    setDeliveryLng(c.longitude !== null && c.longitude !== undefined ? String(c.longitude) : '');
    setRawCoordsInput('');
  };

  // Al seleccionar cliente del catálogo, auto-llenar datos preferidos y punto de entrega
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const c = clients.find((item) => item.id === clientId);
    if (c) {
      setClientName(c.business_name);
      setClientTaxId(c.tax_id);
      setZoneCode(c.zone_code);
      // Las coordenadas del cliente se cargan siempre; el vendedor puede ajustarlas luego
      applyClientDeliveryData(c);
    }
  };

  // Abrir modal de nuevo cliente (+ Nuevo Cliente)
  const handleOpenNewClientModal = () => {
    setNewClientBusinessName(clientName.trim());
    setNewClientTaxId(clientTaxId.trim());
    setNewClientZone(zoneCode || 'METROPOLITANA');
    setNewClientAddress('');
    setNewClientPhone('');
    setNewClientMinWeight('2.20');
    setNewClientMaxWeight('2.50');
    setNewClientLat(deliveryLat || '');
    setNewClientLng(deliveryLng || '');
    setNewClientError(null);
    setNewClientModalOpen(true);
  };

  // Guardar nuevo cliente desde el formulario comercial
  const handleSaveNewClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setNewClientError(null);

    const bName = newClientBusinessName.trim();
    const tId = newClientTaxId.trim();

    if (!bName) {
      setNewClientError('La razón social o nombre comercial es obligatorio.');
      return;
    }
    if (!tId) {
      setNewClientError('El RUC o documento tributario es obligatorio.');
      return;
    }

    if (clients.some((c) => c.tax_id.toLowerCase() === tId.toLowerCase())) {
      setNewClientError(`Ya existe un cliente registrado con el RUC/DNI "${tId}".`);
      return;
    }

    const minW = newClientMinWeight ? parseFloat(newClientMinWeight) : undefined;
    const maxW = newClientMaxWeight ? parseFloat(newClientMaxWeight) : undefined;
    if (minW !== undefined && maxW !== undefined && minW > maxW) {
      setNewClientError('El peso mínimo preferente no puede ser mayor al peso máximo.');
      return;
    }

    // Coordenadas satelitales del punto de entrega (opcionales, pero se piden ambas juntas)
    let lat: number | null = null;
    let lng: number | null = null;
    const latStr = newClientLat.trim();
    const lngStr = newClientLng.trim();
    if (latStr || lngStr) {
      if (!latStr || !lngStr) {
        setNewClientError('Debe ingresar latitud y longitud juntas para fijar el punto de entrega.');
        return;
      }
      lat = parseFloat(latStr);
      lng = parseFloat(lngStr);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        setNewClientError('La latitud debe ser un número entre -90 y 90.');
        return;
      }
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        setNewClientError('La longitud debe ser un número entre -180 y 180.');
        return;
      }
    }

    setIsSavingClient(true);
    try {
      const payload: ClientCreatePayload = {
        business_name: bName,
        tax_id: tId,
        zone_code: newClientZone,
        address: newClientAddress.trim() || undefined,
        contact_phone: newClientPhone.trim() || undefined,
        latitude: lat,
        longitude: lng,
        preferred_min_weight: minW,
        preferred_max_weight: maxW,
        is_active: true,
      };

      // El cliente se persiste en la base de datos: si falla, se informa y no se simula localmente.
      const createdClient = await apiClient<Client>('/comercial/clients', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Actualizar state y caché de clientes
      const updated = [createdClient, ...clients];
      setClients(updated);
      localStorage.setItem('avicola_comercial_clients', JSON.stringify(updated));

      // Auto-seleccionar e insertar en el pedido comercial
      setSelectedClientId(createdClient.id);
      setClientName(createdClient.business_name);
      setClientTaxId(createdClient.tax_id);
      setZoneCode(createdClient.zone_code);
      if (createdClient.address || lat !== null || lng !== null) {
        applyClientDeliveryData(createdClient);
      }

      setNewClientModalOpen(false);
      showToast(`✔ Cliente "${createdClient.business_name}" registrado e insertado en el pedido.`);
    } catch (error: any) {
      setNewClientError(error?.message || 'Error al registrar el nuevo cliente.');
    } finally {
      setIsSavingClient(false);
    }
  };

  // Cliente actualmente seleccionado en el formulario de pedido
  const selectedClientData = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  // Generar nuevo pedido (soporta 1 o más líneas para el mismo cliente)
  const handleCreateOrder = async (isDraft: boolean) => {
    setFormError(null);

    if (!clientName.trim()) {
      setFormError('Por favor seleccione o ingrese el nombre del cliente.');
      return;
    }

    if (orderLines.length === 0) {
      setFormError('Debe existir al menos una línea de pedido.');
      return;
    }

    for (let i = 0; i < orderLines.length; i++) {
      const line = orderLines[i];
      const qty = parseInt(line.requestedQuantityStr, 10) || 0;
      if (qty <= 0) {
        setFormError(`Línea ${i + 1}: la cantidad solicitada debe ser mayor a 0 aves.`);
        return;
      }
      const densityNum = resolveZoneDensity(zoneDensities, zoneCode, line.sexPreference);
      if (!Number.isFinite(densityNum) || densityNum < MIN_DENSITY || densityNum > MAX_DENSITY) {
        setFormError(`Línea ${i + 1}: la densidad configurada (${densityNum}) debe estar entre ${MIN_DENSITY} y ${MAX_DENSITY} aves por jaula.`);
        return;
      }

      if (line.sexPreference === 'HEMBRA') {
        const hasMin = line.minWeightStr.trim() !== '';
        const hasMax = line.maxWeightStr.trim() !== '';
        if (hasMin || hasMax) {
          if (!hasMin || !hasMax) {
            setFormError(`Línea ${i + 1}: ingrese ambos pesos (mínimo y máximo) o deje ambos vacíos.`);
            return;
          }
          const minW = parseFloat(line.minWeightStr);
          const maxW = parseFloat(line.maxWeightStr);
          if (!Number.isFinite(minW) || !Number.isFinite(maxW) || minW <= 0 || maxW <= 0) {
            setFormError(`Línea ${i + 1}: el rango de peso debe ser mayor a 0 kg.`);
            return;
          }
          if (minW > maxW) {
            setFormError(`Línea ${i + 1}: el peso mínimo (${minW} kg) no puede superar al máximo (${maxW} kg).`);
            return;
          }
        }
      }
    }

    // Punto de entrega: si se fijan coordenadas, deben venir ambas y dentro de rango
    if ((deliveryLat && !deliveryLng) || (!deliveryLat && deliveryLng)) {
      setFormError('Ingrese latitud y longitud juntas para fijar el punto de entrega.');
      return;
    }
    if (deliveryLat && deliveryLng) {
      const latNum = parseFloat(deliveryLat);
      const lngNum = parseFloat(deliveryLng);
      if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
        setFormError('La latitud del punto de entrega debe estar entre -90 y 90.');
        return;
      }
      if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
        setFormError('La longitud del punto de entrega debe estar entre -180 y 180.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const createdOrders: SalesOrder[] = [];
      for (const line of orderLines) {
        const qty = parseInt(line.requestedQuantityStr, 10) || 0;
        const densityNum = resolveZoneDensity(zoneDensities, zoneCode, line.sexPreference);
        const includeWeight =
          line.sexPreference === 'HEMBRA' &&
          line.minWeightStr.trim() !== '' &&
          line.maxWeightStr.trim() !== '';
        const payload: OrderCreatePayload = {
          client_id: selectedClientId || undefined,
          client_name: clientName.trim(),
          client_tax_id: clientTaxId.trim() || undefined,
          seller_full_name: user?.full_name || 'Juan Carlos Pérez Gálvez',
          zone_code: zoneCode,
          target_delivery_date: targetDeliveryDate,
          requested_quantity: qty,
          density_birds_per_cage: densityNum,
          min_weight_kg: includeWeight ? parseFloat(line.minWeightStr) : undefined,
          max_weight_kg: includeWeight ? parseFloat(line.maxWeightStr) : undefined,
          sex_preference: line.sexPreference,
          delivery_address: deliveryAddress.trim() || undefined,
          delivery_latitude: deliveryLat ? parseFloat(deliveryLat) : null,
          delivery_longitude: deliveryLng ? parseFloat(deliveryLng) : null,
          is_draft: isDraft,
        };

        const createdOrder = await apiClient<SalesOrder>('/comercial/orders', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        createdOrders.push(createdOrder);
      }

      const updated = [...createdOrders.slice().reverse(), ...orders];
      setOrders(updated);
      localStorage.setItem('avicola_comercial_orders', JSON.stringify(updated));

      if (createdOrders.length === 1) {
        showToast(`Pedido [${createdOrders[0].order_number}] generado exitosamente.`);
      } else {
        const nums = createdOrders.map((o) => o.order_number).join(', ');
        showToast(`${createdOrders.length} líneas de pedido generadas exitosamente (${nums}).`);
      }

      // Limpiar formulario y cambiar a pestaña Programación
      setDeliveryAddress('');
      setDeliveryLat('');
      setDeliveryLng('');
      setRawCoordsInput('');
      setOrderLines([createOrderLine('MACHO')]);
      setActiveTab('programacion');
    } catch (err: any) {
      setFormError(err.message || 'Error al generar pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir modal de Aprobación
  const handleOpenOkModal = (order: SalesOrder) => {
    setSelectedOrderForAction(order);
    setOkFarmCode(order.assigned_farm_code || order.suggested_farm_code || 'TRAD1');
    setOkBarnCode(order.assigned_barn_code || order.suggested_barn_code || 'G-01');
    setOkAllocatedQtyStr(String(order.requested_quantity));
    setOkDensityStr(
      String(
        order.density_birds_per_cage ||
          resolveZoneDensity(zoneDensities, order.zone_code, order.sex_preference || 'MACHO')
      )
    );
    setOkObservation(`Aprobación formal verificada por Gestor Comercial (${user?.username || 'gestor'}). Stock apto para saca programada.`);
    setOkModalOpen(true);
  };

  // Ejecutar Aprobación por el Gestor Comercial
  const handleConfirmDarOk = async () => {
    if (!selectedOrderForAction) return;
    const qty = parseInt(okAllocatedQtyStr, 10) || 0;

    if (qty <= 0) {
      alert('La cantidad a reservar debe ser mayor a 0 aves.');
      return;
    }

    const densityNum = parseInt(okDensityStr, 10);
    if (!Number.isFinite(densityNum) || densityNum < MIN_DENSITY || densityNum > MAX_DENSITY) {
      alert(`La densidad debe estar entre ${MIN_DENSITY} y ${MAX_DENSITY} aves por jaula.`);
      return;
    }

    if (okBarnAvailability && qty > okBarnAvailability.barn_balance_available) {
      alert(
        `Saldo insuficiente en ${okFarmCode} ${okBarnCode}: ` +
        `${okBarnAvailability.barn_balance_available.toLocaleString()} disponibles vs ${qty.toLocaleString()} solicitadas. ` +
        'Ajusta la cantidad o selecciona otro galpón.'
      );
      return;
    }

    setIsSubmitting(true);
    const payload: OrderActionPayload = {
      farm_code: okFarmCode,
      barn_code: okBarnCode,
      allocated_quantity: qty,
      density_birds_per_cage: densityNum,
      observation: okObservation.trim() || undefined,
    };

    try {
      // El backend valida y descuenta el saldo; sin respaldo local
      const updatedOrder = await apiClient<SalesOrder>(`/comercial/orders/${selectedOrderForAction.id}/dar-ok`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // El saldo lo descuenta el backend; refrescamos la disponibilidad real
      loadInitialData();

      const updatedList = orders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
      setOrders(updatedList);
      localStorage.setItem('avicola_comercial_orders', JSON.stringify(updatedList));

      setOkModalOpen(false);
      showToast(`✔ Pedido [${selectedOrderForAction.order_number}] APROBADO formalmente. Se reservaron ${qty.toLocaleString()} aves de [${okFarmCode} - ${okBarnCode}].`);
    } catch (err: any) {
      alert(err.message || 'Error al aprobar el pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir modal de observación
  const handleOpenObservarModal = (order: SalesOrder) => {
    setSelectedOrderForAction(order);
    setObservationText(order.gestor_observation || '');
    setObservarModalOpen(true);
  };

  // Confirmar observación
  const handleConfirmObservar = async () => {
    if (!selectedOrderForAction || !observationText.trim()) return;
    setIsSubmitting(true);

    try {
      let updatedOrder: SalesOrder;
      try {
        updatedOrder = await apiClient<SalesOrder>(`/comercial/orders/${selectedOrderForAction.id}/observar`, {
          method: 'POST',
          body: JSON.stringify({ observation: observationText.trim() }),
        });
      } catch {
        updatedOrder = {
          ...selectedOrderForAction,
          status: 'CON_OBSERVACION',
          gestor_username: user?.username || 'gestor_comercial',
          gestor_observation: observationText.trim(),
          updated_at: new Date().toISOString(),
        };
      }

      const updatedList = orders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
      setOrders(updatedList);
      localStorage.setItem('avicola_comercial_orders', JSON.stringify(updatedList));

      setObservarModalOpen(false);
      showToast(`⚠ Pedido [${selectedOrderForAction.order_number}] devuelto con observación al vendedor.`);
    } catch (err: any) {
      alert(err.message || 'Error al enviar observación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancelar pedido
  const handleCancelOrder = async (order: SalesOrder) => {
    if (!window.confirm(`¿Está seguro de cancelar el pedido [${order.order_number}]?`)) return;

    try {
      let updatedOrder: SalesOrder;
      try {
        updatedOrder = await apiClient<SalesOrder>(`/comercial/orders/${order.id}/cancelar`, {
          method: 'POST',
          body: JSON.stringify({ observation: 'Cancelado por usuario' }),
        });
      } catch {
        updatedOrder = {
          ...order,
          status: 'CANCELADO',
          updated_at: new Date().toISOString(),
        };
      }

      // El backend libera la reserva al cancelar; refrescamos la disponibilidad real
      if (order.status === 'APROBADO_RESERVADO') {
        loadInitialData();
        showToast(`Pedido [${order.order_number}] cancelado. Se liberó la reserva en el galpón.`);
      } else {
        showToast(`Pedido [${order.order_number}] cancelado.`);
      }

      const updatedList = orders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
      setOrders(updatedList);
      localStorage.setItem('avicola_comercial_orders', JSON.stringify(updatedList));
    } catch (err: any) {
      alert(err.message || 'Error al cancelar pedido.');
    }
  };

  // Abrir modal de edición de cliente
  const handleOpenEditClient = (client: Client) => {
    setEditingClient(client);
    setEditClientForm({
      business_name: client.business_name,
      tax_id: client.tax_id,
      zone_code: client.zone_code || 'METROPOLITANA',
      address: client.address || '',
      contact_phone: client.contact_phone || '',
      latitude: client.latitude != null ? String(client.latitude) : '',
      longitude: client.longitude != null ? String(client.longitude) : '',
      min_weight: client.preferred_min_weight != null ? String(client.preferred_min_weight) : '',
      max_weight: client.preferred_max_weight != null ? String(client.preferred_max_weight) : '',
      is_active: client.is_active,
    });
    setEditClientError(null);
    setEditClientModalOpen(true);
  };

  // Guardar edición de ficha de cliente
  const handleSaveEditClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingClient) return;
    setEditClientError(null);

    const bName = editClientForm.business_name.trim();
    const tId = editClientForm.tax_id.trim();
    if (!bName) {
      setEditClientError('La razón social o nombre comercial es obligatorio.');
      return;
    }
    if (!tId) {
      setEditClientError('El RUC o documento tributario es obligatorio.');
      return;
    }

    const latStr = editClientForm.latitude.trim();
    const lngStr = editClientForm.longitude.trim();
    let lat: number | null = null;
    let lng: number | null = null;
    if (latStr || lngStr) {
      if (!latStr || !lngStr) {
        setEditClientError('Debe ingresar latitud y longitud juntas para fijar el punto de entrega.');
        return;
      }
      lat = parseFloat(latStr);
      lng = parseFloat(lngStr);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        setEditClientError('La latitud debe estar entre -90 y 90.');
        return;
      }
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        setEditClientError('La longitud debe estar entre -180 y 180.');
        return;
      }
    }

    const minW = editClientForm.min_weight.trim() ? parseFloat(editClientForm.min_weight) : null;
    const maxW = editClientForm.max_weight.trim() ? parseFloat(editClientForm.max_weight) : null;
    if (minW !== null && maxW !== null && minW > maxW) {
      setEditClientError('El peso mínimo no puede superar al peso máximo.');
      return;
    }

    setIsSavingClientEdit(true);
    try {
      const payload: ClientUpdatePayload = {
        business_name: bName,
        tax_id: tId,
        zone_code: editClientForm.zone_code,
        address: editClientForm.address.trim() || undefined,
        contact_phone: editClientForm.contact_phone.trim() || undefined,
        latitude: lat,
        longitude: lng,
        preferred_min_weight: minW,
        preferred_max_weight: maxW,
        is_active: editClientForm.is_active,
      };

      const updatedClient = await apiClient<Client>(`/comercial/clients/${editingClient.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const updatedList = clients.map((c) => (c.id === updatedClient.id ? updatedClient : c));
      setClients(updatedList);
      localStorage.setItem('avicola_comercial_clients', JSON.stringify(updatedList));

      if (selectedClientId === updatedClient.id) {
        setClientName(updatedClient.business_name);
        setClientTaxId(updatedClient.tax_id);
        setZoneCode(updatedClient.zone_code);
        applyClientDeliveryData(updatedClient);
      }

      setEditClientModalOpen(false);
      showToast(`✔ Ficha del cliente "${updatedClient.business_name}" actualizada.`);
    } catch (err: any) {
      setEditClientError(err?.message || 'Error al actualizar ficha del cliente.');
    } finally {
      setIsSavingClientEdit(false);
    }
  };

  // Pedidos con transporte asignado: base de la pestaña "Mis Transportes"
  const transportOrders = useMemo(
    () => orders.filter((o) => o.transport_assigned && o.status !== 'CANCELADO'),
    [orders]
  );

  // Filtrado de clientes para la pestaña Clientes
  const filteredClients = useMemo(() => {
    const q = clientSearchQuery.trim().toLowerCase();
    return clients.filter((c) => {
      if (clientZoneFilter !== 'ALL' && c.zone_code !== clientZoneFilter) return false;
      if (!q) return true;
      return (
        c.business_name.toLowerCase().includes(q) ||
        c.tax_id.toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q) ||
        (c.contact_phone || '').toLowerCase().includes(q)
      );
    });
  }, [clients, clientSearchQuery, clientZoneFilter]);

  // ============================================================================
  // MAPA DE ESTADOS COMERCIALES (7 estados solicitados)
  // ============================================================================
  type EstadoComercial =
    | 'PREPROGRAMACION'
    | 'PROGRAMADO'
    | 'PROGRAMADO_CON_CAMION'
    | 'CONFIRMADO_ARIS'
    | 'EN_RUTA'
    | 'TERMINADO'
    | 'CANCELADO';

  interface EstadoComercialInfo {
    label: string;
    color: string;       // texto
    bgColor: string;     // badge bg
    borderColor: string;
  }

  const ESTADOS_COMERCIALES: Record<EstadoComercial, EstadoComercialInfo> = {
    PREPROGRAMACION:       { label: 'Preprogramación',          color: 'text-amber-600 dark:text-amber-400',        bgColor: 'bg-amber-50 dark:bg-amber-950/30',        borderColor: 'border-amber-300 dark:border-amber-800' },
    PROGRAMADO:            { label: 'Programado',               color: 'text-sky-700 dark:text-sky-400',            bgColor: 'bg-sky-50 dark:bg-sky-950/30',             borderColor: 'border-sky-300 dark:border-sky-800' },
    PROGRAMADO_CON_CAMION: { label: 'Programado con camión',    color: 'text-indigo-700 dark:text-indigo-400',      bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',       borderColor: 'border-indigo-300 dark:border-indigo-800' },
    CONFIRMADO_ARIS:       { label: 'Confirmado (código Aris)', color: 'text-emerald-700 dark:text-emerald-400',    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',     borderColor: 'border-emerald-400 dark:border-emerald-700' },
    EN_RUTA:               { label: 'En ruta',                  color: 'text-blue-700 dark:text-blue-400',          bgColor: 'bg-blue-50 dark:bg-blue-950/30',           borderColor: 'border-blue-300 dark:border-blue-800' },
    TERMINADO:             { label: 'Terminado',                color: 'text-slate-600 dark:text-slate-400',        bgColor: 'bg-slate-100 dark:bg-slate-800/50',        borderColor: 'border-slate-300 dark:border-slate-700' },
    CANCELADO:             { label: 'Cancelado',                color: 'text-rose-500 dark:text-rose-400',          bgColor: 'bg-rose-50 dark:bg-rose-950/30',           borderColor: 'border-rose-300 dark:border-rose-800/60' },
  };

  const estadoComercialLabels: EstadoComercial[] = [
    'PREPROGRAMACION',
    'PROGRAMADO',
    'PROGRAMADO_CON_CAMION',
    'CONFIRMADO_ARIS',
    'EN_RUTA',
    'TERMINADO',
    'CANCELADO',
  ];

  /** Deriva el estado comercial de 7 valores a partir de los campos del pedido. */
  function deriveEstadoComercial(o: SalesOrder): EstadoComercial {
    if (o.status === 'CANCELADO') return 'CANCELADO';
    if (o.dispatch_phase === 'ENTREGADO_CONFORME') return 'TERMINADO';
    if (o.status === 'DESPACHADO' && o.dispatch_phase === 'ENTREGADO_CONFORME') return 'TERMINADO';
    if (o.dispatch_phase === 'EN_TRANSITO') return 'EN_RUTA';
    if (o.dispatch_phase === 'EN_GRANJA_CARGANDO' || (o.status === 'APROBADO_RESERVADO' && o.codigo_aris)) {
      // Confirmado (código Aris): el pedido tiene código Aris generado por el gestor
      // Puede estar en EN_GRANJA_CARGANDO (llegó a granja) o aún en TRANSPORTE_ASIGNADO
      return 'CONFIRMADO_ARIS';
    }
    if (o.status === 'APROBADO_RESERVADO' && o.transport_assigned) return 'PROGRAMADO_CON_CAMION';
    if (o.status === 'APROBADO_RESERVADO') return 'PROGRAMADO';
    // BORRADOR, REGISTRADO, CON_OBSERVACION, o cualquier otro cae en preprogramación
    return 'PREPROGRAMACION';
  }

  // Filtrado de pedidos para la pestaña Programación
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'ALL' && statusFilter !== 'CON_OBSERVACION') {
        // Filtro por estado comercial (excepto CON_OBSERVACION que se maneja especial)
        const eco = deriveEstadoComercial(o);
        if (eco !== statusFilter) return false;
      }
      // Filtro especial: "Con observación" es un estado transversal visible
      if (statusFilter === 'CON_OBSERVACION' && o.status !== 'CON_OBSERVACION') return false;
      if (zoneFilter !== 'ALL' && o.zone_code !== zoneFilter) return false;
      // Filtro por fecha (saca o registro) según el criterio elegido
      if (!matchesRange(orderDateKey(o, dateFilter.criterion), dateRange)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = o.order_number.toLowerCase().includes(q);
        const matchClient = o.client_name.toLowerCase().includes(q);
        const matchRef = o.external_reference?.toLowerCase().includes(q) || false;
        const matchFarm = o.assigned_farm_code?.toLowerCase().includes(q) || o.suggested_farm_code?.toLowerCase().includes(q) || false;
        if (!matchNum && !matchClient && !matchRef && !matchFarm) return false;
      }
      return true;
    });
  }, [orders, statusFilter, zoneFilter, searchQuery, dateFilter.criterion, dateRange]);

  // KPIs de la pestaña Programación
  const kpiTotal = orders.length;
  const kpiPreprogramacion = orders.filter((o) => deriveEstadoComercial(o) === 'PREPROGRAMACION').length;
  const kpiProgramados = orders.filter((o) => deriveEstadoComercial(o) === 'PROGRAMADO' || deriveEstadoComercial(o) === 'PROGRAMADO_CON_CAMION').length;
  const kpiObservados = orders.filter((o) => o.status === 'CON_OBSERVACION').length;
  const kpiTotalAves = orders
    .filter((o) => o.status !== 'CANCELADO')
    .reduce((acc, curr) => acc + curr.requested_quantity, 0);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 p-4 bg-slate-900 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in border border-slate-700">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header Corporativo del Área Comercial */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-slate-950 dark:text-slate-50 tracking-tight flex items-center gap-2.5">
            <ShoppingCart className="w-7 h-7 text-red-600" />
            <span>Módulo Comercial &amp; Programación de Saca</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Registro comercial de pedidos, cartera de clientes y control de estado de saca.
          </p>
        </div>

        {/* Badge de Rol y Facultades */}
        <div className="flex items-center gap-2">
          {isGestorOrAdmin ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Rol Gestor: Autorizado para aprobar pedidos</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs font-bold shadow-2xs">
              <User className="w-4 h-4 text-blue-600" />
              <span>Rol Vendedor: Captura y revisión de pedidos</span>
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={loadInitialData}
            isLoading={isLoading}
            className="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold"
            title="Refrescar información"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Selector de Pestañas Principales */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('programacion')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'programacion'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>📅 Programación de Pedidos ({orders.length})</span>
        </button>

        {canCreateOrders && (
          <button
            type="button"
            onClick={() => setActiveTab('nuevo_pedido')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'nuevo_pedido'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>➕ Nuevo Pedido de Venta</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('clientes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'clientes'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>👥 Clientes ({clients.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('monitoreo')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'monitoreo'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>🚚 Mis Transportes ({transportOrders.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: APARTADO DE "PROGRAMACIÓN" (REVISIÓN DE ESTADO Y DAR OK GESTOR) */}
      {/* ========================================================================= */}
      {activeTab === 'programacion' && (
        <div className="space-y-5">
          {/* Tarjetas de KPIs de la Programación Comercial */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* KPI 1: Total Pedidos */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Pedidos</span>
                <ShoppingCart className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-2xl font-black text-slate-950 dark:text-white font-mono">{kpiTotal}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Cartera comercial activa</div>
            </div>

            {/* KPI 2: Preprogramación */}
            <div className="bg-amber-50/70 dark:bg-amber-950/30 p-4 rounded-2xl border-2 border-amber-300 dark:border-amber-800/60 shadow-xs">
              <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Preprogramación</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-900 dark:text-amber-200 font-mono">{kpiPreprogramacion}</div>
              <div className="text-[10px] text-amber-800 dark:text-amber-400 mt-0.5 font-semibold">Esperando asignación del gestor</div>
            </div>

            {/* KPI 3: Programados */}
            <div className="bg-sky-50/70 dark:bg-sky-950/25 p-4 rounded-2xl border-2 border-sky-400 dark:border-sky-600/60 shadow-xs">
              <div className="flex items-center justify-between text-sky-800 dark:text-sky-300 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Programados</span>
                <CheckCircle2 className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-black text-sky-900 dark:text-sky-200 font-mono">{kpiProgramados}</div>
              <div className="text-[10px] text-sky-700 dark:text-sky-400 mt-0.5 font-bold">Con reserva en firme para saca</div>
            </div>

            {/* KPI 4: Con observación */}
            <div className="bg-rose-50/60 dark:bg-rose-950/30 p-4 rounded-2xl border border-rose-300 dark:border-rose-900 shadow-xs">
              <div className="flex items-center justify-between text-rose-800 dark:text-rose-300 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Con observación</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-900 dark:text-rose-200 font-mono">{kpiObservados}</div>
              <div className="text-[10px] text-rose-700 dark:text-rose-400 mt-0.5 font-medium">Requieren ajuste del cliente</div>
            </div>

            {/* KPI 5: Total Aves Programadas */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Aves Programadas</span>
                <Layers className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl font-black text-slate-950 dark:text-white font-mono">{kpiTotalAves.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Demanda total solicitada</div>
            </div>
          </div>

          {/* Panel de Filtros y Búsqueda de la Programación */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por N° pedido (PED-2026-001), cliente, RUC u orden de compra..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Filtro por fecha (saca / registro) */}
              <OrderDateFilter value={dateFilter} onChange={setDateFilter} />

              {/* Filtro Estado */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="PREPROGRAMACION">📋 Preprogramación</option>
                <option value="PROGRAMADO">📌 Programado</option>
                <option value="PROGRAMADO_CON_CAMION">🚛 Programado con camión</option>
                <option value="CONFIRMADO_ARIS">✅ Confirmado (código Aris)</option>
                <option value="EN_RUTA">🚚 En ruta</option>
                <option value="TERMINADO">✔ Terminado</option>
                <option value="CANCELADO">❌ Cancelado</option>
                <option value="CON_OBSERVACION">⚠ Con observación</option>
              </select>

              {/* Filtro Zona */}
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">Todas las Zonas</option>
                <option value="METROPOLITANA">Metropolitana</option>
                <option value="NORTE">Norte</option>
                <option value="CENTRO">Centro</option>
                <option value="SUR">Sur</option>
              </select>

              {(searchQuery || statusFilter !== 'ALL' || zoneFilter !== 'ALL' || dateFilter.preset !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setZoneFilter('ALL');
                    setDateFilter(DEFAULT_DATE_FILTER);
                  }}
                  className="px-2.5 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl font-bold transition-colors"
                  title="Limpiar filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Programación de Pedidos */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900/90 text-slate-950 dark:text-slate-100 text-[11px] font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4 whitespace-nowrap">N° Pedido</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Fecha de Pedido</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Saldo (Aves)</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Sexo</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        <div className="font-bold">
                          {orders.length === 0
                            ? 'Aún no hay pedidos registrados'
                            : 'No se encontraron pedidos con los filtros aplicados'}
                        </div>
                        {orders.length === 0 && (
                          <div className="text-[11px] mt-1 text-slate-400">
                            Registre el primer pedido desde la pestaña "Nuevo Pedido de Venta".
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const eco = deriveEstadoComercial(order);
                      const ecoInfo = ESTADOS_COMERCIALES[eco];

                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* N° Pedido */}
                          <td className="py-3 px-4 font-mono font-black text-slate-900 dark:text-slate-100 whitespace-nowrap text-xs">
                            {order.order_number}
                          </td>

                          {/* Cliente */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-950 dark:text-white">{order.client_name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Zona {order.zone_code}</span>
                              {order.external_reference && <span>• OC: {order.external_reference}</span>}
                            </div>
                          </td>

                          {/* Fecha de Pedido */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                              {formatDateDisplay(order.target_delivery_date)}
                            </span>
                          </td>

                          {/* Saldo (cantidad de aves) */}
                          <td className="py-3 px-4 text-right">
                            <div className="font-mono font-black text-sm text-slate-950 dark:text-white">
                              {order.requested_quantity.toLocaleString()}
                            </div>
                          </td>

                          {/* Sexo */}
                          <td className="py-3 px-4 text-center font-bold text-xs whitespace-nowrap">
                            {order.sex_preference === 'MACHO' && (
                              <span className="text-blue-700 dark:text-blue-400 font-bold">Macho</span>
                            )}
                            {order.sex_preference === 'HEMBRA' && (
                              <span className="text-rose-700 dark:text-rose-400 font-bold">Hembra</span>
                            )}
                            {(!order.sex_preference || order.sex_preference === 'INDISTINTO') && (
                              <span className="text-slate-600 dark:text-slate-400 font-medium">Indistinto</span>
                            )}
                          </td>

                          {/* Estado (badge con los 7 estados solicitados) */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${ecoInfo.bgColor} ${ecoInfo.color} ${ecoInfo.borderColor}`}
                            >
                              {ecoInfo.label}
                            </span>
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
      {/* PESTAÑA 2: NUEVO PEDIDO DE VENTA                                          */}
      {/* ========================================================================= */}
      {activeTab === 'nuevo_pedido' && (
        <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-black text-slate-950 dark:text-white flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-red-600" />
              <span>Captura de Pedido de Venta</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Complete los datos acordados con el cliente. Al registrar, ingresará a la Programación para revisión y aprobación del Gestor Comercial.
            </p>
          </div>

          {formError && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* 1. Cliente */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Cliente Autorizado *
                </label>
                <button
                  type="button"
                  onClick={handleOpenNewClientModal}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 hover:underline transition-colors"
                  title="Registrar nuevo cliente en catálogo"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Nuevo Cliente</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') {
                      handleOpenNewClientModal();
                    } else {
                      handleSelectClient(e.target.value);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="">-- Seleccionar del Catálogo ({clients.length} clientes) --</option>
                  <option value="__NEW__" className="text-red-600 font-bold bg-red-50 dark:bg-red-950/40">
                    ➕ + Registrar Nuevo Cliente en Catálogo...
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.business_name} ({c.zone_code}) {c.tax_id ? `• ${c.tax_id}` : ''}
                    </option>
                  ))}
                </select>

                <Input
                  type="text"
                  placeholder="O escribir nombre de cliente..."
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    if (selectedClientId) setSelectedClientId('');
                  }}
                  className="text-xs"
                  required
                />
              </div>

              {selectedClientId && (
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Cliente en catálogo &bull; RUC: {clientTaxId || 'S/N'} &bull; Zona: {zoneCode}
                    {clients.find((c) => c.id === selectedClientId)?.address && (
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {' '}&bull; Entrega: {clients.find((c) => c.id === selectedClientId)?.address}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* 2. RUC / DNI y Zona */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  RUC / Documento Tributario
                </label>
                <Input
                  type="text"
                  placeholder="Ej: 20548963211"
                  value={clientTaxId}
                  onChange={(e) => setClientTaxId(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Zona de Entrega Comercial *
                </label>
                <select
                  value={zoneCode}
                  onChange={(e) => setZoneCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="METROPOLITANA">Metropolitana (Lima)</option>
                  <option value="NORTE">Zona Norte</option>
                  <option value="CENTRO">Zona Centro</option>
                  <option value="SUR">Zona Sur</option>
                </select>
              </div>
            </div>

            {/* 2.1 Punto de Entrega y Coordenadas Satelitales */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-red-600" />
                  <span>Punto de Entrega & Coordenadas Satelitales (Descarga) *</span>
                </label>
                {selectedClientData ? (
                  <button
                    type="button"
                    onClick={() => applyClientDeliveryData(selectedClientData)}
                    className="text-[10px] font-bold text-blue-700 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    title="Restaurar la dirección y coordenadas registradas en la ficha del cliente"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Usar datos del cliente</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">
                    Destino físico del camión
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Dirección / Punto de Descarga del Cliente *
                </label>
                <Input
                  type="text"
                  placeholder="Ej: Mercado Mayorista Santa Anita, Rampa 2 - Puesto 45 (o Av. Ejemplo 123)"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="text-xs font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Pegar desde Google Maps:
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej: -12.046374, -77.042793"
                    value={rawCoordsInput}
                    onChange={(e) => handleParseDeliveryCoords(e.target.value)}
                    className="text-xs font-mono font-medium"
                  />
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">
                    Clic derecho en Google Maps &rarr; copiar
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Latitud (WGS84):
                  </label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Ej: -12.046374"
                    value={deliveryLat}
                    onChange={(e) => setDeliveryLat(e.target.value)}
                    className="text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Longitud (WGS84):
                  </label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Ej: -77.042793"
                    value={deliveryLng}
                    onChange={(e) => setDeliveryLng(e.target.value)}
                    className="text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {selectedClientData &&
                (selectedClientData.latitude === null ||
                  selectedClientData.latitude === undefined ||
                  selectedClientData.longitude === null ||
                  selectedClientData.longitude === undefined) && (
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-relaxed">
                    El cliente "{selectedClientData.business_name}" no tiene coordenadas registradas. Ingréselas aquí para este pedido
                    o actualice su ficha en la pestaña Clientes.
                  </p>
                )}

              {deliveryLat && deliveryLng && (
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Coordenadas fijadas: {deliveryLat}, {deliveryLng}</span>
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${deliveryLat},${deliveryLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-emerald-800 dark:text-emerald-300 underline font-black inline-flex items-center gap-1"
                  >
                    <span>Verificar en Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* 3. Fecha de Creación del Pedido */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Fecha de Creación del Pedido *
                </label>
                <Input
                  type="date"
                  value={targetDeliveryDate}
                  readOnly
                  aria-readonly="true"
                  className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 cursor-not-allowed"
                  required
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Fecha automática de registro (solo lectura).
                </p>
              </div>
            </div>

            {/* 4. Líneas de Pedido (Línea 1, Línea 2, ...) */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Líneas de Pedido ({orderLinesSummary.lines.length})
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Agrega una línea por cada requerimiento de cantidad y sexo para este cliente.
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddOrderLine}
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Agregar Línea</span>
                </Button>
              </div>

              <div className="space-y-3">
                {orderLinesSummary.lines.map((line, index) => (
                  <div
                    key={line.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                        <span className="w-5 h-5 rounded-md bg-red-600 text-white text-[11px] flex items-center justify-center font-mono">
                          {index + 1}
                        </span>
                        <span>Línea {index + 1}</span>
                      </span>

                      {orderLinesSummary.lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOrderLine(line.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors"
                          title={`Quitar Línea ${index + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Quitar</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                      {/* Cantidad de Aves */}
                      <div className="md:col-span-4">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Cantidad de Aves *
                        </label>
                        <Input
                          type="number"
                          min="1"
                          step="50"
                          placeholder="Ej: 3000"
                          value={line.requestedQuantityStr}
                          onChange={(e) =>
                            handleUpdateOrderLine(line.id, { requestedQuantityStr: e.target.value })
                          }
                          className="text-sm font-mono font-black"
                          required
                        />
                      </div>

                      {/* Sexo: Macho o Hembras */}
                      <div className="md:col-span-4">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Sexo del Lote *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateOrderLine(line.id, { sexPreference: 'MACHO' })}
                            className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition-all ${
                              line.sexPreference === 'MACHO'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs shadow-blue-600/30'
                                : 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                            }`}
                          >
                            Macho
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateOrderLine(line.id, { sexPreference: 'HEMBRA' })}
                            className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition-all ${
                              line.sexPreference === 'HEMBRA'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs shadow-rose-600/30'
                                : 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 border-slate-200 dark:border-slate-700 hover:border-rose-300'
                            }`}
                          >
                            Hembras
                          </button>
                        </div>
                      </div>

                      {/* Densidad (solo lectura) y Jaulas Estimadas */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Densidad (aves/jla)
                        </label>
                        <Input
                          type="number"
                          value={line.density}
                          readOnly
                          aria-readonly="true"
                          className="text-sm font-mono font-black bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 cursor-not-allowed text-center"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Jaulas Est.
                        </label>
                        <div className="h-9 px-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center font-mono font-black text-sm text-red-600 dark:text-red-400">
                          {line.cagesNeeded.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Rango de Peso Opcional (solo permitido para Hembras; en Machos no aplica) */}
                    {line.sexPreference === 'HEMBRA' && (
                      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Peso Mínimo (kg) — Opcional
                          </label>
                          <Input
                            type="number"
                            step="0.05"
                            min="1.0"
                            placeholder="Opcional ej: 2.15"
                            value={line.minWeightStr}
                            onChange={(e) =>
                              handleUpdateOrderLine(line.id, { minWeightStr: e.target.value })
                            }
                            className="text-xs font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Peso Máximo (kg) — Opcional
                          </label>
                          <Input
                            type="number"
                            step="0.05"
                            min="1.0"
                            placeholder="Opcional ej: 2.35"
                            value={line.maxWeightStr}
                            onChange={(e) =>
                              handleUpdateOrderLine(line.id, { maxWeightStr: e.target.value })
                            }
                            className="text-xs font-mono font-bold"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  Densidad automática según Zona <strong>{zoneCode}</strong> (solo lectura desde Administración).
                </span>
                <div className="flex items-center gap-4 font-mono font-black">
                  <span className="text-slate-900 dark:text-slate-100">
                    Total Aves: {orderLinesSummary.totalBirds.toLocaleString()}
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    Total Jaulas: {orderLinesSummary.totalCages.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de Envío */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleCreateOrder(true)}
              className="w-full sm:w-auto text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              Guardar Borrador
            </Button>

            <Button
              type="button"
              variant="primary"
              isLoading={isSubmitting}
              onClick={() => handleCreateOrder(false)}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl shadow-md shadow-red-600/20"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              <span>Enviar Pedido a Preprogramación</span>
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: CATÁLOGO DE CLIENTES Y PUNTOS DE ENTREGA                       */}
      {/* ========================================================================= */}
      {activeTab === 'clientes' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-red-600" />
                Catálogo de Clientes &amp; Puntos de Entrega
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Administra la cartera comercial y coordenadas de entrega de los clientes autorizados.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  placeholder="Buscar razón social, RUC..."
                  className="pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl w-52 text-slate-900 dark:text-slate-100"
                />
              </div>

              <select
                value={clientZoneFilter}
                onChange={(e) => setClientZoneFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">Todas las Zonas</option>
                <option value="METROPOLITANA">Metropolitana</option>
                <option value="NORTE">Norte</option>
                <option value="CENTRO">Centro</option>
                <option value="SUR">Sur</option>
              </select>

              <Button
                type="button"
                size="sm"
                onClick={handleOpenNewClientModal}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Nuevo Cliente</span>
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900/90 text-slate-950 dark:text-slate-100 text-[11px] font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">Cliente / Contacto</th>
                    <th className="py-3 px-4 whitespace-nowrap">RUC / DNI</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Zona</th>
                    <th className="py-3 px-4">Dirección de Entrega</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Coordenadas GPS</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Estado</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 italic">
                        No se encontraron clientes con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => {
                      const hasCoords = client.latitude != null && client.longitude != null;
                      return (
                        <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-950 dark:text-white">{client.business_name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">{client.contact_phone || 'Sin teléfono'}</div>
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {client.tax_id}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-700 dark:text-slate-300">
                              {client.zone_code}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-[280px]">
                            <span className="line-clamp-2">{client.address || '—'}</span>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {hasCoords ? (
                              <a
                                href={`https://www.google.com/maps?q=${client.latitude},${client.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10.5px] font-mono font-bold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                                title="Ver punto de entrega en Google Maps"
                              >
                                <MapPin className="w-3 h-3" />
                                <span>{Number(client.latitude).toFixed(5)}, {Number(client.longitude).toFixed(5)}</span>
                              </a>
                            ) : (
                              <span className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400" title="Sin coordenadas: el pedido no podrá autocompletar el punto de entrega">
                                Sin coordenadas
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {client.is_active ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Activo</span>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400 font-bold">Inactivo</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditClient(client)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Editar ficha del cliente"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {hasCoords && (
                                <a
                                  href={`https://www.google.com/maps?q=${client.latitude},${client.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="Abrir punto de entrega en Google Maps"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
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

          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium px-1">
            Las coordenadas registradas aquí se cargan automáticamente como punto de entrega al seleccionar el cliente en un pedido.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA: MIS TRANSPORTES (SEGUIMIENTO DE RUTA DEL VENDEDOR)               */}
      {/* ========================================================================= */}
      {activeTab === 'monitoreo' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-600" />
                Monitoreo de Transportes
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Ruta de las unidades asignadas a {isGestorOrAdmin ? 'los pedidos aprobados' : 'tus pedidos aprobados'}.
              </p>
            </div>
            <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {transportOrders.length} unidad{transportOrders.length !== 1 ? 'es' : ''} en ruta
            </span>
          </div>

          {transportOrders.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
              <Truck className="w-9 h-9 mx-auto mb-2 text-slate-400" />
              <div className="font-bold text-slate-700 dark:text-slate-200">Aún no hay transportes en ruta</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Cuando el Gestor Comercial apruebe uno de los pedidos y le asigne una unidad, su ruta aparecerá aquí.
              </p>
              <Button
                size="sm"
                className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold"
                onClick={() => setActiveTab('programacion')}
              >
                Ver mis pedidos
              </Button>
            </div>
          ) : (
            <FlotaGpsMap readOnly orders={transportOrders} showSellerFilter={isGestorOrAdmin} />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: APROBAR Y ASIGNAR GALPÓN (ACCIÓN DEL GESTOR COMERCIAL)           */}
      {/* ========================================================================= */}
      {okModalOpen && selectedOrderForAction && (
        <Modal
          isOpen={okModalOpen}
          onClose={() => setOkModalOpen(false)}
          title={`Aprobación & Reserva de Pedido [${selectedOrderForAction.order_number}]`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Acción del Gestor Comercial:</strong> Al aprobar, se asigna formalmente el galpón de origen
                y se efectúa la reserva en firme de las aves requeridas para saca comercial.
              </div>
            </div>

            {/* Resumen del pedido */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Cliente:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedOrderForAction.client_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Fecha Requerida:</span>
                <span className="font-mono font-bold">{formatDateDisplay(selectedOrderForAction.target_delivery_date)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Aves Solicitadas:</span>
                <span className="font-mono font-black text-slate-900 dark:text-slate-100">
                  {selectedOrderForAction.requested_quantity.toLocaleString()} aves
                </span>
                <span className="text-[10px] text-slate-500 block">
                  ~{computeCages(selectedOrderForAction.requested_quantity, selectedOrderForAction.density_birds_per_cage)} jaulas
                  {' '}a {selectedOrderForAction.density_birds_per_cage || DEFAULT_DENSITY} aves/jaula
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Rango de Peso:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {selectedOrderForAction.min_weight_kg.toFixed(2)} - {selectedOrderForAction.max_weight_kg.toFixed(2)} kg
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Sexo Requerido:</span>
                <span className="font-bold">
                  {selectedOrderForAction.sex_preference === 'MACHO' && <span className="text-blue-600">♂ Solo Machos</span>}
                  {selectedOrderForAction.sex_preference === 'HEMBRA' && <span className="text-rose-600">♀ Solo Hembras</span>}
                  {(!selectedOrderForAction.sex_preference || selectedOrderForAction.sex_preference === 'INDISTINTO') && <span className="text-slate-600">⚖️ Indistinto</span>}
                </span>
              </div>
            </div>

            {/* Asignación formal de Galpón y Cantidad */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Granja Oficial Asignada *
                </label>
                <select
                  value={okFarmCode}
                  onChange={(e) => setOkFarmCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                >
                  {OFFICIAL_FARMS.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.code} - {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Código de Galpón *
                </label>
                <select
                  value={okBarnCode}
                  onChange={(e) => setOkBarnCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((b) => (
                    <option key={b} value={`G-${String(b).padStart(2, '0')}`}>
                      Galpón G-{String(b).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Cantidad a Reservar *
                </label>
                <Input
                  type="number"
                  value={okAllocatedQtyStr}
                  onChange={(e) => setOkAllocatedQtyStr(e.target.value)}
                  className="text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Densidad (Aves / Jaula) *
                </label>
                <Input
                  type="number"
                  min={MIN_DENSITY}
                  max={MAX_DENSITY}
                  step="1"
                  value={okDensityStr}
                  onChange={(e) => setOkDensityStr(e.target.value)}
                  className="text-xs font-mono font-bold"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  {computeCages(parseInt(okAllocatedQtyStr, 10) || 0, parseInt(okDensityStr, 10)).toLocaleString()} jaulas
                  {' '}• rango {MIN_DENSITY}-{MAX_DENSITY}
                </p>
              </div>
            </div>

            {/* Live Stock del Galpón en el Modal Dar OK */}
            {okBarnAvailability && (
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    Estado de Galpón [{okFarmCode} - {okBarnCode}]:
                  </span>
                  <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                    <span className="text-slate-600 dark:text-slate-400">
                      Conteo Físico: <strong>{okBarnAvailability.physical_count.toLocaleString()}</strong>
                    </span>
                    <span className="text-amber-600 dark:text-amber-400">
                      Ya reservadas: <strong>{(okBarnAvailability.reserved_count || 0).toLocaleString()}</strong>
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-black text-xs">
                      Saldo Libre: {okBarnAvailability.barn_balance_available.toLocaleString()} aves
                    </span>
                  </div>
                </div>

                {/* Advertencia si la cantidad a reservar supera el saldo disponible */}
                {(parseInt(okAllocatedQtyStr, 10) || 0) > okBarnAvailability.barn_balance_available && (
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg flex flex-col gap-1.5 text-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span className="text-rose-900 dark:text-rose-200 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        Cantidad a reservar ({(parseInt(okAllocatedQtyStr, 10) || 0).toLocaleString()} aves) excede el saldo disponible ({okBarnAvailability.barn_balance_available.toLocaleString()} aves).
                      </span>
                      {okBarnAvailability.barn_balance_available > 0 && (
                        <button
                          type="button"
                          onClick={() => setOkAllocatedQtyStr(String(okBarnAvailability.barn_balance_available))}
                          className="px-2 py-0.5 text-[10px] font-black bg-rose-600 hover:bg-rose-700 text-white rounded-md whitespace-nowrap shadow-xs"
                        >
                          Ajustar a {okBarnAvailability.barn_balance_available.toLocaleString()} aves
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Advertencia de Incompatibilidad de Sexo */}
                {selectedOrderForAction.sex_preference &&
                  selectedOrderForAction.sex_preference !== 'INDISTINTO' &&
                  okBarnAvailability.sex !== selectedOrderForAction.sex_preference && (
                    <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg flex items-center gap-1.5 text-xs text-rose-900 dark:text-rose-200 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        Incompatibilidad de Sexo: El pedido exige <strong>{selectedOrderForAction.sex_preference}</strong>, pero el galpón [{okBarnCode}] tiene aves <strong>{okBarnAvailability.sex}</strong>.
                      </span>
                    </div>
                  )}
              </div>
            )}

            {/* Observación / Constancia de Aprobación */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                Constancia u Observación del Gestor Comercial
              </label>
              <textarea
                rows={2}
                value={okObservation}
                onChange={(e) => setOkObservation(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOkModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                onClick={handleConfirmDarOk}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                <span>Aprobar &amp; Reservar Saca</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: OBSERVAR PEDIDO (GESTOR COMERCIAL)                               */}
      {/* ========================================================================= */}
      {observarModalOpen && selectedOrderForAction && (
        <Modal
          isOpen={observarModalOpen}
          onClose={() => setObservarModalOpen(false)}
          title={`Observar Pedido [${selectedOrderForAction.order_number}]`}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Indique al vendedor el motivo de la observación (ej. rango de peso no disponible en fecha, propuesta de fecha alternativa o entrega fraccionada):
            </p>

            <textarea
              rows={4}
              placeholder="Ej: El galpón solicitado no cuenta con aves en rango 2.2-2.4 kg para el jueves. Se sugiere rango 2.0-2.2 kg o mover la saca al sábado 08..."
              value={observationText}
              onChange={(e) => setObservationText(e.target.value)}
              className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setObservarModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                onClick={handleConfirmObservar}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                Enviar Observación al Vendedor
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DETALLE COMPLETO Y TRAZABILIDAD DEL PEDIDO                       */}
      {/* ========================================================================= */}
      {detailModalOpen && selectedOrderForAction && (
        <Modal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={`Detalle de Pedido: ${selectedOrderForAction.order_number}`}
          size="md"
        >
          <div className="space-y-3.5 text-xs">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="font-extrabold text-slate-950 dark:text-white text-sm block">
                  {selectedOrderForAction.client_name}
                </span>
                <span className="font-mono font-bold text-[10.5px] text-slate-500 dark:text-slate-400">
                  RUC: {selectedOrderForAction.client_tax_id || 'No registrado'}
                </span>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  selectedOrderForAction.status === 'APROBADO_RESERVADO'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : selectedOrderForAction.status === 'CON_OBSERVACION'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    : selectedOrderForAction.status === 'CANCELADO'
                    ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {selectedOrderForAction.status === 'APROBADO_RESERVADO' && 'Aprobado'}
                {selectedOrderForAction.status === 'CON_OBSERVACION' && 'Observado'}
                {selectedOrderForAction.status === 'CANCELADO' && 'Cancelado'}
                {selectedOrderForAction.status === 'REGISTRADO' && 'Por aprobar'}
                {selectedOrderForAction.status === 'BORRADOR' && 'Borrador'}
                {selectedOrderForAction.status === 'DESPACHADO' && 'Despachado'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <span className="text-slate-500 block">Vendedor Comercial:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedOrderForAction.seller_full_name || selectedOrderForAction.seller_username || 'No registrado'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Zona de Entrega:</span>
                <span className="font-bold">Zona {selectedOrderForAction.zone_code}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Fecha Requerida:</span>
                <span className="font-mono font-bold">{formatDateDisplay(selectedOrderForAction.target_delivery_date)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Requisito de Sexo:</span>
                <span className="font-bold">
                  {selectedOrderForAction.sex_preference === 'MACHO' && <span className="text-blue-600">♂ Solo Machos</span>}
                  {selectedOrderForAction.sex_preference === 'HEMBRA' && <span className="text-rose-600">♀ Solo Hembras</span>}
                  {(!selectedOrderForAction.sex_preference || selectedOrderForAction.sex_preference === 'INDISTINTO') && <span className="text-slate-600">⚖️ Indistinto</span>}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Cantidad Solicitada:</span>
                <span className="font-mono font-black text-slate-950 dark:text-white">
                  {selectedOrderForAction.requested_quantity.toLocaleString()} aves
                </span>
                {selectedOrderForAction.allocated_quantity > 0 && (
                  <span className="text-[10px] text-emerald-600 block">
                    Asignadas: {selectedOrderForAction.allocated_quantity.toLocaleString()}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500 block">Rango de Peso:</span>
                <span className="font-mono font-bold">
                  {selectedOrderForAction.min_weight_kg.toFixed(2)} - {selectedOrderForAction.max_weight_kg.toFixed(2)} kg
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Densidad de Carga:</span>
                <span className="font-mono font-bold">
                  {selectedOrderForAction.density_birds_per_cage || DEFAULT_DENSITY} aves/jaula
                </span>
                <span className="text-[10px] text-slate-400 block">
                  ~{selectedOrderForAction.estimated_cages || computeCages(selectedOrderForAction.requested_quantity, selectedOrderForAction.density_birds_per_cage)} jaulas
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Galpón Asignado:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedOrderForAction.assigned_farm_code
                    ? `${selectedOrderForAction.assigned_farm_code} - ${selectedOrderForAction.assigned_barn_code}`
                    : 'Aún no asignado'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 block font-bold mb-0.5">Punto de Entrega</span>
              <p className="text-slate-800 dark:text-slate-200">
                {selectedOrderForAction.delivery_address || 'No registrado'}
              </p>
              {selectedOrderForAction.delivery_latitude != null && selectedOrderForAction.delivery_longitude != null && (
                <a
                  href={`https://www.google.com/maps?q=${selectedOrderForAction.delivery_latitude},${selectedOrderForAction.delivery_longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-700 dark:text-blue-400 hover:underline mt-1"
                >
                  <MapPin className="w-3 h-3" />
                  Ver en Google Maps
                </a>
              )}
            </div>

            {selectedOrderForAction.transport_assigned && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900">
                <span className="text-blue-900 dark:text-blue-300 block font-bold mb-0.5">Transporte Asignado</span>
                <p className="text-slate-800 dark:text-slate-200">
                  {selectedOrderForAction.transport_plate || 'Sin placa'}
                  {selectedOrderForAction.transport_driver_name ? ` · ${selectedOrderForAction.transport_driver_name}` : ''}
                </p>
                {selectedOrderForAction.loading_slot_time && (
                  <p className="text-[10.5px] font-mono text-blue-700 dark:text-blue-300">
                    Ventana de carga: {selectedOrderForAction.loading_slot_time}
                  </p>
                )}
              </div>
            )}

            {selectedOrderForAction.gestor_observation && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-1">
                <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>Observación del Gestor Comercial ({selectedOrderForAction.gestor_username || 'Gestor'}):</span>
                </div>
                <p className="text-amber-800 dark:text-amber-300">
                  {selectedOrderForAction.gestor_observation}
                </p>
              </div>
            )}

            {selectedOrderForAction.notes && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 block font-bold mb-0.5">Notas del Vendedor:</span>
                <p className="text-slate-700 dark:text-slate-300">{selectedOrderForAction.notes}</p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setDetailModalOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR NUEVO CLIENTE EN CATÁLOGO (+ NUEVO CLIENTE)              */}
      {/* ========================================================================= */}
      {newClientModalOpen && (
        <Modal
          isOpen={newClientModalOpen}
          onClose={() => setNewClientModalOpen(false)}
          title="Registrar Nuevo Cliente en Catálogo"
          size="md"
        >
          <form onSubmit={handleSaveNewClient} className="space-y-4 text-xs">
            <div className="p-3 bg-red-50/70 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/50 flex items-start gap-2.5">
              <UserPlus className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>Catálogo Comercial:</strong> Registre el cliente para incorporarlo al directorio oficial.
                Al guardar, se auto-seleccionará automáticamente en el formulario del pedido.
              </div>
            </div>

            {newClientError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{newClientError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Razón Social o Nombre Comercial *
                </label>
                <Input
                  type="text"
                  placeholder="Ej: Inversiones Avícolas Lurín S.A.C."
                  value={newClientBusinessName}
                  onChange={(e) => setNewClientBusinessName(e.target.value)}
                  className="text-xs"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    RUC / Documento Tributario *
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej: 20601234987"
                    value={newClientTaxId}
                    onChange={(e) => setNewClientTaxId(e.target.value)}
                    className="text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Zona de Entrega Comercial *
                  </label>
                  <select
                    value={newClientZone}
                    onChange={(e) => setNewClientZone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                  >
                    <option value="METROPOLITANA">Metropolitana (Lima)</option>
                    <option value="NORTE">Zona Norte</option>
                    <option value="CENTRO">Zona Centro</option>
                    <option value="SUR">Zona Sur</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Dirección
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej: Av. Industrial 450, Lurín"
                    value={newClientAddress}
                    onChange={(e) => setNewClientAddress(e.target.value)}
                    className="text-xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Dirección del punto de entrega habitual. Se autocompletará al elegir el cliente en un pedido.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Teléfono de Contacto
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej: +51 987 654 321"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Coordenadas satelitales del punto de entrega (opcional, autocompletan el pedido) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Coordenadas Satelitales del Punto de Entrega
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">Opcional</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Latitud (WGS84)</label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="Ej: -12.046374"
                      value={newClientLat}
                      onChange={(e) => setNewClientLat(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Longitud (WGS84)</label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="Ej: -77.042793"
                      value={newClientLng}
                      onChange={(e) => setNewClientLng(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Recomendado: regístrelas ahora para que cada pedido de este cliente cargue solo su punto de entrega.
                  En Google Maps: clic derecho sobre el punto → copiar coordenadas.
                </p>
              </div>

              {/* Rango de peso habitual del cliente (opcional) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Rango de Peso Habitual del Cliente (kg)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Peso Mín (kg)</label>
                    <Input
                      type="number"
                      step="0.05"
                      min="1.0"
                      max="4.0"
                      value={newClientMinWeight}
                      onChange={(e) => setNewClientMinWeight(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Peso Máx (kg)</label>
                    <Input
                      type="number"
                      step="0.05"
                      min="1.0"
                      max="4.0"
                      value={newClientMaxWeight}
                      onChange={(e) => setNewClientMaxWeight(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setNewClientModalOpen(false)}
                disabled={isSavingClient}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
                disabled={isSavingClient}
              >
                {isSavingClient ? (
                  <span>Guardando...</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Guardar y Seleccionar Cliente</span>
                  </span>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR FICHA DE CLIENTE (INCLUYE DIRECCIÓN Y COORDENADAS)           */}
      {/* ========================================================================= */}
      {editClientModalOpen && (
        <Modal
          isOpen={editClientModalOpen}
          onClose={() => setEditClientModalOpen(false)}
          title="Editar Ficha del Cliente"
          description="Actualice los datos, la dirección y las coordenadas del punto de entrega."
          size="md"
        >
          <form onSubmit={handleSaveEditClient} className="space-y-4 text-xs">
            {editClientError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{editClientError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Razón Social o Nombre Comercial *
              </label>
              <Input
                type="text"
                value={editClientForm.business_name}
                onChange={(e) => setEditClientForm((f) => ({ ...f, business_name: e.target.value }))}
                className="text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  RUC / Documento Tributario *
                </label>
                <Input
                  type="text"
                  value={editClientForm.tax_id}
                  onChange={(e) => setEditClientForm((f) => ({ ...f, tax_id: e.target.value }))}
                  className="text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Zona de Entrega Comercial *
                </label>
                <select
                  value={editClientForm.zone_code}
                  onChange={(e) => setEditClientForm((f) => ({ ...f, zone_code: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="METROPOLITANA">Metropolitana (Lima)</option>
                  <option value="NORTE">Zona Norte</option>
                  <option value="CENTRO">Zona Centro</option>
                  <option value="SUR">Zona Sur</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Dirección de Entrega
                </label>
                <Input
                  type="text"
                  value={editClientForm.address}
                  onChange={(e) => setEditClientForm((f) => ({ ...f, address: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Teléfono de Contacto
                </label>
                <Input
                  type="text"
                  value={editClientForm.contact_phone}
                  onChange={(e) => setEditClientForm((f) => ({ ...f, contact_phone: e.target.value }))}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Coordenadas del punto de entrega */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Coordenadas Satelitales del Punto de Entrega
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Latitud (WGS84)</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Ej: -12.046374"
                    value={editClientForm.latitude}
                    onChange={(e) => setEditClientForm((f) => ({ ...f, latitude: e.target.value }))}
                    className="text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Longitud (WGS84)</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Ej: -77.042793"
                    value={editClientForm.longitude}
                    onChange={(e) => setEditClientForm((f) => ({ ...f, longitude: e.target.value }))}
                    className="text-xs font-mono"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Deje ambos campos vacíos si el cliente aún no tiene un punto de entrega fijo.
              </p>
            </div>

            {/* Pesos preferentes y estado */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Peso Mín (kg)</label>
                <Input
                  type="number"
                  step="0.05"
                  min="1.0"
                  max="4.0"
                  value={editClientForm.min_weight}
                  onChange={(e) => setEditClientForm((f) => ({ ...f, min_weight: e.target.value }))}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Peso Máx (kg)</label>
                <Input
                  type="number"
                  step="0.05"
                  min="1.0"
                  max="4.0"
                  value={editClientForm.max_weight}
                  onChange={(e) => setEditClientForm((f) => ({ ...f, max_weight: e.target.value }))}
                  className="text-xs"
                />
              </div>
              <label className="flex items-center gap-2 pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editClientForm.is_active}
                  onChange={(e) => setEditClientForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-red-600"
                />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Cliente activo</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditClientModalOpen(false)}
                disabled={isSavingClientEdit}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
                disabled={isSavingClientEdit}
              >
                {isSavingClientEdit ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SEGUIMIENTO DE RUTA DEL TRANSPORTE (VENDEDOR, SOLO LECTURA)        */}
      {/* ========================================================================= */}
      {trackingOrder && (
        <Modal
          isOpen={!!trackingOrder}
          onClose={() => setTrackingOrder(null)}
          title={`Seguimiento de Ruta — ${trackingOrder.order_number}`}
          description={`${trackingOrder.client_name} • ${trackingOrder.assigned_farm_code || 'Granja'} ${trackingOrder.assigned_barn_code || ''}`}
          size="2xl"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200">
                <Truck className="w-3.5 h-3.5" />
                {trackingOrder.transport_plate || 'Sin placa'}
              </span>
              {trackingOrder.transport_driver_name && (
                <span className="text-slate-600 dark:text-slate-300">
                  Chofer: <strong>{trackingOrder.transport_driver_name}</strong>
                </span>
              )}
              {trackingOrder.transport_driver_phone && (
                <span className="text-slate-600 dark:text-slate-300 font-mono">{trackingOrder.transport_driver_phone}</span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold">
                {trackingOrder.dispatch_phase === 'EN_TRANSITO'
                  ? 'En tránsito'
                  : trackingOrder.dispatch_phase === 'EN_GRANJA_CARGANDO'
                  ? 'Cargando en granja'
                  : trackingOrder.dispatch_phase === 'ENTREGADO_CONFORME'
                  ? 'Entregado'
                  : 'Transporte asignado'}
              </span>
            </div>

            <FlotaGpsMap
              initialSelectedTruckId={
                gpsSimulationStore.getTrucks().find((t) => t.orderId === trackingOrder.order_number)?.id
              }
              readOnly={true}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};
