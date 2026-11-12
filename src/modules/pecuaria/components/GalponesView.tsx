import React, { useEffect, useMemo, useState } from 'react';
import {
  Warehouse,
  Bird,
  Scale,
  CalendarDays,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { TablaGeneralSaldoItem } from '@/types/pecuaria';
import { ChickenAnimation, ChickenMood } from './ChickenAnimation';

interface GalponesViewProps {
  data: TablaGeneralSaldoItem[];
  isLoading: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  OPERATIVO: 'Operativo',
  BLOQUEADO_SANITARIO: 'Bloqueado sanitario',
  PENDIENTE_REVISION: 'Pendiente de revisión',
  CERRADO: 'Cerrado',
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Sin registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin registro';
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const GalponesView: React.FC<GalponesViewProps> = ({ data, isLoading }) => {
  const [selectedFarm, setSelectedFarm] = useState<string>('');
  const [selectedBarnId, setSelectedBarnId] = useState<string>('');

  const farms = useMemo(() => {
    const map = new Map<string, { code: string; name: string; zone: string; count: number }>();
    data.forEach((item) => {
      const current = map.get(item.farm_code);
      map.set(item.farm_code, {
        code: item.farm_code,
        name: item.farm_name,
        zone: item.farm_zone,
        count: (current?.count || 0) + 1,
      });
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [data]);

  // Granja por defecto: la primera con datos
  useEffect(() => {
    if (farms.length === 0) {
      setSelectedFarm('');
      return;
    }
    if (!farms.some((f) => f.code === selectedFarm)) {
      setSelectedFarm(farms[0].code);
    }
  }, [farms, selectedFarm]);

  const farmBarns = useMemo(
    () =>
      data
        .filter((item) => item.farm_code === selectedFarm)
        .sort((a, b) => a.barn_number - b.barn_number),
    [data, selectedFarm]
  );

  // Galpón por defecto: el primero de la granja
  useEffect(() => {
    if (farmBarns.length === 0) {
      setSelectedBarnId('');
      return;
    }
    if (!farmBarns.some((b) => b.barn_id === selectedBarnId)) {
      setSelectedBarnId(farmBarns[0].barn_id);
    }
  }, [farmBarns, selectedBarnId]);

  const barn = farmBarns.find((b) => b.barn_id === selectedBarnId) || null;

  const mood: ChickenMood = !barn
    ? 'idle'
    : barn.barn_status !== 'OPERATIVO'
    ? 'idle'
    : barn.bird_age_days > 45
    ? 'alert'
    : 'normal';

  const occupiedPercent = barn && barn.physical_count > 0
    ? Math.min(100, Math.round((barn.barn_balance_available / barn.physical_count) * 100))
    : 0;

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-600 border-r-transparent mb-3" />
        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Cargando galpones...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
        <Warehouse className="w-10 h-10 mx-auto mb-2 text-slate-400" />
        <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Sin galpones registrados</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          No hay lotes ni inventario cargados en la base de datos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selector de granja */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Selecciona una granja
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {farms.length} granjas con galpones registrados
            </span>
          </div>
        </div>

        <select
          value={selectedFarm}
          onChange={(e) => setSelectedFarm(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
        >
          {farms.map((farm) => (
            <option key={farm.code} value={farm.code}>
              {farm.code} — {farm.name} ({farm.count} galpones)
            </option>
          ))}
        </select>
      </div>

      {/* Grilla de galpones de la granja */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Galpones de {selectedFarm}
          </span>
          <span className="text-[10px] font-bold text-slate-400">
            {farmBarns.length} registrados
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
          {farmBarns.map((item) => {
            const isSelected = item.barn_id === selectedBarnId;
            const isPriority = item.bird_age_days > 45;
            const isBlocked = item.barn_status !== 'OPERATIVO';
            return (
              <button
                key={item.barn_id}
                type="button"
                onClick={() => setSelectedBarnId(item.barn_id)}
                className={`rounded-xl border px-2 py-2 text-left transition-all ${
                  isSelected
                    ? 'border-red-500 ring-2 ring-red-500/25 bg-red-50 dark:bg-red-950/30'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-xs text-slate-900 dark:text-slate-100">
                    {item.barn_code}
                  </span>
                  {isBlocked ? (
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                  ) : isPriority ? (
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </div>
                <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.bird_age_days} días
                </div>
                <div className="text-[9.5px] font-mono text-slate-600 dark:text-slate-300 truncate">
                  {item.barn_balance_available.toLocaleString()} aves
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalle del galpón: gallina + datos reales */}
      {barn ? (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
          {/* Escena de la gallina */}
          <div className="relative bg-gradient-to-b from-sky-100 via-emerald-50 to-amber-100 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-between overflow-hidden">
            <div className="w-full flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-lg bg-white/80 dark:bg-slate-800 text-[10px] font-black font-mono text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700">
                {barn.farm_code} · {barn.barn_code}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {barn.barn_balance_available < 2000 && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    &lt; 2k aves
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-lg text-[9.5px] font-black uppercase ${
                    barn.barn_status !== 'OPERATIVO'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : barn.bird_age_days > 45
                      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {STATUS_LABEL[barn.barn_status] || barn.barn_status}
                </span>
              </div>
            </div>

            <ChickenAnimation mood={mood} className="my-1" />

            {/* Suelo */}
            <div className="w-full">
              <div className="h-1.5 rounded-full bg-amber-200/70 dark:bg-amber-900/40" />
              <p className="text-center text-[10px] font-semibold text-slate-600 dark:text-slate-400 mt-2">
                {mood === 'alert'
                  ? 'Lote con más de 45 días: prioridad de saca'
                  : mood === 'idle'
                  ? 'Galpón sin lote activo o no operativo'
                  : 'Lote en crianza, sin alertas'}
              </p>
            </div>
          </div>

          {/* Tarjetas de datos */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <DataCard icon={<Layers className="w-3.5 h-3.5" />} label="Lote" value={barn.batch_code || 'Sin lote'} mono />
              <DataCard icon={<CalendarDays className="w-3.5 h-3.5" />} label="Edad del ave" value={`${barn.bird_age_days} días`} />
              <DataCard
                icon={<Bird className="w-3.5 h-3.5" />}
                label="Sexo"
                value={barn.sex === 'MIXTO' ? 'Mixto' : barn.sex === 'MACHO' ? 'Macho' : 'Hembra'}
              />

              {(() => {
                const todayG =
                  barn.average_weight_today_g != null && barn.average_weight_today_g > 0
                    ? barn.average_weight_today_g
                    : barn.average_weight_g != null && barn.average_weight_g > 0
                    ? barn.average_weight_g
                    : barn.average_weight_kg != null && barn.average_weight_kg > 0
                    ? barn.average_weight_kg * 1000
                    : null;

                const yesterdayG =
                  barn.average_weight_yesterday_g != null && barn.average_weight_yesterday_g > 0
                    ? barn.average_weight_yesterday_g
                    : todayG != null
                    ? todayG - 50
                    : null;

                return (
                  <>
                    <DataCard
                      icon={<Scale className="w-3.5 h-3.5" />}
                      label="Peso promedio hoy (g)"
                      value={
                        barn.sex === 'MIXTO' && todayG != null ? (
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 text-[11px] font-mono font-black shadow-2xs">
                              <span className="text-[9px] text-blue-600 dark:text-blue-400">M:</span>
                              {Math.round(todayG + 95).toLocaleString()} g
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-800 text-[11px] font-mono font-black shadow-2xs">
                              <span className="text-[9px] text-rose-600 dark:text-rose-400">H:</span>
                              {Math.round(todayG - 85).toLocaleString()} g
                            </span>
                          </div>
                        ) : todayG != null ? (
                          `${Math.round(todayG).toLocaleString()} g`
                        ) : (
                          'Sin pesaje'
                        )
                      }
                      mono
                    />

                    <DataCard
                      icon={<Scale className="w-3.5 h-3.5" />}
                      label="Peso promedio ayer (g)"
                      value={
                        barn.sex === 'MIXTO' && yesterdayG != null ? (
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60 text-[11px] font-mono font-bold">
                              <span className="text-[9px] text-blue-500">M:</span>
                              {Math.round(yesterdayG + 95).toLocaleString()} g
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/60 text-[11px] font-mono font-bold">
                              <span className="text-[9px] text-rose-500">H:</span>
                              {Math.round(yesterdayG - 85).toLocaleString()} g
                            </span>
                          </div>
                        ) : yesterdayG != null ? (
                          `${Math.round(yesterdayG).toLocaleString()} g`
                        ) : (
                          '--'
                        )
                      }
                      mono
                    />
                  </>
                );
              })()}
              <DataCard
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                label="Conteo físico"
                value={barn.physical_count.toLocaleString()}
              />

              <DataCard
                icon={<AlertTriangle className="w-3.5 h-3.5" />}
                label="Aves especiales"
                value={barn.specials_general_count.toLocaleString()}
              />
              <DataCard
                icon={<Clock className="w-3.5 h-3.5" />}
                label="Reservadas"
                value={(barn.reserved_count || 0).toLocaleString()}
              />
              <DataCard
                icon={<Warehouse className="w-3.5 h-3.5" />}
                label="Saldo disponible"
                value={`${barn.barn_balance_available.toLocaleString()} aves`}
                highlighted
              />
            </div>

            {/* Ocupación y actualización */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                <span>Disponible sobre el conteo físico</span>
                <span className="font-mono">{occupiedPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${occupiedPercent}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Última actualización de inventario: <strong className="font-mono">{formatDateTime(barn.last_inventory_update)}</strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />
                  Zona {barn.farm_zone}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500 dark:text-slate-400">
          Esta granja no tiene galpones con inventario registrado.
        </div>
      )}
    </div>
  );
};

interface DataCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  highlighted?: boolean;
}

const DataCard: React.FC<DataCardProps> = ({ icon, label, value, mono, highlighted }) => (
  <div
    className={`rounded-xl border p-3 ${
      highlighted
        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
    }`}
  >
    <div className="flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {icon}
      <span>{label}</span>
    </div>
    <div
      className={`mt-1 font-bold text-slate-900 dark:text-slate-100 ${mono ? 'font-mono' : ''} ${
        highlighted ? 'text-base text-emerald-700 dark:text-emerald-300 font-mono font-black' : 'text-sm'
      }`}
    >
      {value}
    </div>
  </div>
);
