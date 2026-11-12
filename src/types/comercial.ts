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

export interface ZoneCageDensity {
  zone_code: string;
  zone_name: string;
  male_density: number;
  female_density: number;
  updated_at?: string | null;
}

export const DEFAULT_ZONE_DENSITIES: ZoneCageDensity[] = [
  { zone_code: 'METROPOLITANA', zone_name: 'Metropolitana (Lima)', male_density: 9, female_density: 11 },
  { zone_code: 'NORTE', zone_name: 'Zona Norte', male_density: 8, female_density: 11 },
  { zone_code: 'CENTRO', zone_name: 'Zona Centro', male_density: 9, female_density: 11 },
  { zone_code: 'SUR', zone_name: 'Zona Sur', male_density: 8, female_density: 11 },
];

/** Obtiene la densidad configurada para una zona y sexo (MACHO / HEMBRA). */
export function resolveZoneDensity(
  densities: ZoneCageDensity[],
  zoneCode: string,
  sex: SexPreference
): number {
  const normalizedZone = (zoneCode || 'METROPOLITANA').toUpperCase().trim();
  const match =
    densities.find((d) => d.zone_code.toUpperCase() === normalizedZone) ||
    DEFAULT_ZONE_DENSITIES.find((d) => d.zone_code === normalizedZone);
  if (!match) return DEFAULT_DENSITY;
  return clampDensity(sex === 'HEMBRA' ? match.female_density : match.male_density);
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

export type SexPreference = 'MACHO' | 'HEMBRA' | 'INDISTINTO' | 'MIXTO';

export interface OrderLine {
  id: string;
  requested_quantity: number;
  cages?: number;
  density_birds_per_cage: number;
  sex_preference: SexPreference;
  min_weight_kg: number;
  max_weight_kg: number;
  notes?: string | null;
}

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
  order_lines?: OrderLine[];
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
  // Código Aris (generado por Gestor Comercial)
  codigo_aris?: string;
  codigo_aris_generated_at?: string;
  codigo_aris_generated_by?: string;
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

export interface TransportVehicleCreatePayload {
  plate: string;
  model: string;
  capacity_cages: number;
  capacity_birds?: number;
  driver_name: string;
  driver_phone?: string;
  default_crew?: string;
  zone_coverage: string[];
  status?: 'DISPONIBLE' | 'ASIGNADO' | 'EN_MANTENIMIENTO';
}

export type TransportVehicleUpdatePayload = Partial<TransportVehicleCreatePayload>;

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
  target_delivery_date?: string;
  requested_quantity: number;
  density_birds_per_cage?: number;
  min_weight_kg?: number;
  max_weight_kg?: number;
  sex_preference?: SexPreference;
  suggested_farm_code?: string;
  suggested_barn_code?: string;
  external_reference?: string;
  notes?: string;
  delivery_address?: string;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  order_lines?: OrderLine[];
  is_draft?: boolean;
  auto_reserve?: boolean;
}

export type EstadoComercial =
  | 'BORRADOR'
  | 'PREPROGRAMACION'
  | 'PROGRAMADO'
  | 'PROGRAMADO_CON_CAMION'
  | 'CONFIRMADO'
  | 'DESPACHADO'
  | 'TERMINADO'
  | 'CANCELADO';

export interface EstadoComercialInfo {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}

export const ESTADO_COMERCIAL_ORDER: EstadoComercial[] = [
  'BORRADOR',
  'PREPROGRAMACION',
  'PROGRAMADO',
  'PROGRAMADO_CON_CAMION',
  'CONFIRMADO',
  'DESPACHADO',
  'TERMINADO',
  'CANCELADO',
];

