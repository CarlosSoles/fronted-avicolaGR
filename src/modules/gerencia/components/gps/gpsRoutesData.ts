import { GpsCoordinate, SimulatedTruck } from './simulationTypes';
import realRoads from './realRoadRoutes.json';
import { FARM_COORDINATES } from '@/types/pecuaria';

/**
 * Calcula la distancia aproximada en kilómetros entre dos coordenadas (Haversine).
 */
export function calculateDistanceKm(c1: GpsCoordinate, c2: GpsCoordinate): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLng = ((c2.lng - c1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calcula el ángulo de rumbo (bearing en grados) entre dos puntos geográficos.
 */
export function calculateBearing(c1: GpsCoordinate, c2: GpsCoordinate): number {
  const lat1 = (c1.lat * Math.PI) / 180;
  const lat2 = (c2.lat * Math.PI) / 180;
  const dLng = ((c2.lng - c1.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * RUTAS VIALES REALES OBTENIDAS DE OSRM (OPEN SOURCE ROUTING MACHINE)
 * Siguen al 100% el asfalto de carreteras, puentes, rampas y avenidas de Lima.
 */
export const ROUTE_1_SMOOTH: GpsCoordinate[] = realRoads.route1; // 371 coordenadas por Autopista Ramiro Prialé
export const ROUTE_2_SMOOTH: GpsCoordinate[] = realRoads.route2; // 483 coordenadas por Panamericana Norte

export const WAYPOINTS_TRUCK_1: GpsCoordinate[] = [
  ROUTE_1_SMOOTH[0],
  ROUTE_1_SMOOTH[Math.floor(ROUTE_1_SMOOTH.length / 2)],
  ROUTE_1_SMOOTH[ROUTE_1_SMOOTH.length - 1],
];

export const WAYPOINTS_TRUCK_2: GpsCoordinate[] = [
  ROUTE_2_SMOOTH[0],
  ROUTE_2_SMOOTH[Math.floor(ROUTE_2_SMOOTH.length / 2)],
  ROUTE_2_SMOOTH[ROUTE_2_SMOOTH.length - 1],
];

export const TRUCK_1_SANTA_ANITA: SimulatedTruck = {
  id: 'VH-001',
  plate: 'T8C-940',
  model: 'Camión Baranda 3 Ejes',
  driverName: 'Carlos Méndez Rojas',
  driverPhone: '+51 984 123 456',
  crewName: 'Cuadrilla Norte 1 (4 estibadores)',
  orderId: 'PED-2026-001',
  customerName: 'Distribuidora Santa Anita S.A.C.',
  destinationZone: 'ZONA CENTRO / LIMA ESTE',
  originFarm: 'Granja Tradición 1',
  originBarn: 'Galpón G-01',
  assignedBirds: 4000,
  assignedCages: 500,
  totalWeightTon: 9.4,
  routeColor: '#059669', // Emerald
  waypoints: WAYPOINTS_TRUCK_1,
  fullPath: ROUTE_1_SMOOTH,
  // En punto de partida (Granja Tradición 1) esperando activación desde Admin
  currentIndex: 0,
  currentCoord: ROUTE_1_SMOOTH[0],
  progressPercent: 0,
  currentSpeedKmH: 0,
  etaMinutes: 25,
  status: 'EN_GRANJA',
  isPlaying: false,
  speedMultiplier: 1,
};

export const TRUCK_2_METRO_CENCOSUD: SimulatedTruck = {
  id: 'VH-002',
  plate: 'V6B-821',
  model: 'Camión Plataforma 2 Ejes',
  driverName: 'José Luis Quispe',
  driverPhone: '+51 992 345 678',
  crewName: 'Cuadrilla Centro 2 (3 estibadores)',
  orderId: 'PED-2026-003',
  customerName: 'Supermercados Metro / Cencosud',
  destinationZone: 'ZONA NORTE / LIMA METRO',
  originFarm: 'Granja Pacific 6',
  originBarn: 'Galpón G-02',
  assignedBirds: 5000,
  assignedCages: 625,
  totalWeightTon: 12.3,
  routeColor: '#2563eb', // Blue
  waypoints: WAYPOINTS_TRUCK_2,
  fullPath: ROUTE_2_SMOOTH,
  currentIndex: 0,
  currentCoord: ROUTE_2_SMOOTH[0],
  progressPercent: 0,
  currentSpeedKmH: 0,
  etaMinutes: 38,
  status: 'EN_GRANJA',
  isPlaying: false,
  speedMultiplier: 1,
};

/**
 * Inicialmente la flota está en base (vacía) hasta que se asigne transporte a un pedido formal.
 */
export const INITIAL_SIMULATED_TRUCKS: SimulatedTruck[] = [];

function buildInterpolatedPath(origin: GpsCoordinate, dest: GpsCoordinate, steps = 60): GpsCoordinate[] {
  const path: GpsCoordinate[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    path.push({
      lat: Number((origin.lat + (dest.lat - origin.lat) * t).toFixed(6)),
      lng: Number((origin.lng + (dest.lng - origin.lng) * t).toFixed(6)),
    });
  }
  path[0] = origin;
  path[path.length - 1] = dest;
  return path;
}

// Coordenadas dinámicas cargadas desde Admin (/admin/farms) con respaldo en FARM_COORDINATES
const dynamicFarmCoordinates: Record<string, GpsCoordinate> = {};

export function setDynamicFarmCoordinates(
  farms: Array<{ code?: string; latitude?: number | null; longitude?: number | null }>
) {
  if (!Array.isArray(farms)) return;
  farms.forEach((f) => {
    const code = String(f.code || '').trim().toUpperCase();
    const lat = Number(f.latitude);
    const lng = Number(f.longitude);
    if (code && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      dynamicFarmCoordinates[code] = { lat, lng };
    }
  });
}

export function getFarmOriginCoordinate(farmCode?: string | null): GpsCoordinate | undefined {
  const code = String(farmCode || '').trim().toUpperCase();
  if (!code) return undefined;
  return dynamicFarmCoordinates[code] || FARM_COORDINATES[code];
}

// Caché de rutas viales reales obtenidas desde OSRM
const osrmRouteCache = new Map<string, { path: GpsCoordinate[]; durationMin: number }>();
const osrmPending = new Map<string, Promise<{ path: GpsCoordinate[]; durationMin: number } | null>>();

export function getRouteCacheKey(origin: GpsCoordinate, dest: GpsCoordinate): string {
  return `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}->${dest.lat.toFixed(5)},${dest.lng.toFixed(5)}`;
}

export function getCachedOsrmRoute(origin: GpsCoordinate, dest: GpsCoordinate) {
  return osrmRouteCache.get(getRouteCacheKey(origin, dest));
}

export async function fetchOsrmRoadRoute(
  origin: GpsCoordinate,
  dest: GpsCoordinate
): Promise<{ path: GpsCoordinate[]; durationMin: number } | null> {
  const key = getRouteCacheKey(origin, dest);
  const cached = osrmRouteCache.get(key);
  if (cached) return cached;

  const inflight = osrmPending.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      const route = data?.routes?.[0];
      const coords: Array<[number, number]> | undefined = route?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return null;

      const path: GpsCoordinate[] = coords.map(([lng, lat]) => ({ lat, lng }));
      path[0] = origin;
      path[path.length - 1] = dest;

      const durationMin = Math.max(5, Math.round((Number(route.duration) || 1200) / 60));
      const result = { path, durationMin };
      osrmRouteCache.set(key, result);
      return result;
    } catch {
      return null;
    } finally {
      osrmPending.delete(key);
    }
  })();

  osrmPending.set(key, task);
  return task;
}

/**
 * Genera dinámicamente una unidad telemática en ruta para un pedido real aprobado con transporte
 */
export function createSimulatedTruckFromOrder(order: any, existingTruck?: SimulatedTruck): SimulatedTruck {
  const zoneStr = String(order.zone_code || '').toUpperCase();
  const isNorte = zoneStr.includes('NORTE');
  const templatePath = isNorte ? ROUTE_2_SMOOTH : ROUTE_1_SMOOTH;
  const routeColor = isNorte ? '#2563eb' : '#059669';

  const farmCode = order.assigned_farm_code || order.suggested_farm_code || 'TRAD1';
  const barnCode = order.assigned_barn_code || order.suggested_barn_code || 'G-01';

  const farmOrigin: GpsCoordinate = getFarmOriginCoordinate(farmCode) || templatePath[0];
  const hasClientCoord =
    Number.isFinite(Number(order.delivery_latitude)) &&
    Number.isFinite(Number(order.delivery_longitude)) &&
    Number(order.delivery_latitude) !== 0 &&
    Number(order.delivery_longitude) !== 0;

  const clientDest: GpsCoordinate = hasClientCoord
    ? { lat: Number(order.delivery_latitude), lng: Number(order.delivery_longitude) }
    : templatePath[templatePath.length - 1];

  const cachedOsrm = getCachedOsrmRoute(farmOrigin, clientDest);
  const existingMatchesEndpoints =
    existingTruck &&
    existingTruck.fullPath.length > 2 &&
    calculateDistanceKm(existingTruck.fullPath[0], farmOrigin) < 0.05 &&
    calculateDistanceKm(existingTruck.fullPath[existingTruck.fullPath.length - 1], clientDest) < 0.05;

  const fullPath: GpsCoordinate[] = cachedOsrm
    ? cachedOsrm.path
    : existingMatchesEndpoints
      ? existingTruck!.fullPath
      : buildInterpolatedPath(farmOrigin, clientDest);

  const waypoints: GpsCoordinate[] = [
    fullPath[0],
    fullPath[Math.floor(fullPath.length / 2)],
    fullPath[fullPath.length - 1],
  ];

  const birds = order.allocated_quantity || order.requested_quantity || 3500;
  const cages = order.estimated_cages || Math.ceil(birds / 8);
  const totalWeightTon = order.estimated_total_kg
    ? Math.round((order.estimated_total_kg / 1000) * 10) / 10
    : Math.round(((birds * 2.35) / 1000) * 10) / 10;

  const truckId = order.transport_truck_id || `VH-${String(order.order_number || '001').slice(-3)}`;
  const plate = order.transport_plate || 'T8C-940';
  const driverName = order.transport_driver_name || 'Carlos Méndez Rojas';
  const driverPhone = order.transport_driver_phone || '+51 984 123 456';

  const sameOriginAsExisting =
    existingTruck &&
    existingTruck.fullPath.length > 0 &&
    calculateDistanceKm(existingTruck.fullPath[0], fullPath[0]) < 0.05;

  let initialIndex = 0;
  let initialProgress = 0;
  let initialStatus: 'EN_GRANJA' | 'EN_TRANSITO' | 'EN_DESTINO' = 'EN_GRANJA';

  if (existingTruck && sameOriginAsExisting) {
    initialIndex = Math.min(existingTruck.currentIndex, fullPath.length - 1);
    initialProgress = existingTruck.progressPercent;
    initialStatus = existingTruck.status;
  } else if (order.dispatch_phase === 'EN_TRANSITO') {
    initialIndex = Math.floor(fullPath.length * 0.3);
    initialProgress = 30;
    initialStatus = 'EN_TRANSITO';
  } else if (order.dispatch_phase === 'ENTREGADO_CONFORME') {
    initialIndex = fullPath.length - 1;
    initialProgress = 100;
    initialStatus = 'EN_DESTINO';
  }

  return {
    id: truckId,
    plate,
    model: 'Camión Baranda 3 Ejes',
    driverName,
    driverPhone,
    crewName: 'Cuadrilla de Carga y Despacho',
    orderId: order.order_number || 'PED-PENDIENTE',
    customerName: order.client_name || 'Cliente Mayorista',
    destinationZone: order.zone_code || 'ZONA CENTRO',
    originFarm: `Granja ${farmCode}`,
    originBarn: `Galpón ${barnCode}`,
    assignedBirds: birds,
    assignedCages: cages,
    totalWeightTon,
    routeColor,
    waypoints,
    fullPath,
    currentIndex: initialIndex,
    currentCoord: fullPath[initialIndex] || fullPath[0],
    progressPercent: initialProgress,
    currentSpeedKmH: existingTruck ? existingTruck.currentSpeedKmH : 0,
    etaMinutes: cachedOsrm ? cachedOsrm.durationMin : (isNorte ? 38 : 25),
    status: initialStatus,
    isPlaying: existingTruck ? existingTruck.isPlaying : false,
    speedMultiplier: existingTruck ? existingTruck.speedMultiplier : 1,
  };
}

