import React from 'react';
import roxiSaludando from '@/img/roxi_saludando.png';
import roxiPensando from '@/img/roxi_pensando.png';
import roxiRespuesta from '@/img/roxi_respuesta.png';
import roxiRechazo from '@/img/roxi_rechazo.png';
import roxiDespedida from '@/img/roxi_despedida.png';

export type RoxiMood = 'saludando' | 'pensando' | 'respuesta' | 'rechazo' | 'despedida';

interface RoxiAvatarProps {
  mood?: RoxiMood;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBadge?: boolean;
}

const ROXI_IMAGES: Record<RoxiMood, string> = {
  saludando: roxiSaludando,
  pensando: roxiPensando,
  respuesta: roxiRespuesta,
  rechazo: roxiRechazo,
  despedida: roxiDespedida,
};

const MOOD_DESCRIPTIONS: Record<RoxiMood, string> = {
  saludando: 'ROXI lista para asistir',
  pensando: 'ROXI analizando saca y rutas...',
  respuesta: 'ROXI tiene una recomendación',
  rechazo: 'ROXI alerta sobre restricciones',
  despedida: 'ROXI conforme con la asignación',
};

const SIZE_CLASSES = {
  xs: 'w-7 h-7',
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
  xl: 'w-28 h-28',
};

export const RoxiAvatar: React.FC<RoxiAvatarProps> = ({
  mood = 'saludando',
  size = 'md',
  className = '',
  showBadge = false,
}) => {
  const imgSrc = ROXI_IMAGES[mood] || roxiSaludando;
  const moodDesc = MOOD_DESCRIPTIONS[mood];

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {/* Halo de animación según el estado */}
      {mood === 'pensando' && (
        <span className="absolute inset-0 rounded-full bg-blue-500/20 dark:bg-blue-400/20 animate-ping" />
      )}
      {mood === 'respuesta' && (
        <span className="absolute inset-0 rounded-full bg-emerald-500/20 dark:bg-emerald-400/20 animate-pulse" />
      )}
      {mood === 'rechazo' && (
        <span className="absolute inset-0 rounded-full bg-amber-500/20 dark:bg-amber-400/20 animate-pulse" />
      )}

      {/* Imagen oficial con gesto reactivo */}
      <img
        src={imgSrc}
        alt={`ROXI - ${moodDesc}`}
        title={`ROXI AI: ${moodDesc}`}
        className={`object-contain transition-all duration-300 drop-shadow-md select-none ${
          SIZE_CLASSES[size]
        } ${mood === 'pensando' ? 'animate-bounce duration-1000' : ''}`}
      />

      {/* Indicador de estado */}
      {showBadge && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
            mood === 'pensando'
              ? 'bg-blue-500 animate-pulse'
              : mood === 'respuesta'
              ? 'bg-emerald-500'
              : mood === 'rechazo'
              ? 'bg-amber-500'
              : 'bg-emerald-400'
          }`}
          title={moodDesc}
        />
      )}
    </div>
  );
};

