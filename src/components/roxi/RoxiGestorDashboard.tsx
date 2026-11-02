import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Scale,
  Calendar,
  Truck,
  Bird,
  ShieldCheck,
  Search,
  ArrowRight,
  RefreshCw,
  Sliders,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SalesOrder, OrderStatus } from '@/types/comercial';
import { TablaGeneralSaldoItem } from '@/types/pecuaria';
import { RoxiAvatar, RoxiMood } from './RoxiAvatar';
import { RoxiCopilotCard } from './RoxiCopilotCard';
import {
  askRoxiForBarnRecommendation,
  RoxiAllocationResponse,
  RoxiRecommendPayload,
} from '@/lib/roxiApi';

interface RoxiGestorDashboardProps {
  orders: SalesOrder[];
  pecuariaItems: TablaGeneralSaldoItem[];
  selectedOrderId?: string;
  onSelectOrder: (orderId: string) => void;
  onApproveOrder: (order: SalesOrder, farmCode: string, barnCode: string) => Promise<void>;
  isApproving?: boolean;
  onNavigateToPedidos?: () => void;
}

export const RoxiGestorDashboard: React.FC<RoxiGestorDashboardProps> = ({
  orders,
  pecuariaItems,
  selectedOrderId,
  onSelectOrder,
  onApproveOrder,
  isApproving = false,
  onNavigateToPedidos,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'evaluador' | 'simulador' | 'radar_edad'>('evaluador');

  // Pedidos activos (no cancelados ni despachados si se quiere priorizar)
  const pendingOrders = useMemo(() => {
    return orders.filter((o) => o.status !== 'CANCELADO');
  }, [orders]);

  // Pedido seleccionado actualmente para evaluación
  const currentOrder = useMemo(() => {
    if (!selectedOrderId && pendingOrders.length > 0) {
      return pendingOrders[0];
    }
    return pendingOrders.find((o) => o.id === selectedOrderId) || pendingOrders[0] || null;
  }, [pendingOrders, selectedOrderId]);

  // Galpones en edad crítica (> 42 días) que requieren saca prioritaria
  const criticalAgeBarns = useMemo(() => {
    return pecuariaItems
      .filter((b) => b.bird_age_days >= 42 && b.barn_balance_available > 0)
      .sort((a, b) => b.bird_age_days - a.bird_age_days);
  }, [pecuariaItems]);

  // Estado para el Galpón seleccionado por ROXI para el pedido en evaluación
  const [assignedFarm, setAssignedFarm] = useState<string>('');
  const [assignedBarn, setAssignedBarn] = useState<string>('');

  // Sincronizar galpón cuando cambia el pedido
  React.useEffect(() => {
    if (currentOrder) {
      setAssignedFarm(currentOrder.suggested_farm_code || 'TRAD1');
      setAssignedBarn(currentOrder.suggested_barn_code || 'G-01');
    }
  }, [currentOrder?.id]);

  // Estado para el Simulador Libre
  const [simQuantity, setSimQuantity] = useState<number>(3500);
  const [simSex, setSimSex] = useState<string>('MACHO');
  const [simMinWeight, setSimMinWeight] = useState<number>(2.20);
  const [simMaxWeight, setSimMaxWeight] = useState<number>(2.50);
  const [simZone, setSimZone] = useState<string>('NORTE');
  const [simDate, setSimDate] = useState<string>(new Date().toISOString().split('T')[0]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* HERO BANNER PRINCIPAL DE ROXI */}
      {/* ========================================================================= */}
      <div className="p-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-800/60 rounded-3xl text-white shadow-xl relative overflow-hidden">
        {/* Adorno visual de fondo */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-md p-1.5 border border-white/20 shadow-lg flex items-center justify-center shrink-0">
              <RoxiAvatar mood="saludando" size="lg" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>ROXI • Centro de Control IA</span>
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Gemini 2.0 Flash Conectado
                </span>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Inventario en Vivo • 23 Granjas
                </span>
              </div>
              <p className="text-xs text-indigo-200 max-w-2xl leading-relaxed">
                Asistente especializado en optimización zootécnica y logística comercial. ROXI evalúa distancias viales reales en km hacia los 4 ejes de Lima (S/. 4.50/km), prioriza lotes biológicos mayores a 45 días y calibra pesos con tolerancia estricta.
              </p>
            </div>
          </div>

          {/* Métricas Rápidas Operativas */}
          <div className="flex items-center gap-3 shrink-0 bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-xs">
            <div className="text-center px-3 border-r border-white/10">
              <span className="text-[10px] uppercase text-indigo-300 font-bold block">Por Evaluar</span>
              <span className="text-xl font-black text-white">
                {orders.filter((o) => o.status === 'REGISTRADO' || o.status === 'BORRADOR').length}
              </span>
            </div>
            <div className="text-center px-3 border-r border-white/10">
              <span className="text-[10px] uppercase text-amber-300 font-bold block">Edad &gt; 42d</span>
              <span className="text-xl font-black text-amber-300">
                {criticalAgeBarns.length}
              </span>
            </div>
            <div className="text-center px-3">
              <span className="text-[10px] uppercase text-emerald-300 font-bold block">Flete Base</span>
              <span className="text-xl font-black text-emerald-300">S/. 4.50</span>
            </div>
          </div>
        </div>

        {/* SUB-TABS INTERNOS DEL DASHBOARD DE ROXI */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10 text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('evaluador')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeSubTab === 'evaluador'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <span>Evaluador de Pedidos Reales</span>
          </button>

          <button
            onClick={() => setActiveSubTab('simulador')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeSubTab === 'simulador'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Sliders className="w-4 h-4 text-blue-300" />
            <span>Simulador Libre de Saca</span>
          </button>

          <button
            onClick={() => setActiveSubTab('radar_edad')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeSubTab === 'radar_edad'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <span>Radar de Urgencia Sanitaria ({criticalAgeBarns.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: EVALUADOR DE PEDIDOS REALES DE LA BANDEJA */}
      {/* ========================================================================= */}
      {activeSubTab === 'evaluador' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda: Selector de Pedidos */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                Pedidos para Evaluación ({pendingOrders.length})
              </span>
              <span className="text-[10px] text-slate-500">Selecciona uno</span>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No hay pedidos en cola actualmente.
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {pendingOrders.map((order) => {
                  const isSelected = currentOrder?.id === order.id;
                  const isApproved = order.status === 'APROBADO_RESERVADO';
                  return (
                    <div
                      key={order.id}
                      onClick={() => onSelectOrder(order.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 shadow-xs'
                          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-xs text-slate-900 dark:text-slate-100">
                          {order.order_number}
                        </span>
                        <span
                          className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {isApproved ? 'Aprobado' : 'Por Evaluar'}
                        </span>
                      </div>

                      <div className="mt-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                        {order.client_name}
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-slate-500 font-mono">
                        <div>
                          <span className="block text-[8.5px] uppercase font-sans text-slate-400">Aves</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {order.requested_quantity.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[8.5px] uppercase font-sans text-slate-400">Zona</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {order.zone_code || 'CENTRO'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[8.5px] uppercase font-sans text-slate-400">Fecha</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {order.target_delivery_date ? order.target_delivery_date.slice(5) : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Columna Derecha: Tarjeta Interactiva de ROXI */}
          <div className="lg:col-span-8 space-y-4">
            {currentOrder ? (
              <div className="space-y-4">
                {/* Resumen del Pedido Seleccionado */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Analizando Pedido Seleccionado
                    </span>
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                      {currentOrder.order_number} &bull; {currentOrder.client_name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Solicita <strong>{currentOrder.requested_quantity.toLocaleString()} aves</strong> ({currentOrder.sex_preference || 'Indistinto'}), calibre{' '}
                      <strong>{currentOrder.min_weight_kg.toFixed(2)} - {currentOrder.max_weight_kg.toFixed(2)} kg</strong> para entrega en{' '}
                      <strong>{currentOrder.zone_code || 'CENTRO'}</strong>.
                    </p>
                  </div>

                  {/* Botón de Aprobación Directa con la recomendación de ROXI */}
                  {currentOrder.status !== 'APROBADO_RESERVADO' && (
                    <Button
                      onClick={() => onApproveOrder(currentOrder, assignedFarm, assignedBarn)}
                      isLoading={isApproving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-xs shrink-0 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aprobar con Galpón Sugerido ({assignedFarm} - {assignedBarn})</span>
                    </Button>
                  )}
                </div>

                {/* Componente Copiloto de ROXI */}
                <RoxiCopilotCard
                  payload={{
                    client_name: currentOrder.client_name,
                    quantity_birds: currentOrder.requested_quantity,
                    sex: currentOrder.sex_preference || 'INDISTINTO',
                    min_weight: currentOrder.min_weight_kg,
                    max_weight: currentOrder.max_weight_kg,
                    zone_code: currentOrder.zone_code || 'CENTRO',
                    delivery_address: currentOrder.delivery_address,
                    scheduled_date: currentOrder.target_delivery_date,
                  }}
                  currentFarmCode={assignedFarm}
                  currentBarnCode={assignedBarn}
                  onApplyBarn={(farm, barn) => {
                    setAssignedFarm(farm);
                    setAssignedBarn(barn);
                  }}
                  userRole="gestor_comercial"
                />
              </div>
            ) : (
              <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-slate-400">
                Selecciona un pedido de la lista para evaluarlo con ROXI.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: SIMULADOR LIBRE DE SACA (SANDBOX) */}
      {/* ========================================================================= */}
      {activeSubTab === 'simulador' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Parámetros de Simulación */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                Parámetros de la Consulta Simulada
              </h3>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Cantidad de Aves Solicitadas:
              </label>
              <Input
                type="number"
                value={simQuantity}
                onChange={(e) => setSimQuantity(Number(e.target.value))}
                className="font-mono font-bold text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Sexo del Lote:
                </label>
                <select
                  value={simSex}
                  onChange={(e) => setSimSex(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="MACHO">Macho</option>
                  <option value="HEMBRA">Hembra</option>
                  <option value="MIXTO">Mixto / Indistinto</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Zona Comercial de Lima:
                </label>
                <select
                  value={simZone}
                  onChange={(e) => setSimZone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="NORTE">Lima Norte (Puente Piedra/Comas)</option>
                  <option value="CENTRO">Lima Centro (Santa Anita/La Parada)</option>
                  <option value="SUR">Lima Sur (Villa El Salvador/Lurín)</option>
                  <option value="METROPOLITANA">Metropolitana / Callao</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Peso Mínimo (kg):
                </label>
                <Input
                  type="number"
                  step="0.05"
                  value={simMinWeight}
                  onChange={(e) => setSimMinWeight(Number(e.target.value))}
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Peso Máximo (kg):
                </label>
                <Input
                  type="number"
                  step="0.05"
                  value={simMaxWeight}
                  onChange={(e) => setSimMaxWeight(Number(e.target.value))}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Fecha Estimada de Saca:
              </label>
              <Input
                type="date"
                value={simDate}
                onChange={(e) => setSimDate(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Resultado de la Simulación con ROXI */}
          <div className="lg:col-span-7">
            <RoxiCopilotCard
              key={`${simQuantity}-${simSex}-${simMinWeight}-${simMaxWeight}-${simZone}`}
              payload={{
                client_name: 'Simulación Comercial Gestor',
                quantity_birds: simQuantity,
                sex: simSex,
                min_weight: simMinWeight,
                max_weight: simMaxWeight,
                zone_code: simZone,
                scheduled_date: simDate,
              }}
              onApplyBarn={(farm, barn) => {
                alert(`Galpón simulado óptimo: Granja ${farm} - ${barn}`);
              }}
              userRole="gestor_comercial"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: RADAR DE URGENCIA SANITARIA (EDAD BIOLÓGICA > 42 DÍAS) */}
      {/* ========================================================================= */}
      {activeSubTab === 'radar_edad' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Radar de Lotes en Edad Crítica (Mayor a 42 Días)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Regla biológica de ROXI: Las aves con más de 45 días generan sobrecostos alimenticios diarios y riesgo sanitario. Priorizar su saca en los próximos pedidos.
              </p>
            </div>
            <span className="px-3 py-1 bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-extrabold text-xs rounded-xl self-start">
              {criticalAgeBarns.length} Galpones Detectados
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-sans uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-2.5 px-3">Granja</th>
                  <th className="py-2.5 px-3">Galpón</th>
                  <th className="py-2.5 px-3 text-center">Edad (Días)</th>
                  <th className="py-2.5 px-3 text-center">Sexo</th>
                  <th className="py-2.5 px-3 text-right">Peso Prom.</th>
                  <th className="py-2.5 px-3 text-right">Saldo Libre</th>
                  <th className="py-2.5 px-3 text-center">Nivel de Urgencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {criticalAgeBarns.map((barn) => {
                  const isUltraCritical = barn.bird_age_days >= 45;
                  return (
                    <tr
                      key={`${barn.farm_code}-${barn.barn_code}`}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isUltraCritical ? 'bg-red-50/40 dark:bg-red-950/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                        {barn.farm_code}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                        {barn.barn_code}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] ${
                            isUltraCritical
                              ? 'bg-red-600 text-white font-black animate-pulse'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                          }`}
                        >
                          {barn.bird_age_days} días
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans font-bold">
                        {barn.sex}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                        {barn.average_weight_kg ? `${barn.average_weight_kg.toFixed(2)} kg` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                        {barn.barn_balance_available.toLocaleString()} aves
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        {isUltraCritical ? (
                          <span className="text-[10px] text-red-600 dark:text-red-400 font-black uppercase flex items-center justify-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Crítica (&gt; 45d)
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">
                            Atención (&gt; 42d)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
