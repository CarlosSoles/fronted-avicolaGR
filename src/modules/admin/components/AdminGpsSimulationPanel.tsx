import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Truck,
  Gauge,
  Clock,
  Radio,
  Sliders,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/api';
import { FlotaGpsMap } from '@/modules/gerencia/components/gps/FlotaGpsMap';
import { gpsSimulationStore } from '@/modules/gerencia/components/gps/gpsSimulationStore';
import { SimulatedTruck } from '@/modules/gerencia/components/gps/simulationTypes';

export const AdminGpsSimulationPanel: React.FC = () => {
  const [trucks, setTrucks] = useState<SimulatedTruck[]>(gpsSimulationStore.getTrucks());
  const [globalSpeed, setGlobalSpeed] = useState<1 | 2 | 5>(gpsSimulationStore.getGlobalSpeed());
  const [isSimulatingAll, setIsSimulatingAll] = useState<boolean>(
    gpsSimulationStore.getIsSimulatingAll()
  );

  useEffect(() => {
    // Sincronizar con los pedidos reales de la base de datos
    apiClient<any>('/comercial/orders')
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data || res?.items || [];
        gpsSimulationStore.syncOrders(list);
      })
      .catch(() => {
        const stored = localStorage.getItem('avicola_commercial_orders');
        if (stored) {
          try {
            gpsSimulationStore.syncOrders(JSON.parse(stored));
          } catch {}
        }
      });

    const unsub = gpsSimulationStore.subscribe(() => {
      setTrucks([...gpsSimulationStore.getTrucks()]);
      setGlobalSpeed(gpsSimulationStore.getGlobalSpeed());
      setIsSimulatingAll(gpsSimulationStore.getIsSimulatingAll());
    });
    return unsub;
  }, []);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* CABECERA EXPLICATIVA DEL CONTROL ADMIN */}
      {/* ========================================================================= */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-900">
              Panel Exclusivo de Administrador
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-bold text-slate-500">Mando Central de Simulación</span>
          </div>
          <h2 className="text-2xl font-black text-slate-950 dark:text-white flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-red-600" />
            Consola Telemática de Simulación GPS
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Control maestro de marcha de la flota. Las órdenes de marcha, velocidad y posición
            que configures aquí se transmiten automáticamente en tiempo real al <strong>Módulo del Gestor Comercial</strong> (donde ellos solo visualizan la ruta).
          </p>
        </div>

        {/* Master Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            size="md"
            disabled={trucks.length === 0}
            onClick={() => gpsSimulationStore.toggleAll()}
            className={`font-black flex items-center gap-2 px-5 py-2.5 rounded-2xl shadow-sm text-white ${
              trucks.length === 0
                ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-60'
                : isSimulatingAll
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isSimulatingAll ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isSimulatingAll ? 'Pausar Toda la Flota' : 'Iniciar Toda la Flota'}</span>
          </Button>

          {/* Velocidad */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <FastForward className="w-4 h-4 text-slate-500 ml-2 mr-1" />
            {([1, 2, 5] as const).map((spd) => (
              <button
                key={spd}
                disabled={trucks.length === 0}
                onClick={() => gpsSimulationStore.setGlobalSpeed(spd)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                  trucks.length === 0
                    ? 'text-slate-400 cursor-not-allowed'
                    : globalSpeed === spd
                    ? 'bg-white dark:bg-slate-900 text-red-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TARJETAS DE MANDO INDIVIDUAL POR CAMIÓN */}
      {/* ========================================================================= */}
      {trucks.length === 0 ? (
        <div className="p-8 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
            <Truck className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-slate-950 dark:text-white">
            Flota en Base &bull; Sin Despachos Activos
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
            Actualmente no hay camiones en carretera porque no existen pedidos aprobados con transporte asignado en Gestión Comercial. Tan pronto como un pedido sea aprobado y tenga transporte asignado, aparecerá aquí automáticamente con su ruta, velocidad y controles telemáticos.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
            <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>Sincronizado con la Base de Datos en tiempo real</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {trucks.map((truck) => (
            <div
              key={truck.id}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-mono font-black text-sm shadow-sm"
                    style={{ backgroundColor: truck.routeColor }}
                  >
                    {truck.id.split('-')[1]}
                  </div>
                  <div>
                    <h3 className="font-mono font-black text-slate-950 dark:text-white text-base">
                      {truck.id} &bull; {truck.plate}
                    </h3>
                    <p className="text-xs text-slate-500">{truck.driverName} &bull; {truck.model}</p>
                  </div>
                </div>

                <span
                  className={`text-xs font-black px-3 py-1 rounded-full uppercase ${
                    truck.status === 'EN_DESTINO'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : truck.status === 'EN_TRANSITO'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {truck.status === 'EN_DESTINO'
                    ? 'Arribado en Destino'
                    : truck.status === 'EN_TRANSITO'
                    ? 'En Marcha'
                    : 'En Granja (Detenido)'}
                </span>
              </div>

              {/* Datos de Trayecto y Telemetría */}
              <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Velocidad</span>
                  <span className="text-lg font-black font-mono text-slate-950 dark:text-white">
                    {truck.currentSpeedKmH} <span className="text-[10px]">km/h</span>
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Progreso</span>
                  <span className="text-lg font-black font-mono text-slate-950 dark:text-white">
                    {truck.progressPercent}%
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">ETA</span>
                  <span className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">
                    {truck.etaMinutes} <span className="text-[10px]">min</span>
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl">
                <div><strong>Origen:</strong> {truck.originFarm} ({truck.originBarn})</div>
                <div><strong>Destino:</strong> {truck.customerName} ({truck.destinationZone})</div>
                <div><strong>Carga:</strong> {truck.assignedBirds.toLocaleString()} aves ({truck.totalWeightTon} Ton ~{truck.assignedCages} jlas)</div>
              </div>

              {/* Slider de Avance Manual */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-500">
                  <span>Posicionar en Carretera:</span>
                  <span className="text-slate-900 dark:text-white">{truck.progressPercent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={truck.progressPercent}
                  onChange={(e) =>
                    gpsSimulationStore.seekTruckProgress(truck.id, Number(e.target.value))
                  }
                  className="w-full accent-red-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
              </div>

              {/* Controles de Marcha del Camión */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => gpsSimulationStore.toggleTruck(truck.id)}
                  className={`flex-1 text-xs font-black flex items-center justify-center gap-1.5 ${
                    truck.isPlaying
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white'
                  }`}
                >
                  {truck.isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" /> <span>Pausar Marcha</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> <span>Iniciar Marcha</span>
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => gpsSimulationStore.resetTruck(truck.id)}
                  className="text-xs font-bold flex items-center gap-1 text-slate-700 dark:text-slate-200"
                  title="Reiniciar a Granja de Origen"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reiniciar</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA PREVIA DEL MAPA DIRECTAMENTE EN EL PANEL ADMIN */}
      {/* ========================================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-950 dark:text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Vista Previa de Transmisión Satelital (Lo que ve el Gestor Comercial)
          </h3>
          <span className="text-xs text-slate-500 font-bold">Monitoreo GPS &bull; Sincronizado</span>
        </div>

        {/* Mapa renderizado en modo administrador con controles interactivos */}
        <FlotaGpsMap readOnly={false} />
      </div>
    </div>
  );
};

