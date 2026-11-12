import React, { useMemo, useState } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  ArrowUpDown,
  Lock,
  X,
  AlertTriangle,
  CheckCircle2,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/api';
import { TablaGeneralSaldoItem } from '@/types/pecuaria';

type SortKey =
  | 'farm_code'
  | 'barn_code'
  | 'bird_age_days'
  | 'sex'
  | 'barn_balance_available'
  | 'reserved_saca'
  | 'barn_status'
  | 'average_weight_kg'
  | 'campaign';

interface SaldosGalponPanelProps {
  items: TablaGeneralSaldoItem[];
  lastUpdated: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
  onBarnClosed: (barnId: string) => void;
  onToast: (msg: string) => void;
}

const formatInt = (val: number): string => Math.round(val).toLocaleString('en-US');

const formatDec = (val: number, decimals = 2): string =>
  val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const getAvgWeightKg = (item: TablaGeneralSaldoItem): number | null => {
  if (typeof item.average_weight_kg === 'number' && Number.isFinite(item.average_weight_kg)) {
    return item.average_weight_kg;
  }
  if (typeof item.average_weight_g === 'number' && Number.isFinite(item.average_weight_g)) {
    return item.average_weight_g / 1000;
  }
  return null;
};

const getAvgWeightG = (item: TablaGeneralSaldoItem): number | null => {
  if (typeof item.average_weight_g === 'number' && Number.isFinite(item.average_weight_g)) {
    return item.average_weight_g;
  }
  if (typeof item.average_weight_kg === 'number' && Number.isFinite(item.average_weight_kg)) {
    return item.average_weight_kg * 1000;
  }
  return null;
};

const formatBarnStatusBadge = (status: TablaGeneralSaldoItem['barn_status']) => {
  if (status === 'OPERATIVO') {
    return {
      label: 'Galpón abierto',
      classes:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      dotClass: 'bg-emerald-500',
    };
  }
  if (status === 'BLOQUEADO_SANITARIO') {
    return {
      label: 'Bloqueado',
      classes:
        'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
      dotClass: 'bg-rose-500',
    };
  }
  if (status === 'PENDIENTE_REVISION') {
    return {
      label: 'En revisión',
      classes:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      dotClass: 'bg-amber-500',
    };
  }
  return {
    label: status,
    classes:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  };
};

