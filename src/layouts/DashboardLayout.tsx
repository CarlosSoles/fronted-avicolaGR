import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../modules/auth/context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationsContext';
import { Button } from '../components/ui/Button';
import { UserRole } from '../types/auth';
import logoRocio from '../img/logo_rocio.png';
import {
  Bird,
  ShoppingCart,
  Sliders,
  Settings,
  LogOut,
  ChevronDown,
  Layers,
  Menu,
  X,
  ShieldCheck,
  Sun,
  Moon,
  Bell,
  User,
  Truck,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const { user, logout, switchMockRole } = useAuth();
  const { theme, setTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('avicola_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('avicola_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleLabels: Record<
    UserRole,
    { label: string; color: 'emerald' | 'blue' | 'purple' | 'amber' | 'slate' | 'rose' }
  > = {
    supervisor_pecuario: { label: 'Supervisor Pecuario', color: 'rose' },
    registrador_pecuario: { label: 'Registrador Granja', color: 'amber' },
    gestor_comercial: { label: 'Gestor Comercial', color: 'blue' },
    gerente_comercial: { label: 'Gerente Comercial', color: 'purple' },
    vendedor: { label: 'Vendedor', color: 'slate' },
    controlador_flota: { label: 'Controlador de Flota', color: 'emerald' },
    admin_sistema: { label: 'Administrador Maestro', color: 'slate' },
  };

  // Módulos principales según roles
  const operationalNavItems = [
    {
      to: '/admin',
      label: 'Módulo Admin',
      sublabel: 'Usuarios & Sistema',
      icon: Settings,
      allowedRoles: ['admin_sistema'],
    },
    {
      to: '/pecuaria',
      label: 'Módulo Pecuaria',
      sublabel: 'Tabla General de Saldo',
      icon: Bird,
      allowedRoles: ['supervisor_pecuario', 'registrador_pecuario', 'admin_sistema'],
    },
    {
      to: '/comercial',
      label: 'Área Comercial',
      sublabel: 'Pedidos & Programación',
      icon: ShoppingCart,
      allowedRoles: ['vendedor', 'admin_sistema'],
    },
    {
      to: '/gestion-comercial',
      label: 'Gestión Comercial',
      sublabel: 'Asignación & Reservas',
      icon: Sliders,
      allowedRoles: ['gestor_comercial', 'gerente_comercial', 'admin_sistema'],
    },
    {
      to: '/control-flota',
      label: 'Control de Flota',
      sublabel: 'Transporte & Distribución',
      icon: Truck,
      allowedRoles: ['controlador_flota', 'admin_sistema'],
    },
  ];

  // Opciones generales: Notificaciones y Cuenta
  const generalNavItems = [
    {
      to: '/notificaciones',
      label: 'Notificaciones',
      sublabel: unreadCount > 0 ? `${unreadCount} pendientes` : 'Al día',
      icon: Bell,
      badge: unreadCount > 0 ? String(unreadCount) : undefined,
    },
    {
      to: '/cuenta',
      label: 'Mi Cuenta',
      sublabel: 'Perfil & Seguridad',
      icon: User,
    },
  ];

  const currentRoleInfo = user ? roleLabels[user.role] : { label: 'Invitado', color: 'slate' as const };
  const visibleOperationalItems = operationalNavItems.filter((item) => user && item.allowedRoles.includes(user.role));

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row antialiased font-sans transition-colors duration-200">
      {/* ========================================================================= */}
      {/* SIDEBAR DESKTOP COLAPSABLE (h-screen, sticky, NO SCROLL GENERAL)          */}
      {/* ========================================================================= */}
      <aside
        className={`hidden md:flex h-screen flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 shadow-sm transition-all duration-300 ease-in-out z-30 ${
          isSidebarCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Brand Header con Logo Oficial El Rocío */}
        <div
          className={`h-20 px-4 flex items-center ${
            isSidebarCollapsed ? 'justify-center' : 'justify-between'
          } border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors shrink-0 overflow-hidden`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoRocio}
              alt="Logo El Rocío"
              className="h-11 w-auto max-w-[50px] object-contain shrink-0 cursor-pointer"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? 'Desglosar panel lateral' : 'Esconder panel lateral'}
            />
            {!isSidebarCollapsed && (
              <div className="truncate animate-fade-in">
                <div className="font-black text-sm tracking-tight text-slate-950 dark:text-slate-50 truncate">
                  Avícola - Grupo Rocío
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 font-bold truncate">
                  {user?.role?.includes('pecuario')
                    ? 'Módulo Pecuario'
                    : user?.role === 'admin_sistema'
                    ? 'Administración General'
                    : 'Planificación de Saca & Stock'}
                </p>
              </div>
            )}
          </div>

          {!isSidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              title="Esconder panel lateral"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <PanelLeftClose className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          )}
        </div>

        {/* Navigation Links - Scroll independiente solo dentro del menú */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto min-h-0">
          {/* Sección 1: Módulos Autorizados */}
          <div className="space-y-1.5">
            {!isSidebarCollapsed ? (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Módulos Autorizados
              </div>
            ) : (
              <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
            )}
            {visibleOperationalItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={`${item.label} — ${item.sublabel}`}
                  className={({ isActive }) =>
                    `group relative flex items-center ${
                      isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3.5 px-3.5 py-2.5'
                    } rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-red-50 text-red-700 border border-red-200 shadow-xs dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 group-hover:border-slate-300 dark:group-hover:border-slate-600 transition-colors shrink-0">
                    <Icon className="w-4 h-4 text-inherit" />
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex-1 truncate">
                      <div className="truncate text-xs font-bold">{item.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 font-normal truncate">
                        {item.sublabel}
                      </div>
                    </div>
                  )}

                  {/* Tooltip flotante en modo colapsado */}
                  {isSidebarCollapsed && (
                    <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                      <div className="font-bold">{item.label}</div>
                      <div className="text-[10px] text-slate-300 font-normal">{item.sublabel}</div>
                    </div>
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* Sección 2: Comunicación & Mi Cuenta */}
          <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            {!isSidebarCollapsed ? (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Comunicación &amp; Perfil
              </div>
            ) : (
              <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
            )}
            {generalNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={`${item.label} — ${item.sublabel}`}
                  className={({ isActive }) =>
                    `group relative flex items-center ${
                      isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3.5 px-3.5 py-2.5'
                    } rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-red-50 text-red-700 border border-red-200 shadow-xs dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 group-hover:border-slate-300 dark:group-hover:border-slate-600 transition-colors shrink-0 relative">
                    <Icon className="w-4 h-4 text-inherit" />
                    {isSidebarCollapsed && item.badge && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-600" />
                    )}
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex-1 truncate">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-xs font-bold">{item.label}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-red-600 text-white">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 font-normal truncate">
                        {item.sublabel}
                      </div>
                    </div>
                  )}

                  {/* Tooltip flotante en modo colapsado */}
                  {isSidebarCollapsed && (
                    <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                      <div className="font-bold flex items-center gap-2">
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-red-600 text-white">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-300 font-normal">{item.sublabel}</div>
                    </div>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* ===================================================================== */}
        {/* FOOTER USER CARD                                                      */}
        {/* ===================================================================== */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 transition-colors shrink-0">
          {!isSidebarCollapsed ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs space-y-2.5 animate-fade-in">
              <div
                onClick={() => navigate('/cuenta')}
                className="flex items-center gap-2.5 cursor-pointer group"
                title="Ir a mi cuenta"
              >
                <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-red-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
                </div>
                <div className="truncate flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-red-600 transition-colors truncate">
                    {user?.full_name || 'Usuario'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-mono">
                    @{user?.username || user?.email?.split('@')[0]}
                  </div>
                </div>
              </div>

              {/* Rol del usuario y botón estandarizado de Cerrar Sesión */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {currentRoleInfo.label}
                </span>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-600 dark:text-red-400 hover:text-white hover:bg-red-600 dark:hover:text-white dark:hover:bg-red-600 border border-red-200 dark:border-red-900/60 transition-all cursor-pointer shadow-2xs shrink-0"
                  title="Cerrar sesión del sistema"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <div
                onClick={() => navigate('/cuenta')}
                className="w-9 h-9 rounded-full bg-slate-900 dark:bg-red-600 text-white flex items-center justify-center text-xs font-bold cursor-pointer hover:ring-2 hover:ring-red-500 transition-all shadow-xs"
                title={`${user?.full_name || 'Usuario'} — Ir a mi cuenta`}
              >
                {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400 hover:text-white hover:bg-red-600 dark:hover:text-white dark:hover:bg-red-600 border border-red-200 dark:border-red-900/60 transition-all cursor-pointer shadow-2xs"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE TOPBAR */}
      {/* ========================================================================= */}
      <header className="md:hidden h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between transition-colors shrink-0">
        <div className="flex items-center gap-2.5">
          <img src={logoRocio} alt="Logo El Rocío" className="h-9 w-auto object-contain shrink-0" />
          <span className="font-black text-slate-950 dark:text-slate-50 text-sm">Avícola - Grupo Rocío</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Selector de Modo Segmentado Mobile */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-1.5 rounded-md transition-all ${
                theme === 'light' ? 'bg-white text-amber-500 shadow-xs' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Modo Claro"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-1.5 rounded-md transition-all ${
                theme === 'dark' ? 'bg-slate-900 text-blue-400 shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Modo Oscuro"
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MOBILE MENU MODAL */}
      {/* ========================================================================= */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col p-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl flex-1 flex flex-col border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-lg text-slate-900 dark:text-slate-100">Menú de Navegación</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 py-6 space-y-2 overflow-y-auto">
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider px-2">Módulos</div>
              {visibleOperationalItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 font-semibold text-sm"
                >
                  <item.icon className="w-5 h-5 text-red-600" />
                  <div>
                    <div>{item.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">{item.sublabel}</div>
                  </div>
                </NavLink>
              ))}

              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider px-2 pt-4">General</div>
              {generalNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 font-semibold text-sm"
                >
                  <item.icon className="w-5 h-5 text-red-600" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">{item.sublabel}</div>
                  </div>
                </NavLink>
              ))}
            </div>
            <Button variant="danger" onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700">
              Cerrar Sesión
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA CON SCROLL INDEPENDIENTE */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto min-h-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        {/* Topbar sticky con acceso directo a Cuenta, Notificaciones y Salir */}
        <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-20 shadow-2xs transition-colors duration-200 shrink-0">
          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
            {/* Botón toggle para escritorio: permite desglosar y esconder el panel lateral */}
            <button
              type="button"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? 'Desglosar panel de módulos' : 'Esconder panel de módulos'}
              className="hidden md:inline-flex p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors mr-1 cursor-pointer"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-red-600 dark:text-red-400" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              )}
            </button>
            <Layers className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-slate-100">Avícola - Grupo Rocío</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-slate-600 dark:text-slate-400 hidden sm:inline">Sistema Integral de Saca &amp; Stock</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Acceso directo a Notificaciones */}
            <NavLink
              to="/notificaciones"
              title={unreadCount > 0 ? `${unreadCount} notificaciones no leídas` : 'Notificaciones (al día)'}
              className={({ isActive }) =>
                `p-2 rounded-xl border relative transition-colors ${
                  isActive
                    ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`
              }
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </NavLink>

            {/* Acceso directo a Mi Cuenta */}
            <NavLink
              to="/cuenta"
              title="Mi Cuenta"
              className={({ isActive }) =>
                `flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors ${
                  isActive
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`
              }
            >
              <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-red-600 text-white flex items-center justify-center text-[10px] font-bold">
                {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
              </div>
              <span className="text-xs font-bold truncate max-w-[100px] hidden sm:inline">
                {user?.full_name?.split(' ')[0] || 'Cuenta'}
              </span>
            </NavLink>

            {/* Selector de Modo: Claro / Oscuro (solo escritorio; en móvil está en la barra superior) */}
            <div className="hidden md:flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  theme === 'light'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
                title="Modo Claro"
              >
                <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-500' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">Claro</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900 text-white shadow-xs border border-slate-700'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
                title="Modo Oscuro"
              >
                <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-blue-400' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">Oscuro</span>
              </button>
            </div>
          </div>
        </div>

        {/* Page Container fluido para máxima amplitud al colapsar el menú */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-[1720px] mx-auto transition-all duration-300">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
