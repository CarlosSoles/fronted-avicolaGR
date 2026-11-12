import React, { useState, useEffect } from 'react';
import { TablaGeneralSaldoItem } from '@/types/pecuaria';
import {
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface TablaGeneralSaldoProps {
  data: TablaGeneralSaldoItem[];
  isLoading: boolean;
}

const formatShortDate = (value?: string | null): string => {
  const parsed = value ? new Date(value) : new Date();
  const d = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

const formatGramsDecimal = (grams: number): string =>
  grams.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const formatStandardGrams = (grams: number): string =>
  Math.round(grams).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  });

export const TablaGeneralSaldo: React.FC<TablaGeneralSaldoProps> = ({
  data,
  isLoading,
}) => {
  // Paginación de 15 registros
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  // Reset a página 1 si cambian los filtros o se reduce la cantidad de registros
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [data.length, totalPages, currentPage]);

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-600 border-r-transparent mb-4" />
        <p className="text-sm text-slate-600 font-medium">Cargando Tabla General de Saldo...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-xs transition-colors">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">No se encontraron galpones activos</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          No hay galpones que coincidan con los filtros aplicados o todos los galpones consultados han sido cerrados por fin de venta.
        </p>
      </div>
    );
  }

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, data.length);
  const currentItems = data.slice(startIndex, endIndex);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-colors flex flex-col">
      {/* TABLA GENERAL CON SCROLL INTERNO Y ENCABEZADOS FIJOS (STICKY) */}
      <div className="md:hidden px-3 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
        <ChevronRight className="w-3 h-3 shrink-0" />
        <span>Desliza horizontalmente para ver todas las columnas</span>
      </div>
      <div className="block overflow-x-auto overflow-y-auto max-h-[580px] relative scrollbar-thin">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-20 shadow-2xs">
            <tr className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
              <th className="py-3.5 px-3 bg-slate-100 dark:bg-slate-900 text-center">Fecha</th>
              <th className="py-3.5 px-3 bg-slate-100 dark:bg-slate-900">Granja</th>
              <th className="py-3.5 px-3 bg-slate-100 dark:bg-slate-900">Galpón</th>
              <th className="py-3.5 px-3 bg-slate-100 dark:bg-slate-900 text-center">Campaña</th>
              <th className="py-3.5 px-3 bg-slate-100 dark:bg-slate-900 text-center">Edad</th>
              <th className="py-3.5 px-3 bg-slate-100 dark:bg-slate-900 text-center">Sexo</th>
              <th className="py-3.5 px-3 bg-slate-100 dark:bg-slate-900 text-center">Aves Especiales</th>
              <th className="py-3.5 px-3 bg-slate-100 dark:bg-slate-900 text-right">Saldos</th>
              <th className="py-3.5 px-3 bg-slate-100 dark:bg-slate-900 text-right">Promedio pesos (g)</th>
              <th className="py-3.5 px-3 bg-slate-100 dark:bg-slate-900 text-right">Peso estándar (g)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-xs font-medium">
            {currentItems.map((item) => {
              const isMacho = item.sex === 'MACHO';
              const avgWeightGrams =
                item.average_weight_g !== undefined && item.average_weight_g !== null && item.average_weight_g > 0
                  ? item.average_weight_g
                  : item.average_weight_kg !== null && item.average_weight_kg > 0
                  ? item.average_weight_kg * 1000
                  : null;
              const standardWeightGrams =
                item.standard_weight_g !== undefined && item.standard_weight_g !== null && item.standard_weight_g > 0
                  ? item.standard_weight_g
                  : null;

              // Colorimetría pastel fija sin animaciones
              const rowColorClass = isMacho
                ? 'bg-blue-50/70 hover:bg-blue-100/80 text-blue-950 border-b border-blue-200/60 dark:bg-[#0c1f38]/60 dark:hover:bg-[#102a4c]/75 dark:text-blue-100 dark:border-blue-900/40'
                : 'bg-red-50/70 hover:bg-red-100/80 text-red-950 border-b border-red-200/60 dark:bg-[#2e1219]/60 dark:hover:bg-[#3d1822]/75 dark:text-rose-100 dark:border-rose-900/40';

              return (
                <tr key={`${item.farm_code}-${item.barn_id}`} className={`${rowColorClass} transition-colors`}>
                  {/* 1. FECHA (dd/mm/aa) */}
                  <td className="py-2.5 px-3 text-center font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {formatShortDate(item.last_inventory_update)}
                  </td>

                  {/* 2. GRANJA: SOLO EL CÓDIGO SIN RECUADRO */}
                  <td className="py-2.5 px-3 font-mono font-black text-xs sm:text-sm tracking-wide text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {item.farm_code}
                  </td>

                  {/* 3. GALPÓN (CÓDIGO Y LOTE) */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                      {item.barn_code || `G-${String(item.barn_number).padStart(2, '0')}`}
                    </div>
                    {item.batch_code && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {item.batch_code}
                      </div>
                    )}
                  </td>

                  {/* 4. CAMPAÑA */}
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {item.campaign || '208'}
                  </td>

                  {/* 5. EDAD DEL AVE */}
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {item.bird_age_days} días
                  </td>

                  {/* 6. SEXO */}
                  <td className="py-2.5 px-3 text-center font-bold text-xs uppercase tracking-wide text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {isMacho ? 'Macho' : 'Hembra'}
                  </td>

                  {/* 7. AVES ESPECIALES */}
                  <td className="py-2.5 px-3 text-center font-bold text-sm text-slate-900 dark:text-slate-100 font-mono whitespace-nowrap">
                    {item.specials_general_count.toLocaleString()}
                  </td>

                  {/* 8. SALDOS (DISPONIBLE PARA VENTA) */}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        {item.barn_balance_available.toLocaleString()} aves
                      </span>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <span>Físico: {item.physical_count.toLocaleString()}</span>
                        {item.reserved_count > 0 && <span>| Res: {item.reserved_count}</span>}
                      </div>
                    </div>
                  </td>

                  {/* 9. PROMEDIO PESOS (g) */}
                  <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                    {avgWeightGrams !== null ? (
                      <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        {formatGramsDecimal(avgWeightGrams)}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">Sin Pesaje</span>
                    )}
                  </td>

                  {/* 10. PESO ESTÁNDAR (g) */}
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {standardWeightGrams !== null ? (
                      <span>{formatStandardGrams(standardWeightGrams)}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">--</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* PIE DE TABLA: LEYENDA Y PAGINACIÓN DE 15 REGISTROS */}
      <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs transition-colors shrink-0">
        {/* Leyenda de sexos */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-300 dark:bg-blue-500 border border-blue-400 inline-block" />
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Azul: Machos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-300 dark:bg-rose-500 border border-rose-400 inline-block" />
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Rojo: Hembras</span>
          </div>
        </div>

        {/* Resumen de registros visibles */}
        <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          Mostrando <span className="text-slate-900 dark:text-slate-100 font-bold">{startIndex + 1} - {endIndex}</span> de{' '}
          <span className="text-slate-900 dark:text-slate-100 font-bold">{data.length}</span> galpones
        </div>

        {/* Controles de Paginación */}
        <div className="flex items-center gap-1 flex-wrap justify-center">
          {/* Ir al inicio */}
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            title="Primera página"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Anterior */}
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Anterior</span>
          </button>

          {/* Indicador de página actual */}
          <span className="px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            {currentPage} / {totalPages}
          </span>

          {/* Siguiente */}
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span>Siguiente</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Ir al final */}
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            title="Última página"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};