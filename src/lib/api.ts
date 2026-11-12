import { supabase } from './supabase';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ejecuta fetch con reintentos escalonados ante estados transitorios de arranque
 * en frío o limitación temporal del proxy/servidor (429, 502, 503, 504).
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryDelaysMs: number[] = [2500, 5000]
): Promise<Response> {
  let response = await fetch(url, options);
  for (const delayMs of retryDelaysMs) {
    if (!RETRYABLE_STATUS_CODES.has(response.status)) {
      return response;
    }
    await sleep(delayMs);
    response = await fetch(url, options);
  }
  return response;
}

/**
 * Extrae un mensaje legible de error HTTP sin ocultar fallos 429/5xx del servidor o proxy.
 */
export async function parseApiError(response: Response, fallbackMessage: string): Promise<string> {
  let detail: string | undefined;
  try {
    const rawText = await response.text();
    if (rawText) {
      try {
        const parsed = JSON.parse(rawText);
        detail = parsed?.detail || parsed?.message;
      } catch {
        // El cuerpo no es JSON (p. ej. texto plano "Too Many Requests" o HTML de Cloudflare)
      }
    }
  } catch {
    // Ignorar error de lectura de cuerpo
  }

  if (detail) return detail;
  if (response.status === 429) {
    return 'El servidor está despertando o limitó temporalmente las solicitudes (HTTP 429). Espere unos segundos e intente nuevamente.';
  }
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    return `El servidor está iniciando (HTTP ${response.status}). Espere unos segundos e intente nuevamente.`;
  }
  return fallbackMessage;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // 1. Obtener token del sistema almacenado
  let token: string | null = localStorage.getItem('avicola_token');

  // 2. Si no hay token del backend, buscar en sesión de Supabase
  if (!token) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token || null;
    } catch (err) {
      console.warn('No se pudo obtener la sesión de Supabase:', err);
    }
  }

  // 3. Fallback de desarrollo con rol almacenado (solo en desarrollo)
  if (!token && import.meta.env.DEV) {
    try {
      const stored = localStorage.getItem('avicola_user');
      if (stored) {
        const user = JSON.parse(stored);
        token = `dev-token-${user.role || 'supervisor_pecuario'}`;
      } else {
        token = 'dev-token-supervisor_pecuario';
      }
    } catch {
      token = 'dev-token-supervisor_pecuario';
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  // En producción, sin sesión no se envía token: el backend responde 401
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const method = (options.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

  const response = isIdempotent
    ? await fetchWithRetry(url, { ...options, headers }, [2500, 5000])
    : await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorDetail = await parseApiError(
      response,
      `Error ${response.status}: ${response.statusText}`
    );
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}
