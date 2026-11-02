import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  AlertTriangle,
  RotateCcw,
  Layers,
  Truck,
  Scale,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RoxiAvatar, RoxiMood } from './RoxiAvatar';
import {
  askRoxiForBarnRecommendation,
  RoxiAllocationResponse,
  RoxiRecommendPayload,
} from '@/lib/roxiApi';

interface RoxiCopilotCardProps {
  payload: RoxiRecommendPayload;
  currentFarmCode?: string;
  currentBarnCode?: string;
  onApplyBarn: (farmCode: string, barnCode: string) => void;
  userRole?: 'vendedor' | 'gestor_comercial' | 'admin_sistema' | string;
  compact?: boolean;
}

export const RoxiCopilotCard: React.FC<RoxiCopilotCardProps> = ({
  payload,
  currentFarmCode,
  currentBarnCode,
  onApplyBarn,
  userRole = 'vendedor',
  compact = false,
}) => {
  const [mood, setMood] = useState<RoxiMood>('saludando');
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<RoxiAllocationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAlternative, setShowAlternative] = useState<boolean>(false);
  const [applied, setApplied] = useState<boolean>(false);

  const handleAskRoxi = async () => {
    setLoading(true);
    setMood('pensando');
    setErrorMessage(null);
    setApplied(false);

    try {
      const data = await askRoxiForBarnRecommendation(payload);
      setResponse(data);
      if (data.warnings && data.warnings.length > 0 && !data.recommended_barn) {
        setMood('rechazo');
      } else {
        setMood('respuesta');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo conectar con ROXI. Intente nuevamente.');
      setMood('rechazo');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!response) return;
    const { farm_code, barn_code } = response.recommended_barn;
    onApplyBarn(farm_code, barn_code);
    setMood('despedida');
    setApplied(true);
  };

  const handleApplyAlternative = () => {
    if (!response?.alternative_barn) return;
    const { farm_code, barn_code } = response.alternative_barn;
    onApplyBarn(farm_code, barn_code);
    setMood('despedida');
    setApplied(true);
  };

  const isCurrentMatching =
    response &&
    currentFarmCode === response.recommended_barn.farm_code &&
    currentBarnCode === response.recommended_barn.barn_code;

  return (
    <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 dark:from-slate-900/90 dark:via-slate-900 dark:to-blue-950/20 shadow-xs transition-all">
      {/* Header del Copiloto */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <RoxiAvatar mood={mood} size={compact ? 'sm' : 'md'} showBadge />
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-black text-slate-950 dark:text-white tracking-tight">
                ROXI
              </span>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Copiloto IA • Gemini 2.0 Flash
              </span>
              {applied && (
                <span className="text-[10px] font-black uppercase px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Aplicado</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Optimización de saca por edad biológica (&gt;45 días), flete y calibre de peso en tiempo real
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleAskRoxi}
          isLoading={loading}
          className="text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{response ? 'Recalcular con ROXI' : 'Consultar a ROXI'}</span>
        </Button>
      </div>

      {/* Estado 1: Mensaje inicial de bienvenida */}
      {!response && !loading && !errorMessage && (
        <div className="mt-3 pt-3 border-t border-blue-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400 leading-relaxed flex items-center justify-between gap-2">
          <span>
            💡 <em>"Indica la cantidad, sexo y peso del pedido. Al presionar <strong>'Consultar a ROXI'</strong> evaluaré los saldos pecuarios en tiempo real para decirte qué galpón te conviene ofrecer."</em>
          </span>
        </div>
      )}

      {/* Estado 2: Animación pensando */}
      {loading && (
        <div className="mt-3 pt-3 border-t border-blue-100 dark:border-slate-800/80 text-xs text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
          <span>ROXI está evaluando los saldos en vivo de las 23 granjas y calculando la mejor ruta...</span>
        </div>
      )}

      {/* Estado de Error / Rechazo */}
      {errorMessage && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Estado 3: Recomendación emitida por ROXI */}
      {response && !loading && (
        <div className="mt-3.5 pt-3.5 border-t border-blue-200/80 dark:border-slate-800 space-y-3">
          {/* Tarjeta del Galpón Recomendado */}
          <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border-2 border-emerald-500/80 dark:border-emerald-600 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-slate-950 dark:text-white font-mono">
                    {response.recommended_barn.farm_name} • {response.recommended_barn.barn_code}
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    Score: {response.recommended_barn.score_total}/100
                  </span>
                  {response.recommended_barn.current_age_days >= 45 && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                      ¡Edad Crítica: {response.recommended_barn.current_age_days}d!
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {response.recommended_barn.sex}
                  </span>
                </div>

                {/* Argumento comercial o técnico */}
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1.5 leading-relaxed">
                  {userRole === 'gestor_comercial'
                    ? response.gestor_technical_notes
                    : response.commercial_pitch}
                </p>

                {/* Métricas clave */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-mono">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                    <span>~{response.recommended_barn.distance_km} km a destino</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-slate-600" />
                    <span>Peso Prom: <strong>{response.recommended_barn.current_weight_kg.toFixed(2)} kg</strong></span>
                  </span>
                  <span>•</span>
                  <span>Saldo Libre: <strong>{response.recommended_barn.available_balance.toLocaleString()} aves</strong></span>
                  {response.estimated_freight_cost_saving_soles > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-black">
                        Ahorro Flete: S/. {response.estimated_freight_cost_saving_soles.toFixed(2)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Botón Aplicar Sugerencia */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleApply}
                  className={`text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition-all ${
                    isCurrentMatching || applied
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isCurrentMatching || applied ? 'Galpón Asignado' : 'Aplicar Sugerencia'}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Opción de Galpón Alternativo (Desplegable) */}
          {response.alternative_barn && (
            <div className="text-xs">
              <button
                type="button"
                onClick={() => setShowAlternative(!showAlternative)}
                className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-bold flex items-center gap-1 transition-colors"
              >
                <span>{showAlternative ? 'Ocultar' : 'Ver'} alternativa de respaldo (Plan B)</span>
                {showAlternative ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showAlternative && (
                <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 dark:text-white font-mono">
                        {response.alternative_barn.farm_name} • {response.alternative_barn.barn_code}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        Score: {response.alternative_barn.score_total}/100
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {response.alternative_barn.key_advantage} &bull; Distancia: ~{response.alternative_barn.distance_km} km &bull; Saldo: {response.alternative_barn.available_balance.toLocaleString()} aves
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyAlternative}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-slate-700 border border-blue-300 dark:border-blue-700 transition-colors shrink-0"
                  >
                    Usar Plan B
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