export const SaldosGalponPanel: React.FC<SaldosGalponPanelProps> = ({
  items,
  lastUpdated,
  refreshing,
  onRefresh,
  onBarnClosed,
  onToast,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedFarm, setSelectedFarm] = useState<string>('ALL');
  const [selectedSex, setSelectedSex] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedAge, setSelectedAge] = useState<string>('ALL');
  const [maxBalanceInput, setMaxBalanceInput] = useState<string>('');

  const [sortKey, setSortKey] = useState<SortKey>('farm_code');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const [barnToClose, setBarnToClose] = useState<TablaGeneralSaldoItem | null>(null);
  const [isClosingBarn, setIsClosingBarn] = useState<boolean>(false);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    selectedFarm !== 'ALL' ||
    selectedSex !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedAge !== 'ALL' ||
    maxBalanceInput.trim() !== '';

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedFarm('ALL');
    setSelectedSex('ALL');
    setSelectedStatus('ALL');
    setSelectedAge('ALL');
    setMaxBalanceInput('');
  };

  // Opciones dinámicas de filtro desde BD
  const farmOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((it) => {
      if (!map.has(it.farm_code)) {
        map.set(it.farm_code, it.farm_name);
      }
    });
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [items]);

  const ageOptions = useMemo(() => {
    return Array.from(new Set(items.map((it) => it.bird_age_days))).sort((a, b) => a - b);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const maxBal = maxBalanceInput.trim() !== '' ? Number(maxBalanceInput) : null;

    const list = items.filter((it) => {
      if (selectedFarm !== 'ALL' && it.farm_code !== selectedFarm) return false;
      if (selectedSex !== 'ALL' && it.sex !== selectedSex) return false;
      if (selectedStatus !== 'ALL' && it.barn_status !== selectedStatus) return false;
      if (selectedAge !== 'ALL' && String(it.bird_age_days) !== selectedAge) return false;
      if (maxBal !== null && Number.isFinite(maxBal) && it.barn_balance_available >= maxBal) {
        return false;
      }
      if (q) {
        const campaignStr = (it.campaign || '208').toLowerCase();
        const match =
          it.farm_code.toLowerCase().includes(q) ||
          it.farm_name.toLowerCase().includes(q) ||
          it.barn_code.toLowerCase().includes(q) ||
          campaignStr.includes(q);
        if (!match) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'farm_code':
          cmp = a.farm_code.localeCompare(b.farm_code) || a.barn_number - b.barn_number;
          break;
        case 'barn_code':
          cmp = a.barn_number - b.barn_number;
          break;
        case 'bird_age_days':
          cmp = a.bird_age_days - b.bird_age_days;
          break;
        case 'sex':
          cmp = a.sex.localeCompare(b.sex);
          break;
        case 'barn_balance_available':
          cmp = a.barn_balance_available - b.barn_balance_available;
          break;
        case 'reserved_saca':
          cmp =
            (a.reserved_count || 0) +
            (a.sold_pending_count || 0) -
            ((b.reserved_count || 0) + (b.sold_pending_count || 0));
          break;
        case 'barn_status':
          cmp = a.barn_status.localeCompare(b.barn_status);
          break;
        case 'average_weight_kg':
          cmp = (getAvgWeightKg(a) || 0) - (getAvgWeightKg(b) || 0);
          break;
        case 'campaign':
          cmp = (a.campaign || '208').localeCompare(b.campaign || '208');
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [
    items,
    searchTerm,
    selectedFarm,
    selectedSex,
    selectedStatus,
    selectedAge,
    maxBalanceInput,
    sortKey,
    sortAsc,
  ]);

  const kpis = useMemo(() => {
    let totalBirds = 0;
    let openBarns = 0;
    let maleBirds = 0;
    let femaleBirds = 0;
    let reservedBirds = 0;
    let lowStockBarns = 0;

    filteredItems.forEach((it) => {
      totalBirds += it.barn_balance_available;
      if (it.barn_status === 'OPERATIVO') openBarns += 1;
      if (it.sex === 'MACHO') maleBirds += it.barn_balance_available;
      if (it.sex === 'HEMBRA') femaleBirds += it.barn_balance_available;
      reservedBirds += (it.reserved_count || 0) + (it.sold_pending_count || 0);
      if (it.barn_balance_available < 2000) lowStockBarns += 1;
    });

    return {
      totalBirds,
      openBarns,
      records: filteredItems.length,
      maleBirds,
      femaleBirds,
      reservedBirds,
      lowStockBarns,
    };
  }, [filteredItems]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const handleConfirmCloseBarn = async () => {
    if (!barnToClose) return;
    setIsClosingBarn(true);
    try {
      await apiClient<boolean>(`/pecuaria/barns/${barnToClose.barn_id}/close`, {
        method: 'PATCH',
      });
      onBarnClosed(barnToClose.barn_id);
      onToast(`✅ Galpón ${barnToClose.farm_code} (${barnToClose.barn_code}) cerrado correctamente.`);
      setBarnToClose(null);
    } catch (err: any) {
      onToast(`❌ Error al cerrar galpón: ${err.message || 'No se pudo completar el cierre'}`);
    } finally {
      setIsClosingBarn(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Granja',
      'Nombre Granja',
      'Galpón',
      'Edad (días)',
      'Sexo',
      'Saldo (aves)',
      'Reservado / Saca (aves)',
      'Estado',
      'Promedio de pesos (kg)',
      'Promedio de pesos (g)',
      'Campaña',
    ];
    const rows = filteredItems.map((it) => {
      const avgKg = getAvgWeightKg(it);
      const avgG = getAvgWeightG(it);
      const statusInfo = formatBarnStatusBadge(it.barn_status);
      return [
        it.farm_code,
        it.farm_name,
        it.barn_code,
        it.bird_age_days,
        it.sex,
        it.barn_balance_available,
        (it.reserved_count || 0) + (it.sold_pending_count || 0),
        statusInfo.label,
        avgKg !== null ? avgKg.toFixed(2) : '',
        avgG !== null ? avgG.toFixed(2) : '',
        it.campaign || '208',
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `saldos_por_galpon_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onToast(`📄 Exportados ${filteredItems.length} registros a CSV.`);
  };

  const formattedLastConsult = lastUpdated
    ? lastUpdated.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'En vivo';

  const renderSortHeader = (
    label: string,
    key: SortKey,
    align: 'left' | 'center' | 'right' = 'left'
  ) => (
    <th
      onClick={() => handleSort(key)}
      className={`py-3 px-3 cursor-pointer select-none hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        <span>{label}</span>
        <ArrowUpDown
          className={`w-3 h-3 ${
            sortKey === key ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400/80'
          }`}
        />
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* 7 TARJETAS KPI SUPERIORES DE SALDO POR GALPÓN (CLICKEABLES PARA FILTRAR) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        {/* KPI 1: Saldo Total */}
        <button
          type="button"
          onClick={resetFilters}
          title="Click para ver toda la disponibilidad"
          className="text-left p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-t-2 border-t-purple-600 shadow-xs hover:shadow-sm transition-all cursor-pointer"
        >
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Saldo de aves</div>
          <div className="text-2xl font-black font-mono tabular-nums text-purple-700 dark:text-purple-400 mt-1">
            {formatInt(kpis.totalBirds)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Total de la selección</div>
        </button>

        {/* KPI 2: Galpones Abiertos */}
        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === 'OPERATIVO' ? 'ALL' : 'OPERATIVO')}
          className={`text-left p-3.5 bg-white dark:bg-slate-900 rounded-2xl border shadow-xs hover:shadow-sm transition-all cursor-pointer border-t-2 border-t-emerald-600 ${
            selectedStatus === 'OPERATIVO'
              ? 'border-emerald-400 ring-2 ring-emerald-500/20'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Galpones abiertos</div>
          <div className="text-2xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            {formatInt(kpis.openBarns)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Operativos en selección</div>
        </button>

        {/* KPI 3: Registros */}
        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-t-2 border-t-sky-600 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Registros</div>
          <div className="text-2xl font-black font-mono tabular-nums text-sky-700 dark:text-sky-400 mt-1">
            {formatInt(kpis.records)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Galpones y campañas</div>
        </div>

        {/* KPI 4: Macho */}
        <button
          type="button"
          onClick={() => setSelectedSex(selectedSex === 'MACHO' ? 'ALL' : 'MACHO')}
          title="Filtrar solo galpones Macho"
          className={`text-left p-3.5 bg-white dark:bg-slate-900 rounded-2xl border shadow-xs hover:shadow-sm transition-all cursor-pointer border-t-2 border-t-blue-600 ${
            selectedSex === 'MACHO'
              ? 'border-blue-400 ring-2 ring-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Macho</div>
          <div className="text-2xl font-black font-mono tabular-nums text-blue-700 dark:text-blue-400 mt-1">
            {formatInt(kpis.maleBirds)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Aves en la selección</div>
        </button>

        {/* KPI 5: Hembra */}
        <button
          type="button"
          onClick={() => setSelectedSex(selectedSex === 'HEMBRA' ? 'ALL' : 'HEMBRA')}
          title="Filtrar solo galpones Hembra"
          className={`text-left p-3.5 bg-white dark:bg-slate-900 rounded-2xl border shadow-xs hover:shadow-sm transition-all cursor-pointer border-t-2 border-t-rose-600 ${
            selectedSex === 'HEMBRA'
              ? 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/30 dark:bg-rose-950/20'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Hembra</div>
          <div className="text-2xl font-black font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
            {formatInt(kpis.femaleBirds)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Aves en la selección</div>
        </button>

        {/* KPI 6: Reservado / Saca */}
        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-t-2 border-t-amber-500 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Reservado / Saca</div>
          <div className="text-2xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {formatInt(kpis.reservedBirds)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Aves reservadas en BD</div>
        </div>

        {/* KPI 7: Menos de 2,000 aves */}
        <button
          type="button"
          onClick={() => setMaxBalanceInput(maxBalanceInput === '2000' ? '' : '2000')}
          title="Filtrar galpones con menos de 2,000 aves"
          className={`text-left p-3.5 bg-white dark:bg-slate-900 rounded-2xl border shadow-xs hover:shadow-sm transition-all cursor-pointer border-t-2 border-t-violet-600 col-span-2 sm:col-span-1 ${
            maxBalanceInput === '2000'
              ? 'border-violet-400 ring-2 ring-violet-500/20 bg-violet-50/30 dark:bg-violet-950/20'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Menos de 2,000 aves</div>
          <div className="text-2xl font-black font-mono tabular-nums text-violet-700 dark:text-violet-400 mt-1">
            {formatInt(kpis.lowStockBarns)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Galpones en la selección</div>
        </button>
      </div>

      {/* PANEL PRINCIPAL: DETALLE DE DISPONIBILIDAD & SALDOS POR GALPÓN */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Fila 1: Título + Acciones principales */}
        <div className="px-5 pt-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Detalle de Disponibilidad
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {filteredItems.length} de {items.length} galpones
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
                  Saldos por galpón
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  Última consulta: {formattedLastConsult}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="secondary"
                onClick={resetFilters}
                className="h-9 px-3 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              className="h-9 px-3.5 text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </Button>

            <Button
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-9 px-4 text-xs font-extrabold bg-purple-700 hover:bg-purple-800 text-white flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </Button>
          </div>
        </div>

        {/* Fila 2: Grid simétrico de 6 filtros sin saltos desordenados */}
        <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-900/40 border-y border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Buscar
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Granja, galpón o campaña..."
                className="h-9 w-full pl-8 pr-3 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Granja
            </label>
            <select
              value={selectedFarm}
              onChange={(e) => setSelectedFarm(e.target.value)}
              className="h-9 w-full px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">Todas las granjas</option>
              {farmOptions.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.code} — {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Sexo
            </label>
            <select
              value={selectedSex}
              onChange={(e) => setSelectedSex(e.target.value)}
              className="h-9 w-full px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">Todos los sexos</option>
              <option value="MACHO">MACHO</option>
              <option value="HEMBRA">HEMBRA</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Estado de galpón
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 w-full px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">Todos los estados</option>
              <option value="OPERATIVO">Galpón abierto</option>
              <option value="PENDIENTE_REVISION">En revisión</option>
              <option value="BLOQUEADO_SANITARIO">Bloqueado sanitario</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Edad (días)
            </label>
            <select
              value={selectedAge}
              onChange={(e) => setSelectedAge(e.target.value)}
              className="h-9 w-full px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">Todas las edades</option>
              {ageOptions.map((age) => (
                <option key={age} value={String(age)}>
                  {age} días
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Saldo menor a (aves)
            </label>
            <input
              type="number"
              min={0}
              value={maxBalanceInput}
              onChange={(e) => setMaxBalanceInput(e.target.value)}
              placeholder="# Sin límite"
              className="h-9 w-full px-2.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs">
              <tr className="text-[11px] font-black text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                {renderSortHeader('Granja', 'farm_code', 'left')}
                {renderSortHeader('Galpón', 'barn_code', 'left')}
                {renderSortHeader('Edad', 'bird_age_days', 'center')}
                {renderSortHeader('Sexo', 'sex', 'center')}
                {renderSortHeader('Saldo (aves)', 'barn_balance_available', 'right')}
                {renderSortHeader('Reservado / Saca (aves)', 'reserved_saca', 'right')}
                {renderSortHeader('Estado', 'barn_status', 'center')}
                {renderSortHeader('Promedio de pesos', 'average_weight_kg', 'right')}
                {renderSortHeader('Campaña', 'campaign', 'center')}
                <th className="py-3 px-3 text-right whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 italic">
                    No se encontraron galpones que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const avgKg = getAvgWeightKg(item);
                  const avgG = getAvgWeightG(item);
                  const reservedTotal = (item.reserved_count || 0) + (item.sold_pending_count || 0);
                  const statusBadge = formatBarnStatusBadge(item.barn_status);

                  return (
                    <tr
                      key={item.barn_id}
                      className="hover:bg-purple-50/30 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono font-black text-blue-700 dark:text-blue-400">
                          {item.farm_code}
                        </span>
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 ml-1.5 hidden sm:inline">
                          {item.farm_name}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                          {item.barn_code}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {item.bird_age_days} d
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-extrabold text-[10.5px] tracking-wide ${
                            item.sex === 'MACHO'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {item.sex}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-black text-slate-950 dark:text-white text-sm whitespace-nowrap">
                        {formatInt(item.barn_balance_available)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={
                            reservedTotal > 0
                              ? 'font-bold text-amber-600 dark:text-amber-400'
                              : 'text-slate-400'
                          }
                        >
                          {formatInt(reservedTotal)}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge.classes}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
                          <span>{statusBadge.label}</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {avgKg !== null ? (
                          <div>
                            <span className="font-bold text-blue-700 dark:text-blue-400 text-xs block">
                              {avgKg.toFixed(2)} kg
                            </span>
                            {avgG !== null && (
                              <span className="text-[10px] text-slate-400 block">
                                {formatDec(avgG, 2)} g
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {item.campaign || '208'}
                      </td>

                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setBarnToClose(item)}
                          className="h-8 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-rose-300 hover:bg-rose-50/50 hover:text-rose-700 dark:hover:text-rose-400"
                        >
                          <Lock className="w-3 h-3 mr-1.5" />
                          <span>Cerrar galpón</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN PARA CERRAR GALPÓN */}
      {barnToClose && (
        <Modal
          isOpen={!!barnToClose}
          onClose={() => !isClosingBarn && setBarnToClose(null)}
          title={`Confirmar Cierre de Galpón — ${barnToClose.farm_code} (${barnToClose.barn_code})`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-slate-700 dark:text-slate-300">
                Al cerrar el galpón <strong>{barnToClose.farm_code} &bull; {barnToClose.barn_code}</strong>, su estado
                pasará a <strong>CERRADO</strong> y dejará de mostrarse como disponible en la planificación comercial.
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-2 font-mono">
              <div>
                <span className="text-[10px] font-sans text-slate-400 block">Granja</span>
                <span className="font-bold text-slate-900 dark:text-white">{barnToClose.farm_name}</span>
              </div>
              <div>
                <span className="text-[10px] font-sans text-slate-400 block">Sexo / Edad</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {barnToClose.sex} ({barnToClose.bird_age_days} d)
                </span>
              </div>
              <div>
                <span className="text-[10px] font-sans text-slate-400 block">Saldo actual</span>
                <span className="font-black text-purple-700 dark:text-purple-400">
                  {formatInt(barnToClose.barn_balance_available)} aves
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                size="sm"
                variant="secondary"
                disabled={isClosingBarn}
                onClick={() => setBarnToClose(null)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isClosingBarn}
                onClick={handleConfirmCloseBarn}
                className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isClosingBarn ? 'Cerrando galpón...' : 'Confirmar cierre de galpón'}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
