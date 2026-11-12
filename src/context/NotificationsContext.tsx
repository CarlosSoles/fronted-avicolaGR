import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types/auth';

export type NotificationCategory = 'pecuaria' | 'gestion_comercial' | 'comercial' | 'control_flota' | 'admin';

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  targetRoles: UserRole[];
  farmCode?: string;
  orderId?: string;
  badgeText?: string;
}

interface ServerNotification {
  id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  description: string;
  badge?: string | null;
  farm_code?: string | null;
  order_id?: string | null;
  created_at: string;
  read: boolean;
}

export const getCategoryForRole = (role?: UserRole): NotificationCategory => {
  switch (role) {
    case 'supervisor_pecuario':
    case 'registrador_pecuario':
      return 'pecuaria';
    case 'gestor_comercial':
    case 'gerente_comercial':
      return 'gestion_comercial';
    case 'vendedor':
      return 'comercial';
    case 'controlador_flota':
      return 'control_flota';
    case 'admin_sistema':
    default:
      return 'admin';
  }
};

/** Convierte un timestamp ISO en una etiqueta relativa legible. */
const relativeTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return date.toLocaleDateString('es-PE');
};

interface NotificationsContextType {
  notifications: NotificationItem[];
  allNotifications: NotificationItem[];
  unreadCount: number;
  currentCategory: NotificationCategory;
  markAllAsRead: () => void;
  toggleRead: (id: string) => void;
  clearNotifications: () => void;
  refresh: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const currentRole = (user?.role || 'admin_sistema') as UserRole;
  const currentCategory = getCategoryForRole(currentRole);

  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    try {
      const data = await apiClient<ServerNotification[]>('/notifications');
      setItems(
        (data || []).map((n) => ({
          id: n.id,
          category: n.category,
          type: n.type,
          title: n.title,
          description: n.description,
          time: relativeTime(n.created_at),
          read: !!n.read,
          targetRoles: [],
          farmCode: n.farm_code || undefined,
          orderId: n.order_id || undefined,
          badgeText: n.badge || undefined,
        }))
      );
    } catch {
      // Sin conexión: se conserva lo último cargado
    }
  }, [userId]);

  useEffect(() => {
    load();
    // Realtime: refresca al instante cuando se inserta/actualiza una notificación
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => load()
      )
      .subscribe();

    // Fallback por sondeo en caso de que Realtime no esté disponible
    const timer = setInterval(load, 60000);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  // El backend ya filtra por rol o por usuario; el admin ve el panorama completo
  const scopedNotifications = useMemo(() => {
    if (currentRole === 'admin_sistema') return items;
    return items.filter((n) => n.category === currentCategory);
  }, [items, currentRole, currentCategory]);

  const unreadCount = useMemo(
    () => scopedNotifications.filter((n) => !n.read).length,
    [scopedNotifications]
  );

  const persistRead = (ids: string[], read: boolean) => {
    if (ids.length === 0) return;
    apiClient('/notifications/reads', {
      method: 'PUT',
      body: JSON.stringify({ keys: ids, read }),
    }).catch(() => {
      // Si falla la red, el cambio queda solo en pantalla
    });
  };

  const markAllAsRead = () => {
    const ids = scopedNotifications.filter((n) => !n.read).map((n) => n.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    persistRead(ids, true);
  };

  const toggleRead = (id: string) => {
    const target = items.find((n) => n.id === id);
    if (!target) return;
    const nowRead = !target.read;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: nowRead } : n)));
    persistRead([id], nowRead);
  };

  const clearNotifications = () => {
    const ids = scopedNotifications.map((n) => n.id);
    if (ids.length === 0) return;
    setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
    persistRead(ids, true);
  };

  return (
    <NotificationsContext.Provider
      value={{
        notifications: scopedNotifications,
        allNotifications: items,
        unreadCount,
        currentCategory,
        markAllAsRead,
        toggleRead,
        clearNotifications,
        refresh: load,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications debe usarse dentro de un NotificationsProvider');
  }
  return context;
};
