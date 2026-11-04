import { apiClient } from './api';
import { FARM_COORDINATES, generateInitialOfficialData, haversineKm } from '@/types/pecuaria';

export interface CandidateBarnEvaluation {
  farm_code: string;
  farm_name: string;
  barn_code: string;
  current_age_days: number;
  current_weight_kg: number;
  available_balance: number;
  sex: string;
  distance_km: number;
  score_total: number;
  score_breakdown: {
    edad_biologica: number;
    distancia_flete: number;
    calibre_peso: number;
    eficiencia_saldo: number;
  };
  key_advantage: string;
}

export interface RoxiAllocationResponse {
  recommended_barn: CandidateBarnEvaluation;
  alternative_barn?: CandidateBarnEvaluation | null;
  commercial_pitch: string;
  gestor_technical_notes: string;
  split_recommendation: {
    enabled: boolean;
    reason?: string | null;
  };
  estimated_freight_cost_saving_soles: number;
  warnings: string[];
  agent_name: string;
  model_used: string;
  execution_time_ms: number;
}

export interface RoxiRecommendPayload {
  order_id?: string;
  client_name?: string;
  quantity_birds: number;
  sex?: string;
  min_weight?: number;
  max_weight?: number;
  zone_code?: string;
  delivery_address?: string;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  scheduled_date?: string;
}

/**
 * Motor heurístico local de ROXI (solo si el backend no responde).
 * Replica la misma prioridad del backend: edad > cercanía al punto de entrega > peso > saldo.
 * Las distancias se calculan con las coordenadas reales de cada granja.
 */
function computeLocalFallbackRecommendation(payload: RoxiRecommendPayload): RoxiAllocationResponse {
  const inventory = generateInitialOfficialData();
  const reqQty = payload.quantity_birds || 3000;
  const rawSex = (payload.sex || 'INDISTINTO').toUpperCase();
  const reqSex = rawSex === 'MACHO' || rawSex === 'HEMBRA' ? rawSex : 'INDISTINTO';
  const minW = payload.min_weight ?? 2.15;
  const maxW = payload.max_weight ?? 2.5;

  const deliveryCoords =
    payload.delivery_latitude != null && payload.delivery_longitude != null
      ? { lat: payload.delivery_latitude, lng: payload.delivery_longitude }
      : null;

  const withDistance = (barn: (typeof inventory)[number]) => {
    const coords = FARM_COORDINATES[barn.farm_code];
    return deliveryCoords && coords
      ? haversineKm(deliveryCoords.lat, deliveryCoords.lng, coords.lat, coords.lng)
      : 45;
  };

  // Filtros duros: estado, saldo, sexo y tolerancia de peso (±0.18 kg)
  let eligible = inventory
    .filter((b) => b.barn_status === 'OPERATIVO' && b.barn_balance_available > 0)
    .filter((b) => reqSex === 'INDISTINTO' || b.sex === reqSex)
    .filter((b) => {
      const w = b.average_weight_kg || 2.4;
      return w >= minW - 0.18 && w <= maxW + 0.18;
    });

  if (eligible.length === 0) {
    eligible = inventory.filter((b) => b.barn_status === 'OPERATIVO' && b.barn_balance_available > 0);
  }

  const candidates = eligible.map((barn) => {
    const weight = barn.average_weight_kg || 2.4;
    return { barn, weight, distance: withDistance(barn) };
  });

  const distances = candidates.map((c) => c.distance);
  const minD = Math.min(...distances);
  const maxD = Math.max(...distances);

  const scored = candidates.map(({ barn, weight, distance }) => {
    const age = barn.bird_age_days;
    const agePoints = age >= 47 ? 40 : age >= 45 ? 36 : age >= 42 ? 26 : age >= 38 ? 16 : 6;
    const distancePoints =
      maxD > minD ? Math.round(30 * (1 - (distance - minD) / (maxD - minD))) : 30;
    const weightPoints =
      weight >= minW && weight <= maxW ? 20 : weight >= minW - 0.15 && weight <= maxW + 0.15 ? 12 : 4;
    const stockPoints =
      barn.barn_balance_available >= reqQty
        ? 10
        : Math.max(1, Math.round((10 * barn.barn_balance_available) / Math.max(reqQty, 1)));

    return {
      farm_code: barn.farm_code,
      farm_name: barn.farm_name,
      barn_code: barn.barn_code,
      current_age_days: Number(age.toFixed(1)),
      current_weight_kg: Number(weight.toFixed(2)),
      available_balance: barn.barn_balance_available,
      sex: barn.sex,
      distance_km: distance,
      score_total: Math.min(100, agePoints + distancePoints + weightPoints + stockPoints),
      score_breakdown: {
        edad_biologica: agePoints,
        distancia_flete: distancePoints,
        calibre_peso: weightPoints,
        eficiencia_saldo: stockPoints,
      },
      key_advantage: `${age} días en ${barn.farm_name}, ${weight.toFixed(2)} kg y a ${distance} km del punto de entrega.`,
    };
  });

  scored.sort((a, b) => b.score_total - a.score_total);

  const best = scored[0] || {
    farm_code: 'TRAD1',
    farm_name: 'Tradisa 1',
    barn_code: 'G-01',
    current_age_days: 47,
    current_weight_kg: 2.45,
    available_balance: 12500,
    sex: 'MACHO',
    distance_km: 35,
    score_total: 90,
    score_breakdown: { edad_biologica: 40, distancia_flete: 25, calibre_peso: 20, eficiencia_saldo: 5 },
    key_advantage: 'Lote prioritario en Tradisa 1.',
  };

  const alt = scored[1] || null;
  const maxDistance = maxD;
  const savingKm = Math.max(0, maxDistance - best.distance_km);

  return {
    recommended_barn: best,
    alternative_barn: alt,
    commercial_pitch: `Te sugiero ofrecer el Galpón ${best.barn_code} de la Granja ${best.farm_name}: ${best.current_weight_kg} kg de peso promedio, ${best.current_age_days} días de crianza y a ${best.distance_km} km del punto de entrega.`,
    gestor_technical_notes: `Prioridad biológica: ${best.current_age_days} días de edad. Distancia al destino: ${best.distance_km} km ${deliveryCoords ? '(calculada por coordenadas)' : '(sin coordenadas de entrega: estimada)'}. Saldo disponible: ${best.available_balance.toLocaleString()} aves.`,
    split_recommendation: {
      enabled: best.available_balance < reqQty,
      reason: best.available_balance < reqQty ? 'Saldo menor a la cantidad requerida' : null,
    },
    estimated_freight_cost_saving_soles: Math.round(savingKm * 4.5 * 100) / 100,
    warnings:
      best.current_age_days >= 45
        ? [`Lote con edad crítica (${best.current_age_days} días). Saca prioritaria.`]
        : [],
    agent_name: 'ROXI',
    model_used: 'Motor local (sin conexión al backend)',
    execution_time_ms: 28,
  };
}

