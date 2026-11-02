import { SimulatedTruck } from './simulationTypes';
import {
  INITIAL_SIMULATED_TRUCKS,
  createSimulatedTruckFromOrder,
  calculateBearing,
  calculateDistanceKm,
} from './gpsRoutesData';

const STORAGE_KEY = 'avicola_gr_gps_sim_state_v8';

interface StoredSimState {
  trucksState: Array<{
    id: string;
    currentIndex: number;
    progressPercent: number;
    currentSpeedKmH: number;
    etaMinutes: number;
    status: 'EN_GRANJA' | 'EN_TRANSITO' | 'EN_DESTINO';
    isPlaying: boolean;
  }>;
  globalSpeedMultiplier: 1 | 2 | 5;
  isSimulatingAll: boolean;
  lastUpdated: number;
}

class GpsSimulationStore {
  private trucks: SimulatedTruck[] = INITIAL_SIMULATED_TRUCKS;
  private globalSpeedMultiplier: 1 | 2 | 5 = 1;
  private isSimulatingAll: boolean = false;
  private listeners: Set<() => void> = new Set();
  private intervalId: any = null;

  constructor() {
    this.loadFromStorage();
    this.startLoop();

    // Sincronizar entre pestañas del navegador en tiempo real
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          this.applyStoredState(JSON.parse(e.newValue));
        }
      });
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const payload: StoredSimState = {
        trucksState: this.trucks.map((t) => ({
          id: t.id,
          currentIndex: t.currentIndex,
          progressPercent: t.progressPercent,
          currentSpeedKmH: t.currentSpeedKmH,
          etaMinutes: t.etaMinutes,
          status: t.status,
          isPlaying: t.isPlaying,
        })),
        globalSpeedMultiplier: this.globalSpeedMultiplier,
        isSimulatingAll: this.isSimulatingAll,
        lastUpdated: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignorar quota exceeded
    }
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.applyStoredState(JSON.parse(raw));
      }
    } catch {
      // Usar estado inicial si falla
    }
  }

  private applyStoredState(stored: StoredSimState) {
    if (!stored || !Array.isArray(stored.trucksState)) return;
    this.globalSpeedMultiplier = stored.globalSpeedMultiplier || 1;
    this.isSimulatingAll = typeof stored.isSimulatingAll === 'boolean' ? stored.isSimulatingAll : true;

    this.trucks = this.trucks.map((t) => {
      const saved = stored.trucksState.find((s) => s.id === t.id);
      if (!saved) return t;

      const safeIndex = Math.min(Math.max(0, saved.currentIndex), t.fullPath.length - 1);
      return {
        ...t,
        currentIndex: safeIndex,
        currentCoord: t.fullPath[safeIndex],
        progressPercent: saved.progressPercent,
        currentSpeedKmH: saved.currentSpeedKmH,
        etaMinutes: saved.etaMinutes,
        status: saved.status,
        isPlaying: saved.isPlaying,
      };
    });

    this.notify();
  }

  private startLoop() {
    if (this.intervalId) clearInterval(this.intervalId);

    const intervalTime = 600 / this.globalSpeedMultiplier;
    this.intervalId = setInterval(() => {
      let changed = false;

      this.trucks = this.trucks.map((truck) => {
        if (!truck.isPlaying) return truck;

        const totalSteps = truck.fullPath.length;
        let nextIndex = truck.currentIndex + 1;
        changed = true;

        if (nextIndex >= totalSteps) {
          nextIndex = totalSteps - 1;
          return {
            ...truck,
            currentIndex: nextIndex,
            currentCoord: truck.fullPath[nextIndex],
            progressPercent: 100,
            currentSpeedKmH: 0,
            etaMinutes: 0,
            status: 'EN_DESTINO',
            isPlaying: false,
          };
        }

        const currentPos = truck.fullPath[nextIndex];
        const progress = Math.round((nextIndex / (totalSteps - 1)) * 100);
        const destCoord = truck.fullPath[totalSteps - 1];
        const remainingKm = calculateDistanceKm(currentPos, destCoord);

        const simulatedSpeed =
          progress < 10
            ? 35
            : progress > 90
            ? 25
            : Math.floor(58 + Math.sin(nextIndex) * 8);

        const eta = Math.max(1, Math.round((remainingKm / (simulatedSpeed || 40)) * 60));

        return {
          ...truck,
          currentIndex: nextIndex,
          currentCoord: currentPos,
          progressPercent: progress,
          currentSpeedKmH: simulatedSpeed,
          etaMinutes: eta,
          status: progress === 0 ? 'EN_GRANJA' : progress >= 100 ? 'EN_DESTINO' : 'EN_TRANSITO',
        };
      });

      if (changed) {
        this.saveToStorage();
        this.notify();
      }
    }, intervalTime);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  // Getters
  public getTrucks(): SimulatedTruck[] {
    return this.trucks;
  }

  public getGlobalSpeed(): 1 | 2 | 5 {
    return this.globalSpeedMultiplier;
  }

  public getIsSimulatingAll(): boolean {
    return this.isSimulatingAll;
  }

  // Mutators (Ejecutados por el Admin)
  public toggleAll() {
    this.isSimulatingAll = !this.isSimulatingAll;
    this.trucks = this.trucks.map((t) => ({ ...t, isPlaying: this.isSimulatingAll }));
    this.saveToStorage();
    this.notify();
  }

  public toggleTruck(truckId: string) {
    this.trucks = this.trucks.map((t) =>
      t.id === truckId ? { ...t, isPlaying: !t.isPlaying } : t
    );
    this.saveToStorage();
    this.notify();
  }

  public setGlobalSpeed(speed: 1 | 2 | 5) {
    this.globalSpeedMultiplier = speed;
    this.startLoop(); // reiniciar ticker con nueva velocidad
    this.saveToStorage();
    this.notify();
  }

  public resetTruck(truckId: string) {
    this.trucks = this.trucks.map((t) => {
      if (t.id !== truckId) return t;
      const origin = t.fullPath[0];
      return {
        ...t,
        currentIndex: 0,
        currentCoord: origin,
        progressPercent: 0,
        currentSpeedKmH: 0,
        etaMinutes: Math.round(
          (calculateDistanceKm(origin, t.fullPath[t.fullPath.length - 1]) / 50) * 60
        ),
        status: 'EN_GRANJA',
        isPlaying: false,
      };
    });
    this.saveToStorage();
    this.notify();
  }

  public seekTruckProgress(truckId: string, targetPercent: number) {
    this.trucks = this.trucks.map((t) => {
      if (t.id !== truckId) return t;
      const targetIndex = Math.floor(((t.fullPath.length - 1) * targetPercent) / 100);
      const currentPos = t.fullPath[targetIndex];
      return {
        ...t,
        currentIndex: targetIndex,
        currentCoord: currentPos,
        progressPercent: targetPercent,
        status: targetPercent === 0 ? 'EN_GRANJA' : targetPercent >= 100 ? 'EN_DESTINO' : 'EN_TRANSITO',
      };
    });
    this.saveToStorage();
    this.notify();
  }

  /**
   * Sincroniza dinámicamente las unidades en ruta según los pedidos reales aprobados con transporte
   */
  public syncOrders(orders: Array<any>) {
    if (!Array.isArray(orders)) return;

    // Solo pedidos reales con transporte asignado y que no estén cancelados
    const assignedOrders = orders.filter(
      (o) =>
        o.transport_assigned === true &&
        o.status !== 'CANCELADO'
    );

    if (assignedOrders.length === 0) {
      if (this.trucks.length > 0) {
        this.trucks = [];
        this.saveToStorage();
        this.notify();
      }
      return;
    }

    const currentTrucksMap = new Map(this.trucks.map((t) => [t.id, t]));
    const nextTrucks: SimulatedTruck[] = [];

    assignedOrders.forEach((order) => {
      const truckId = order.transport_truck_id || `VH-${String(order.order_number || '001').slice(-3)}`;
      const existing = currentTrucksMap.get(truckId);
      const built = createSimulatedTruckFromOrder(order, existing);
      nextTrucks.push(built);
    });

    this.trucks = nextTrucks;
    this.saveToStorage();
    this.notify();
  }
}

// Instancia única compartida entre toda la aplicación
export const gpsSimulationStore = new GpsSimulationStore();

