import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Truck,
  MapPin,
  Warehouse,
  Gauge,
  Clock,
  Phone,
  Maximize2,
  ChevronRight,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { SimulatedTruck } from './simulationTypes';
import { SalesOrder } from '@/types/comercial';
import { calculateBearing } from './gpsRoutesData';
import { gpsSimulationStore } from './gpsSimulationStore';

// Iconos HTML personalizados para Leaflet
const createFarmIcon = (label: string) =>
  L.divIcon({
    className: 'custom-farm-icon',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
        <div style="background:#dc2626; color:white; font-size:10px; font-weight:900; padding:3px 7px; border-radius:8px; box-shadow:0 4px 10px rgba(220,38,38,0.4); border:1.5px solid white; white-space:nowrap; margin-bottom:2px;">
          🏭 ${label}
        </div>
        <div style="width:14px; height:14px; background:#dc2626; border:2.5px solid white; border-radius:50%; box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
      </div>
    `,
    iconSize: [0, 0],
  });

const createClientIcon = (label: string) =>
  L.divIcon({
    className: 'custom-client-icon',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
        <div style="background:#1e293b; color:white; font-size:10px; font-weight:900; padding:3px 7px; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.4); border:1.5px solid white; white-space:nowrap; margin-bottom:2px;">
          🏪 ${label}
        </div>
        <div style="width:14px; height:14px; background:#0f172a; border:2.5px solid white; border-radius:50%; box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
      </div>
    `,
    iconSize: [0, 0],
  });

const createTruckIcon = (plate: string, color: string, bearing: number, isMoving: boolean) =>
  L.divIcon({
    className: 'custom-truck-icon',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -50%);">
        <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
          ${
            isMoving
              ? `<div style="position:absolute; inset:0; border-radius:50%; background:${color}; opacity:0.3; animation:ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
              : ''
          }
          <div style="position:relative; width:36px; height:36px; border-radius:50%; background:${color}; border:3px solid white; box-shadow:0 4px 12px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; transform: rotate(${bearing}deg); transition: transform 0.3s ease;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
              <path d="M15 18H9"/>
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
              <circle cx="17" cy="18" r="2"/>
              <circle cx="7" cy="18" r="2"/>
            </svg>
          </div>
        </div>
        <div style="background:#0f172a; color:#f8fafc; font-size:9px; font-weight:900; font-family:monospace; padding:1.5px 6px; border-radius:6px; border:1px solid #334155; margin-top:-4px; box-shadow:0 2px 5px rgba(0,0,0,0.3); white-space:nowrap;">
          🚛 ${plate}
        </div>
      </div>
    `,
    iconSize: [0, 0],
  });

export interface FlotaGpsMapProps {
  initialSelectedTruckId?: string;
  readOnly?: boolean; // Por defecto true en el módulo Gestor Comercial
  onClose?: () => void;
  /** Pedidos de los que se derivan los vendedores para el filtro de monitoreo */
  orders?: SalesOrder[];
  /** Muestra u oculta el selector de vendedor (se oculta en la vista del propio vendedor) */
  showSellerFilter?: boolean;
}

