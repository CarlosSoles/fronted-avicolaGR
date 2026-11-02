import { apiClient } from './api';

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
  scheduled_date?: string;
}

export async function askRoxiForBarnRecommendation(
  payload: RoxiRecommendPayload
): Promise<RoxiAllocationResponse> {
  return apiClient<RoxiAllocationResponse>('/agent/recommend-barn', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function askRoxiToReassignOrder(
  orderId: string,
  reason: string = 'Ajuste operativo'
): Promise<RoxiAllocationResponse> {
  return apiClient<RoxiAllocationResponse>(`/agent/reassign-order/${orderId}?reason=${encodeURIComponent(reason)}`, {
    method: 'POST',
  });
}

export async function getRoxiStatus(): Promise<any> {
  return apiClient<any>('/agent/status', {
    method: 'GET',
  });
}