export async function askRoxiForBarnRecommendation(
  payload: RoxiRecommendPayload
): Promise<RoxiAllocationResponse> {
  try {
    // Timeout de 7 segundos para no dejar colgado al usuario si Render está en reposo (cold-start)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout backend Render')), 7000)
    );

    const apiPromise = apiClient<RoxiAllocationResponse>('/agent/recommend-barn', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return await Promise.race([apiPromise, timeoutPromise]);
  } catch (err) {
    console.warn('ROXI API remota no disponible o en espera, activando motor heurístico local:', err);
    return computeLocalFallbackRecommendation(payload);
  }
}

export async function askRoxiToReassignOrder(
  orderId: string,
  reason: string = 'Ajuste operativo'
): Promise<RoxiAllocationResponse> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout backend Render')), 7000)
    );

    const apiPromise = apiClient<RoxiAllocationResponse>(
      `/agent/reassign-order/${orderId}?reason=${encodeURIComponent(reason)}`,
      { method: 'POST' }
    );

    return await Promise.race([apiPromise, timeoutPromise]);
  } catch (err) {
    console.warn('ROXI Reassign API no disponible, activando motor heurístico local:', err);
    return computeLocalFallbackRecommendation({ quantity_birds: 3000, sex: 'INDISTINTO' });
  }
}

export async function getRoxiStatus(): Promise<any> {
  try {
    return await apiClient<any>('/agent/status', { method: 'GET' });
  } catch {
    return {
      agent_name: 'ROXI',
      role: 'Copiloto IA de Asignación y Planificación de Saca',
      version: '2.0.0',
      model: 'no disponible',
      api_key_configured: false,
      mode: 'Sin conexión con el backend',
      status: 'DEGRADED_FALLBACK',
      company: 'Avícola GR / Grupo El Rocío',
    };
  }
}
