import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/context/AuthContext';
import { LoginPage } from '../modules/auth/pages/LoginPage';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { PecuariaDashboardPage } from '../modules/pecuaria/pages/PecuariaDashboardPage';
import { ComercialPage } from '../modules/comercial/pages/ComercialPage';
import { GestionComercialPage } from '../modules/gerencia/pages/GestionComercialPage';
import { AdminPage } from '../modules/admin/pages/AdminPage';
import { AccountPage } from '../modules/account/pages/AccountPage';
import { NotificationsPage } from '../modules/notifications/pages/NotificationsPage';
import { UserRole } from '../types/auth';

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
  );
};
