import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SalesOrder } from '@/types/comercial';
import {
  chatWithRoxi,
  RoxiChatHistoryItem,
  synthesizeRoxiSpeech,
} from '@/lib/roxiApi';
import { RoxiAvatar, RoxiMood } from './RoxiAvatar';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  spokenText?: string;
  mood?: RoxiMood;
  inScope?: boolean;
  suggestedAction?: string | null;
  actionPayload?: Record<string, unknown> | null;
  timestamp: string;
}

interface RoxiChatPanelProps {
  selectedOrder?: SalesOrder | null;
  onNavigateToPedidos?: () => void;
  onOpenOrderInEvaluator?: (orderId: string) => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const QUICK_CHIPS = [
  { label: '📊 KPIs de hoy', query: 'Dame un resumen de los KPIs operativos de hoy.' },
  { label: '⏳ Pedidos por completar', query: '¿Qué pedidos están pendientes por completar granja y galpón?' },
  { label: '🐔 Galpones críticos (>45 días)', query: '¿Qué galpones tienen 45 días o más y requieren saca prioritaria?' },
  { label: '🚛 Sin camión o sin ARIS', query: '¿Cuántos pedidos programados están sin camión o sin código ARIS?' },
  { label: '✨ Recomendar granja y galpón', query: '¿Qué granja y galpón me recomiendas para el pedido seleccionado?' },
];

const MOOD_CAPTIONS: Record<RoxiMood, string> = {
  saludando: '¡Hola! Lista para ayudarte con tus KPIs y programación.',
  pensando: 'Analizando saldos, pedidos y rutas en vivo...',
  respuesta: 'Aquí tienes el detalle actualizado.',
  rechazo: 'Esta consulta está fuera de mi ámbito operativo.',
  despedida: '¡Con gusto! Aquí estaré cuando necesites otra consulta.',
};

const isFarewellMessage = (text: string): boolean => {
  const q = text.toLowerCase();
  return /\b(gracias|muchas gracias|chao|chau|adi[oó]s|hasta luego|nos vemos)\b/.test(q);
};

const normalizeDictatedText = (raw: string): string => {
  return raw
    .replace(/\b(balpón|balpon|calpón|calpon)\b/gi, 'galpón')
    .replace(/\bg[\s-]*0?(\d{1,2})\b/gi, (_, num: string) => `G-${num.padStart(2, '0')}`)
    .replace(/\s+/g, ' ')
    .trim();
};

const pickBestSpanishVoice = (): SpeechSynthesisVoice | null => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  return voices.find((v) => v.lang.toLowerCase().startsWith('es')) || null;
};

const renderFormattedReply = (text: string): React.ReactNode => {
  return text.split('\n').map((line, idx) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={idx} className={idx > 0 ? 'mt-1' : ''}>
        {parts.map((part, pIdx) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={pIdx} className="font-bold text-slate-900 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <React.Fragment key={pIdx}>{part}</React.Fragment>
          )
        )}
      </p>
    );
  });
};

