import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/context/AuthContext';
import { LoginPage } from '../modules/auth/pages/LoginPage';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { UserRole } from '../types/auth';

const PecuariaDashboardPage = lazy(() =>
  import('../modules/pecuaria/pages/PecuariaDashboardPage').then((m) => ({
    default: m.PecuariaDashboardPage,
  }))
);
const ComercialPage = lazy(() =>
  import('../modules/comercial/pages/ComercialPage').then((m) => ({
    default: m.ComercialPage,
  }))
);
const GestionComercialPage = lazy(() =>
  import('../modules/gerencia/pages/GestionComercialPage').then((m) => ({
    default: m.GestionComercialPage,
  }))
);
const ControlFlotaPage = lazy(() =>
  import('../modules/flota/pages/ControlFlotaPage').then((m) => ({
    default: m.ControlFlotaPage,
  }))
);
const AdminPage = lazy(() =>
  import('../modules/admin/pages/AdminPage').then((m) => ({
    default: m.AdminPage,
  }))
);
const AccountPage = lazy(() =>
  import('../modules/account/pages/AccountPage').then((m) => ({
    default: m.AccountPage,
  }))
);
const NotificationsPage = lazy(() =>
  import('../modules/notifications/pages/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  }))
);

const RouteFallback: React.FC = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-2 text-slate-500">
    <div className="w-7 h-7 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
    <span className="text-xs font-medium">Cargando módulo...</span>
  </div>
);

export const getDefaultRouteForRole = (role?: UserRole): string => {
  switch (role) {
    case 'admin_sistema':
      return '/admin';
    case 'supervisor_pecuario':
    case 'registrador_pecuario':
      return '/pecuaria';
    case 'gestor_comercial':
    case 'gerente_comercial':
      return '/gestion-comercial';
    case 'vendedor':
      return '/comercial';
    case 'controlador_flota':
      return '/control-flota';
    default:
      return '/login';
  }
};

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-600 border-r-transparent" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">Validando sesión en Avícola GR...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return children;
};

export const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      {/* Ruta pública: Login */}
      <Route
        path="/login"
        element={user ? <Navigate to={getDefaultRouteForRole(user.role)} replace /> : <LoginPage />}
      />

      {/* Rutas protegidas dentro del DashboardLayout */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/"
          element={<Navigate to={user ? getDefaultRouteForRole(user.role) : '/login'} replace />}
        />
        <Route
          path="/pecuaria"
          element={
            <ProtectedRoute allowedRoles={['supervisor_pecuario', 'registrador_pecuario', 'admin_sistema']}>
              <PecuariaDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/comercial"
          element={
            <ProtectedRoute allowedRoles={['vendedor', 'admin_sistema']}>
              <ComercialPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gestion-comercial"
          element={
            <ProtectedRoute allowedRoles={['gestor_comercial', 'gerente_comercial', 'admin_sistema']}>
              <GestionComercialPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/control-flota"
          element={
            <ProtectedRoute allowedRoles={['controlador_flota', 'admin_sistema']}>
              <ControlFlotaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin_sistema']}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notificaciones"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cuenta"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route
        path="*"
        element={<Navigate to={user ? getDefaultRouteForRole(user.role) : '/login'} replace />}
      />
    </Routes>
    </Suspense>
  );
};
