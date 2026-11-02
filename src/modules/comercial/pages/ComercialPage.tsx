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
import {
  Client,
  ClientCreatePayload,
  SalesOrder,
  OrderCreatePayload,
  OrderActionPayload,
  SexPreference,
  ProgramacionTransporteItem,
  ProgramacionTransporteResponse,
} from '@/types/comercial';
import { TablaGeneralSaldoItem, OFFICIAL_FARMS, generateInitialOfficialData } from '@/types/pecuaria';
import { RoxiCopilotCard } from '@/components/roxi/RoxiCopilotCard';
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
  Scale,
  Package,
  Printer,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';

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

  // Estados de navegación interna por pestañas
  const [activeTab, setActiveTab] = useState<'programacion' | 'nuevo_pedido' | 'disponibilidad'>('programacion');

  // Datos principales
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [clients, setClients] = useState<Client[]>(() => {
    const local = localStorage.getItem('avicola_comercial_clients');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [];
  });
  const [pecuariaItems, setPecuariaItems] = useState<TablaGeneralSaldoItem[]>(() => {
    const local = localStorage.getItem('avicola_pecuaria_table_items');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return generateInitialOfficialData();
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filtros de la pestaña Programación
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');

  // Filtros de la pestaña Stock Disponible de Pecuaria
  const [pecFarmFilter, setPecFarmFilter] = useState<string>('ALL');
  const [pecSexFilter, setPecSexFilter] = useState<string>('ALL');
  const [pecAgeFilter, setPecAgeFilter] = useState<'ALL' | 'OVER_45' | 'UNDER_45'>('ALL');
  const [pecSearchQuery, setPecSearchQuery] = useState<string>('');

  // Formulario de Nuevo Pedido
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [clientTaxId, setClientTaxId] = useState<string>('');
  const [zoneCode, setZoneCode] = useState<string>('METROPOLITANA');
  const [targetDeliveryDate, setTargetDeliveryDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [requestedQuantityStr, setRequestedQuantityStr] = useState<string>('3000');
  const [minWeightStr, setMinWeightStr] = useState<string>('2.20');
  const [maxWeightStr, setMaxWeightStr] = useState<string>('2.45');
  const [sexPreference, setSexPreference] = useState<SexPreference>('INDISTINTO');
  const [suggestedFarmCode, setSuggestedFarmCode] = useState<string>('TRAD1');
  const [suggestedBarnCode, setSuggestedBarnCode] = useState<string>('G-01');
  const [externalReference, setExternalReference] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modales de Acción del Gestor Comercial (Dar OK / Observar / Cancelar / Detalle)
  const [selectedOrderForAction, setSelectedOrderForAction] = useState<SalesOrder | null>(null);
  const [okModalOpen, setOkModalOpen] = useState<boolean>(false);
  const [observarModalOpen, setObservarModalOpen] = useState<boolean>(false);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);

  // Modal de Registro Rápido de Nuevo Cliente (+ Nuevo Cliente)
  const [newClientModalOpen, setNewClientModalOpen] = useState<boolean>(false);
  const [newClientBusinessName, setNewClientBusinessName] = useState<string>('');
  const [newClientTaxId, setNewClientTaxId] = useState<string>('');
  const [newClientZone, setNewClientZone] = useState<string>('METROPOLITANA');
  const [newClientAddress, setNewClientAddress] = useState<string>('');
  const [newClientPhone, setNewClientPhone] = useState<string>('');
  const [newClientMinWeight, setNewClientMinWeight] = useState<string>('2.20');
  const [newClientMaxWeight, setNewClientMaxWeight] = useState<string>('2.50');
  const [newClientError, setNewClientError] = useState<string | null>(null);
  const [isSavingClient, setIsSavingClient] = useState<boolean>(false);

  // Modal de Hoja de Programación Diaria para Transporte (pedidos con OK)
  const [transportSheetOpen, setTransportSheetOpen] = useState<boolean>(false);
  const [transportSelectedDate, setTransportSelectedDate] = useState<string>('ALL');
  const [isExportingCSV, setIsExportingCSV] = useState<boolean>(false);

  // Campos para la acción de Dar OK
  const [okFarmCode, setOkFarmCode] = useState<string>('');
  const [okBarnCode, setOkBarnCode] = useState<string>('');
  const [okAllocatedQtyStr, setOkAllocatedQtyStr] = useState<string>('');
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
          const storedPecuaria = localStorage.getItem('avicola_pecuaria_table_items');
          if (storedPecuaria) {
            setPecuariaItems(JSON.parse(storedPecuaria));
          } else {
            const initial = generateInitialOfficialData();
            setPecuariaItems(initial);
            localStorage.setItem('avicola_pecuaria_table_items', JSON.stringify(initial));
          }
        }
      } catch {
        const storedPecuaria = localStorage.getItem('avicola_pecuaria_table_items');
        if (storedPecuaria) {
          setPecuariaItems(JSON.parse(storedPecuaria));
        } else {
          const initial = generateInitialOfficialData();
          setPecuariaItems(initial);
          localStorage.setItem('avicola_pecuaria_table_items', JSON.stringify(initial));
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
  // GESTIÓN DE DISPONIBILIDAD Y RESERVA EN TIEMPO REAL (PECUARIA <-> COMERCIAL)
  // ---------------------------------------------------------------------------
  const reserveBarnStock = (farmCode: string, barnCode: string, quantity: number) => {
    setPecuariaItems((prev) => {
      const updated = prev.map((item) => {
        if (item.farm_code === farmCode && item.barn_code === barnCode) {
          const newReserved = (item.reserved_count || 0) + quantity;
          const newAvailable = Math.max(
            0,
            item.physical_count - item.specials_general_count - newReserved - (item.sold_pending_count || 0)
          );
          return {
            ...item,
            reserved_count: newReserved,
            barn_balance_available: newAvailable,
          };
        }
        return item;
      });
      localStorage.setItem('avicola_pecuaria_table_items', JSON.stringify(updated));
      return updated;
    });
  };

  const releaseBarnStock = (farmCode: string, barnCode: string, quantity: number) => {
    setPecuariaItems((prev) => {
      const updated = prev.map((item) => {
        if (item.farm_code === farmCode && item.barn_code === barnCode) {
          const newReserved = Math.max(0, (item.reserved_count || 0) - quantity);
          const newAvailable = Math.max(
            0,
            item.physical_count - item.specials_general_count - newReserved - (item.sold_pending_count || 0)
          );
          return {
            ...item,
            reserved_count: newReserved,
            barn_balance_available: newAvailable,
          };
        }
        return item;
      });
      localStorage.setItem('avicola_pecuaria_table_items', JSON.stringify(updated));
      return updated;
    });
  };

  // Disponibilidad en vivo del galpón sugerido en el formulario de Nuevo Pedido
  const selectedBarnAvailability = useMemo(() => {
    return pecuariaItems.find(
      (item) => item.farm_code === suggestedFarmCode && item.barn_code === suggestedBarnCode
    );
  }, [pecuariaItems, suggestedFarmCode, suggestedBarnCode]);

  // Disponibilidad en vivo del galpón seleccionado en el modal Dar OK del Gestor
  const okBarnAvailability = useMemo(() => {
    return pecuariaItems.find(
      (item) => item.farm_code === okFarmCode && item.barn_code === okBarnCode
    );
  }, [pecuariaItems, okFarmCode, okBarnCode]);

  // Estimación Logística y Tonelaje en tiempo real (Kg, Toneladas, Jaulas y Camiones)
  const logisticsCalculation = useMemo(() => {
    const qty = parseInt(requestedQuantityStr, 10) || 0;
    const minW = parseFloat(minWeightStr) || 0;
    const maxW = parseFloat(maxWeightStr) || 0;
    const avgW = minW + maxW > 0 ? (minW + maxW) / 2 : 2.30;
    const totalKg = Math.round(qty * avgW * 100) / 100;
    const totalTons = Math.round((totalKg / 1000) * 100) / 100;
    const cagesNeeded = Math.ceil(qty / 8); // Estándar de 8 aves por jaula de transporte
    const tripsEstimate = Math.max(1, Math.ceil(cagesNeeded / 450)); // Camión avícola estándar de ~450 jaulas (3,600 aves)
    return {
      qty,
      avgW: Math.round(avgW * 100) / 100,
      totalKg,
      totalTons,
      cagesNeeded,
      tripsEstimate,
    };
  }, [requestedQuantityStr, minWeightStr, maxWeightStr]);

  // Al seleccionar cliente del catálogo, auto-llenar datos preferidos
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const c = clients.find((item) => item.id === clientId);
    if (c) {
      setClientName(c.business_name);
      setClientTaxId(c.tax_id);
      setZoneCode(c.zone_code);
      if (c.preferred_min_weight) setMinWeightStr(String(c.preferred_min_weight));
      if (c.preferred_max_weight) setMaxWeightStr(String(c.preferred_max_weight));
    }
  };

  // Abrir modal de nuevo cliente (+ Nuevo Cliente)
  const handleOpenNewClientModal = () => {
    setNewClientBusinessName(clientName.trim());
    setNewClientTaxId(clientTaxId.trim());
    setNewClientZone(zoneCode || 'METROPOLITANA');
    setNewClientAddress('');
    setNewClientPhone('');
    setNewClientMinWeight(minWeightStr || '2.20');
    setNewClientMaxWeight(maxWeightStr || '2.50');
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

    setIsSavingClient(true);
    try {
      const payload: ClientCreatePayload = {
        business_name: bName,
        tax_id: tId,
        zone_code: newClientZone,
        address: newClientAddress.trim() || undefined,
        contact_phone: newClientPhone.trim() || undefined,
        preferred_min_weight: minW,
        preferred_max_weight: maxW,
        is_active: true,
      };

      let createdClient: Client;
      try {
        createdClient = await apiClient<Client>('/comercial/clients', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch {
        // En caso de fallo de red o modo offline
        createdClient = {
          id: `client-${Date.now()}`,
          business_name: payload.business_name,
          tax_id: payload.tax_id,
          zone_code: payload.zone_code,
          address: payload.address,
          contact_phone: payload.contact_phone,
          preferred_min_weight: payload.preferred_min_weight,
          preferred_max_weight: payload.preferred_max_weight,
          is_active: true,
          created_at: new Date().toISOString(),
        };
      }

      // Actualizar state y caché de clientes
      const updated = [createdClient, ...clients];
      setClients(updated);
      localStorage.setItem('avicola_comercial_clients', JSON.stringify(updated));

      // Auto-seleccionar e insertar en el pedido comercial
      setSelectedClientId(createdClient.id);
      setClientName(createdClient.business_name);
      setClientTaxId(createdClient.tax_id);
      setZoneCode(createdClient.zone_code);
      if (createdClient.preferred_min_weight) {
        setMinWeightStr(String(createdClient.preferred_min_weight));
      }
      if (createdClient.preferred_max_weight) {
        setMaxWeightStr(String(createdClient.preferred_max_weight));
      }

      setNewClientModalOpen(false);
      showToast(`✔ Cliente "${createdClient.business_name}" registrado e insertado en el pedido.`);
    } catch (error: any) {
      setNewClientError(error?.message || 'Error al registrar el nuevo cliente.');
    } finally {
      setIsSavingClient(false);
    }
  };

  // Lista de pedidos con OK Gestor (APROBADO_RESERVADO)
  const approvedOrdersList = useMemo(() => {
    return orders.filter((o) => o.status === 'APROBADO_RESERVADO');
  }, [orders]);

  // Fechas únicas disponibles entre los pedidos con OK
  const approvedDatesList = useMemo(() => {
    const dates = Array.from(new Set(approvedOrdersList.map((o) => o.target_delivery_date))).filter(Boolean);
    return dates.sort();
  }, [approvedOrdersList]);

  // Pedidos filtrados para la Hoja de Transporte según la fecha seleccionada
  const transportFilteredOrders = useMemo(() => {
    if (transportSelectedDate === 'ALL') {
      return [...approvedOrdersList].sort((a, b) => {
        if (a.target_delivery_date !== b.target_delivery_date) {
          return a.target_delivery_date.localeCompare(b.target_delivery_date);
        }
        return (a.assigned_farm_code || '').localeCompare(b.assigned_farm_code || '');
      });
    }
    return approvedOrdersList
      .filter((o) => o.target_delivery_date === transportSelectedDate)
      .sort((a, b) => (a.assigned_farm_code || '').localeCompare(b.assigned_farm_code || ''));
  }, [approvedOrdersList, transportSelectedDate]);

  // Resumen logístico consolidado de la Hoja de Transporte
  const transportSummary = useMemo(() => {
    let totalBirds = 0;
    let totalCages = 0;
    let totalKg = 0;

    transportFilteredOrders.forEach((o) => {
      const birds = o.allocated_quantity || o.requested_quantity || 0;
      const cages = o.estimated_cages || Math.ceil(birds / 8);
      const kg = o.estimated_total_kg || Math.round(birds * ((o.min_weight_kg + o.max_weight_kg) / 2));
      totalBirds += birds;
      totalCages += cages;
      totalKg += kg;
    });

    const totalTons = Math.round((totalKg / 1000) * 10) / 10;
    const estimatedTrucks = Math.max(transportFilteredOrders.length > 0 ? 1 : 0, Math.ceil(totalCages / 450));

    return {
      totalOrders: transportFilteredOrders.length,
      totalBirds,
      totalCages,
      totalKg,
      totalTons,
      estimatedTrucks,
    };
  }, [transportFilteredOrders]);

  // Abrir la Hoja de Programación Diaria y Transporte
  const handleOpenTransportSheet = () => {
    if (approvedDatesList.length > 0) {
      setTransportSelectedDate(approvedDatesList[0]);
    } else {
      setTransportSelectedDate('ALL');
    }
    setTransportSheetOpen(true);
  };

  // Imprimir Hoja de Programación (dispara ventana de impresión limpia en documento aislado landscape)
  const handlePrintTransportSheet = () => {
    if (transportFilteredOrders.length === 0) {
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

    const fechaDespacho = transportSelectedDate === 'ALL' ? 'CONSOLIDADO GENERAL' : formatDateDisplay(transportSelectedDate);
    const fechaEmision = new Date().toLocaleDateString('es-PE') + ' ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

    const rowsHtml = transportFilteredOrders.map((o, idx) => {
      const birds = o.allocated_quantity || o.requested_quantity || 0;
      const cages = o.estimated_cages || Math.ceil(birds / 8);
      const tons = o.estimated_total_kg
        ? Math.round(o.estimated_total_kg / 100) / 10
        : Math.round((birds * ((o.min_weight_kg + o.max_weight_kg) / 2)) / 1000 * 10) / 10;
      const sex = o.sex_preference === 'MACHO' ? 'Macho' : o.sex_preference === 'HEMBRA' ? 'Hembra' : 'Indistinto';
      const weightRange = `${o.min_weight_kg.toFixed(2)} - ${o.max_weight_kg.toFixed(2)} kg`;
      const ocNotes = [o.external_reference ? `OC: ${o.external_reference}` : '', o.notes || o.gestor_observation || ''].filter(Boolean).join(' • ');

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
          <td style="font-size: 8.5px; color: #475569; max-width: 180px;">${ocNotes || '-'}</td>
        </tr>
      `;
    }).join('');

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
              <div><strong>SISTEMA:</strong> SACA &amp; STOCK OFICIAL</div>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi-card">
              <div class="kpi-label">Aves Confirmadas</div>
              <div class="kpi-value">${transportSummary.totalBirds.toLocaleString()}</div>
              <div class="kpi-sub">${transportSummary.totalOrders} pedidos aprobados</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Tonelaje Total</div>
              <div class="kpi-value" style="color: #047857;">${transportSummary.totalTons} Ton</div>
              <div class="kpi-sub">${Math.round(transportSummary.totalKg).toLocaleString()} kg aprox.</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Total Jaulas</div>
              <div class="kpi-value" style="color: #1d4ed8;">~${transportSummary.totalCages.toLocaleString()}</div>
              <div class="kpi-sub">Estándar ~8 aves / jaula</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Camiones Estimados</div>
              <div class="kpi-value" style="color: #b45309;">~${transportSummary.estimatedTrucks} viaje(s)</div>
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
                <th>Observaciones / Despacho</th>
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

  // Exportar Hoja de Programación a archivo CSV / Excel
  const handleExportTransportCSV = () => {
    if (transportFilteredOrders.length === 0) {
      showToast('⚠️ No hay pedidos aprobados para exportar en esta fecha.');
      return;
    }

    setIsExportingCSV(true);
    try {
      const headers = [
        'Nro Pedido',
        'Fecha Saca',
        'Granja Origen',
        'Galpon Origen',
        'Cliente',
        'RUC',
        'Zona Entrega',
        'Aves Asignadas',
        'Jaulas (~8 aves)',
        'Sexo',
        'Rango Peso Solicitado (kg)',
        'Toneladas Estimadas',
        'Gestor Comercial Aprobador',
        'Orden Compra / OC',
        'Observaciones / Despacho',
      ];

      const rows = transportFilteredOrders.map((o) => {
        const birds = o.allocated_quantity || o.requested_quantity || 0;
        const cages = o.estimated_cages || Math.ceil(birds / 8);
        const kg = o.estimated_total_kg || Math.round(birds * ((o.min_weight_kg + o.max_weight_kg) / 2));
        const tons = Math.round((kg / 1000) * 10) / 10;
        const sex = o.sex_preference || 'INDISTINTO';
        const weightRange = `${o.min_weight_kg.toFixed(2)} - ${o.max_weight_kg.toFixed(2)}`;

        return [
          `"${o.order_number}"`,
          `"${o.target_delivery_date}"`,
          `"${o.assigned_farm_code || 'POR ASIGNAR'}"`,
          `"${o.assigned_barn_code || 'POR ASIGNAR'}"`,
          `"${o.client_name.replace(/"/g, '""')}"`,
          `"${o.client_tax_id || ''}"`,
          `"${o.zone_code}"`,
          birds,
          cages,
          `"${sex}"`,
          `"${weightRange}"`,
          tons,
          `"${o.gestor_username || 'Gestor'}"`,
          `"${(o.external_reference || '').replace(/"/g, '""')}"`,
          `"${(o.notes || o.gestor_observation || '').replace(/"/g, '""')}"`,
        ].join(';');
      });

      // Agregar BOM UTF-8 (\uFEFF) para compatibilidad con Excel en español
      const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateTag = transportSelectedDate === 'ALL' ? 'CONSOLIDADO' : transportSelectedDate;
      link.href = url;
      link.setAttribute('download', `Hoja_Programacion_Transporte_${dateTag}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('✔ Hoja de Programación Diaria exportada a Excel (CSV).');
    } catch {
      showToast('❌ Error al exportar la hoja de programación.');
    } finally {
      setIsExportingCSV(false);
    }
  };

  // Generar nuevo pedido
  const handleCreateOrder = async (isDraft: boolean) => {
    setFormError(null);
    const qty = parseInt(requestedQuantityStr, 10) || 0;
    const minW = parseFloat(minWeightStr) || 0;
    const maxW = parseFloat(maxWeightStr) || 0;

    if (!clientName.trim()) {
      setFormError('Por favor seleccione o ingrese el nombre del cliente.');
      return;
    }
    if (qty <= 0) {
      setFormError('La cantidad solicitada debe ser mayor a 0 aves.');
      return;
    }
    if (minW <= 0 || maxW <= 0) {
      setFormError('Ingrese pesos mínimos y máximos válidos en kg.');
      return;
    }
    if (minW > maxW) {
      setFormError(`El peso mínimo (${minW} kg) no puede superar al peso máximo (${maxW} kg).`);
      return;
    }

    let finalNotes = orderNotes.trim();
    if (selectedBarnAvailability && qty > selectedBarnAvailability.barn_balance_available) {
      const deficit = qty - selectedBarnAvailability.barn_balance_available;
      const alertNotice = `[ALERTA STOCK: Solicitadas ${qty.toLocaleString()} aves vs ${selectedBarnAvailability.barn_balance_available.toLocaleString()} disponibles en ${suggestedFarmCode}-${suggestedBarnCode}. Déficit: ${deficit.toLocaleString()} aves a evaluar por Gestor]`;
      finalNotes = finalNotes ? `${finalNotes} | ${alertNotice}` : alertNotice;
    }

    // Validación de sexo requerido vs lote sugerido
    if (sexPreference !== 'INDISTINTO' && selectedBarnAvailability && selectedBarnAvailability.sex !== sexPreference) {
      const alertSex = `[ALERTA SEXO: Pedido exige ${sexPreference === 'MACHO' ? 'Solo Machos' : 'Solo Hembras'} vs Galpón ${suggestedBarnCode} con aves ${selectedBarnAvailability.sex}]`;
      finalNotes = finalNotes ? `${finalNotes} | ${alertSex}` : alertSex;
    }

    setIsSubmitting(true);
    const payload: OrderCreatePayload = {
      client_id: selectedClientId || undefined,
      client_name: clientName.trim(),
      client_tax_id: clientTaxId.trim() || undefined,
      seller_full_name: user?.full_name || 'Juan Carlos Pérez Gálvez',
      zone_code: zoneCode,
      target_delivery_date: targetDeliveryDate,
      requested_quantity: qty,
      min_weight_kg: minW,
      max_weight_kg: maxW,
      sex_preference: sexPreference,
      suggested_farm_code: suggestedFarmCode,
      suggested_barn_code: suggestedBarnCode,
      external_reference: externalReference.trim() || undefined,
      notes: finalNotes || undefined,
      is_draft: isDraft,
    };

    try {
      let createdOrder: SalesOrder;
      try {
        createdOrder = await apiClient<SalesOrder>('/comercial/orders', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch {
        // Fallback local
        const nextNum = orders.length + 1;
        createdOrder = {
          id: `ord-loc-${Date.now()}`,
          order_number: `PED-2026-${String(nextNum).padStart(3, '0')}`,
          client_id: payload.client_id,
          client_name: payload.client_name,
          client_tax_id: payload.client_tax_id,
          seller_user_id: user?.id || 'vendedor',
          seller_username: user?.username || 'vendedor',
          seller_full_name: user?.full_name || 'Juan Carlos Pérez Gálvez',
          zone_code: payload.zone_code,
          target_delivery_date: payload.target_delivery_date,
          requested_quantity: payload.requested_quantity,
          allocated_quantity: 0,
          min_weight_kg: payload.min_weight_kg,
          max_weight_kg: payload.max_weight_kg,
          sex_preference: sexPreference,
          estimated_total_kg: logisticsCalculation.totalKg,
          estimated_cages: logisticsCalculation.cagesNeeded,
          suggested_farm_code: payload.suggested_farm_code,
          suggested_barn_code: payload.suggested_barn_code,
          status: isDraft ? 'BORRADOR' : 'REGISTRADO',
          external_reference: payload.external_reference,
          notes: payload.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      const updated = [createdOrder, ...orders];
      setOrders(updated);
      localStorage.setItem('avicola_comercial_orders', JSON.stringify(updated));

      showToast(`Pedido [${createdOrder.order_number}] generado exitosamente.`);
      // Limpiar formulario y cambiar a pestaña Programación
      setExternalReference('');
      setOrderNotes('');
      setSexPreference('INDISTINTO');
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

    if (okBarnAvailability && okBarnAvailability.barn_balance_available <= 0) {
      if (!window.confirm(`El galpón [${okBarnCode}] de [${okFarmCode}] no tiene saldo libre disponible (0 aves). ¿Desea proceder de todos modos?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    const payload: OrderActionPayload = {
      farm_code: okFarmCode,
      barn_code: okBarnCode,
      allocated_quantity: qty,
      observation: okObservation.trim() || undefined,
    };

    try {
      let updatedOrder: SalesOrder;
      try {
        updatedOrder = await apiClient<SalesOrder>(`/comercial/orders/${selectedOrderForAction.id}/dar-ok`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch {
        // Fallback local
        updatedOrder = {
          ...selectedOrderForAction,
          status: 'APROBADO_RESERVADO',
          assigned_farm_code: okFarmCode,
          assigned_barn_code: okBarnCode,
          allocated_quantity: qty,
          gestor_username: user?.username || 'gestor_comercial',
          gestor_observation: okObservation || 'Aprobación formal otorgada por Gestor Comercial. Reserva de aves confirmada.',
          updated_at: new Date().toISOString(),
        };
      }

      // Descontar y reservar aves en el inventario biológico de Pecuaria en tiempo real
      reserveBarnStock(okFarmCode, okBarnCode, qty);

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

      // Si el pedido estaba aprobado con reserva, liberar las aves de vuelta a Pecuaria
      if (order.status === 'APROBADO_RESERVADO') {
        const farmToRelease = order.assigned_farm_code || order.suggested_farm_code || 'TRAD1';
        const barnToRelease = order.assigned_barn_code || order.suggested_barn_code || 'G-01';
        const qtyToRelease = order.allocated_quantity || order.requested_quantity;
        releaseBarnStock(farmToRelease, barnToRelease, qtyToRelease);
        showToast(`Pedido [${order.order_number}] cancelado. Se liberaron ${qtyToRelease.toLocaleString()} aves de vuelta al saldo disponible.`);
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

  // Filtrado de pedidos para la pestaña Programación
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (zoneFilter !== 'ALL' && o.zone_code !== zoneFilter) return false;
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
  }, [orders, statusFilter, zoneFilter, searchQuery]);

  // Filtrado de galpones para la pestaña Stock Disponible de Pecuaria
  const filteredPecuariaItems = useMemo(() => {
    return pecuariaItems.filter((item) => {
      if (pecFarmFilter !== 'ALL' && item.farm_code !== pecFarmFilter) return false;
      if (pecSexFilter !== 'ALL' && item.sex !== pecSexFilter) return false;
      if (pecAgeFilter === 'OVER_45' && item.bird_age_days <= 45) return false;
      if (pecAgeFilter === 'UNDER_45' && item.bird_age_days > 45) return false;
      if (pecSearchQuery.trim()) {
        const q = pecSearchQuery.toLowerCase().trim();
        const matchFarm = item.farm_code.toLowerCase().includes(q) || item.farm_name.toLowerCase().includes(q);
        const matchBarn = item.barn_code.toLowerCase().includes(q);
        const matchBatch = item.batch_code?.toLowerCase().includes(q) || false;
        if (!matchFarm && !matchBarn && !matchBatch) return false;
      }
      return true;
    });
  }, [pecuariaItems, pecFarmFilter, pecSexFilter, pecAgeFilter, pecSearchQuery]);

  // KPIs de la pestaña Programación
  const kpiTotal = orders.length;
  const kpiPendientes = orders.filter((o) => o.status === 'REGISTRADO').length;
  const kpiAprobados = orders.filter((o) => o.status === 'APROBADO_RESERVADO').length;
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
            Recepción de disponibilidad pecuaria en tiempo real, registro comercial de pedidos y control de estado de saca.
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

        <button
          type="button"
          onClick={() => setActiveTab('disponibilidad')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'disponibilidad'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>🐔 Stock Disponible de Pecuaria ({pecuariaItems.length} galpones)</span>
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

            {/* KPI 2: Pendientes de Aprobación */}
            <div className="bg-amber-50/70 dark:bg-amber-950/30 p-4 rounded-2xl border-2 border-amber-300 dark:border-amber-800/60 shadow-xs">
              <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Pendientes de Aprobación</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-900 dark:text-amber-200 font-mono">{kpiPendientes}</div>
              <div className="text-[10px] text-amber-800 dark:text-amber-400 mt-0.5 font-semibold">Esperando asignación</div>
            </div>

            {/* KPI 3: Aprobados con Reserva */}
            <div className="bg-emerald-50/70 dark:bg-emerald-950/25 p-4 rounded-2xl border-2 border-emerald-400 dark:border-emerald-600/60 shadow-xs">
              <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Aprobados con Reserva</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200 font-mono">{kpiAprobados}</div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-bold">Reserva en firme para saca</div>
            </div>

            {/* KPI 4: Con Observación */}
            <div className="bg-rose-50/60 dark:bg-rose-950/30 p-4 rounded-2xl border border-rose-300 dark:border-rose-900 shadow-xs">
              <div className="flex items-center justify-between text-rose-800 dark:text-rose-300 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Con observación</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-900 dark:text-rose-200 font-mono">{kpiObservados}</div>
              <div className="text-[10px] text-rose-700 dark:text-rose-400 mt-0.5 font-medium">Requieren ajuste cliente</div>
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

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Filtro Estado */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="REGISTRADO">⏳ Pendiente</option>
                <option value="APROBADO_RESERVADO">✔ Aprobado</option>
                <option value="CON_OBSERVACION">⚠ Con observación</option>
                <option value="BORRADOR">Borrador</option>
                <option value="CANCELADO">Cancelado</option>
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

              {(searchQuery || statusFilter !== 'ALL' || zoneFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setZoneFilter('ALL');
                  }}
                  className="px-2.5 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl font-bold transition-colors"
                  title="Limpiar filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Botón Hoja de Programación Diaria y Transporte (Exportar / Imprimir pedidos con OK) */}
              <Button
                type="button"
                size="sm"
                onClick={handleOpenTransportSheet}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs whitespace-nowrap ml-1"
                title="Generar e imprimir la Hoja de Programación Diaria para Transporte (pedidos con OK)"
              >
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>Hoja de Transporte</span>
                {approvedOrdersList.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500 text-white font-black">
                    {approvedOrdersList.length}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Tabla de Programación de Pedidos */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900/90 text-slate-950 dark:text-slate-100 text-[11px] font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4 whitespace-nowrap">N° Pedido</th>
                    <th className="py-3 px-4">Cliente &amp; Zona</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Fecha Saca</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Cantidad &amp; Logística</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Sexo</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Rango Solicitado (kg)</th>
                    <th className="py-3 px-4 whitespace-nowrap">Galpón Asignado</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Estado Programación</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        <div className="font-bold">No se encontraron pedidos con los filtros aplicados</div>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const isPendingOk = order.status === 'REGISTRADO';
                      const isApproved = order.status === 'APROBADO_RESERVADO';
                      const isObserved = order.status === 'CON_OBSERVACION';
                      const estCages = order.estimated_cages || Math.ceil(order.requested_quantity / 8);
                      const estTons = order.estimated_total_kg
                        ? Math.round(order.estimated_total_kg / 100) / 10
                        : Math.round((order.requested_quantity * ((order.min_weight_kg + order.max_weight_kg) / 2)) / 1000 * 10) / 10;

                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* N° Pedido (texto directo, sin card) */}
                          <td className="py-3 px-4 font-mono font-black text-slate-900 dark:text-slate-100 whitespace-nowrap text-xs">
                            {order.order_number}
                          </td>

                          {/* Cliente & Zona */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-950 dark:text-white">{order.client_name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Zona {order.zone_code}</span>
                              {order.external_reference && <span>• OC: {order.external_reference}</span>}
                            </div>
                          </td>

                          {/* Fecha de Entrega/Saca */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                              {formatDateDisplay(order.target_delivery_date)}
                            </span>
                          </td>

                          {/* Cantidad de Aves Solicitada & Logística */}
                          <td className="py-3 px-4 text-right">
                            <div className="font-mono font-black text-sm text-slate-950 dark:text-white">
                              {order.requested_quantity.toLocaleString()} aves
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                              ~{estCages.toLocaleString()} jlas &bull; {estTons} Ton
                            </div>
                            {order.allocated_quantity > 0 && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                                Asignadas: {order.allocated_quantity.toLocaleString()}
                              </div>
                            )}
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

                          {/* Rango Solicitado (kg) */}
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 dark:text-slate-100 text-xs whitespace-nowrap">
                            {order.min_weight_kg.toFixed(2)} - {order.max_weight_kg.toFixed(2)} kg
                          </td>

                          {/* Galpón Asignado vs Sugerido */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {order.assigned_farm_code ? (
                              <div>
                                <div className="flex items-center gap-1.5 font-mono text-xs">
                                  <span className="font-black text-slate-950 dark:text-white">
                                    {order.assigned_farm_code}
                                  </span>
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                    &bull; {order.assigned_barn_code}
                                  </span>
                                </div>
                                {order.transport_assigned && (
                                  <div className="text-[10px] text-blue-700 dark:text-blue-400 font-mono font-bold flex items-center gap-1 mt-0.5">
                                    <Truck className="w-3 h-3 text-blue-600" />
                                    <span>{order.transport_plate} ({order.transport_shift || 'Madrugada'})</span>
                                  </div>
                                )}
                              </div>
                            ) : order.suggested_farm_code ? (
                              <div className="text-slate-500 text-[11px] italic font-mono">
                                Sug: {order.suggested_farm_code} ({order.suggested_barn_code})
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Por asignar</span>
                            )}
                          </td>

                          {/* Estado de Programación (solo texto limpio, sin cards ni fondos) */}
                          <td className="py-3 px-4 text-center whitespace-nowrap text-xs font-bold">
                            {isPendingOk && (
                              <span className="text-amber-600 dark:text-amber-400">
                                Pendiente
                              </span>
                            )}
                            {isApproved && (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Aprobado
                              </span>
                            )}
                            {isObserved && (
                              <span className="text-rose-600 dark:text-rose-400">
                                Con observación
                              </span>
                            )}
                            {order.status === 'BORRADOR' && (
                              <span className="text-slate-500 dark:text-slate-400 font-medium">
                                Borrador
                              </span>
                            )}
                            {order.status === 'CANCELADO' && (
                              <span className="text-rose-500 dark:text-rose-400 font-medium">
                                Cancelado
                              </span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Botón Ver Detalle (para todos los roles) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrderForAction(order);
                                  setDetailModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Ver detalles del pedido"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* ACCIONES EXCLUSIVAS DEL GESTOR COMERCIAL */}
                              {isGestorOrAdmin && isPendingOk && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenOkModal(order)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs"
                                    title="Aprobar el pedido y reservar galpón"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Aprobar</span>
                                  </Button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenObservarModal(order)}
                                    className="p-1 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-300 dark:border-amber-800 transition-colors"
                                    title="Devolver con observación"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              {/* Si ya está aprobado, el Gestor puede reasignar si es necesario */}
                              {isGestorOrAdmin && isApproved && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenOkModal(order)}
                                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-100 border border-slate-300 dark:border-slate-700"
                                  title="Revisar asignación"
                                >
                                  Reasignar
                                </button>
                              )}

                              {/* Opción de cancelar si está pendiente */}
                              {isPendingOk && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelOrder(order)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                                  title="Cancelar pedido"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: NUEVO PEDIDO DE VENTA                                          */}
      {/* ========================================================================= */}
      {activeTab === 'nuevo_pedido' && (
        <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-black text-slate-950 dark:text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-red-600" />
                <span>Captura de Pedido de Venta</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Complete los datos acordados con el cliente. Al registrar, ingresará a la Programación para revisión y aprobación del Gestor Comercial.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400">
              Vendedor: {user?.username || 'Comercial'}
            </span>
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
                    Cliente verificado en catálogo &bull; RUC: {clientTaxId || 'S/N'} &bull; Zona habitual: {zoneCode}
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

            {/* 3. Cantidad y Fecha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Cantidad de Aves Solicitadas *
                </label>
                <Input
                  type="number"
                  min="1"
                  step="50"
                  placeholder="Ej: 3000"
                  value={requestedQuantityStr}
                  onChange={(e) => setRequestedQuantityStr(e.target.value)}
                  className="text-sm font-mono font-black"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Fecha Programada de Saca / Entrega *
                </label>
                <Input
                  type="date"
                  value={targetDeliveryDate}
                  onChange={(e) => setTargetDeliveryDate(e.target.value)}
                  className="text-xs font-mono font-bold"
                  required
                />
              </div>
            </div>

            {/* 3.1 Preferencia de Sexo del Ave */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="block text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                🐔 Requisito de Sexo del Lote *
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSexPreference('INDISTINTO')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                    sexPreference === 'INDISTINTO'
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  <span className="text-xs font-extrabold">⚖️ Indistinto</span>
                  <span className="text-[10px] opacity-80">Macho o Hembra</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSexPreference('MACHO')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                    sexPreference === 'MACHO'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/30 font-black'
                      : 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                  }`}
                >
                  <span className="text-xs font-extrabold">♂️ Solo Machos</span>
                  <span className="text-[10px] opacity-80">Pollería / Mayor gramaje</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSexPreference('HEMBRA')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                    sexPreference === 'HEMBRA'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-600/30 font-black'
                      : 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 border-slate-200 dark:border-slate-700 hover:border-rose-300'
                  }`}
                >
                  <span className="text-xs font-extrabold">♀️ Solo Hembras</span>
                  <span className="text-[10px] opacity-80">Calibre parejo / Asadores</span>
                </button>
              </div>
            </div>

            {/* 4. Rango de Peso Requerido */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="block text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                ⚖️ Rango de Peso Comercial Requerido (kg) *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Peso Mínimo (kg):
                  </span>
                  <Input
                    type="number"
                    step="0.05"
                    min="1.0"
                    placeholder="Ej: 2.15"
                    value={minWeightStr}
                    onChange={(e) => setMinWeightStr(e.target.value)}
                    className="text-xs font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Peso Máximo (kg):
                  </span>
                  <Input
                    type="number"
                    step="0.05"
                    min="1.0"
                    placeholder="Ej: 2.40"
                    value={maxWeightStr}
                    onChange={(e) => setMaxWeightStr(e.target.value)}
                    className="text-xs font-mono font-bold"
                    required
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                El Gestor Comercial evaluará galpones de Pecuaria cuya distribución muestral cumpla este rango.
              </p>
            </div>

            {/* Estimación Logística y Tonelaje en Tiempo Real */}
            <div className="p-4 bg-slate-100/80 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs font-extrabold text-slate-950 dark:text-slate-50 flex items-center gap-2 uppercase tracking-wider">
                  <Truck className="w-4 h-4 text-red-600" />
                  <span>Estimación Logística &amp; Tonelaje de Despacho</span>
                </span>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                  Estándar: 8 aves / jaula transportadora
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Peso Teórico</span>
                  <span className="text-xs font-mono font-black text-slate-900 dark:text-slate-100">
                    {logisticsCalculation.avgW.toFixed(2)} kg/ave
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Kilos Totales</span>
                  <span className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-400">
                    {logisticsCalculation.totalKg.toLocaleString()} kg
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Tonelaje Bruto</span>
                  <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-400">
                    {logisticsCalculation.totalTons} Ton
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Jaulas Requeridas</span>
                  <span className="text-xs font-mono font-black text-red-600 dark:text-red-400">
                    {logisticsCalculation.cagesNeeded.toLocaleString()} jaulas
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    (~{logisticsCalculation.tripsEstimate} camión{logisticsCalculation.tripsEstimate > 1 ? 'es' : ''})
                  </span>
                </div>
              </div>
            </div>

            {/* Asistente Inteligente de Asignación • ROXI (Gemini 2.0 Flash) */}
            <RoxiCopilotCard
              payload={{
                client_name: clientName || 'Cliente Mayorista',
                quantity_birds: parseInt(requestedQuantityStr, 10) || 3000,
                sex: sexPreference,
                min_weight: parseFloat(minWeightStr) || 2.20,
                max_weight: parseFloat(maxWeightStr) || 2.45,
                zone_code: zoneCode,
                scheduled_date: targetDeliveryDate,
              }}
              currentFarmCode={suggestedFarmCode}
              currentBarnCode={suggestedBarnCode}
              onApplyBarn={(farm, barn) => {
                setSuggestedFarmCode(farm);
                setSuggestedBarnCode(barn);
              }}
              userRole={user?.role || 'vendedor'}
            />

            {/* 5. Granja y Galpón Orientativo (Sugerido de Pecuaria) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Granja de Origen Sugerida (Pecuaria)
                </label>
                <select
                  value={suggestedFarmCode}
                  onChange={(e) => setSuggestedFarmCode(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200"
                >
                  {OFFICIAL_FARMS.map((farm) => (
                    <option key={farm.code} value={farm.code}>
                      {farm.code} - {farm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Galpón Sugerido
                </label>
                <select
                  value={suggestedBarnCode}
                  onChange={(e) => setSuggestedBarnCode(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((b) => (
                    <option key={b} value={`G-${String(b).padStart(2, '0')}`}>
                      Galpón G-{String(b).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Validación y Disponibilidad en Vivo del Galpón Sugerido */}
            {selectedBarnAvailability && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-red-600" />
                      Disponibilidad Pecuaria: [{suggestedFarmCode} - {suggestedBarnCode}]
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                        selectedBarnAvailability.sex === 'MACHO'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
                      }`}
                    >
                      {selectedBarnAvailability.sex}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono">
                      {selectedBarnAvailability.bird_age_days} días
                      {selectedBarnAvailability.bird_age_days > 45 && ' (!Saca Prioritaria)'}
                    </span>
                    {selectedBarnAvailability.average_weight_kg && (
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                        Peso Prom: <strong>{selectedBarnAvailability.average_weight_kg.toFixed(2)} kg</strong>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">Saldo Libre:</span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      {selectedBarnAvailability.barn_balance_available.toLocaleString()} aves
                    </span>
                  </div>
                </div>

                {/* Alerta de Incompatibilidad de Sexo */}
                {sexPreference !== 'INDISTINTO' && selectedBarnAvailability.sex !== sexPreference && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Incompatibilidad de Sexo: El pedido exige <strong>{sexPreference === 'MACHO' ? 'SOLO MACHOS' : 'SOLO HEMBRAS'}</strong>, pero el galpón [{suggestedBarnCode}] de [{suggestedFarmCode}] contiene aves <strong>{selectedBarnAvailability.sex}</strong>.
                    </span>
                  </div>
                )}

                {/* Alerta si la cantidad solicitada supera el saldo libre */}
                {(parseInt(requestedQuantityStr, 10) || 0) > selectedBarnAvailability.barn_balance_available && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Cantidad solicitada ({(parseInt(requestedQuantityStr, 10) || 0).toLocaleString()} aves) supera el saldo disponible ({selectedBarnAvailability.barn_balance_available.toLocaleString()} aves) por{' '}
                        <strong className="text-red-700 dark:text-red-300">
                          {((parseInt(requestedQuantityStr, 10) || 0) - selectedBarnAvailability.barn_balance_available).toLocaleString()} aves
                        </strong>.
                      </span>
                    </div>
                    {selectedBarnAvailability.barn_balance_available > 0 && (
                      <button
                        type="button"
                        onClick={() => setRequestedQuantityStr(String(selectedBarnAvailability.barn_balance_available))}
                        className="px-2.5 py-1 text-[11px] font-black bg-amber-600 hover:bg-amber-700 text-white rounded-md whitespace-nowrap shadow-xs"
                      >
                        Ajustar a Disponible ({selectedBarnAvailability.barn_balance_available.toLocaleString()})
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 6. OC y Observaciones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Referencia Externa (N° Orden de Compra)
                </label>
                <Input
                  type="text"
                  placeholder="Ej: OC-98214"
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Notas u Observaciones Comerciales
                </label>
                <Input
                  type="text"
                  placeholder="Ej: Horario preferencial 5:00 AM, rampa 1"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="text-xs"
                />
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
              <span>Enviar Pedido a Programación (Solicitar Aprobación)</span>
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: DISPONIBILIDAD PECUARIA EN VIVO                                */}
      {/* ========================================================================= */}
      {activeTab === 'disponibilidad' && (
        <div className="space-y-4">
          {/* Banner Informativo de Validación Comercial */}
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-black text-slate-950 dark:text-slate-100 text-[13px]">
                Disponibilidad Biológica de Granjas y Galpones (Fuente Pecuaria)
              </p>
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                Aquí el personal comercial consulta en vivo el stock de las <strong>23 granjas oficiales</strong> y sus <strong>230 galpones</strong>.
                Revise la edad, sexo, peso promedio y saldo libre disponible para elegir el galpón que mejor cumpla con los requerimientos del pedido.
                Al hacer clic en <strong className="text-red-700 dark:text-red-400">"Usar para Pedido"</strong>, el galpón y su rango de peso se transfieren automáticamente al formulario de nuevo pedido.
              </p>
            </div>
          </div>

          {/* Barra de Filtros y Búsqueda de Galpones */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por código de granja (ej. TRAD1, PACI6) o galpón (G-01)..."
                  value={pecSearchQuery}
                  onChange={(e) => setPecSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filtro Granja */}
                <select
                  value={pecFarmFilter}
                  onChange={(e) => setPecFarmFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value="ALL">Todas las Granjas (23)</option>
                  {OFFICIAL_FARMS.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.code} - {f.name}
                    </option>
                  ))}
                </select>

                {/* Filtro Sexo */}
                <select
                  value={pecSexFilter}
                  onChange={(e) => setPecSexFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value="ALL">Todos los Sexos</option>
                  <option value="MACHO">Solo Machos</option>
                  <option value="HEMBRA">Solo Hembras</option>
                </select>

                {/* Filtro Edad */}
                <select
                  value={pecAgeFilter}
                  onChange={(e) => setPecAgeFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value="ALL">Todas las Edades</option>
                  <option value="OVER_45">⚠️ Prioridad Cierre (&gt; 45 días)</option>
                  <option value="UNDER_45">En Crecimiento (≤ 45 días)</option>
                </select>

                {/* Limpiar Filtros */}
                {(pecFarmFilter !== 'ALL' || pecSexFilter !== 'ALL' || pecAgeFilter !== 'ALL' || pecSearchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPecFarmFilter('ALL');
                      setPecSexFilter('ALL');
                      setPecAgeFilter('ALL');
                      setPecSearchQuery('');
                    }}
                    className="px-3 py-2 text-xs text-red-600 hover:text-red-700 font-black border border-red-200 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="font-extrabold text-slate-900 dark:text-slate-100">
                Mostrando <span className="text-red-600">{filteredPecuariaItems.length}</span> de {pecuariaItems.length} galpones
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                23 granjas oficiales activas &bull; Actualizado en tiempo real
              </span>
            </div>
          </div>

          {/* Tabla de Galpones Disponibles */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 z-10 border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-[11px] font-black uppercase text-slate-950 dark:text-slate-50 tracking-wider">
                    <th className="py-3 px-4">Granja</th>
                    <th className="py-3 px-4">Galpón</th>
                    <th className="py-3 px-4 text-center">Edad</th>
                    <th className="py-3 px-4 text-center">Sexo</th>
                    <th className="py-3 px-4 text-right">Saldo Disponible Saca</th>
                    <th className="py-3 px-4 text-center">Peso Promedio &amp; Rango</th>
                    <th className="py-3 px-4 text-center">Acción Comercial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredPecuariaItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-700 dark:text-slate-300">
                        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                        <p className="font-bold text-sm">No se encontraron galpones con los filtros seleccionados.</p>
                        <p className="text-xs text-slate-500 mt-1">Pruebe limpiando los filtros para ver la oferta completa.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPecuariaItems.map((item) => {
                      const isPriority = item.bird_age_days > 45;
                      return (
                        <tr
                          key={`${item.farm_code}-${item.barn_id}`}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                            isPriority ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-black text-slate-950 dark:text-slate-50 text-[13px]">
                            {item.farm_code}
                            <span className="block text-[10px] font-normal text-slate-600 dark:text-slate-400">
                              {item.farm_name}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-slate-950 dark:text-slate-100 text-[13px]">
                            {item.barn_code}
                          </td>
                          <td className="py-3 px-4 text-center font-black font-mono">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${
                                isPriority
                                  ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200 font-black'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {item.bird_age_days} d
                              {isPriority && <span className="text-[10px] font-black text-red-600">(!SACA)</span>}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-black">
                            {item.sex === 'MACHO' ? (
                              <span className="text-blue-700 dark:text-blue-400 font-black">Macho</span>
                            ) : (
                              <span className="text-rose-700 dark:text-rose-400 font-black">Hembra</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 text-[13px]">
                            {item.barn_balance_available.toLocaleString()} aves
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            {item.average_weight_kg ? (
                              <div>
                                <span className="font-black text-slate-950 dark:text-slate-100 text-[12px]">
                                  {item.average_weight_kg.toFixed(2)} kg
                                </span>{' '}
                                <span className="text-[10px] text-slate-600 dark:text-slate-400 block font-semibold">
                                  ({(item.average_weight_kg - 0.15).toFixed(2)} - {(item.average_weight_kg + 0.15).toFixed(2)} kg)
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">Sin pesaje</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSuggestedFarmCode(item.farm_code);
                                setSuggestedBarnCode(item.barn_code);
                                if (item.average_weight_kg) {
                                  setMinWeightStr((item.average_weight_kg - 0.15).toFixed(2));
                                  setMaxWeightStr((item.average_weight_kg + 0.15).toFixed(2));
                                }
                                setActiveTab('nuevo_pedido');
                                showToast(`Galpón [${item.barn_code}] de [${item.farm_code}] precargado en el formulario.`);
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] py-1.5 px-3 rounded-lg shadow-sm hover:shadow transition-all"
                            >
                              Usar para Pedido &rarr;
                            </button>
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
                  ~{Math.ceil(selectedOrderForAction.requested_quantity / 8)} jaulas
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
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
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
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-extrabold text-slate-950 dark:text-white text-sm">
                {selectedOrderForAction.client_name}
              </span>
              <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                {selectedOrderForAction.client_tax_id || 'Sin RUC'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <span className="text-slate-500 block">Vendedor Comercial:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedOrderForAction.seller_full_name || (selectedOrderForAction.seller_username === 'areacomercial1' ? 'Felipe' : selectedOrderForAction.seller_username === 'vendedor2' ? 'María Elena Rodríguez Soto' : 'Juan Carlos Pérez Gálvez')}
                </span>
                <span className="text-[10px] text-slate-400 block font-normal">
                  Ejecutivo Comercial de Ventas
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
              </div>
              <div>
                <span className="text-slate-500 block">Logística &amp; Jaulas:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  ~{selectedOrderForAction.estimated_cages || Math.ceil(selectedOrderForAction.requested_quantity / 8)} jaulas ({selectedOrderForAction.estimated_total_kg ? `${Math.round(selectedOrderForAction.estimated_total_kg / 100) / 10} Ton` : `${Math.round((selectedOrderForAction.requested_quantity * ((selectedOrderForAction.min_weight_kg + selectedOrderForAction.max_weight_kg) / 2)) / 1000 * 10) / 10} Ton`})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Rango de Peso:</span>
                <span className="font-mono font-bold">
                  {selectedOrderForAction.min_weight_kg.toFixed(2)} - {selectedOrderForAction.max_weight_kg.toFixed(2)} kg
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
                    Dirección o Punto de Entrega
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej: Av. Industrial 450, Lurín"
                    value={newClientAddress}
                    onChange={(e) => setNewClientAddress(e.target.value)}
                    className="text-xs"
                  />
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
      {/* MODAL: HOJA DE PROGRAMACIÓN DIARIA Y TRANSPORTE (EXPORTAR / IMPRIMIR)     */}
      {/* ========================================================================= */}
      {transportSheetOpen && (
        <Modal
          isOpen={transportSheetOpen}
          onClose={() => setTransportSheetOpen(false)}
          title="Hoja de Programación Diaria y Transporte"
          size="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Barra de Controles y Acciones (Oculta al imprimir) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 print:hidden">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 block">
                    Manifiesto Oficial de Saca y Despacho
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Consolidado de pedidos formalmente aprobados con reserva de aves en galpón.
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Selector de fecha de saca */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Fecha Saca:</span>
                  <select
                    value={transportSelectedDate}
                    onChange={(e) => setTransportSelectedDate(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                  >
                    <option value="ALL">Todas las Fechas ({approvedOrdersList.length} pedidos)</option>
                    {approvedDatesList.map((d) => (
                      <option key={d} value={d}>
                        {formatDateDisplay(d)} ({approvedOrdersList.filter((o) => o.target_delivery_date === d).length} pedidos)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botón Imprimir / PDF */}
                <Button
                  size="sm"
                  onClick={handlePrintTransportSheet}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / PDF</span>
                </Button>

                {/* Botón Exportar CSV / Excel */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportTransportCSV}
                  disabled={isExportingCSV}
                  className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isExportingCSV ? 'Exportando...' : 'Exportar Excel (CSV)'}</span>
                </Button>
              </div>
            </div>

            {/* Contenedor imprimible */}
            <div id="printable-transport-sheet" className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 print:border-none print:p-0">
              {/* Membrete corporativo */}
              <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900 dark:border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                    GR
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-950 dark:text-white uppercase tracking-wider">
                      Avícola GR &bull; Grupo Rocío
                    </h3>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                      Hoja de Programación Diaria y Manifiesto de Transporte
                    </div>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                  <div><strong>Fecha Despacho:</strong> {transportSelectedDate === 'ALL' ? 'CONSOLIDADO GENERAL' : formatDateDisplay(transportSelectedDate)}</div>
                  <div><strong>Emisión:</strong> {new Date().toLocaleDateString('es-PE')}</div>
                </div>
              </div>

              {/* KPIs Logísticos de Transporte */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 uppercase font-extrabold block">Aves Confirmadas</span>
                  <span className="text-lg font-black font-mono text-slate-950 dark:text-white">
                    {transportSummary.totalBirds.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{transportSummary.totalOrders} pedidos aprobados</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 uppercase font-extrabold block">Tonelaje Total</span>
                  <span className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">
                    {transportSummary.totalTons} Ton
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{Math.round(transportSummary.totalKg).toLocaleString()} kg aprox.</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 uppercase font-extrabold block">Total Jaulas</span>
                  <span className="text-lg font-black font-mono text-blue-700 dark:text-blue-400">
                    ~{transportSummary.totalCages.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Módulo ~8 aves / jaula</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 uppercase font-extrabold block">Camiones Estimados</span>
                  <span className="text-lg font-black font-mono text-amber-700 dark:text-amber-400">
                    ~{transportSummary.estimatedTrucks} viaje(s)
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Capacidad estándar ~450 jlas</span>
                </div>
              </div>

              {/* Tabla Detallada para Cuadrillas y Transporte */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2.5 px-3 text-center">Item</th>
                      <th className="py-2.5 px-3">N° Pedido</th>
                      <th className="py-2.5 px-3 text-center">Fecha</th>
                      <th className="py-2.5 px-3">Granja &amp; Galpón</th>
                      <th className="py-2.5 px-3">Cliente &amp; Zona</th>
                      <th className="py-2.5 px-3 text-right">Aves</th>
                      <th className="py-2.5 px-3 text-right">Jaulas</th>
                      <th className="py-2.5 px-3 text-center">Sexo</th>
                      <th className="py-2.5 px-3 text-center">Rango Solicitado</th>
                      <th className="py-2.5 px-3 text-right">Peso (Ton)</th>
                      <th className="py-2.5 px-3">Observaciones / Despacho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {transportFilteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-500 italic">
                          No existen pedidos aprobados para la fecha seleccionada.
                        </td>
                      </tr>
                    ) : (
                      transportFilteredOrders.map((o, idx) => {
                        const birds = o.allocated_quantity || o.requested_quantity || 0;
                        const cages = o.estimated_cages || Math.ceil(birds / 8);
                        const tons = o.estimated_total_kg
                          ? Math.round(o.estimated_total_kg / 100) / 10
                          : Math.round((birds * ((o.min_weight_kg + o.max_weight_kg) / 2)) / 1000 * 10) / 10;

                        return (
                          <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {o.order_number}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono whitespace-nowrap">
                              {formatDateDisplay(o.target_delivery_date)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-emerald-800 dark:text-emerald-300">
                              {o.assigned_farm_code} &bull; {o.assigned_barn_code}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-950 dark:text-white leading-tight">
                                {o.client_name}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Zona {o.zone_code} {o.external_reference ? `• OC: ${o.external_reference}` : ''}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {birds.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                              ~{cages}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap font-bold text-xs">
                              {o.sex_preference === 'MACHO' && <span className="text-blue-700 dark:text-blue-400">Macho</span>}
                              {o.sex_preference === 'HEMBRA' && <span className="text-rose-700 dark:text-rose-400">Hembra</span>}
                              {(!o.sex_preference || o.sex_preference === 'INDISTINTO') && <span className="text-slate-600 dark:text-slate-400">Indistinto</span>}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono font-bold text-slate-800 dark:text-slate-200">
                              {o.min_weight_kg.toFixed(2)} - {o.max_weight_kg.toFixed(2)} kg
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                              {tons} Ton
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-600 dark:text-slate-300 max-w-xs truncate">
                              {o.notes || o.gestor_observation || '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Sección de Firmas de Autorización para Transporte (Imprimible) */}
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-6 text-center text-xs">
                <div>
                  <div className="border-t border-slate-400 w-4/5 mx-auto pt-1 mb-1 font-bold text-slate-800 dark:text-slate-200">
                    Gestor Comercial
                  </div>
                  <div className="text-[10px] text-slate-500">Autorización &amp; Asignación Saca</div>
                </div>

                <div>
                  <div className="border-t border-slate-400 w-4/5 mx-auto pt-1 mb-1 font-bold text-slate-800 dark:text-slate-200">
                    Supervisor Transporte
                  </div>
                  <div className="text-[10px] text-slate-500">Programación de Camiones</div>
                </div>

                <div>
                  <div className="border-t border-slate-400 w-4/5 mx-auto pt-1 mb-1 font-bold text-slate-800 dark:text-slate-200">
                    Conductor / Cuadrilla Atrape
                  </div>
                  <div className="text-[10px] text-slate-500">Conformidad de Carga en Granja</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 print:hidden">
              <Button size="sm" variant="secondary" onClick={() => setTransportSheetOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