export const RoxiChatPanel: React.FC<RoxiChatPanelProps> = ({
  selectedOrder,
  onNavigateToPedidos,
  onOpenOrderInEvaluator,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text:
        'Hola, soy **ROXI**. ¿En qué te ayudo hoy?',
      spokenText:
        'Hola, soy ROXI. ¿En qué te ayudo hoy?',
      mood: 'saludando',
      inScope: true,
      timestamp: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [autoVoice, setAutoVoice] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [mood, setMood] = useState<RoxiMood>('saludando');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sendingRef = useRef(false);
  const speakSeqRef = useRef(0);
  const voiceTranscriptRef = useRef('');
  const voiceDispatchedRef = useRef(false);

  const speechSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as Record<string, unknown>;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      stopAudio();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const stopAudio = () => {
    speakSeqRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
  };

  const speakText = async (text: string, msgId: string) => {
    const clean = text.trim();
    if (!clean) return;
    stopAudio();
    const mySeq = speakSeqRef.current;
    setSpeakingMsgId(msgId);

    const blob = await synthesizeRoxiSpeech(clean, 'es-CO-SalomeNeural');
    if (mySeq !== speakSeqRef.current) return;

    if (blob) {
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (mySeq === speakSeqRef.current) stopAudio();
      };
      audio.onerror = () => {
        if (mySeq === speakSeqRef.current) stopAudio();
      };
      try {
        await audio.play();
      } catch {
        if (mySeq === speakSeqRef.current) stopAudio();
      }
      return;
    }

    // Respaldo automático del navegador si edge-tts no devolvió audio
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'es-PE';
      utterance.rate = 1.04;
      utterance.pitch = 1.02;
      const voice = pickBestSpanishVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = () => {
        if (mySeq === speakSeqRef.current) setSpeakingMsgId(null);
      };
      utterance.onerror = () => {
        if (mySeq === speakSeqRef.current) setSpeakingMsgId(null);
      };
      setSpeakingMsgId(msgId);
      window.speechSynthesis.speak(utterance);
    } else {
      setSpeakingMsgId(null);
    }
  };

  const sendMessage = async (rawText: string, viaVoice = false) => {
    const text = rawText.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;

    const nowLabel = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text,
      timestamp: nowLabel,
    };

    const historyPayload: RoxiChatHistoryItem[] = messages
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setSending(true);
    setMood('pensando');

    try {
      const res = await chatWithRoxi({
        message: text,
        order_id: selectedOrder?.id,
        order_context: selectedOrder
          ? {
            order_number: selectedOrder.order_number,
            client_name: selectedOrder.client_name,
            requested_quantity: selectedOrder.requested_quantity,
            zone_code: selectedOrder.zone_code,
            status: selectedOrder.status,
          }
          : undefined,
        history: historyPayload,
      });

      const nextMood: RoxiMood = !res.in_scope
        ? 'rechazo'
        : isFarewellMessage(text)
          ? 'despedida'
          : 'respuesta';

      const assistantMsg: ChatMessage = {
        id: `roxi-${Date.now()}`,
        role: 'assistant',
        text: res.reply,
        spokenText: res.spoken_reply || res.reply,
        mood: nextMood,
        inScope: res.in_scope,
        suggestedAction: res.suggested_action,
        actionPayload: res.action_payload,
        timestamp: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setMood(nextMood);

      if (viaVoice || autoVoice) {
        void speakText(assistantMsg.spokenText || assistantMsg.text, assistantMsg.id);
      }
    } catch {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: 'No pude conectarme al servidor en este momento.',
        spokenText: 'No pude conectarme al servidor en este momento.',
        mood: 'rechazo',
        inScope: true,
        timestamp: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
      setMood('rechazo');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const toggleVoiceInput = () => {
    if (!speechSupported || sendingRef.current) return;
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    stopAudio();
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRec) return;

    voiceTranscriptRef.current = '';
    voiceDispatchedRef.current = false;

    const recognition = new SpeechRec();
    recognition.lang = 'es-PE';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let combined = '';
      for (let i = 0; i < event.results.length; i++) {
        combined += event.results[i][0]?.transcript || '';
      }
      const clean = combined.trim();
      voiceTranscriptRef.current = clean;
      setInputValue(clean);
    };
    recognition.onerror = () => {
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      const finalText = normalizeDictatedText(voiceTranscriptRef.current);
      voiceTranscriptRef.current = '';
      if (finalText && !voiceDispatchedRef.current) {
        voiceDispatchedRef.current = true;
        void sendMessage(finalText, true);
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    setMood('pensando');
    recognition.start();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
      {/* Cabecera limpia */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 via-violet-50/60 to-white dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <RoxiAvatar mood={mood} size="sm" showBadge />
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              ROXI · Copiloto IA
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isListening
                ? 'Escuchando tu consulta...'
                : speakingMsgId
                  ? 'ROXI está respondiendo por voz...'
                  : MOOD_CAPTIONS[mood]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {speakingMsgId && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={stopAudio}
              className="h-8 px-2.5 text-[11px] font-bold border-rose-200 text-rose-700 dark:border-rose-800 dark:text-rose-300"
            >
              <Square className="w-3 h-3 mr-1 fill-current" />
              Detener audio
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const next = !autoVoice;
              setAutoVoice(next);
              if (!next) stopAudio();
            }}
            className={`h-8 px-2.5 text-[11px] font-bold ${autoVoice
              ? 'border-violet-300 text-violet-700 bg-violet-50/70 dark:border-violet-700 dark:text-violet-300 dark:bg-violet-950/40'
              : 'text-slate-500'
              }`}
          >
            {autoVoice ? (
              <>
                <Volume2 className="w-3.5 h-3.5 mr-1" />
                Voz automática: ON
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 mr-1" />
                Voz automática: OFF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Chips de consultas rápidas */}
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-wrap gap-1.5">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            disabled={sending}
            onClick={() => sendMessage(chip.query, false)}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Historial de chat + entrada */}
      <div className="flex flex-col">
        <div
          ref={scrollRef}
          className="p-4 space-y-3.5 max-h-[420px] min-h-[280px] overflow-y-auto bg-slate-50/30 dark:bg-slate-950/30"
        >
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isSpeakingThis = speakingMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <RoxiAvatar
                    mood={msg.mood || 'respuesta'}
                    size="md"
                    className="mb-1"
                  />
                )}

                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs ${isUser
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : msg.inScope === false
                      ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-sm'
                    }`}
                >
                  <div className="leading-relaxed">
                    {isUser ? msg.text : renderFormattedReply(msg.text)}
                  </div>

                  <div
                    className={`mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] ${isUser ? 'text-violet-200' : 'text-slate-400'
                      }`}
                  >
                    <span>{msg.timestamp}</span>
                    {!isUser && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            isSpeakingThis
                              ? stopAudio()
                              : speakText(msg.spokenText || msg.text, msg.id)
                          }
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-violet-100 dark:hover:bg-violet-900 font-semibold"
                        >
                          {isSpeakingThis ? (
                            <>
                              <Square className="w-2.5 h-2.5 fill-current" /> Detener
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" /> Escuchar
                            </>
                          )}
                        </button>

                        {msg.suggestedAction === 'IR_A_PEDIDOS' && onNavigateToPedidos && (
                          <button
                            type="button"
                            onClick={onNavigateToPedidos}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-200 hover:bg-violet-200 font-bold"
                          >
                            Ir a Pedidos <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {msg.suggestedAction === 'ASIGNAR_GALPON' &&
                          onOpenOrderInEvaluator &&
                          typeof msg.actionPayload?.order_id === 'string' && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenOrderInEvaluator(msg.actionPayload!.order_id as string)
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-200 font-bold"
                            >
                              <Sparkles className="w-3 h-3" /> Evaluar pedido
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {sending && (
            <div className="flex items-center gap-2.5 justify-start">
              <RoxiAvatar mood="pensando" size="md" />
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-xs text-slate-500 dark:text-slate-400">
                ROXI está consultando los datos en vivo...
              </div>
            </div>
          )}
        </div>

        {/* Barra de entrada (Texto + Micrófono) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(inputValue, false);
          }}
          className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2"
        >
          <Button
            type="button"
            variant="outline"
            disabled={!speechSupported || sending}
            onClick={toggleVoiceInput}
            title={
              speechSupported
                ? isListening
                  ? 'Detener micrófono'
                  : 'Hablar con ROXI por micrófono'
                : 'Tu navegador no soporta dictado por voz (usa Chrome o Edge)'
            }
            className={`h-10 w-10 p-0 shrink-0 ${isListening
              ? 'bg-rose-50 border-rose-400 text-rose-600 animate-pulse dark:bg-rose-950/50 dark:border-rose-700'
              : ''
              }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>

          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              isListening
                ? 'Escuchando...'
                : 'Pregunta a ROXI por KPIs, pedidos pendientes, galpones >45d o recomendaciones...'
            }
            disabled={sending}
            className="h-10 text-xs flex-1"
          />

          <Button
            type="submit"
            disabled={sending || !inputValue.trim()}
            className="h-10 px-4 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shrink-0"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Enviar
          </Button>
        </form>
      </div>
    </div>
  );
};
