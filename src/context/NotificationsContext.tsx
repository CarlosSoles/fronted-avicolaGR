import React, { createContext, useContext, useState, useMemo } from 'react';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { UserRole } from '@/types/auth';

export type NotificationCategory = 'pecuaria' | 'gestion_comercial' | 'comercial' | 'admin';

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

const NOTIFICATIONS_VERSION = 'v2_role_scoped_2026';

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
    case 'admin_sistema':
    default:
      return 'admin';
  }
};

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  // =========================================================================
  // 1. ÁREA PECUARIA (supervisor_pecuario, registrador_pecuario)
  // =========================================================================
  {
    id: 'pec-1',
    category: 'pecuaria',
    type: 'urgente',
    title: 'Galpón G-01 con Edad > 45 Días en Tradisa 1 (TRAD1)',
    description: 'El lote ha alcanzado 45.4 días de crianza. Prioridad alta para cierre de saca y pesaje de control ave por ave.',
    time: 'Hace 10 min',
    read: false,
    farmCode: 'TRAD1',
    targetRoles: ['supervisor_pecuario', 'registrador_pecuario'],
    badgeText: 'Edad Crítica',
  },
  {
    id: 'pec-2',
    category: 'pecuaria',
    type: 'pesaje',
    title: 'Muestra Técnica de Pesaje Registrada en Pacifico 6 (PACI6)',
    description: 'Se registró muestra ave por ave de 100 ejemplares en Galpón G-02. Peso promedio obtenido: 2.58 kg (Óptimo para saca).',
    time: 'Hace 45 min',
    read: false,
    farmCode: 'PACI6',
    targetRoles: ['supervisor_pecuario', 'registrador_pecuario'],
    badgeText: 'Muestreo ave por ave',
  },
  {
    id: 'pec-3',
    category: 'pecuaria',
    type: 'especiales',
    title: 'Deducción de Aves Especiales (Descartes) en Santa Isabel 1 (SISA1)',
    description: 'Se clasificaron 38 aves especiales en Galpón G-05. El saldo comercializable fue ajustado automáticamente en la Tabla General de Saldo.',
    time: 'Hace 2 horas',
    read: true,
    farmCode: 'SISA1',
    targetRoles: ['supervisor_pecuario', 'registrador_pecuario'],
    badgeText: 'Aves Especiales',
  },
  {
    id: 'pec-4',
    category: 'pecuaria',
    type: 'urgente',
    title: 'Galpón G-03 en Puerto Mori 2 (MORI2) Próximo a Cumplir Ciclo',
    description: 'Lote con 44.1 días de crianza. Se recomienda programar pesaje técnico previo a la asignación de pedidos comerciales.',
    time: 'Hace 3 horas',
    read: true,
    farmCode: 'MORI2',
    targetRoles: ['supervisor_pecuario', 'registrador_pecuario'],
    badgeText: 'Monitoreo 44 días',
  },

  // =========================================================================
  // 2. ÁREA DE GESTIÓN COMERCIAL (gestor_comercial, gerente_comercial)
  // =========================================================================
  {
    id: 'gest-1',
    category: 'gestion_comercial',
    type: 'aprobacion',
    title: 'Nuevo Pedido Pendiente de Aprobación • Supermercados Metro',
    description: 'Pedido de 5,000 aves (12.3 Ton) para el 04/11/2026 en Zona Norte. Galpón sugerido PACI6 (G-02). Requiere validación de cupo y asignación.',
    time: 'Hace 15 min',
    read: false,
    orderId: 'PED-2026-002',
    targetRoles: ['gestor_comercial', 'gerente_comercial'],
    badgeText: 'Pendiente Gestor',
  },
  {
    id: 'gest-2',
    category: 'gestion_comercial',
    type: 'despacho',
    title: 'Unidad de Transporte en Tránsito Carretera • T8C-940',
    description: 'Camión T8C-940 (Chofer Carlos Méndez) cargó 4,000 aves en TRAD1 (G-01) y avanza en ruta hacia Distribuidora Santa Anita S.A.C.',
    time: 'Hace 30 min',
    read: false,
    orderId: 'PED-2026-001',
    targetRoles: ['gestor_comercial', 'gerente_comercial'],
    badgeText: 'En Tránsito GPS',
  },
  {
    id: 'gest-3',
    category: 'gestion_comercial',
    type: 'observacion',
    title: 'Pedido con Observación Comercial • Mercados del Norte',
    description: 'Pedido de 2,500 aves para el 05/11/2026 observado por discrepancia en el rango de peso solicitado (2.40 - 2.70 kg macho). Pendiente de regularizar.',
    time: 'Hace 1 hora',
    read: false,
    orderId: 'PED-2026-004',
    targetRoles: ['gestor_comercial', 'gerente_comercial'],
    badgeText: 'Observación Activa',
  },
  {
    id: 'gest-4',
    category: 'gestion_comercial',
    type: 'reserva',
    title: 'Reserva Confirmada de Galpón • Distribuidora Santa Anita S.A.C.',
    description: 'Galpón Tradisa 1 (G-01) reservado formalmente con 4,000 aves machos. Saldo remanente de galpón: 8,500 aves.',
    time: 'Hace 4 horas',
    read: true,
    orderId: 'PED-2026-001',
    targetRoles: ['gestor_comercial', 'gerente_comercial'],
    badgeText: 'Reserva Saca',
  },
  {
    id: 'gest-5',
    category: 'gestion_comercial',
    type: 'despacho',
    title: 'Hoja de Manifiesto Generada para Flota Jaulera',
    description: 'Manifiesto de saca listo para cuadrilla y chofer Carlos Méndez Rojas en rampa TRAD1 (500 jaulas / 9.4 Ton).',
    time: 'Hace 5 horas',
    read: true,
    targetRoles: ['gestor_comercial', 'gerente_comercial'],
    badgeText: 'Logística Flota',
  },

  // =========================================================================
  // 3. ÁREA COMERCIAL / VENTAS (vendedor)
  // =========================================================================
  {
    id: 'com-1',
    category: 'comercial',
    type: 'aprobado',
    title: '¡Tu Pedido fue Aprobado! • Distribuidora Santa Anita S.A.C.',
    description: 'El Gestor Comercial aprobó tu orden de 4,000 aves (OC-4890) con salida desde Galpón TRAD1 G-01. Transporte T8C-940 asignado.',
    time: 'Hace 20 min',
    read: false,
    orderId: 'PED-2026-001',
    targetRoles: ['vendedor'],
    badgeText: 'Aprobado Gestor',
  },
  {
    id: 'com-2',
    category: 'comercial',
    type: 'entrega',
    title: 'Despacho en Ruta hacia tu Cliente • Distribuidora Santa Anita',
    description: 'El camión con la carga de 4,000 aves ya salió de granja y se encuentra en carretera hacia Santa Anita. Llegada estimada a tiempo.',
    time: 'Hace 40 min',
    read: false,
    orderId: 'PED-2026-001',
    targetRoles: ['vendedor'],
    badgeText: 'En Tránsito',
  },
  {
    id: 'com-3',
    category: 'comercial',
    type: 'observacion',
    title: 'Pedido Observado para Corrección • Mercados del Norte',
    description: 'Gestión Comercial observó tu pedido OC-UNI-55 (2,500 aves) por rango de peso no disponible en SISA1. Por favor coordina con el cliente el ajuste.',
    time: 'Hace 1 hora',
    read: false,
    orderId: 'PED-2026-004',
    targetRoles: ['vendedor'],
    badgeText: 'Acción Requerida',
  },
  {
    id: 'com-4',
    category: 'comercial',
    type: 'aprobado',
    title: 'Programación Registrada con Éxito • Pollerías Norky\'s Corp',
    description: 'Tu pedido por 3,000 aves hembras (OC-9921) fue ingresado correctamente y está en cola de revisión para la fecha 04/11/2026.',
    time: 'Hace 3 horas',
    read: true,
    orderId: 'PED-2026-003',
    targetRoles: ['vendedor'],
    badgeText: 'En Cola Gestor',
  },

  // =========================================================================
  // 4. ADMINISTRACIÓN / TI (admin_sistema)
  // =========================================================================
  {
    id: 'adm-1',
    category: 'admin',
    type: 'seguridad',
    title: 'Usuario Comercial Registrado y Activo',
    description: 'Se confirmó el acceso operativo de la ejecutiva María Elena Rodríguez Soto (@vendedor2) para el Área Comercial.',
    time: 'Hace 15 min',
    read: false,
    targetRoles: ['admin_sistema'],
    badgeText: 'Usuarios TI',
  },
  {
    id: 'adm-2',
    category: 'admin',
    type: 'telemetria',
    title: 'Monitoreo de Telemetría GPS en Vivo',
    description: 'El vehículo T8C-940 sincronizó 371 puntos de ruta real OSRM entre Granja Tradición 1 y Mercado Santa Anita.',
    time: 'Hace 1 hora',
    read: false,
    targetRoles: ['admin_sistema'],
    badgeText: 'GPS Flota',
  },
  {
    id: 'adm-3',
    category: 'admin',
    type: 'sistema',
    title: 'Sincronización de Base de Datos Exitosa',
    description: 'Sincronización completada: 23 granjas oficiales, saldos diarios y catálogo de usuarios persistidos en PostgreSQL.',
    time: 'Hace 3 horas',
    read: true,
    targetRoles: ['admin_sistema'],
    badgeText: 'PostgreSQL Sync',
  },
  {
    id: 'adm-4',
    category: 'admin',
    type: 'seguridad',
    title: 'Auditoría de Roles y Permisos RBAC',
    description: 'Se verificó la separación estricta de rutas: Módulo Pecuaria, Gestión Comercial, Área Comercial y Panel Administrador.',
    time: 'Hace 6 horas',
    read: true,
    targetRoles: ['admin_sistema'],
    badgeText: 'Seguridad RBAC',
  },
];

