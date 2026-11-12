import React, { lazy, Suspense } from 'react';
import type { FlotaGpsMapProps } from './FlotaGpsMap';

const FlotaGpsMapInner = lazy(() =>
  import('./FlotaGpsMap').then((m) => ({ default: m.FlotaGpsMap }))
);

/** Carga diferida del mapa Leaflet para no penalizar la apertura inicial de los módulos. */
export const LazyFlotaGpsMap: React.FC<FlotaGpsMapProps> = (props) => (
  <Suspense
    fallback={
      <div className="h-[460px] flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
        <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        <span>Cargando mapa GPS en vivo...</span>
      </div>
    }
  >
    <FlotaGpsMapInner {...props} />
  </Suspense>
);

