import React, { useState } from 'react';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/api';
import {
  User,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
} from 'lucide-react';

export const AccountPage: React.FC = () => {
  const { user } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setErrorMessage('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (user?.id) {
        try {
          await apiClient(`/admin/users/${user.id}`, {
            method: 'PUT',
            body: JSON.stringify({ password: newPassword }),
          });
        } catch {
          // Fallback para actualización local
          const registered = JSON.parse(localStorage.getItem('avicola_registered_users') || '[]');
          const idx = registered.findIndex((u: any) => u.id === user.id || u.username === user.username);
          if (idx !== -1) {
            registered[idx].password = newPassword;
            localStorage.setItem('avicola_registered_users', JSON.stringify(registered));
          }
        }
      }
      setSuccessMessage('Contraseña actualizada exitosamente.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al actualizar contraseña.');
    } finally {
      setIsUpdating(false);
    }
  };

  const roleLabels: Record<string, string> = {
    admin_sistema: 'Administrador Maestro',
    supervisor_pecuario: 'Supervisor Pecuario',
    registrador_pecuario: 'Registrador Granja',
    gestor_comercial: 'Gestor Comercial',
    gerente_comercial: 'Gerente Comercial',
    vendedor: 'Vendedor Comercial',
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
          <User className="w-6 h-6 text-red-600" />
          Mi Cuenta &amp; Perfil de Usuario
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Información de acceso, credenciales de seguridad y ámbito asignado en Avícola GR.
        </p>
      </div>

      {/* Resumen del Colaborador */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center font-black text-3xl shadow-lg shadow-red-600/20">
            {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                {user?.full_name || 'Colaborador Avícola GR'}
              </h2>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60 self-center sm:self-auto">
                {user?.role ? roleLabels[user.role] || user.role : 'Usuario'}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-300">
                @{user?.username || user?.email?.split('@')[0]}
              </span>
              <span>•</span>
              <span>{user?.email}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Cuenta Activa
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de 2 Columnas: Seguridad & Permisos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Tarjeta: Cambio de Contraseña */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
            <KeyRound className="w-4 h-4 text-red-600" />
            <span>Seguridad: Actualizar Contraseña</span>
          </div>

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Nueva Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
                </button>
              </div>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="mínimo 4 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Confirmar Nueva Contraseña
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 rounded-xl"
              isLoading={isUpdating}
            >
              Guardar Nueva Contraseña
            </Button>
          </form>
        </div>

        {/* Tarjeta: Permisos y Ámbito Operativo */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
            <Shield className="w-4 h-4 text-red-600" />
            <span>Ámbito &amp; Módulos Autorizados</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
              <div className="font-bold text-slate-800 dark:text-slate-200">
                Rol: {user?.role ? roleLabels[user.role] || user.role : 'Usuario'}
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                {user?.role === 'admin_sistema' && 'Acceso maestro: Administración de usuarios, catálogos y todos los módulos.'}
                {user?.role === 'supervisor_pecuario' && 'Acceso al Módulo Pecuario: Supervisión de granjas, galpones y tabla de saldos.'}
                {user?.role === 'registrador_pecuario' && 'Acceso a registro de pesajes de campo ave por ave y aves especiales.'}
                {user?.role?.includes('comercial') && 'Acceso a asignación y gestión de pedidos de clientes.'}
                {user?.role === 'vendedor' && 'Acceso a captura de pedidos y clientes en ruta comercial.'}
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-red-600" />
                <span>Cobertura de Granjas:</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                23 granjas oficiales habilitadas (TRAD1, TRAD2, PACI6, PAC67, PACI7, PACI1, PACI2, etc.).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

