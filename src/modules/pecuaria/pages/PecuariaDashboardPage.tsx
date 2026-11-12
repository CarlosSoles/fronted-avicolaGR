import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TablaGeneralSaldo } from '../components/TablaGeneralSaldo';
import { GalponesView } from '../components/GalponesView';
import { TablaGeneralSaldoItem, TablaGeneralSaldoResponse, OFFICIAL_FARMS } from '@/types/pecuaria';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import {
  Bird,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  CheckCircle,
  X,
  Warehouse,
  Table2,
} from 'lucide-react';

export const PecuariaDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'saldo' | 'galpones'>('saldo');
  const [data, setData] = useState<TablaGeneralSaldoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filtros (Sin operativo ni bloqueado, sin mixto)
  const [selectedFarmCode, setSelectedFarmCode] = useState<string>('ALL');
  const [selectedSex, setSelectedSex] = useState<string>('ALL');
  const [selectedThreshold, setSelectedThreshold] = useState<'ALL' | 'PLUS_1000' | 'MINUS_1000'>('ALL');
  const [selectedAgeFilter, setSelectedAgeFilter] = useState<'ALL' | 'OVER_45' | 'RANGE_38_45' | 'UNDER_38'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedSex !== 'ALL') queryParams.append('sex', selectedSex);

      const res = await apiClient<TablaGeneralSaldoResponse>(
        `/pecuaria/tabla-general-saldo?${queryParams.toString()}`
      );
      // Filtrar solo sexo MACHO o HEMBRA (sin mixto) y que no estén cerrados
      const sanitized = (res?.data || [])
        .filter((d) => (d.sex === 'MACHO' || d.sex === 'HEMBRA') && !d.is_closed)
        .map((d) => ({
          ...d,
          farm_code: d.farm_code || d.farm_name.substring(0, 5).toUpperCase(),
          barn_code: d.barn_code || `G-${String(d.barn_number).padStart(2, '0')}`,
          campaign: d.campaign || '208',
          last_inventory_update: d.last_inventory_update || new Date().toISOString(),
        }));
      setData(sanitized);
      setLoadError(null);
    } catch (err: any) {
      console.warn('Error cargando la Tabla General de Saldo:', err);
      setLoadError(err?.message || 'No se pudo conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSex]);

  useEffect(() => {
    fetchData();

    // Suscripción Realtime para cambios de inventario
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'barn_inventories' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Sincronización inmediata con reservas hechas en Comercial
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'avicola_pecuaria_table_items' && e.newValue) {
        try {
          setData(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchData]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filtrado y Colocación en Prioridad (Edad > 45 días al tope)
  const filteredData = useMemo(() => {
    const list = data.filter((item) => {
      if (item.is_closed) return false;

      // Filtro Granja
      if (selectedFarmCode !== 'ALL' && item.farm_code !== selectedFarmCode) {
        return false;
      }

      // Filtro Sexo
      if (selectedSex !== 'ALL' && item.sex !== selectedSex) {
        return false;
      }

      // Filtro + de 1000 / - de 1000 galpones (saldo disponible)
      if (selectedThreshold === 'PLUS_1000' && item.barn_balance_available < 1000) {
        return false;
      }
      if (selectedThreshold === 'MINUS_1000' && item.barn_balance_available >= 1000) {
        return false;
      }

      // Filtro por Edad
      if (selectedAgeFilter === 'OVER_45' && item.bird_age_days <= 45) {
        return false;
      }
      if (selectedAgeFilter === 'RANGE_38_45' && (item.bird_age_days < 38 || item.bird_age_days > 45)) {
        return false;
      }
      if (selectedAgeFilter === 'UNDER_38' && item.bird_age_days >= 38) {
        return false;
      }

      // Búsqueda textual
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchFarm = item.farm_code.toLowerCase().includes(q) || item.farm_name.toLowerCase().includes(q);
        const matchBarn = item.barn_code.toLowerCase().includes(q) || `galpon ${item.barn_number}`.includes(q);
        const matchBatch = item.batch_code?.toLowerCase().includes(q) || false;
        if (!matchFarm && !matchBarn && !matchBatch) return false;
      }
      return true;
    });

    // REGLA: COLOCAR EN PRIORIDAD LA EDAD DE AVE MAYOR A 45 DÍAS PARA EL CIERRE DE GALPÓN
    return list.sort((a, b) => {
      const aOver45 = a.bird_age_days > 45 ? 1 : 0;
      const bOver45 = b.bird_age_days > 45 ? 1 : 0;
      if (aOver45 !== bOver45) return bOver45 - aOver45; // Los mayores a 45 días van al inicio
      return b.bird_age_days - a.bird_age_days; // Orden descendente por edad
    });
  }, [data, selectedFarmCode, selectedSex, selectedThreshold, selectedAgeFilter, searchQuery]);

  // KPIs Calculados (Total Físico, Especiales, Saldo Neto Disponible y Saldos por Sexo)
  const totalPhysicalCount = filteredData.reduce((acc, curr) => acc + curr.physical_count, 0);
  const totalSpecials = filteredData.reduce((acc, curr) => acc + curr.specials_general_count, 0);
  const totalNetSaca = Math.max(0, totalPhysicalCount - totalSpecials);
  const totalSaldoMachos = filteredData
    .filter((i) => i.sex === 'MACHO')
    .reduce((acc, curr) => acc + curr.barn_balance_available, 0);
  const totalSaldoHembras = filteredData
    .filter((i) => i.sex === 'HEMBRA')
    .reduce((acc, curr) => acc + curr.barn_balance_available, 0);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 p-4 bg-slate-900 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in border border-slate-700">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Titulo Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-start sm:items-center gap-2">
            <Bird className="w-5 h-5 sm:w-7 sm:h-7 text-red-600 shrink-0 mt-0.5 sm:mt-0" />
            <span>Módulo Pecuaria — Tabla General de Saldo</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Consolidado de galpones activos por granja. Los lotes con más de 45 días se ordenan con <strong>máxima prioridad de cierre</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            isLoading={isLoading}
            className="w-full sm:w-auto justify-center border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Pestañas del módulo */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('saldo')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'saldo'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Table2 className="w-4 h-4" />
          <span>Tabla General de Saldo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('galpones')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'galpones'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Warehouse className="w-4 h-4" />
          <span>Ver Galpones</span>
        </button>
      </div>

      {loadError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-800 dark:text-rose-300">
          <span className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>
              <strong className="block">No se pudo cargar la información de Pecuaria</strong>
              {loadError}
            </span>
          </span>
          <Button size="sm" variant="secondary" onClick={fetchData} className="self-end sm:self-auto font-bold">
            Reintentar
          </Button>
        </div>
      )}

      {activeTab === 'galpones' ? (
        <GalponesView data={data} isLoading={isLoading} />
      ) : (
        <>

      {/* 1. TARJETAS DE KPIS: 5 TARJETAS BALANCEADAS (TOTAL, ESPECIALES, DISPONIBLE SACA, MACHOS, HEMBRAS) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        {/* KPI 1: Saldo de Aves (Físico Total) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-xs transition-colors">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Saldo de Aves</span>
            <Bird className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
            {totalPhysicalCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Población total en granjas</div>
        </div>

        {/* KPI 2: Saldo Especiales */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-xs transition-colors">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Saldo Especiales</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-800 dark:text-amber-300 font-mono">
            {totalSpecials.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Aves con defectos descontadas</div>
        </div>

        {/* KPI 3: Saldo Disponible para Saca (Total Aves - Especiales) */}
        <div className="bg-emerald-50/70 dark:bg-emerald-950/25 border-2 border-emerald-400 dark:border-emerald-600/60 p-3 sm:p-4 rounded-2xl shadow-xs transition-colors">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
              Disponible Saca
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-200 font-mono">
            {totalNetSaca.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-bold">
            Total aves - especiales
          </div>
        </div>

        {/* KPI 4: Saldo Machos */}
        <div className="bg-blue-50/80 dark:bg-[#0c1f38]/60 border-2 border-blue-400 dark:border-blue-500/50 p-3 sm:p-4 rounded-2xl shadow-xs transition-colors">
          <div className="flex items-center justify-between text-blue-900 dark:text-blue-200 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-950 dark:text-blue-200">
              Saldo Machos
            </span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-200 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200">M</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-950 dark:text-blue-100 font-mono">
            {totalSaldoMachos.toLocaleString()}
          </div>
          <div className="text-[10px] text-blue-800 dark:text-blue-300 mt-0.5 font-semibold">Aves disponibles libres</div>
        </div>

        {/* KPI 5: Saldo Hembras */}
        <div className="bg-rose-50/80 dark:bg-[#2e1219]/60 border-2 border-red-400 dark:border-rose-500/50 p-3 sm:p-4 rounded-2xl shadow-xs transition-colors">
          <div className="flex items-center justify-between text-red-900 dark:text-rose-200 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-red-950 dark:text-rose-200">
              Saldo Hembras
            </span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-rose-200 dark:bg-rose-900/60 text-red-900 dark:text-rose-200">H</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-red-950 dark:text-rose-100 font-mono">
            {totalSaldoHembras.toLocaleString()}
          </div>
          <div className="text-[10px] text-red-800 dark:text-rose-300 mt-0.5 font-semibold">Aves disponibles libres</div>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS OPTIMIZADA, ALINEADA Y ESTRUCTURADA */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 transition-colors space-y-4">
        {/* Cabecera del panel de filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
              <Filter className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Filtros de Búsqueda &amp; Control
              </span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                Filtrar galpones activos por granja, parvada, saldo o edad
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap justify-end">
            {(searchQuery.trim() !== '' ||
              selectedFarmCode !== 'ALL' ||
              selectedSex !== 'ALL' ||
              selectedThreshold !== 'ALL' ||
              selectedAgeFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedFarmCode('ALL');
                  setSelectedSex('ALL');
                  setSelectedThreshold('ALL');
                  setSelectedAgeFilter('ALL');
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Restablecer todos los filtros"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar Filtros</span>
              </button>
            )}
          </div>
        </div>

        {/* Fila Principal de Filtros: Grid perfectamente alineado en 1 sola fila */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Búsqueda rápida: 4 cols */}
          <div className="lg:col-span-4 space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Búsqueda por Código
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar granja (TRAD1), galpón (G-01)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-600 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filtro Granja: 2 cols */}
          <div className="lg:col-span-2 space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Granja
            </label>
            <select
              value={selectedFarmCode}
              onChange={(e) => setSelectedFarmCode(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="ALL">Todas ({OFFICIAL_FARMS.length})</option>
              {OFFICIAL_FARMS.map((farm) => (
                <option key={farm.code} value={farm.code}>
                  {farm.code} - {farm.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Sexo: 2 cols */}
          <div className="lg:col-span-2 space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Sexo Parvada
            </label>
            <select
              value={selectedSex}
              onChange={(e) => setSelectedSex(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="ALL">Todos los Sexos</option>
              <option value="MACHO">Solo Machos</option>
              <option value="HEMBRA">Solo Hembras</option>
            </select>
          </div>

          {/* Filtro Saldo: 2 cols */}
          <div className="lg:col-span-2 space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Saldo de Aves
            </label>
            <select
              value={selectedThreshold}
              onChange={(e) => setSelectedThreshold(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="ALL">Todos los Saldos</option>
              <option value="PLUS_1000">&gt; 1,000 aves</option>
              <option value="MINUS_1000">&le; 1,000 aves</option>
            </select>
          </div>

          {/* Filtro Edad / Prioridad: 2 cols */}
          <div className="lg:col-span-2 space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Edad / Prioridad
            </label>
            <select
              value={selectedAgeFilter}
              onChange={(e) => setSelectedAgeFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="ALL">Todas las Edades</option>
              <option value="OVER_45">🚨 &gt; 45 días (Prioridad)</option>
              <option value="RANGE_38_45">38 a 45 días (Saca)</option>
              <option value="UNDER_38">&lt; 38 días (Crecimiento)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. TABLA GENERAL ÚNICA (ORDENADA CON PRIORIDAD > 45 DÍAS AL TOPE) */}
      <TablaGeneralSaldo
        data={filteredData}
        isLoading={isLoading}
      />

        </>
      )}
    </div>
  );
};
