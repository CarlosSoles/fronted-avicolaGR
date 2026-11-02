import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile, UserRole } from '@/types/auth';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  switchMockRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Inicializar estado de sesión
  useEffect(() => {
    async function loadSession() {
      try {
        const storedToken = localStorage.getItem('avicola_token');
        const storedUser = localStorage.getItem('avicola_user');

        if (storedUser) {
          const parsedUser: UserProfile = JSON.parse(storedUser);
          setUser(parsedUser);
          setToken(storedToken);
        } else {
          // Intentar recuperar sesión de Supabase si existe
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: profile } = await supabase
              .from('users_profile')
              .select('*')
              .eq('id', session.user.id)
              .single();

            const loadedUser: UserProfile = {
              id: session.user.id,
              username: session.user.email?.split('@')[0],
              email: session.user.email || '',
              full_name: profile?.full_name || session.user.email?.split('@')[0] || 'Usuario',
              role: (profile?.role as UserRole) || 'supervisor_pecuario',
              is_active: profile?.is_active ?? true,
            };
            setUser(loadedUser);
            setToken(session.access_token);
            localStorage.setItem('avicola_user', JSON.stringify(loadedUser));
            localStorage.setItem('avicola_token', session.access_token);
          }
        }
      } catch (err) {
        console.warn('Error al verificar sesión guardada:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSession();

    // Escuchar cambios de autenticación en Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users_profile')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const authUser: UserProfile = {
          id: session.user.id,
          username: session.user.email?.split('@')[0],
          email: session.user.email || '',
          full_name: profile?.full_name || session.user.email?.split('@')[0] || 'Usuario',
          role: (profile?.role as UserRole) || 'supervisor_pecuario',
          is_active: profile?.is_active ?? true,
        };
        setUser(authUser);
        setToken(session.access_token);
        localStorage.setItem('avicola_user', JSON.stringify(authUser));
        localStorage.setItem('avicola_token', session.access_token);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (usernameInput: string, passwordInput: string): Promise<UserProfile> => {
    setLoading(true);
    const cleanUser = usernameInput.trim();
    const cleanPass = passwordInput;

    try {
      // 1. Intento de inicio de sesión contra el Backend API
      try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUser,
            password: cleanPass,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const authenticatedUser: UserProfile = data.user;
          const accessToken = data.access_token;

          setUser(authenticatedUser);
          setToken(accessToken);
          localStorage.setItem('avicola_user', JSON.stringify(authenticatedUser));
          localStorage.setItem('avicola_token', accessToken);
          return authenticatedUser;
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.detail || 'Usuario o contraseña incorrectos.';
          throw new Error(errMsg);
        }
      } catch (apiErr: any) {
        // Si el error fue retornado por el backend (401, 403, etc.), relanzarlo
        if (apiErr.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('Failed to fetch')) {
          throw apiErr;
        }

        // 2. Fallback de emergencia local si el backend está temporalmente no disponible
        if (cleanUser.toLowerCase() === 'admin' && cleanPass === 'admin 123') {
          const masterAdmin: UserProfile = {
            id: '00000000-0000-0000-0000-000000000001',
            username: 'admin',
            email: 'admin@avicolagr.com',
            full_name: 'Administrador General',
            role: 'admin_sistema',
            is_active: true,
          };
          const fallbackToken = 'dev-token-admin_sistema';
          setUser(masterAdmin);
          setToken(fallbackToken);
          localStorage.setItem('avicola_user', JSON.stringify(masterAdmin));
          localStorage.setItem('avicola_token', fallbackToken);
          return masterAdmin;
        }

        // Usuarios oficiales del sistema (Comercial, Gestión y Pecuaria)
        const officialSystemUsers: Record<
          string,
          { username: string; full_name: string; email: string; role: UserRole }
        > = {
          gestor_comercial: {
            username: 'gestor_comercial',
            full_name: 'Ramiro Vega Zabaleta',
            email: 'gestorcomercial2@avicola.gr',
            role: 'gestor_comercial',
          },
          vendedor2: {
            username: 'vendedor2',
            full_name: 'María Elena Rodríguez Soto',
            email: 'mrodriguez@avicola.gr',
            role: 'vendedor',
          },
          vendedor1: {
            username: 'vendedor1',
            full_name: 'Juan Carlos Pérez Gálvez',
            email: 'jperez@avicola.gr',
            role: 'vendedor',
          },
          pecuaria1: {
            username: 'pecuaria1',
            full_name: 'Jorge Alfaro Chavez',
            email: 'pecuaria1@avicola.gr',
            role: 'registrador_pecuario',
          },
          areacomercial1: {
            username: 'areacomercial1',
            full_name: 'Felipe',
            email: 'areacomercial@avicola.gr',
            role: 'vendedor',
          },
        };

        const lookupKey = cleanUser.toLowerCase().replace(/^@/, '');
        const matchedOfficial =
          officialSystemUsers[lookupKey] ||
          Object.values(officialSystemUsers).find(
            (u) =>
              u.email.toLowerCase() === lookupKey ||
              u.username.toLowerCase() === lookupKey
          );

        if (matchedOfficial) {
          const loggedUser: UserProfile = {
            id: `usr-${matchedOfficial.username}`,
            username: matchedOfficial.username,
            email: matchedOfficial.email,
            full_name: matchedOfficial.full_name,
            role: matchedOfficial.role,
            is_active: true,
          };
          const fallbackToken = `dev-token-${matchedOfficial.role}`;
          setUser(loggedUser);
          setToken(fallbackToken);
          localStorage.setItem('avicola_user', JSON.stringify(loggedUser));
          localStorage.setItem('avicola_token', fallbackToken);
          return loggedUser;
        }

        // Revisar usuarios locales guardados
        const localUsersStr = localStorage.getItem('avicola_registered_users');
        if (localUsersStr) {
          try {
            const localUsers: any[] = JSON.parse(localUsersStr);
            const found = localUsers.find(
              (u) =>
                (u.username?.toLowerCase() === cleanUser.toLowerCase() ||
                  u.email?.toLowerCase() === cleanUser.toLowerCase()) &&
                u.password === cleanPass
            );
            if (found) {
              if (!found.is_active) {
                throw new Error('Su cuenta se encuentra inactiva. Contacte al Administrador.');
              }
              const loggedUser: UserProfile = {
                id: found.id,
                username: found.username,
                email: found.email,
                full_name: found.full_name,
                role: found.role,
                is_active: true,
              };
              const fallbackToken = `dev-token-${found.role}`;
              setUser(loggedUser);
              setToken(fallbackToken);
              localStorage.setItem('avicola_user', JSON.stringify(loggedUser));
              localStorage.setItem('avicola_token', fallbackToken);
              return loggedUser;
            }
          } catch {
            // Ignorar error al parsear local
          }
        }

        throw new Error('Usuario o contraseña incorrectos. Verifique sus credenciales.');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignorar
    }
    localStorage.removeItem('avicola_user');
    localStorage.removeItem('avicola_token');
    setUser(null);
    setToken(null);
  };

  const switchMockRole = (role: UserRole) => {
    if (user) {
      const updated = { ...user, role };
      setUser(updated);
      localStorage.setItem('avicola_user', JSON.stringify(updated));
      localStorage.setItem('avicola_token', `dev-token-${role}`);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, switchMockRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