interface NotificationsContextType {
  notifications: NotificationItem[];
  allNotifications: NotificationItem[];
  unreadCount: number;
  currentCategory: NotificationCategory;
  markAllAsRead: () => void;
  toggleRead: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [allNotifications, setAllNotifications] = useState<NotificationItem[]>(() => {
    try {
      const storedVer = localStorage.getItem('avicola_notifications_version');
      const stored = localStorage.getItem('avicola_notifications');
      if (storedVer === NOTIFICATIONS_VERSION && stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    try {
      localStorage.setItem('avicola_notifications_version', NOTIFICATIONS_VERSION);
      localStorage.setItem('avicola_notifications', JSON.stringify(DEFAULT_NOTIFICATIONS));
    } catch {
      // ignore
    }
    return DEFAULT_NOTIFICATIONS;
  });

  const saveNotifications = (newList: NotificationItem[]) => {
    setAllNotifications(newList);
    try {
      localStorage.setItem('avicola_notifications', JSON.stringify(newList));
    } catch {
      // ignore
    }
  };

  const currentRole = user?.role || 'admin_sistema';
  const currentCategory = getCategoryForRole(currentRole);

  // Filtrar estrictamente las notificaciones que pertenecen al área/rol del usuario conectado
  const scopedNotifications = useMemo(() => {
    return allNotifications.filter((n) => {
      if (n.targetRoles && n.targetRoles.includes(currentRole)) return true;
      return n.category === currentCategory;
    });
  }, [allNotifications, currentRole, currentCategory]);

  const scopedUnreadCount = useMemo(() => {
    return scopedNotifications.filter((n) => !n.read).length;
  }, [scopedNotifications]);

  const markAllAsRead = () => {
    const scopedIds = new Set(scopedNotifications.map((n) => n.id));
    const updated = allNotifications.map((n) =>
      scopedIds.has(n.id) ? { ...n, read: true } : n
    );
    saveNotifications(updated);
  };

  const toggleRead = (id: string) => {
    const updated = allNotifications.map((n) =>
      n.id === id ? { ...n, read: !n.read } : n
    );
    saveNotifications(updated);
  };

  const clearNotifications = () => {
    const scopedIds = new Set(scopedNotifications.map((n) => n.id));
    const updated = allNotifications.filter((n) => !scopedIds.has(n.id));
    saveNotifications(updated);
  };

  return (
    <NotificationsContext.Provider
      value={{
        notifications: scopedNotifications,
        allNotifications,
        unreadCount: scopedUnreadCount,
        currentCategory,
        markAllAsRead,
        toggleRead,
        clearNotifications,
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

