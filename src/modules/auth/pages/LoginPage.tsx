import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getDefaultRouteForRole } from '@/routes/AppRoutes';
import logoRocio from '@/img/logo_rocio.png';
import granjaAvicolaImg from '@/img/granja_avicola.png';
import {
  ShieldCheck,
  AlertCircle,
  Sun,
  Moon,
  Lock,
  User,
  Eye,
  EyeOff,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme, setTheme } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [slowWakeupNotice, setSlowWakeupNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) {
      setSlowWakeupNotice(false);
      return;
    }
    const timer = setTimeout(() => setSlowWakeupNotice(true), 3500);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().replace(/^@/, '');
    if (!cleanUser) {
      setErrorMessage('Por favor ingrese su usuario o correo corporativo.');
      return;
    }
    if (!password) {
      setErrorMessage('Por favor ingrese su contraseña.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const loggedUser = await login(cleanUser, password);
      const targetRoute = getDefaultRouteForRole(loggedUser.role);
      navigate(targetRoute);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al iniciar sesión. Verifique sus credenciales.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-200 overflow-x-hidden">
      {/* ========================================================================= */}
      {/* COLUMNA IZQUIERDA: HERO VISUAL CON LA IMAGEN DE LA GRANJA AVÍCOLA        */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-950 overflow-hidden select-none">
        {/* Imagen principal de la granja */}
        <img
          src={granjaAvicolaImg}
          alt="Granja Avícola GR"
          className="absolute inset-0 w-full h-full object-cover object-center transform scale-105 hover:scale-100 transition-transform duration-1000 ease-out"
        />

        {/* Capas de degradado para legibilidad y elegancia visual */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-950/30" />

        {/* Información corporativa flotante (Limpia, sin tarjetas superpuestas) */}
        <div className="relative z-10 p-12 flex flex-col justify-end h-full text-white">
          {/* Bloque de texto institucional inferior */}
          <div className="space-y-4 max-w-lg">
            <h1 className="text-3xl xl:text-4xl font-black text-white tracking-tight leading-tight">
              Control Integral de Pesaje, Saldo y Saca de Aves
            </h1>

            <p className="text-sm text-slate-200 font-medium leading-relaxed">
              Plataforma tecnológica de Avícola - Grupo Rocío para la supervisión de galpones, captura de pesajes ave por ave y sincronización comercial en tiempo real.
            </p>

            {/* Métricas clave en la base del banner */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20 text-xs">
              <div>
                <div className="text-2xl font-black font-mono text-white">23</div>
                <div className="text-slate-300 text-[11px] font-medium">Granjas en red</div>
              </div>
              <div>
                <div className="text-2xl font-black font-mono text-emerald-400">100%</div>
                <div className="text-slate-300 text-[11px] font-medium">Trazabilidad</div>
              </div>
              <div>
                <div className="text-2xl font-black font-mono text-white">En Vivo</div>
                <div className="text-slate-300 text-[11px] font-medium">Control de saca</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COLUMNA DERECHA: FORMULARIO DE ACCESO AL SISTEMA                         */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative overflow-y-auto">
        {/* Selector de Modo en la esquina superior derecha */}
        <div className="flex justify-end mb-4">
          <div className="flex items-center p-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                theme === 'light'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Modo Claro</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                theme === 'dark'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Modo Oscuro</span>
            </button>
          </div>
        </div>

        {/* Contenedor central del Formulario */}
        <div className="w-full max-w-md mx-auto my-auto space-y-6">
          {/* Header Corporativo con Logo Oficial (Sin Card) */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <img src={logoRocio} alt="Logo El Rocío" className="h-16 w-auto object-contain" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tight">
              Avícola - Grupo Rocío
            </h2>
            <p className="text-xs text-red-700 dark:text-red-400 font-bold uppercase tracking-widest">
              Sistema de Planificación de Saca &amp; Stock
            </p>
          </div>

          {/* Card de Inicio de Sesión */}
          <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-8 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors">
            <form className="space-y-4" onSubmit={handleSubmit}>
              {errorMessage && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-red-600" />
                  Usuario o Correo Corporativo
                </label>
                <Input
                  type="text"
                  placeholder="ej: admin o usuario@avicolagr.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-red-600 focus:border-red-600 text-sm py-2.5"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-red-600" />
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 font-medium transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
                  </button>
                </div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-red-600 focus:border-red-600 text-sm py-2.5"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white font-extrabold py-3 rounded-xl shadow-lg shadow-red-600/25 transition-all text-sm tracking-wide"
                isLoading={isLoading}
              >
                {slowWakeupNotice ? 'Conectando con el servidor...' : 'Iniciar Sesión'}
              </Button>
              {slowWakeupNotice && (
                <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                  El servidor estuvo en reposo y está iniciando; espere unos segundos.
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Footer institucional */}
        <div className="text-center text-[11px] text-slate-500 dark:text-slate-400 mt-6 font-medium">
          © {new Date().getFullYear()} Avícola GR S.A.C. • Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
};
