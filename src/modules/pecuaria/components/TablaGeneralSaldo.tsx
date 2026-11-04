import React, { useState, useEffect } from 'react';
import { TablaGeneralSaldoItem } from '@/types/pecuaria';
import {
  XCircle,
  HelpCircle,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface TablaGeneralSaldoProps {
  data: TablaGeneralSaldoItem[];
  isLoading: boolean;
  onCerrarGalpon: (item: TablaGeneralSaldoItem) => void;
}

export const TablaGeneralSaldo: React.FC<TablaGeneralSaldoProps> = ({
  data,
  isLoading,
  onCerrarGalpon,
}) => {
  const [confirmClosingItem, setConfirmClosingItem] = useState<TablaGeneralSaldoItem | null>(null);

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
      {/* Diálogo de Confirmación para Cerrar Galpón */}
      {confirmClosingItem && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/60 flex flex-wrap items-center justify-between gap-3 animate-fade-in transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-950 dark:text-red-200">
                ¿Cerrar Galpón [{confirmClosingItem.barn_code}] de Granja [{confirmClosingItem.farm_code}]?
              </h4>
              <p className="text-xs text-red-700 dark:text-red-400">
                Al cerrar el galpón, ya no aparecerá en la tabla general porque se considera finalizada su venta.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmClosingItem(null)}
              className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                onCerrarGalpon(confirmClosingItem);
                setConfirmClosingItem(null);
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              <Check className="w-4 h-4 mr-1" />
              Confirmar Cierre
            </Button>
          </div>
        </div>
      )}

      {/* TABLA GENERAL CON SCROLL INTERNO Y ENCABEZADOS FIJOS (STICKY) */}
      <div className="md:hidden px-3 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
        <ChevronRight className="w-3 h-3 shrink-0" />
        <span>Desliza horizontalmente para ver todas las columnas</span>
      </div>
      <div className="block overflow-x-auto overflow-y-auto max-h-[580px] relative scrollbar-thin">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-20 shadow-2xs">
            <tr className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <th className="py-3.5 px-2 sm:px-4 bg-slate-100 dark:bg-slate-900">Granja</th>
              <th className="py-3.5 px-2 sm:px-4 bg-slate-100 dark:bg-slate-900">Galpón</th>
              <th className="py-3.5 px-2 sm:px-4 text-center bg-slate-100 dark:bg-slate-900">Edad</th>
              <th className="hidden sm:table-cell py-3.5 px-4 text-center bg-slate-100 dark:bg-slate-900">Especiales</th>
              <th className="py-3.5 px-2 sm:px-4 text-right bg-slate-100 dark:bg-slate-900">Saldo x Galpón</th>
              <th className="hidden md:table-cell py-3.5 px-4 text-center bg-slate-100 dark:bg-slate-900">Peso Promedio &amp; Rango</th>
              <th className="hidden lg:table-cell py-3.5 px-4 text-center bg-slate-100 dark:bg-slate-900">Sexo</th>
              <th className="py-3.5 px-2 sm:px-4 text-center bg-slate-100 dark:bg-slate-900">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-xs font-medium">
            {currentItems.map((item) => {
              const isMacho = item.sex === 'MACHO';
              const hasWeight = item.average_weight_kg !== null && item.average_weight_kg > 0;
              const isReadyForHarvest = item.bird_age_days >= 38 && item.bird_age_days <= 45;

              // Colorimetría pastel fija sin animaciones
              const rowColorClass = isMacho
                ? 'bg-blue-50/70 hover:bg-blue-100/80 text-blue-950 border-b border-blue-200/60 dark:bg-[#0c1f38]/60 dark:hover:bg-[#102a4c]/75 dark:text-blue-100 dark:border-blue-900/40'
                : 'bg-red-50/70 hover:bg-red-100/80 text-red-950 border-b border-red-200/60 dark:bg-[#2e1219]/60 dark:hover:bg-[#3d1822]/75 dark:text-rose-100 dark:border-rose-900/40';

              return (
                <tr key={`${item.farm_code}-${item.barn_id}`} className={`${rowColorClass} transition-colors`}>
                  {/* 1. GRANJA: SOLO EL CÓDIGO */}
                  <td className="py-2.5 px-2 sm:py-3 sm:px-4 font-mono font-black text-xs sm:text-sm tracking-wide">
                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-white/90 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-2xs inline-block text-slate-900 dark:text-slate-100">
                      {item.farm_code}
                    </span>
                  </td>

                  {/* 2. GALPÓN (CÓDIGO Y LOTE) */}
                  <td className="py-2.5 px-2 sm:py-3 sm:px-4">
                    <div className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                      {item.barn_code || `G-${String(item.barn_number).padStart(2, '0')}`}
                    </div>
                    {item.batch_code && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {item.batch_code}
                      </div>
                    )}
                  </td>

                  {/* 3. EDAD DEL AVE */}
                  <td className="py-2.5 px-2 sm:py-3 sm:px-4 text-center font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                    {item.bird_age_days} días
                  </td>

                  {/* 4. ESPECIALES (CANT GENERAL) */}
                  <td className="hidden sm:table-cell py-3 px-4 text-center font-bold text-sm text-slate-900 dark:text-slate-100 font-mono">
                    {item.specials_general_count.toLocaleString()}
                  </td>

                  {/* 5. SALDO POR GALPÓN (DISPONIBLE PARA VENTA) */}
                  <td className="py-2.5 px-2 sm:py-3 sm:px-4 text-right">
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

                  {/* 6. PESO PROMEDIO & RANGO */}
                  <td className="hidden md:table-cell py-3 px-4 text-center">
                    {hasWeight ? (
                      <div className="inline-flex flex-col items-center">
                        <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-slate-100">
                          {item.average_weight_kg?.toFixed(2)} kg
                        </span>
                        <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                          {item.weight_range_label ||
                            (item.min_weight_kg && item.max_weight_kg
                              ? `${item.min_weight_kg.toFixed(2)} - ${item.max_weight_kg.toFixed(2)} kg`
                              : `[${(item.average_weight_kg! - 0.16).toFixed(2)} - ${(item.average_weight_kg! + 0.18).toFixed(2)}]`)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">Sin Pesaje</span>
                    )}
                  </td>

                  {/* 7. SEXO: TEXTO LIMPIO SIN RECUADRO NI SÍMBOLOS */}
                  <td className="hidden lg:table-cell py-3 px-4 text-center font-bold text-xs uppercase tracking-wide text-slate-800 dark:text-slate-200">
                    {isMacho ? 'Macho' : 'Hembra'}
                  </td>

                  {/* 8. ACCIÓN ÚNICA: CERRAR GALPÓN */}
                  <td className="py-2.5 px-2 sm:py-3 sm:px-4 text-center">
                    <button
                      type="button"
                      onClick={() => setConfirmClosingItem(item)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all ${
                        item.bird_age_days > 45
                          ? 'bg-red-600 hover:bg-red-700 text-white border border-red-700 shadow-sm'
                          : 'bg-white dark:bg-slate-800 hover:bg-red-600 dark:hover:bg-red-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white border border-slate-300 dark:border-slate-700 hover:border-red-600'
                      }`}
                      title="Cerrar galpón (ya no tiene venta)"
                    >
                      <XCircle className={`w-3.5 h-3.5 ${item.bird_age_days > 45 ? 'text-white' : 'text-red-600 group-hover:text-white'}`} />
                      <span className="hidden sm:inline">{item.bird_age_days > 45 ? 'Cierre Prioritario' : 'Cerrar Galpón'}</span>
                    </button>
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