import React from 'react';

export type ChickenMood = 'normal' | 'alert' | 'idle';

interface ChickenAnimationProps {
  /** normal: galpón operativo · alert: lote > 45 días · idle: sin lote o bloqueado */
  mood?: ChickenMood;
  className?: string;
}

/**
 * Gallina blanca animada con SVG + CSS (sin imágenes ni librerías externas).
 * Camina, picotea el comedero y cambia el ritmo según el estado del galpón.
 */
export const ChickenAnimation: React.FC<ChickenAnimationProps> = ({
  mood = 'normal',
  className = '',
}) => {
  return (
    <div className={`chk ${mood === 'alert' ? 'chk--alert' : ''} ${mood === 'idle' ? 'chk--idle' : ''} ${className}`}>
      <style>{`
        .chk { --speed: 1; width: 100%; max-width: 280px; margin: 0 auto; }
        .chk--alert { --speed: 0.78; }
        .chk svg { width: 100%; height: auto; overflow: visible; }

        .chk-root {
          transform-box: view-box;
          transform-origin: 120px 190px;
          animation: chk-bob calc(2.1s * var(--speed)) ease-in-out infinite;
        }
        .chk-head {
          transform-box: view-box;
          transform-origin: 152px 128px;
          animation: chk-peck calc(6.6s * var(--speed)) ease-in-out infinite;
        }
        .chk-head-sway {
          transform-box: view-box;
          transform-origin: 152px 128px;
          animation: chk-sway calc(3.4s * var(--speed)) ease-in-out infinite;
        }
        .chk-leg {
          transform-box: view-box;
          transform-origin: 108px 170px;
          animation: chk-step calc(1.2s * var(--speed)) ease-in-out infinite;
        }
        .chk-leg--right {
          transform-origin: 136px 170px;
          animation-delay: calc(-0.6s * var(--speed));
        }
        .chk-wing {
          transform-box: view-box;
          transform-origin: 104px 122px;
          animation: chk-wing calc(4.2s * var(--speed)) ease-in-out infinite;
        }
        .chk-tail {
          transform-box: view-box;
          transform-origin: 82px 112px;
          animation: chk-tail calc(2.4s * var(--speed)) ease-in-out infinite;
        }
        .chk-tail--b { animation-delay: calc(-0.5s * var(--speed)); }
        .chk-eye {
          transform-box: view-box;
          transform-origin: 178px 83px;
          animation: chk-blink calc(4.6s * var(--speed)) ease-in-out infinite;
        }
        .chk-shadow {
          transform-box: view-box;
          transform-origin: 122px 196px;
          animation: chk-shadow calc(2.1s * var(--speed)) ease-in-out infinite;
        }

        @keyframes chk-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-2px) rotate(-0.7deg); }
        }
        @keyframes chk-sway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(2deg); }
        }
        @keyframes chk-peck {
          0%, 58%, 100% { transform: rotate(0deg); }
          63% { transform: rotate(58deg); }
          67% { transform: rotate(66deg); }
          71% { transform: rotate(58deg); }
          76% { transform: rotate(0deg); }
        }
        @keyframes chk-step {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(7deg); }
        }
        @keyframes chk-wing {
          0%, 78%, 100% { transform: rotate(0deg); }
          85% { transform: rotate(-8deg); }
          92% { transform: rotate(2deg); }
        }
        @keyframes chk-tail {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(3deg); }
        }
        @keyframes chk-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        @keyframes chk-shadow {
          0%, 100% { transform: scaleX(1); opacity: 0.16; }
          50% { transform: scaleX(0.96); opacity: 0.12; }
        }

        .chk--idle .chk-root,
        .chk--idle .chk-head,
        .chk--idle .chk-head-sway,
        .chk--idle .chk-leg,
        .chk--idle .chk-wing,
        .chk--idle .chk-tail,
        .chk--idle .chk-shadow { animation-play-state: paused; }

        @media (prefers-reduced-motion: reduce) {
          .chk-root, .chk-head, .chk-head-sway, .chk-leg,
          .chk-wing, .chk-tail, .chk-eye, .chk-shadow {
            animation: none !important;
          }
        }
      `}</style>

      <svg viewBox="0 0 250 210" role="img" aria-label="Gallina del galpón">
        {/* Sombra en el suelo */}
        <ellipse className="chk-shadow" cx="122" cy="196" rx="68" ry="9" fill="#0f172a" />

        {/* Comedero con granos */}
        <g>
          <path d="M182 178 h50 a5 5 0 0 1 0 9 h-50 a5 5 0 0 1 0 -9 z" fill="#CBD5E1" />
          <ellipse cx="207" cy="178" rx="25" ry="6" fill="#E2E8F0" />
          <circle cx="197" cy="176" r="2.6" fill="#F6C13B" />
          <circle cx="207" cy="175" r="2.3" fill="#F0B429" />
          <circle cx="216" cy="177" r="2.5" fill="#F6C13B" />
          <circle cx="202" cy="180" r="2" fill="#EAB308" />
        </g>

        <g className="chk-root">
          {/* Patas */}
          <g className="chk-leg">
            <line x1="108" y1="168" x2="108" y2="189" stroke="#F6AD55" strokeWidth="6" strokeLinecap="round" />
            <path d="M98 191 L108 189 L119 193" stroke="#F6AD55" strokeWidth="5" fill="none" strokeLinecap="round" />
          </g>
          <g className="chk-leg chk-leg--right">
            <line x1="136" y1="168" x2="136" y2="189" stroke="#ED8936" strokeWidth="6" strokeLinecap="round" />
            <path d="M126 193 L136 189 L147 191" stroke="#ED8936" strokeWidth="5" fill="none" strokeLinecap="round" />
          </g>

          {/* Cola */}
          <path
            className="chk-tail"
            d="M72 116 C50 102, 48 82, 64 74 C62 94, 74 104, 86 108 Z"
            fill="#F8FAFC"
            stroke="#CBD5E1"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            className="chk-tail chk-tail--b"
            d="M76 128 C54 118, 48 98, 60 88 C62 106, 74 116, 88 120 Z"
            fill="#EEF2F6"
            stroke="#CBD5E1"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Cuerpo */}
          <ellipse cx="120" cy="138" rx="58" ry="43" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2.5" />
          <path
            d="M78 150 C84 168, 100 178, 122 179 C104 172, 92 162, 86 148 Z"
            fill="#F1F5F9"
            opacity="0.9"
          />

          {/* Ala */}
          <g className="chk-wing">
            <path
              d="M84 132 C86 113, 107 105, 124 112 C113 124, 110 141, 117 153 C100 155, 88 146, 84 132 Z"
              fill="#F8FAFC"
              stroke="#CBD5E1"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path d="M93 132 C101 125, 112 123, 120 126" stroke="#CBD5E1" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M95 141 C103 135, 113 133, 121 136" stroke="#CBD5E1" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </g>

          {/* Cuello y cabeza */}
          <g className="chk-head">
            <g className="chk-head-sway">
              <path
                d="M146 124 C150 109, 152 100, 154 93 L173 99 C166 110, 160 121, 157 133 Z"
                fill="#FFFFFF"
                stroke="#CBD5E1"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <circle cx="168" cy="90" r="27" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2.5" />

              {/* Cresta */}
              <path
                d="M154 66 C156 55, 165 55, 166 66 C170 54, 179 56, 178 67 C183 59, 190 63, 187 73 Z"
                fill="#E53E3E"
              />

              {/* Pico */}
              <path d="M192 87 L214 94 L192 102 Z" fill="#F6AD55" />
              <path d="M192 96 L207 95 L192 102 Z" fill="#DD6B20" opacity="0.5" />

              {/* Mejilla */}
              <ellipse cx="173" cy="99" rx="5.5" ry="3.2" fill="#FEB2B2" opacity="0.5" />

              {/* Ojo */}
              <g className="chk-eye">
                <circle cx="178" cy="83" r="7.2" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
                <circle cx="179.6" cy="83" r="3.5" fill="#1A202C" />
                <circle cx="181" cy="81.5" r="1.2" fill="#FFFFFF" />
              </g>

              {/* Barbilla */}
              <path d="M180 104 C181 114, 189 114, 190 105 Z" fill="#E53E3E" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
};