export const ESTADO_COMERCIAL_META: Record<EstadoComercial, EstadoComercialInfo> = {
  BORRADOR: {
    label: 'En borrador',
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-100 dark:bg-slate-800/70',
    borderColor: 'border-slate-300 dark:border-slate-700',
    dotColor: 'bg-slate-400',
  },
  PREPROGRAMACION: {
    label: 'Preprogramado',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-300 dark:border-amber-800',
    dotColor: 'bg-amber-500',
  },
  PROGRAMADO: {
    label: 'Programado',
    color: 'text-sky-700 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-950/30',
    borderColor: 'border-sky-300 dark:border-sky-800',
    dotColor: 'bg-sky-500',
  },
  PROGRAMADO_CON_CAMION: {
    label: 'Programado con camión',
    color: 'text-indigo-700 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderColor: 'border-indigo-300 dark:border-indigo-800',
    dotColor: 'bg-indigo-500',
  },
  CONFIRMADO: {
    label: 'Confirmado',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-400 dark:border-emerald-700',
    dotColor: 'bg-emerald-500',
  },
  DESPACHADO: {
    label: 'Despachado',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-300 dark:border-blue-800',
    dotColor: 'bg-blue-600',
  },
  TERMINADO: {
    label: 'Terminado',
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-100 dark:bg-slate-800/70',
    borderColor: 'border-slate-300 dark:border-slate-700',
    dotColor: 'bg-slate-500',
  },
  CANCELADO: {
    label: 'Cancelado',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    borderColor: 'border-rose-300 dark:border-rose-800/60',
    dotColor: 'bg-rose-500',
  },
};

/**
 * Máquina de estados unificada del pedido:
 * Preprogramado -> Programado -> Programado con camión -> (Aris) -> Confirmado (llegó a granja) -> Despachado (en ruta) -> Terminado (entregado).
 */
export function deriveEstadoComercial(
  o: Pick<SalesOrder, 'status' | 'transport_assigned' | 'dispatch_phase'>
): EstadoComercial {
  if (o.status === 'CANCELADO') return 'CANCELADO';
  if (o.status === 'BORRADOR') return 'BORRADOR';
  if (o.dispatch_phase === 'ENTREGADO_CONFORME') return 'TERMINADO';
  if (o.dispatch_phase === 'EN_TRANSITO') return 'DESPACHADO';
  if (o.status === 'DESPACHADO') return 'TERMINADO';
  if (o.dispatch_phase === 'EN_GRANJA_CARGANDO') return 'CONFIRMADO';
  if (o.status === 'APROBADO_RESERVADO' && o.transport_assigned) return 'PROGRAMADO_CON_CAMION';
  if (o.status === 'APROBADO_RESERVADO') return 'PROGRAMADO';
  return 'PREPROGRAMACION';
}

export function getOrderLines(
  o: Pick<
    SalesOrder,
    | 'order_lines'
    | 'requested_quantity'
    | 'estimated_cages'
    | 'density_birds_per_cage'
    | 'sex_preference'
    | 'min_weight_kg'
    | 'max_weight_kg'
  >
): OrderLine[] {
  if (Array.isArray(o.order_lines) && o.order_lines.length > 0) {
    return o.order_lines.map((l, idx) => ({
      id: l.id || `line-${idx + 1}`,
      requested_quantity: Number(l.requested_quantity) || 0,
      cages: l.cages ?? computeCages(Number(l.requested_quantity) || 0, l.density_birds_per_cage),
      density_birds_per_cage: clampDensity(l.density_birds_per_cage),
      sex_preference: (l.sex_preference as SexPreference) || 'MACHO',
      min_weight_kg: Number(l.min_weight_kg) || 2.2,
      max_weight_kg: Number(l.max_weight_kg) || 2.5,
      notes: l.notes || null,
    }));
  }
  const density = clampDensity(o.density_birds_per_cage);
  const qty = Number(o.requested_quantity) || 0;
  return [
    {
      id: 'line-1',
      requested_quantity: qty,
      cages: o.estimated_cages ?? computeCages(qty, density),
      density_birds_per_cage: density,
      sex_preference: o.sex_preference || 'MACHO',
      min_weight_kg: Number(o.min_weight_kg) || 2.2,
      max_weight_kg: Number(o.max_weight_kg) || 2.5,
      notes: null,
    },
  ];
}

export interface OrderUpdatePayload {
  client_id?: string;
  client_name?: string;
  client_tax_id?: string;
  zone_code?: string;
  seller_full_name?: string;
  seller_username?: string;
  delivery_address?: string;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  target_delivery_date?: string;
  requested_quantity?: number;
  allocated_quantity?: number;
  density_birds_per_cage?: number;
  min_weight_kg?: number;
  max_weight_kg?: number;
  sex_preference?: SexPreference;
  farm_code?: string;
  barn_code?: string;
  external_reference?: string;
  notes?: string;
  order_lines?: OrderLine[];
  is_draft?: boolean;
  force_reservation?: boolean;
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

