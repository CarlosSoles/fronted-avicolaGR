import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

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

  // 3. Fallback de desarrollo con rol almacenado
  if (!token) {
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
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string>),
  };

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.message || errorDetail;
    } catch {
      // Ignorar si no es JSON
    }
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}
