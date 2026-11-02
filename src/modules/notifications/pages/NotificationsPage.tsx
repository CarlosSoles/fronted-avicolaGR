import React, { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  Scale,
  CheckCircle2,
  Clock,
  Check,
  Trash2,
  Truck,
  Bird,
  ShieldCheck,
  PackageCheck,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  useNotifications,
  NotificationItem,
  NotificationCategory,
} from '@/context/NotificationsContext';
import { useAuth } from '@/modules/auth/context/AuthContext';

const AREA_META: Record<
  NotificationCategory,
  {
    title: string;
    subtitle: string;
    badgeText: string;
    badgeColor: string;
    filters: { key: string; label: string }[];
  }
> = {
  pecuaria: {
    title: 'Centro de Alertas • Área Pecuaria',
    subtitle: 'Monitoreo en tiempo real de lotes en granja, saca prioritaria por edad (>45 días), pesajes y descartes.',
    badgeText: 'Módulo Pecuaria',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    filters: [
      { key: 'urgente', label: 'Saca > 45 Días' },
      { key: 'pesaje', label: 'Muestras de Pesaje' },
      { key: 'especiales', label: 'Aves Especiales' },
    ],
  },
  gestion_comercial: {
    title: 'Centro de Notificaciones • Gestión Comercial & Flota',
    subtitle: 'Aprobación de pedidos, confirmaciones de reserva en galpón, tracking de despacho de flota y cubicaje.',
    badgeText: 'Gestión Comercial',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    filters: [
      { key: 'aprobacion', label: 'Aprobaciones Pendientes' },
      { key: 'despacho', label: 'Flota & Despacho' },
      { key: 'observacion', label: 'Observaciones' },
      { key: 'reserva', label: 'Reservas Galpón' },
    ],
  },
  comercial: {
    title: 'Notificaciones Comerciales • Mis Ventas & Pedidos',
    subtitle: 'Estatus en tiempo real de tus pedidos solicitados: aprobaciones del gestor, observaciones y entregas a tus clientes.',
    badgeText: 'Área Comercial',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    filters: [
      { key: 'aprobado', label: 'Aprobados por Gestor' },
      { key: 'observacion', label: 'Acción Requerida' },
      { key: 'entrega', label: 'En Ruta / Entregados' },
    ],
  },
  admin: {
    title: 'Centro de Notificaciones & Auditoría TI',
    subtitle: 'Auditoría de accesos, creación de cuentas operativas, telemetría telemática de flota y sincronizaciones.',
    badgeText: 'Administración TI',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    filters: [
      { key: 'seguridad', label: 'Seguridad & Cuentas' },
      { key: 'telemetria', label: 'Telemetría GPS' },
      { key: 'sistema', label: 'Sincronización DB' },
    ],
  },
};

const getNotificationVisuals = (n: NotificationItem) => {
  switch (n.type) {
    case 'urgente':
      return {
        icon: <AlertTriangle className="w-4 h-4 text-white" />,
        bg: 'bg-rose-600',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
      };
    case 'pesaje':
      return {
        icon: <Scale className="w-4 h-4 text-white" />,
        bg: 'bg-blue-600',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
      };
    case 'especiales':
      return {
        icon: <Bird className="w-4 h-4 text-white" />,
        bg: 'bg-amber-600',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      };
    case 'aprobacion':
    case 'aprobado':
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-white" />,
        bg: 'bg-emerald-600',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      };
    case 'despacho':
    case 'entrega':
      return {
        icon: <Truck className="w-4 h-4 text-white" />,
        bg: 'bg-cyan-600',
        badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
      };
    case 'observacion':
      return {
        icon: <AlertTriangle className="w-4 h-4 text-white" />,
        bg: 'bg-amber-600',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      };
    case 'reserva':
      return {
        icon: <PackageCheck className="w-4 h-4 text-white" />,
        bg: 'bg-purple-600',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
      };
    case 'telemetria':
      return {
        icon: <Truck className="w-4 h-4 text-white" />,
        bg: 'bg-indigo-600',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
      };
    case 'seguridad':
    case 'sistema':
    default:
      return {
        icon: <ShieldCheck className="w-4 h-4 text-white" />,
        bg: 'bg-slate-700',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
      };
  }
};

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    currentCategory,
    markAllAsRead,
    toggleRead,
    clearNotifications,
  } = useNotifications();

  const [filter, setFilter] = useState<string>('todas');

  const meta = AREA_META[currentCategory] || AREA_META.admin;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'todas') return true;
    if (filter === 'no_leidas') return !n.read;
    return n.type === filter;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header específico según el área del usuario */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black border ${meta.badgeColor}`}>
              {meta.badgeText}
            </span>
            {user?.full_name && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                • {user.full_name}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-red-600" />
            <span>{meta.title}</span>
            {unreadCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                {unreadCount} nuevas
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                Al día
              </span>
            )}
          </h1>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            {meta.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              onClick={markAllAsRead}
              className="text-xs font-bold flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-xs"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Marcar todo como leído</span>
            </Button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearNotifications}
              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Limpiar mis notificaciones"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros adaptada a la especialidad operativa del usuario */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter('todas')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            filter === 'todas'
              ? 'bg-red-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          Todas ({notifications.length})
        </button>

        <button
          type="button"
          onClick={() => setFilter('no_leidas')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            filter === 'no_leidas'
              ? 'bg-red-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          No leídas ({unreadCount})
        </button>

        {meta.filters.map((f) => {
          const count = notifications.filter((n) => n.type === f.key).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filter === f.key
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  filter === f.key
                    ? 'bg-red-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lista de Notificaciones Segmentadas */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-80" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {unreadCount === 0 && filter === 'no_leidas'
                ? '¡Todo al día! No tienes notificaciones pendientes en tu área.'
                : 'No hay notificaciones con este filtro.'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Las nuevas alertas correspondientes a tu rol aparecerán aquí en tiempo real.
            </p>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const visual = getNotificationVisuals(n);

            return (
              <div
                key={n.id}
                onClick={() => toggleRead(n.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                  !n.read
                    ? 'bg-red-50/50 dark:bg-red-950/25 border-red-200 dark:border-red-900/60 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-85 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Icono con color específico */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${visual.bg}`}
                  >
                    {visual.icon}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {n.title}
                      </span>

                      {n.badgeText && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${visual.badgeClass}`}
                        >
                          {n.badgeText}
                        </span>
                      )}

                      {n.farmCode && (
                        <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Granja {n.farmCode}
                        </span>
                      )}

                      {n.orderId && (
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {n.orderId}
                        </span>
                      )}

                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-red-600 inline-block animate-pulse shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                      {n.description}
                    </p>

                    <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 pt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{n.time}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRead(n.id);
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 pt-0.5"
                >
                  {n.read ? 'Marcar no leída' : 'Marcar leída'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};