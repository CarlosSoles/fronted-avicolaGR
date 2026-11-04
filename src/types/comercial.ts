// ==============================================================================
// TIPOS DE DATOS DEL MÓDULO COMERCIAL Y PROGRAMACIÓN
// Archivo: fronted/src/types/comercial.ts
// ==============================================================================

// ==============================================================================
// DENSIDAD DE CARGA (AVES POR JAULA)
// ==============================================================================

export const MIN_DENSITY = 7;
export const MAX_DENSITY = 12;
export const DEFAULT_DENSITY = 8;

/** Normaliza una densidad al rango operativo permitido (7-12). */
export function clampDensity(density?: number | null): number {
  const value = Number.isFinite(Number(density)) ? Number(density) : DEFAULT_DENSITY;
  return Math.min(MAX_DENSITY, Math.max(MIN_DENSITY, Math.round(value)));
}

/**
 * Sugerencia de densidad según el peso promedio del pedido.
 * A mayor peso por ave, menos aves caben por jaula.
 */
export function suggestDensity(minWeight: number, maxWeight: number): number {
  if (!Number.isFinite(minWeight) || !Number.isFinite(maxWeight)) return DEFAULT_DENSITY;
  const avg = (minWeight + maxWeight) / 2;
  if (avg < 2.2) return 12;
  if (avg < 2.4) return 11;
  if (avg < 2.6) return 10;
  if (avg < 2.8) return 9;
  if (avg < 3.0) return 8;
  return 7;
}

/** Jaulas necesarias: ceil(aves / densidad). */
export function computeCages(birds: number, density?: number | null): number {
  if (!Number.isFinite(birds) || birds <= 0) return 0;
  return Math.ceil(birds / clampDensity(density));
}

export interface Client {
  id: string;
  business_name: string;
  tax_id: string;
  zone_code: string;
  address?: string;
  contact_phone?: string;
  latitude?: number | null;
  longitude?: number | null;
  preferred_min_weight?: number;
  preferred_max_weight?: number;
  is_active: boolean;
  created_at: string;
}

export interface ClientCreatePayload {
  business_name: string;
  tax_id: string;
  zone_code: string;
  address?: string;
  contact_phone?: string;
  latitude?: number | null;
  longitude?: number | null;
  preferred_min_weight?: number;
  preferred_max_weight?: number;
  is_active?: boolean;
}

export interface ClientUpdatePayload {
  business_name?: string;
  tax_id?: string;
  zone_code?: string;
  address?: string;
  contact_phone?: string;
  latitude?: number | null;
  longitude?: number | null;
  preferred_min_weight?: number | null;
  preferred_max_weight?: number | null;
  is_active?: boolean;
}

export interface ProgramacionTransporteItem {
  order_id: string;
  order_number: string;
  target_delivery_date: string;
  client_name: string;
  client_tax_id?: string;
  zone_code: string;
  assigned_farm_code: string;
  assigned_barn_code: string;
  allocated_quantity: number;
  density_birds_per_cage?: number;
  estimated_cages: number;
  estimated_total_kg: number;
  estimated_tons: number;
  sex_preference: SexPreference;
  min_weight_kg: number;
  max_weight_kg: number;
  gestor_username?: string;
  notes?: string;
  external_reference?: string;
  transport_assigned?: boolean;
  transport_plate?: string;
  transport_driver_name?: string;
  transport_crew?: string;
  transport_shift?: string;
}

export interface ProgramacionTransporteResponse {
  delivery_date?: string;
  total_orders: number;
  total_birds: number;
  total_cages: number;
  total_tons: number;
  estimated_trucks: number;
  items: ProgramacionTransporteItem[];
}

export type OrderStatus =
  | 'BORRADOR'
  | 'REGISTRADO'
  | 'APROBADO_RESERVADO'
  | 'CON_OBSERVACION'
  | 'DESPACHADO'
  | 'CANCELADO';

export type SexPreference = 'MACHO' | 'HEMBRA' | 'INDISTINTO';

export interface SalesOrder {
  id: string;
  order_number: string;
  client_id?: string;
  client_name: string;
  client_tax_id?: string;
  seller_user_id: string;
  seller_username: string;
  seller_full_name?: string;
  zone_code: string;
  target_delivery_date: string;
  requested_quantity: number;
  allocated_quantity: number;
  density_birds_per_cage?: number;
  min_weight_kg: number;
  max_weight_kg: number;
  sex_preference?: SexPreference;
  estimated_total_kg?: number;
  estimated_cages?: number;
  suggested_farm_code?: string;
  suggested_barn_code?: string;
  assigned_farm_code?: string;
  assigned_barn_code?: string;
  status: OrderStatus;
  external_reference?: string;
  gestor_observation?: string;
  gestor_username?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Datos de Transporte y Distribución
  transport_assigned?: boolean;
  transport_truck_id?: string;
  transport_plate?: string;
  transport_model?: string;
  transport_driver_name?: string;
  transport_driver_phone?: string;
  transport_crew?: string;
  transport_shift?: string;
  transport_capacity_cages?: number;
  transport_notes?: string;
  transport_assigned_at?: string;
  transport_assigned_by?: string;
  // Ciclo de Vida del Despacho (Tracking de 4 Fases)
  dispatch_phase?: DispatchPhase;
  dispatch_phase_updated_at?: string;
  loading_slot_time?: string;
  // Historial de Auditoría y Trazabilidad
  audit_log?: AuditLogEntry[];
  // Fraccionamiento y Split de Pedidos
  is_split_parent?: boolean;
  is_split_child?: boolean;
  parent_order_id?: string;
  original_requested_quantity?: number;
  split_children_ids?: string[];
  // Dirección y contacto
  delivery_address?: string;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  farm_contact_phone?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor_username: string;
  actor_role: string;
  timestamp: string;
  description: string;
  details?: Record<string, any>;
}

export type DispatchPhase =
  | 'TRANSPORTE_ASIGNADO'
  | 'EN_GRANJA_CARGANDO'
  | 'EN_TRANSITO'
  | 'ENTREGADO_CONFORME';

export interface TransportVehicle {
  id: string;
  plate: string;
  model: string;
  capacity_cages: number;
  capacity_birds: number;
  driver_name: string;
  driver_phone?: string;
  default_crew?: string;
  zone_coverage: string[];
  status: 'DISPONIBLE' | 'ASIGNADO' | 'EN_MANTENIMIENTO';
}

export interface AssignTransportPayload {
  vehicle_id: string;
  plate?: string;
  driver_name?: string;
  driver_phone?: string;
  crew_name?: string;
  shift?: string;
  loading_slot_time?: string;
  transport_notes?: string;
}

export interface OrderCreatePayload {
  client_id?: string;
  client_name: string;
  client_tax_id?: string;
  seller_full_name?: string;
  zone_code: string;
  target_delivery_date: string;
  requested_quantity: number;
  density_birds_per_cage?: number;
  min_weight_kg: number;
  max_weight_kg: number;
  sex_preference?: SexPreference;
  suggested_farm_code?: string;
  suggested_barn_code?: string;
  external_reference?: string;
  notes?: string;
  delivery_address?: string;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  is_draft?: boolean;
}

export interface OrderActionPayload {
  observation?: string;
  farm_code?: string;
  barn_code?: string;
  allocated_quantity?: number;
  density_birds_per_cage?: number;
  force_reservation?: boolean;
  force_reason?: string;
  split_remaining?: boolean;
  split_delivery_date?: string;
}

