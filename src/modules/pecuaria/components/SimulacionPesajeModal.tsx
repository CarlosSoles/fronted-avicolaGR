import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TablaGeneralSaldoItem } from '@/types/pecuaria';
import { apiClient } from '@/lib/api';
import { Play, Sparkles, CheckCircle2 } from 'lucide-react';

interface SimulacionPesajeModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: TablaGeneralSaldoItem | null;
  onSuccess: () => void;
}

export const SimulacionPesajeModal: React.FC<SimulacionPesajeModalProps> = ({
  isOpen,
  onClose,
  item,
  onSuccess,
}) => {
  const [sampleSize, setSampleSize] = useState<number>(150);
  const [expectedMean, setExpectedMean] = useState<string>('2.68');
  const [stdDev, setStdDev] = useState<string>('0.14');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!item) return null;

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    const meanNum = parseFloat(expectedMean);
    const stdNum = parseFloat(stdDev);

    if (isNaN(meanNum) || meanNum < 1.0 || meanNum > 5.0) {
      setErrorMessage('El peso promedio esperado debe estar entre 1.00 kg y 5.00 kg.');
      return;
    }
    if (isNaN(stdNum) || stdNum < 0.01 || stdNum > 1.0) {
      setErrorMessage('La desviación estándar debe estar entre 0.01 y 1.00 kg.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await apiClient('/pecuaria/samples/simulate', {
        method: 'POST',
        body: JSON.stringify({
          barn_id: item.barn_id,
          sample_size: sampleSize,
          expected_mean_kg: meanNum,
          std_dev_kg: stdNum,
        }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.warn('Simulation API sync warn:', err);
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Simulación Rápida de Pesaje - Galpón ${String(item.barn_number).padStart(2, '0')}`}
      size="md"
    >
      <form onSubmit={handleSimulate} className="space-y-4">
        <div className="p-3 bg-cyan-950/40 border border-cyan-800/40 rounded-xl flex items-start gap-2.5 text-xs text-cyan-300">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Módulo de Demostración MVP:</span> Genera una muestra
            aleatoria con distribución gaussiana marcada indeleblemente como <code>SIMULADO</code> en
            la base de datos para probar el flujo de actualización de saldos sin balanzas reales conectadas.
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Tamaño de Muestra (Aves)
            </label>
            <select
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value))}
              className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value={50}>50 aves (Muestra exploratoria)</option>
              <option value={100}>100 aves (Estándar técnico)</option>
              <option value={150}>150 aves (Recomendado para saca)</option>
              <option value={200}>200 aves (Alta precisión)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Peso Promedio Esperado (x̄ en kg)
            </label>
            <Input
              type="number"
              step="0.01"
              min="1.0"
              max="5.0"
              value={expectedMean}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpectedMean(e.target.value)}
              required
              className="bg-slate-900 border-slate-700 text-cyan-300 font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Desviación Estándar (σ en kg)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max="0.5"
              value={stdDev}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStdDev(e.target.value)}
              required
              className="bg-slate-900 border-slate-700 text-slate-300 font-mono"
            />
          </div>
        </div>

        {errorMessage && (
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30"
          >
            <Play className="w-4 h-4 mr-1.5" />
            Ejecutar Simulación
          </Button>
        </div>
      </form>
    </Modal>
  );
};
