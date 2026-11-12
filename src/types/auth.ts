export type UserRole =
  | 'admin_sistema'
  | 'registrador_pecuario'
  | 'supervisor_pecuario'
  | 'vendedor'
  | 'gestor_comercial'
  | 'gerente_comercial'
  | 'controlador_flota';

export interface UserProfile {
  id: string;
  username?: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  token: string | null;
}
