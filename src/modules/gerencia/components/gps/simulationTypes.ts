export interface GpsCoordinate {
  lat: number;
  lng: number;
}

export type DeliveryStatus = 'EN_GRANJA' | 'EN_TRANSITO' | 'EN_DESTINO';

export interface SimulatedTruck {
  id: string; // e.g. 'VH-001'
  plate: string; // e.g. 'T7C-842'
  model: string; // e.g. 'Volvo FMX 420'
  driverName: string;
  driverPhone: string;
  crewName: string;
  orderId: string;
  customerName: string;
  destinationZone: string;
  originFarm: string;
  originBarn: string;
  assignedBirds: number;
  assignedCages: number;
  totalWeightTon: number;
  routeColor: string;
  waypoints: GpsCoordinate[];
  fullPath: GpsCoordinate[]; // interpolated smooth path
  // Dynamic telemetry state
  currentIndex: number; // index in fullPath
  currentCoord: GpsCoordinate;
  progressPercent: number; // 0 to 100
  currentSpeedKmH: number;
  etaMinutes: number;
  status: DeliveryStatus;
  isPlaying: boolean;
  speedMultiplier: 1 | 2 | 5;
}