export const FlotaGpsMap: React.FC<FlotaGpsMapProps> = ({
  initialSelectedTruckId,
  readOnly = true,
  onClose,
  orders,
  showSellerFilter = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Referencias a elementos en mapa
  const truckLayersRef = useRef<
    Record<
      string,
      {
        originMarker: L.Marker;
        destMarker: L.Marker;
        basePoly: L.Polyline;
        completedPoly: L.Polyline;
        truckMarker: L.Marker;
      }
    >
  >({});
  const hasFittedBoundsRef = useRef<boolean>(false);

  // Suscripción al store telemático compartido
  const [trucks, setTrucks] = useState<SimulatedTruck[]>(gpsSimulationStore.getTrucks());
  const [selectedTruckId, setSelectedTruckId] = useState<string>(
    initialSelectedTruckId || trucks[0]?.id || ''
  );
  const [sellerFilter, setSellerFilter] = useState<string>('ALL');

  // Vendedores disponibles según los pedidos que serán transportados
  const sellerOptions = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    const bySeller = new Map<string, { username: string; label: string; count: number }>();
    orders.forEach((o) => {
      if (!o.transport_assigned) return;
      const username = o.seller_username || 'sin-vendedor';
      const label = o.seller_full_name || o.seller_username || 'Sin vendedor';
      const prev = bySeller.get(username);
      bySeller.set(username, { username, label, count: (prev?.count || 0) + 1 });
    });
    return Array.from(bySeller.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [orders]);

  // Números de pedido del vendedor seleccionado (null = todos)
  const sellerOrderNumbers = useMemo(() => {
    if (!orders || sellerFilter === 'ALL') return null;
    return new Set(
      orders
        .filter((o) => (o.seller_username || 'sin-vendedor') === sellerFilter)
        .map((o) => o.order_number)
    );
  }, [orders, sellerFilter]);

  const visibleTrucks = useMemo(
    () => (sellerOrderNumbers ? trucks.filter((t) => sellerOrderNumbers.has(t.orderId)) : trucks),
    [trucks, sellerOrderNumbers]
  );

  useEffect(() => {
    const unsubscribe = gpsSimulationStore.subscribe(() => {
      const current = gpsSimulationStore.getTrucks();
      setTrucks([...current]);
      if (current.length > 0 && !current.some((t) => t.id === selectedTruckId)) {
        setSelectedTruckId(current[0].id);
      }
    });
    return unsubscribe;
  }, [selectedTruckId]);

  const selectedTruck = visibleTrucks.find((t) => t.id === selectedTruckId) || visibleTrucks[0] || null;

  // Mantener una selección válida al cambiar de vendedor
  useEffect(() => {
    if (visibleTrucks.length > 0 && !visibleTrucks.some((t) => t.id === selectedTruckId)) {
      setSelectedTruckId(visibleTrucks[0].id);
    }
  }, [visibleTrucks, selectedTruckId]);

  // 1. Inicialización de Leaflet con OpenStreetMap oficial y gratuito
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-11.95, -77.02],
      zoom: 11,
      zoomControl: true,
      attributionControl: false,
    });

    // Tile Layer: OpenStreetMap Oficial (100% libre, sin API key, sin marcas de agua)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      truckLayersRef.current = {};
      hasFittedBoundsRef.current = false;
    };
  }, []);

  // 2. Sincronizar Marcadores y Polilíneas reactivamente con el Store
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const activeTruckIds = new Set(visibleTrucks.map((t) => t.id));

    // Limpiar camiones removidos
    Object.keys(truckLayersRef.current).forEach((id) => {
      if (!activeTruckIds.has(id)) {
        const layers = truckLayersRef.current[id];
        layers.originMarker.remove();
        layers.destMarker.remove();
        layers.basePoly.remove();
        layers.completedPoly.remove();
        layers.truckMarker.remove();
        delete truckLayersRef.current[id];
      }
    });

    // Crear o actualizar camiones
    visibleTrucks.forEach((truck) => {
      const nextCoord = truck.fullPath[Math.min(truck.fullPath.length - 1, truck.currentIndex + 1)];
      const bearing = calculateBearing(truck.currentCoord, nextCoord);
      let layers = truckLayersRef.current[truck.id];

      if (!layers) {
        const originCoord = truck.waypoints[0];
        const destCoord = truck.waypoints[truck.waypoints.length - 1];

        // Marcador de Granja (Origen)
        const originMarker = L.marker([originCoord.lat, originCoord.lng], {
          icon: createFarmIcon(`${truck.originFarm} (${truck.originBarn})`),
        })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif; font-size:12px; padding:2px;">
              <b style="color:#dc2626;">GRANJA DE ORIGEN</b><br/>
              <strong>${truck.originFarm}</strong><br/>
              Galpón: <strong>${truck.originBarn}</strong><br/>
              Carga: ${truck.assignedBirds.toLocaleString()} aves (~${truck.assignedCages} jaulas)
            </div>
          `);

        // Marcador de Cliente (Destino)
        const destMarker = L.marker([destCoord.lat, destCoord.lng], {
          icon: createClientIcon(truck.customerName),
        })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif; font-size:12px; padding:2px;">
              <b style="color:#0f172a;">DESTINO DE ENTREGA</b><br/>
              <strong>${truck.customerName}</strong><br/>
              Zona: ${truck.destinationZone}<br/>
              Pedido: <strong>${truck.orderId}</strong>
            </div>
          `);

        // Polilínea base de la ruta
        const allCoords = truck.fullPath.map((p) => [p.lat, p.lng] as [number, number]);
        const basePoly = L.polyline(allCoords, {
          color: truck.routeColor,
          weight: 3,
          opacity: 0.35,
          dashArray: '4, 8',
        }).addTo(map);

        // Polilínea de tramo recorrido
        const completedCoords = truck.fullPath
          .slice(0, truck.currentIndex + 1)
          .map((p) => [p.lat, p.lng] as [number, number]);
        const completedPoly = L.polyline(completedCoords, {
          color: truck.routeColor,
          weight: 5,
          opacity: 0.9,
        }).addTo(map);

        // Marcador dinámico del Camión
        const truckMarker = L.marker([truck.currentCoord.lat, truck.currentCoord.lng], {
          icon: createTruckIcon(truck.plate, truck.routeColor, bearing, truck.isPlaying),
          zIndexOffset: 1000,
        }).addTo(map);

        truckMarker.on('click', () => {
          setSelectedTruckId(truck.id);
        });

        truckLayersRef.current[truck.id] = {
          originMarker,
          destMarker,
          basePoly,
          completedPoly,
          truckMarker,
        };
      } else {
        // Actualizar posición de camión
        layers.truckMarker.setLatLng([truck.currentCoord.lat, truck.currentCoord.lng]);
        layers.truckMarker.setIcon(
          createTruckIcon(truck.plate, truck.routeColor, bearing, truck.isPlaying)
        );

        // Actualizar marcadores de origen y destino si cambiaron las coordenadas
        const originCoord = truck.waypoints[0];
        const destCoord = truck.waypoints[truck.waypoints.length - 1];
        if (originCoord) {
          layers.originMarker.setLatLng([originCoord.lat, originCoord.lng]);
        }
        if (destCoord) {
          layers.destMarker.setLatLng([destCoord.lat, destCoord.lng]);
        }

        // Actualizar polilínea de ruta completa y tramo completado
        const allCoords = truck.fullPath.map((p) => [p.lat, p.lng] as [number, number]);
        layers.basePoly.setLatLngs(allCoords);

        const completedCoords = truck.fullPath
          .slice(0, truck.currentIndex + 1)
          .map((p) => [p.lat, p.lng] as [number, number]);
        layers.completedPoly.setLatLngs(completedCoords);
      }
    });

    // Ajustar zoom si hay camiones
    if (visibleTrucks.length > 0 && !hasFittedBoundsRef.current) {
      const allPoints = visibleTrucks.flatMap((t) => t.waypoints.map((w) => [w.lat, w.lng] as [number, number]));
      if (allPoints.length > 0) {
        map.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50] });
        hasFittedBoundsRef.current = true;
      }
    } else if (visibleTrucks.length === 0) {
      hasFittedBoundsRef.current = false;
      map.setView([-11.95, -77.02], 11);
    }
  }, [visibleTrucks]);

  // Controles
  const handleCenterOnTruck = (truckId: string) => {
    const truck = visibleTrucks.find((t) => t.id === truckId);
    if (!truck || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([truck.currentCoord.lat, truck.currentCoord.lng], 13, {
      duration: 1.2,
    });
  };

  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    const allPoints = visibleTrucks.flatMap((t) => t.waypoints.map((w) => [w.lat, w.lng] as [number, number]));
    if (allPoints.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50] });
    } else {
      mapInstanceRef.current.setView([-11.95, -77.02], 11);
    }
  };

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* SELECTOR DE CAMIÓN EN PANTALLA */}
      {/* ========================================================================= */}
      {/* SELECTOR DE VENDEDOR PARA EL MONITOREO */}
      {showSellerFilter && orders && orders.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Vendedor
            </span>
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 h-9"
              title="Filtrar los transportes por vendedor"
            >
              <option value="ALL">Todos los vendedores</option>
              {sellerOptions.map((s) => (
                <option key={s.username} value={s.username}>
                  {s.label} — {s.count} pedido{s.count !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {visibleTrucks.length} unidad{visibleTrucks.length !== 1 ? 'es' : ''} en ruta
          </span>
        </div>
      )}

      {visibleTrucks.length === 0 ? (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Flota en Base (0 unidades en ruta)</h4>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  En Base
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Los vehículos aparecerán aquí en tiempo real cuando apruebes un pedido y le asignes transporte en Gestión Comercial.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleTrucks.map((truck) => {
            const isSelected = selectedTruckId === truck.id;
            return (
              <div
                key={truck.id}
                onClick={() => {
                  setSelectedTruckId(truck.id);
                  handleCenterOnTruck(truck.id);
                }}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 border-red-500 ring-2 ring-red-500/20 shadow-md'
                    : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: truck.routeColor }}
                    ></span>
                    <span className="font-mono font-black text-sm text-slate-950 dark:text-white">
                      {truck.id} &bull; {truck.plate}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {truck.orderId}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                      truck.status === 'EN_DESTINO'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : truck.status === 'EN_TRANSITO'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {truck.status === 'EN_DESTINO'
                      ? '✓ Arribado'
                      : truck.status === 'EN_TRANSITO'
                      ? '🚚 En Ruta'
                      : '⏳ En Granja'}
                  </span>
                </div>

                {/* Trayecto Origen -> Destino */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-semibold mt-2">
                  <span className="truncate max-w-[140px] text-red-700 dark:text-red-400">
                    {truck.originFarm}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate max-w-[160px] text-slate-900 dark:text-white font-bold">
                    {truck.customerName}
                  </span>
                </div>

                {/* Barra de Progreso y Métricas */}
                <div className="mt-2.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1">
                    <span>Progreso: <strong>{truck.progressPercent}%</strong></span>
                    <span>
                      Velocidad: <strong>{truck.currentSpeedKmH} km/h</strong> &bull; ETA:{' '}
                      <strong>{truck.etaMinutes} min</strong>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${truck.progressPercent}%`,
                        backgroundColor: truck.routeColor,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONTENEDOR DEL MAPA OPENSTREETMAP */}
      {/* ========================================================================= */}
      <div className="relative w-full h-[540px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg bg-slate-100 dark:bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* BOTÓN ENCUADRAR RUTAS EN MAPA */}
        <button
          onClick={handleFitAll}
          className="absolute top-3 right-3 z-[400] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 shadow-md flex items-center gap-1.5 transition-colors"
          title="Ajustar zoom para ver rutas"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Ver Rutas</span>
        </button>

        {/* HUD TELEMETRÍA FLOTANTE */}
        {selectedTruck ? (
          <div className="absolute top-3 left-3 z-[400] max-w-sm w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedTruck.routeColor }}
                ></span>
                <div>
                  <h3 className="font-mono font-black text-sm text-slate-950 dark:text-white leading-tight">
                    {selectedTruck.id} &bull; {selectedTruck.plate}
                  </h3>
                  <p className="text-[10px] text-slate-500">{selectedTruck.model}</p>
                </div>
              </div>
              <button
                onClick={() => handleCenterOnTruck(selectedTruck.id)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs"
                title="Centrar en este camión"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tacómetro y ETA */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-center gap-1 text-[10px] font-black text-slate-400 uppercase">
                  <Gauge className="w-3 h-3 text-emerald-500" />
                  <span>Velocidad</span>
                </div>
                <div className="text-xl font-black font-mono text-slate-950 dark:text-white mt-0.5">
                  {selectedTruck.currentSpeedKmH}{' '}
                  <span className="text-[10px] font-bold text-slate-400">km/h</span>
                </div>
              </div>

              <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-center gap-1 text-[10px] font-black text-slate-400 uppercase">
                  <Clock className="w-3 h-3 text-blue-500" />
                  <span>Tiempo a Destino</span>
                </div>
                <div className="text-xl font-black font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                  {selectedTruck.etaMinutes}{' '}
                  <span className="text-[10px] font-bold text-slate-400">min</span>
                </div>
              </div>
            </div>

            {/* Detalles del Chofer y Carga */}
            <div className="text-xs space-y-1.5 font-sans pt-1">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400 font-medium">Conductor:</span>
                <strong className="text-slate-900 dark:text-white">{selectedTruck.driverName}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400 font-medium">Carga Asignada:</span>
                <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                  {selectedTruck.assignedBirds.toLocaleString()} aves ({selectedTruck.totalWeightTon} Ton)
                </strong>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="text-slate-400 font-medium">Cliente &amp; Destino:</span>
                <strong className="text-slate-900 dark:text-white truncate max-w-[170px]">
                  {selectedTruck.customerName}
                </strong>
              </div>
            </div>

            {/* BARRA DE PROGRESO */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 mb-1">
                <span>Recorrido de Saca</span>
                <span>{selectedTruck.progressPercent}%</span>
              </div>
              {!readOnly ? (
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedTruck.progressPercent}
                  onChange={(e) =>
                    gpsSimulationStore.seekTruckProgress(selectedTruck.id, Number(e.target.value))
                  }
                  className="w-full accent-red-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
              ) : (
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${selectedTruck.progressPercent}%`,
                      backgroundColor: selectedTruck.routeColor,
                    }}
                  ></div>
                </div>
              )}
            </div>

            {/* BOTONES */}
            <div className="flex items-center gap-1.5 pt-1">
              {!readOnly ? (
                <>
                  <button
                    onClick={() => gpsSimulationStore.toggleTruck(selectedTruck.id)}
                    className="flex-1 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-colors"
                  >
                    {selectedTruck.isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" /> <span>Pausar</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" /> <span>Iniciar Marcha</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => gpsSimulationStore.resetTruck(selectedTruck.id)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs"
                    title="Reiniciar a Granja de Origen"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 font-bold">
                  <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                  <span>Transmisión en Vivo</span>
                </div>
              )}

              <a
                href={`https://wa.me/${selectedTruck.driverPhone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(
                  selectedTruck.driverName
                )},%20te%20contacto%20desde%20Despacho%20Avícola%20GR%20por%20el%20pedido%20${selectedTruck.orderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 px-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-1 font-bold shadow-xs"
                title="Contactar al chofer por WhatsApp"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>WhatsApp Chofer</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="absolute top-3 left-3 z-[400] max-w-sm w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-mono font-black text-sm text-slate-950 dark:text-white">
                  Flota en Base &bull; Sin Ruta
                </h3>
                <p className="text-[10px] text-slate-500">Monitoreo Satelital en Espera</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              No hay transportes en carretera en este momento. Las unidades se desplegarán automáticamente al asignar camión a un pedido.
            </p>
          </div>
        )}

        {/* LEYENDA DEL MAPA FLOTANTE */}
        <div className="absolute bottom-4 right-4 z-[400] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md text-[11px] font-bold text-slate-700 dark:text-slate-300 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            <span>Granja de Saca (Origen)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 dark:bg-white"></span>
            <span>Cliente / Mercado (Destino)</span>
          </div>
          {visibleTrucks.length === 0 ? (
            <div className="flex items-center gap-2 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
              <span>Sin rutas activas</span>
            </div>
          ) : (
            visibleTrucks.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.routeColor }}></span>
                <span>{t.id}: {t.originFarm.replace('Granja ', '')} &rarr; {t.customerName.slice(0, 15)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
