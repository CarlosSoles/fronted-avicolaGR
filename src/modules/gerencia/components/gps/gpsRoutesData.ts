import { GpsCoordinate, SimulatedTruck } from './simulationTypes';
import realRoads from './realRoadRoutes.json';

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
 * IMPORTANTE: Solo el pedido PED-2026-001 está actualmente Aprobado con Transporte Designado
 * (T8C-940 - Carlos Méndez Rojas). Por ende, inicialmente SOLO 1 camión está activo en ruta.
 */
export const INITIAL_SIMULATED_TRUCKS: SimulatedTruck[] = [TRUCK_1_SANTA_ANITA];

