import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { UserProfile, UserRole } from '@/types/auth';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ModuleTabs } from '@/components/ui/ModuleTabs';
import { KpiCard } from '@/components/ui/KpiCard';
import {
  ZoneCageDensity,
  DEFAULT_ZONE_DENSITIES,
  MIN_DENSITY,
  MAX_DENSITY,
  clampDensity,
} from '@/types/comercial';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Key,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Database,
  Sliders,
  RefreshCw,
  AlertTriangle,
  Building2,
  Layers,
  Lock,
  UserCheck,
  Check,
  X,
  Eye,
  EyeOff,
  Truck,
  MapPin,
  ExternalLink,
  Save,
} from 'lucide-react';
import { AdminGpsSimulationPanel } from '../components/AdminGpsSimulationPanel';

interface FarmItem {
  code: string;
  name: string;
  barns_count: number;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
}

const ROLE_DEFINITIONS: Record<
  UserRole,
  { label: string; description: string; color: string; badgeClass: string }
> = {
  admin_sistema: {
    label: 'Administrador TI / Maestro',
    description: 'Acceso total y exclusivo para creación/gestión de usuarios y configuración.',
    color: 'slate',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  },
  supervisor_pecuario: {
    label: 'Supervisor Pecuario',
    description: 'Control de granjas, galpones, tabla general de saldo y registro de saca.',
    color: 'rose',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60',
  },
  registrador_pecuario: {
    label: 'Registrador Granja',
    description: 'Registro de muestras de pesaje ave por ave y aves especiales en galpón.',
    color: 'amber',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60',
  },
  gestor_comercial: {
    label: 'Gestor Comercial',
    description: 'Planificación comercial, asignación de pedidos a galpones y reservas.',
    color: 'blue',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60',
  },
  gerente_comercial: {
    label: 'Gerente Comercial',
    description: 'Aprobación de excepciones, límites de sobreventa y políticas comerciales.',
    color: 'purple',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/60',
  },
  vendedor: {
    label: 'Vendedor Comercial',
    description: 'Captura y registro de pedidos de clientes en rutas comerciales.',
    color: 'emerald',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60',
  },
  controlador_flota: {
    label: 'Controlador de Flota',
    description: 'Asignación de camiones a pedidos programados y administración de la flota de distribución.',
    color: 'cyan',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-900/60',
  },
};

const OFFICIAL_FARMS_FALLBACK: FarmItem[] = [
  { code: 'TRAD1', name: 'Tradisa 1', barns_count: 10, status: 'OPERATIVO' },
  { code: 'TRAD2', name: 'Tradisa II', barns_count: 10, status: 'OPERATIVO' },
  { code: 'PACI6', name: 'Pacifico 6', barns_count: 10, status: 'OPERATIVO' },
  { code: 'PAC67', name: 'San Jose 3', barns_count: 10, status: 'OPERATIVO' },
  { code: 'PACI7', name: 'San Jose 2', barns_count: 10, status: 'OPERATIVO' },
  { code: 'PACI1', name: 'Pacifico 1', barns_count: 10, status: 'OPERATIVO' },
  { code: 'PACI2', name: 'Pacifico 2', barns_count: 10, status: 'OPERATIVO' },
  { code: 'PACI5', name: 'San Jose 1', barns_count: 10, status: 'OPERATIVO' },
  { code: 'SISA2', name: 'Santa Isabel 2', barns_count: 10, status: 'OPERATIVO' },
  { code: 'SEMIA', name: 'Semillero A', barns_count: 10, status: 'OPERATIVO' },
  { code: 'SISA3', name: 'Santa Isabel 3', barns_count: 10, status: 'OPERATIVO' },
  { code: 'SISA1', name: 'Santa Isabel 1', barns_count: 10, status: 'OPERATIVO' },
  { code: 'SEMIB', name: 'Semillero B', barns_count: 10, status: 'OPERATIVO' },
  { code: 'NUC-9', name: 'Nucleo 9', barns_count: 10, status: 'OPERATIVO' },
  { code: 'R4G-B', name: 'R4GB', barns_count: 10, status: 'OPERATIVO' },
  { code: 'NUC-B', name: 'Nucleo B', barns_count: 10, status: 'OPERATIVO' },
  { code: 'ESMER', name: 'Esmeralda', barns_count: 10, status: 'OPERATIVO' },
  { code: 'R4G-C', name: 'R4GC', barns_count: 10, status: 'OPERATIVO' },
  { code: 'R4G-A', name: 'R4GA', barns_count: 10, status: 'OPERATIVO' },
  { code: 'QBAGA', name: 'Quebaga', barns_count: 10, status: 'OPERATIVO' },
  { code: 'MORI2', name: 'Puerto Mori 2', barns_count: 10, status: 'OPERATIVO' },
  { code: '507', name: '507', barns_count: 10, status: 'OPERATIVO' },
  { code: 'HARC2', name: 'Harco 2', barns_count: 10, status: 'OPERATIVO' },
];

export const OFFICIAL_DEFAULT_USERS: UserProfile[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    username: 'admin',
    email: 'admin@avicolagr.com',
    full_name: 'Administrador General',
    role: 'admin_sistema',
    is_active: true,
    created_at: '2026-10-01T08:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    username: 'areacomercial1',
    email: 'areacomercial@avicola.gr',
    full_name: 'Felipe',
    role: 'vendedor',
    is_active: true,
    created_at: '2026-10-10T09:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    username: 'vendedor1',
    email: 'jperez@avicola.gr',
    full_name: 'Juan Carlos Pérez Gálvez',
    role: 'vendedor',
    is_active: true,
    created_at: '2026-10-15T09:30:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    username: 'vendedor2',
    email: 'mrodriguez@avicola.gr',
    full_name: 'María Elena Rodríguez Soto',
    role: 'vendedor',
    is_active: true,
    created_at: '2026-10-20T10:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    username: 'gestor_comercial',
    email: 'gestorcomercial2@avicola.gr',
    full_name: 'Ramiro Vega Zabaleta',
    role: 'gestor_comercial',
    is_active: true,
    created_at: '2026-10-25T08:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    username: 'pecuaria1',
    email: 'pecuaria1@avicola.gr',
    full_name: 'Jorge Alfaro Chavez',
    role: 'registrador_pecuario',
    is_active: true,
    created_at: '2026-10-28T08:00:00Z',
  },
];

export const AdminPage: React.FC = () => {
  const { user: currentUser } = useAuth();

  // Estados de navegación interna
  const [activeTab, setActiveTab] = useState<'usuarios' | 'granjas' | 'parametros' | 'simulador_gps'>('usuarios');

  // Estados de Gestión de Usuarios
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  // Formulario Crear Usuario
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'supervisor_pecuario' as UserRole,
    is_active: true,
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Formulario Editar Usuario
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    role: 'supervisor_pecuario' as UserRole,
    is_active: true,
    newPassword: '',
  });

  // Granjas
  const [farms, setFarms] = useState<FarmItem[]>(OFFICIAL_FARMS_FALLBACK);
  const [loadingFarms, setLoadingFarms] = useState(false);
  const [farmSearch, setFarmSearch] = useState('');

  // Modal de Coordenadas de Granja
  const [editingFarmCoords, setEditingFarmCoords] = useState<FarmItem | null>(null);
  const [farmCoordInput, setFarmCoordInput] = useState<string>('');
  const [farmLat, setFarmLat] = useState<string>('');
  const [farmLng, setFarmLng] = useState<string>('');
  const [isSavingFarmCoords, setIsSavingFarmCoords] = useState<boolean>(false);

  const handleOpenFarmCoordsModal = (farm: FarmItem) => {
    setEditingFarmCoords(farm);
    const latStr = farm.latitude !== null && farm.latitude !== undefined ? String(farm.latitude) : '';
    const lngStr = farm.longitude !== null && farm.longitude !== undefined ? String(farm.longitude) : '';
    setFarmLat(latStr);
    setFarmLng(lngStr);
    setFarmCoordInput(latStr && lngStr ? `${latStr}, ${lngStr}` : '');
  };

  const handleParseFarmCoords = (input: string) => {
    setFarmCoordInput(input);
    const match = input.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    if (match) {
      setFarmLat(match[1]);
      setFarmLng(match[2]);
    }
  };

  const handleSaveFarmCoords = async () => {
    if (!editingFarmCoords) return;
    setIsSavingFarmCoords(true);
    try {
      const lat = farmLat ? parseFloat(farmLat) : null;
      const lng = farmLng ? parseFloat(farmLng) : null;

      // Solo se confirma el guardado si el servidor lo aceptó
      const saved = await apiClient<FarmItem>(`/admin/farms/${editingFarmCoords.code}/coordinates`, {
        method: 'PUT',
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });

      const updated = farms.map((f) =>
        f.code === editingFarmCoords.code
          ? { ...f, latitude: saved?.latitude ?? lat, longitude: saved?.longitude ?? lng }
          : f
      );
      setFarms(updated);
      localStorage.setItem('avicola_admin_farms_coords', JSON.stringify(updated));
      showNotification(`✔ Coordenadas satelitales de "${editingFarmCoords.name}" guardadas exitosamente.`);
      setEditingFarmCoords(null);
    } catch (err: any) {
      showNotification(`❌ No se pudieron guardar las coordenadas: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsSavingFarmCoords(false);
    }
  };

  // Notificación de éxito
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  // Función de mezcla para garantizar la presencia de los usuarios oficiales de Comercial
  const mergeWithOfficialUsers = (loadedList: UserProfile[]): UserProfile[] => {
    const result = [...loadedList];
    for (const official of OFFICIAL_DEFAULT_USERS) {
      const exists = result.some(
        (u) =>
          (u.username && official.username && u.username.toLowerCase() === official.username.toLowerCase()) ||
          (u.email && official.email && u.email.toLowerCase() === official.email.toLowerCase())
      );
      if (!exists) {
        result.push(official);
      }
    }
    return result;
  };

  // ----------------------------------------------------------------------------
  // Cargar Usuarios
  // ----------------------------------------------------------------------------
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await apiClient<UserProfile[]>('/admin/users');
      const merged = mergeWithOfficialUsers(data);
      setUsers(merged);
      localStorage.setItem('avicola_registered_users', JSON.stringify(merged));
    } catch (err: any) {
      console.warn('Cargando usuarios desde respaldo local:', err);
      const stored = localStorage.getItem('avicola_registered_users');
      let baseList: UserProfile[] = [];
      if (stored) {
        try {
          baseList = JSON.parse(stored);
        } catch {
          baseList = [];
        }
      }
      const merged = mergeWithOfficialUsers(baseList);
      setUsers(merged);
      localStorage.setItem('avicola_registered_users', JSON.stringify(merged));
    } finally {
      setLoadingUsers(false);
    }
  };

  // ----------------------------------------------------------------------------
  // Cargar Granjas
  // ----------------------------------------------------------------------------
  const fetchFarms = async () => {
    setLoadingFarms(true);
    try {
      const data = await apiClient<FarmItem[]>('/admin/farms');
      const localCoords = localStorage.getItem('avicola_admin_farms_coords');
      if (localCoords) {
        try {
          const parsed = JSON.parse(localCoords) as FarmItem[];
          const merged = data.map((d) => {
            const loc = parsed.find((p) => p.code === d.code);
            return {
              ...d,
              latitude: d.latitude ?? loc?.latitude ?? null,
              longitude: d.longitude ?? loc?.longitude ?? null,
            };
          });
          setFarms(merged);
          setLoadingFarms(false);
          return;
        } catch {}
      }
      setFarms(data);
    } catch {
      const localCoords = localStorage.getItem('avicola_admin_farms_coords');
      if (localCoords) {
        try {
          setFarms(JSON.parse(localCoords));
          setLoadingFarms(false);
          return;
        } catch {}
      }
      setFarms(OFFICIAL_FARMS_FALLBACK);
    } finally {
      setLoadingFarms(false);
    }
  };

  // Densidades por zona y sexo
  const [zoneDensities, setZoneDensities] = useState<ZoneCageDensity[]>(DEFAULT_ZONE_DENSITIES);
  const [loadingZoneDensities, setLoadingZoneDensities] = useState(false);
  const [savingZoneDensities, setSavingZoneDensities] = useState(false);

  const fetchZoneDensities = async () => {
    setLoadingZoneDensities(true);
    try {
      const data = await apiClient<ZoneCageDensity[]>('/admin/zone-densities');
      if (Array.isArray(data) && data.length > 0) {
        setZoneDensities(data);
        localStorage.setItem('avicola_zone_densities', JSON.stringify(data));
      }
    } catch {
      const stored = localStorage.getItem('avicola_zone_densities');
      if (stored) {
        try {
          setZoneDensities(JSON.parse(stored));
        } catch {}
      }
    } finally {
      setLoadingZoneDensities(false);
    }
  };

  const handleDensityValueChange = (
    zoneCode: string,
    field: 'male_density' | 'female_density',
    rawValue: string
  ) => {
    const parsed = parseInt(rawValue, 10);
    setZoneDensities((prev) =>
      prev.map((item) =>
        item.zone_code === zoneCode
          ? {
              ...item,
              [field]: Number.isFinite(parsed) ? parsed : item[field],
            }
          : item
      )
    );
  };

  const handleSaveZoneDensities = async () => {
    setSavingZoneDensities(true);
    try {
      const payload = {
        densities: zoneDensities.map((z) => ({
          zone_code: z.zone_code,
          male_density: clampDensity(z.male_density),
          female_density: clampDensity(z.female_density),
        })),
      };
      const saved = await apiClient<ZoneCageDensity[]>('/admin/zone-densities', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setZoneDensities(saved);
      localStorage.setItem('avicola_zone_densities', JSON.stringify(saved));
      showNotification('✔ Densidades por zona y sexo guardadas en la base de datos.');
    } catch (err: any) {
      showNotification(`❌ No se pudieron guardar las densidades: ${err?.message || 'Error de conexión'}`);
    } finally {
      setSavingZoneDensities(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchFarms();
    fetchZoneDensities();
  }, []);

  // ----------------------------------------------------------------------------
  // Filtrado de Usuarios
  // ----------------------------------------------------------------------------
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const query = userSearch.toLowerCase();
      const matchesSearch =
        u.full_name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        (u.username && u.username.toLowerCase().includes(query));

      const matchesRole = roleFilter === 'todos' || u.role === roleFilter;
      const matchesStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'activo' && u.is_active) ||
        (statusFilter === 'inactivo' && !u.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, userSearch, roleFilter, statusFilter]);

  // ----------------------------------------------------------------------------
  // Filtrado de Granjas
  // ----------------------------------------------------------------------------
  const filteredFarms = useMemo(() => {
    return farms.filter((f) => {
      const q = farmSearch.toLowerCase();
      return f.code.toLowerCase().includes(q) || f.name.toLowerCase().includes(q);
    });
  }, [farms, farmSearch]);

  // ----------------------------------------------------------------------------
  // Crear Usuario
  // ----------------------------------------------------------------------------
  const handleOpenCreateModal = () => {
    setCreateForm({
      username: '',
      email: '',
      full_name: '',
      password: '',
      role: 'supervisor_pecuario',
      is_active: true,
    });
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.username.trim() || !createForm.email.trim() || !createForm.full_name.trim()) {
      setFormError('Por favor complete todos los campos obligatorios.');
      return;
    }
    if (!createForm.password || createForm.password.length < 4) {
      setFormError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        username: createForm.username.trim().toLowerCase(),
        email: createForm.email.trim().toLowerCase(),
        full_name: createForm.full_name.trim(),
        password: createForm.password,
        role: createForm.role,
        is_active: createForm.is_active,
      };

      try {
        const created = await apiClient<UserProfile>('/admin/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setUsers((prev) => [created, ...prev]);
      } catch (apiErr: any) {
        // Fallback local en caso de error de red
        const localCreated: UserProfile = {
          id: `usr-${Date.now()}`,
          username: payload.username,
          email: payload.email,
          full_name: payload.full_name,
          role: payload.role,
          is_active: payload.is_active,
          created_at: new Date().toISOString(),
        };
        const updatedUsers = [localCreated, ...users];
        setUsers(updatedUsers);
        // Guardar credenciales en local registered users
        const localRegistered = JSON.parse(localStorage.getItem('avicola_registered_users') || '[]');
        localRegistered.push({ ...payload, id: localCreated.id });
        localStorage.setItem('avicola_registered_users', JSON.stringify(localRegistered));
      }

      setIsCreateModalOpen(false);
      showNotification(`Usuario "${createForm.full_name}" registrado exitosamente.`);
    } catch (err: any) {
      setFormError(err.message || 'Error al crear el usuario.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // ----------------------------------------------------------------------------
  // Editar Usuario
  // ----------------------------------------------------------------------------
  const handleOpenEditModal = (u: UserProfile) => {
    setUserToEdit(u);
    setEditForm({
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      is_active: u.is_active,
      newPassword: '',
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;

    setFormSubmitting(true);
    try {
      const payload: any = {
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        is_active: editForm.is_active,
      };
      if (editForm.newPassword) {
        payload.password = editForm.newPassword;
      }

      try {
        const updated = await apiClient<UserProfile>(`/admin/users/${userToEdit.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } catch {
        // Fallback local
        const updated = {
          ...userToEdit,
          ...payload,
        };
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      }

      setIsEditModalOpen(false);
      setUserToEdit(null);
      showNotification(`Usuario "${editForm.full_name}" actualizado.`);
    } catch (err: any) {
      alert(`Error al actualizar usuario: ${err.message}`);
    } finally {
      setFormSubmitting(false);
    }
  };

  // ----------------------------------------------------------------------------
  // Activar / Desactivar Usuario
  // ----------------------------------------------------------------------------
  const handleToggleStatus = async (targetUser: UserProfile) => {
    if (targetUser.username === 'admin') {
      alert('La cuenta principal de Administrador no puede ser desactivada.');
      return;
    }

    const nextState = !targetUser.is_active;
    try {
      try {
        await apiClient(`/admin/users/${targetUser.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ is_active: nextState }),
        });
      } catch {
        // fallback
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: nextState } : u))
      );
      showNotification(
        `Usuario ${targetUser.full_name} ${nextState ? 'activado' : 'desactivado'}.`
      );
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // ----------------------------------------------------------------------------
  // Eliminar Usuario
  // ----------------------------------------------------------------------------
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    if (userToDelete.username === 'admin') {
      alert('La cuenta principal de Administrador no puede ser eliminada.');
      setUserToDelete(null);
      return;
    }

    try {
      try {
        await apiClient(`/admin/users/${userToDelete.id}`, { method: 'DELETE' });
      } catch {
        // fallback
      }
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      showNotification(`Usuario "${userToDelete.full_name}" eliminado correctamente.`);
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    } finally {
      setUserToDelete(null);
    }
  };

  // KPIs
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.is_active).length;
  const pecuarioUsers = users.filter(
    (u) => u.role === 'supervisor_pecuario' || u.role === 'registrador_pecuario'
  ).length;
  const comercialUsers = users.filter(
    (u) => u.role === 'gestor_comercial' || u.role === 'gerente_comercial' || u.role === 'vendedor'
  ).length;

  return (
    <div className="space-y-6">
      {/* Banner de Notificación */}
      {successBanner && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 font-semibold shadow-xs transition-all animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/20 font-black">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Módulo Administrador &amp; Control de Usuarios
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Panel maestro del Administrador (<span className="font-semibold text-red-600 dark:text-red-400">admin</span>) para gestión de usuarios, roles del sistema y configuración.
              </p>
            </div>
          </div>
        </div>

        {/* Botón de recarga general */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              fetchUsers();
              fetchFarms();
            }}
            className="flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar Datos</span>
          </Button>
        </div>
      </div>

      {/* Tabs Principales */}
      <ModuleTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          {
            id: 'usuarios',
            label: 'Gestión de Usuarios & Accesos',
            icon: <Users className="w-4 h-4 shrink-0" />,
            badge: (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {totalUsers}
              </span>
            ),
          },
          {
            id: 'granjas',
            label: 'Catálogo de Granjas Oficiales',
            icon: <Building2 className="w-4 h-4 shrink-0" />,
            badge: (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {farms.length}
              </span>
            ),
          },
          {
            id: 'parametros',
            label: 'Parámetros del Sistema',
            icon: <Sliders className="w-4 h-4 shrink-0" />,
          },
          {
            id: 'simulador_gps',
            label: 'Simulador GPS Flota',
            icon: <Truck className="w-4 h-4 text-emerald-600 shrink-0" />,
            activeClassName: 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-black',
            badge: (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white">
                Control Demo
              </span>
            ),
          },
        ]}
      />

      {/* ========================================================================= */}
      {/* TAB 1: GESTIÓN DE USUARIOS */}
      {/* ========================================================================= */}
      {activeTab === 'usuarios' && (
        <div className="space-y-5">
          {/* Métricas Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              title="Total usuarios"
              value={totalUsers}
              subtitle="Cuentas registradas"
              accent="slate"
            />
            <KpiCard
              title="Usuarios activos"
              value={activeUsers}
              subtitle="Con acceso permitido"
              accent="emerald"
            />
            <KpiCard
              title="Área pecuaria"
              value={pecuarioUsers}
              subtitle="Supervisores & Registradores"
              accent="rose"
            />
            <KpiCard
              title="Área comercial"
              value={comercialUsers}
              subtitle="Gestión, Gerencia & Ventas"
              accent="blue"
            />
          </div>

          {/* Barra de Búsqueda y Botón "+ Nuevo Usuario" */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-1 flex-col sm:flex-row items-center gap-2.5 w-full">
              {/* Buscador */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar usuario por nombre, usuario o correo..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 font-medium"
                />
              </div>

              {/* Filtro por Rol */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600 font-medium"
              >
                <option value="todos">Todos los Roles</option>
                <option value="admin_sistema">Administrador TI</option>
                <option value="supervisor_pecuario">Supervisor Pecuario</option>
                <option value="registrador_pecuario">Registrador Granja</option>
                <option value="gestor_comercial">Gestor Comercial</option>
                <option value="gerente_comercial">Gerente Comercial</option>
                <option value="vendedor">Vendedor Comercial</option>
                <option value="controlador_flota">Controlador de Flota</option>
              </select>

              {/* Filtro por Estado */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-36 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600 font-medium"
              >
                <option value="todos">Todos los Estados</option>
                <option value="activo">Solo Activos</option>
                <option value="inactivo">Solo Inactivos</option>
              </select>
            </div>

            {/* Botón "+ Nuevo Usuario" */}
            <Button
              variant="primary"
              onClick={handleOpenCreateModal}
              className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-extrabold px-4 py-2 text-xs flex items-center justify-center gap-2 rounded-xl shadow-md shadow-red-600/20 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Nuevo Usuario</span>
            </Button>
          </div>

          {/* Tabla de Usuarios */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 uppercase font-black tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3.5">Usuario / Correo</th>
                    <th className="px-4 py-3.5">Nombre Completo</th>
                    <th className="px-4 py-3.5">Rol en el Sistema</th>
                    <th className="px-4 py-3.5 text-center">Estado</th>
                    <th className="px-4 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="w-5 h-5 animate-spin text-red-600" />
                          <span>Cargando lista de usuarios autorizados...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        No se encontraron usuarios con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const roleInfo = ROLE_DEFINITIONS[u.role] || {
                        label: u.role,
                        description: '',
                        badgeClass: 'bg-slate-100 text-slate-700',
                      };
                      const isMasterAdmin = u.username === 'admin';

                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          {/* Usuario / Correo */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  isMasterAdmin
                                    ? 'bg-red-600 text-white shadow-xs'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {u.full_name ? u.full_name[0].toUpperCase() : 'U'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                  <span>@{u.username || u.email.split('@')[0]}</span>
                                  {isMasterAdmin && (
                                    <span className="px-1.5 py-0.2 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded text-[9px] font-black uppercase tracking-wider">
                                      Admin Maestro
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Nombre Completo */}
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                            {u.full_name}
                          </td>

                          {/* Rol */}
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${roleInfo.badgeClass}`}
                            >
                              {roleInfo.label}
                            </span>
                          </td>

                          {/* Estado interactivo */}
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(u)}
                              disabled={isMasterAdmin}
                              title={
                                isMasterAdmin
                                  ? 'La cuenta admin siempre permanece activa'
                                  : u.is_active
                                  ? 'Clic para desactivar'
                                  : 'Clic para activar'
                              }
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                                u.is_active
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                                  : 'bg-slate-100 text-slate-500 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                              } ${isMasterAdmin ? 'cursor-default' : 'hover:scale-105'}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                }`}
                              />
                              <span>{u.is_active ? 'Activo' : 'Inactivo'}</span>
                            </button>
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Botón Editar */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(u)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Editar datos y contraseña"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Botón Eliminar */}
                              {!isMasterAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setUserToDelete(u)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                  title="Eliminar usuario"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CATÁLOGO OFICIAL DE 23 GRANJAS */}
      {/* ========================================================================= */}
      {activeTab === 'granjas' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Catálogo Oficial de 23 Granjas Avícola GR
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cada granja cuenta como mínimo con 10 galpones codificados para la planificación de saca y pesajes.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por código o nombre..."
                value={farmSearch}
                onChange={(e) => setFarmSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredFarms.map((f) => (
              <div
                key={f.code}
                className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-red-300 dark:hover:border-red-900 transition-colors flex flex-col justify-between gap-2.5"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900">
                        {f.code}
                      </span>
                      <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                        {f.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      {f.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{f.barns_count} Galpones asignados</span>
                  </div>
                </div>

                {/* Coordenadas GPS */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  {f.latitude && f.longitude ? (
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>{f.latitude.toFixed(4)}, {f.longitude.toFixed(4)}</span>
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                      <span>Sin GPS</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenFarmCoordsModal(f)}
                    className="text-red-600 hover:text-red-700 font-black text-[11px] hover:underline cursor-pointer"
                  >
                    {f.latitude && f.longitude ? 'Editar GPS' : '+ Asignar GPS'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PARÁMETROS TÉCNICOS & SEGURIDAD */}
      {/* ========================================================================= */}
      {activeTab === 'parametros' && (
        <div className="space-y-4">
          {/* Configuración de Densidad de Carga por Zona y Sexo */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
                  <Truck className="w-5 h-5 text-red-600" />
                  <span>Densidad de Carga por Zona y Sexo (Aves / Jaula)</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Define la densidad por defecto (rango {MIN_DENSITY}–{MAX_DENSITY} aves/jaula) según zona y sexo. El módulo Comercial tomará automáticamente estos valores en solo lectura al generar un pedido.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveZoneDensities}
                isLoading={savingZoneDensities}
                disabled={loadingZoneDensities}
                className="bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1.5 shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Densidades</span>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2.5 px-3">Zona Comercial</th>
                    <th className="py-2.5 px-3 text-center">Código</th>
                    <th className="py-2.5 px-3 text-center">Machos (aves/jaula)</th>
                    <th className="py-2.5 px-3 text-center">Hembras (aves/jaula)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {zoneDensities.map((zone) => (
                    <tr key={zone.zone_code} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-red-600" />
                          {zone.zone_name}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-500 dark:text-slate-400">
                        {zone.zone_code}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Input
                          type="number"
                          min={MIN_DENSITY}
                          max={MAX_DENSITY}
                          step={1}
                          value={zone.male_density}
                          onChange={(e) => handleDensityValueChange(zone.zone_code, 'male_density', e.target.value)}
                          className="w-24 mx-auto text-center font-mono font-black text-blue-700 dark:text-blue-300"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Input
                          type="number"
                          min={MIN_DENSITY}
                          max={MAX_DENSITY}
                          step={1}
                          value={zone.female_density}
                          onChange={(e) => handleDensityValueChange(zone.zone_code, 'female_density', e.target.value)}
                          className="w-24 mx-auto text-center font-mono font-black text-rose-700 dark:text-rose-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
                <Sliders className="w-5 h-5 text-red-600" />
                <span>Reglas de Negocio Pecuario</span>
              </div>
              <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800">
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 dark:text-slate-400">Edad objetivo para saca:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">38 a 45 días</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 dark:text-slate-400">Prioridad para cierre de galpón:</span>
                  <span className="font-bold text-red-600 dark:text-red-400">&gt; 45 días (Prioridad 1)</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 dark:text-slate-400">Tolerancia de peso objetivo:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">± 0.150 kg</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 dark:text-slate-400">Colorimetría por sexo:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Macho (Azul Pastel) / Hembra (Rojo Pastel)
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
                <Lock className="w-5 h-5 text-red-600" />
                <span>Seguridad &amp; Conexión a Base de Datos</span>
              </div>
              <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800">
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 dark:text-slate-400">Base de Datos:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    PostgreSQL Supabase (Conectado)
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 dark:text-slate-400">Cifrado de Contraseñas:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">PBKDF2-HMAC-SHA256</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 dark:text-slate-400">Token de Sesión:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">JWT HS256 / Bearer</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 dark:text-slate-400">Administrador Maestro:</span>
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">admin (admin 123)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SIMULADOR TELEMÁTICO DE FLOTA GPS */}
      {/* ========================================================================= */}
      {activeTab === 'simulador_gps' && (
        <AdminGpsSimulationPanel />
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR NUEVO USUARIO */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Crear Nuevo Usuario del Sistema"
        description="El usuario creado podrá iniciar sesión inmediatamente con sus credenciales y acceder a los módulos de su rol."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Nombre Completo *
              </label>
              <Input
                type="text"
                placeholder="ej: Carlos Ahumada"
                value={createForm.full_name}
                onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                className="text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Usuario (Identificador) *
              </label>
              <Input
                type="text"
                placeholder="ej: cahumada o supervisor1"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                className="text-xs font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Correo Electrónico *
              </label>
              <Input
                type="email"
                placeholder="colaborador@avicolagr.com"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="text-xs"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Contraseña Inicial *
                </label>
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                >
                  {showCreatePassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showCreatePassword ? 'Ocultar' : 'Ver'}</span>
                </button>
              </div>
              <Input
                type={showCreatePassword ? 'text' : 'password'}
                placeholder="mínimo 4 caracteres"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="text-xs font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Rol en el Sistema *
            </label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="supervisor_pecuario">Supervisor Pecuario (Módulo Pecuaria)</option>
              <option value="registrador_pecuario">Registrador Granja (Pesajes y Especiales)</option>
              <option value="gestor_comercial">Gestor Comercial (Gestión Comercial)</option>
              <option value="gerente_comercial">Gerente Comercial (Aprobaciones y Reportes)</option>
              <option value="vendedor">Vendedor Comercial (Área Comercial / Pedidos)</option>
              <option value="controlador_flota">Controlador de Flota (Control de Flota &amp; Transporte)</option>
              <option value="admin_sistema">Administrador TI (Acceso Completo &amp; Admin)</option>
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {ROLE_DEFINITIONS[createForm.role]?.description}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_active_create"
              checked={createForm.is_active}
              onChange={(e) => setCreateForm({ ...createForm, is_active: e.target.checked })}
              className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-600 cursor-pointer"
            />
            <label htmlFor="is_active_create" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
              Cuenta Activa (Permitir inicio de sesión inmediato)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5"
              isLoading={formSubmitting}
            >
              Crear Usuario
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: EDITAR USUARIO */}
      {/* ========================================================================= */}
      {userToEdit && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Editar Usuario: ${userToEdit.full_name}`}
          description="Actualice los datos de acceso o establezca una nueva contraseña para el usuario."
          maxWidth="lg"
        >
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Nombre Completo
                </label>
                <Input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Correo Electrónico
                </label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Rol en el Sistema
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                  disabled={userToEdit.username === 'admin'}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-60"
                >
                  <option value="supervisor_pecuario">Supervisor Pecuario</option>
                  <option value="registrador_pecuario">Registrador Granja</option>
                  <option value="gestor_comercial">Gestor Comercial</option>
                  <option value="gerente_comercial">Gerente Comercial</option>
                  <option value="vendedor">Vendedor Comercial</option>
                  <option value="controlador_flota">Controlador de Flota</option>
                  <option value="admin_sistema">Administrador TI</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Nueva Contraseña (Opcional)
                </label>
                <Input
                  type="password"
                  placeholder="Dejar vacío para conservar"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_active_edit"
                checked={editForm.is_active}
                disabled={userToEdit.username === 'admin'}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-600 cursor-pointer disabled:opacity-60"
              />
              <label htmlFor="is_active_edit" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                Cuenta Activa (Acceso al sistema permitido)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5"
                isLoading={formSubmitting}
              >
                Guardar Cambios
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* DIÁLOGO: CONFIRMAR ELIMINACIÓN DE USUARIO */}
      {/* ========================================================================= */}
      {userToDelete && (
        <Modal
          isOpen={!!userToDelete}
          onClose={() => setUserToDelete(null)}
          title="Eliminar Cuenta de Usuario"
          description="¿Está seguro de que desea eliminar permanentemente este colaborador? Esta acción no se puede deshacer."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 font-semibold flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <div>Usuario: <strong>{userToDelete.full_name}</strong> (@{userToDelete.username})</div>
                <div className="text-[11px] font-normal text-red-600 dark:text-red-400">
                  {userToDelete.email}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setUserToDelete(null)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4"
              >
                Sí, Eliminar Usuario
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: CONFIGURAR COORDENADAS GPS DE GRANJA */}
      {editingFarmCoords && (
        <Modal
          isOpen={!!editingFarmCoords}
          onClose={() => setEditingFarmCoords(null)}
          title={`Coordenadas GPS de Granja: ${editingFarmCoords.name} (${editingFarmCoords.code})`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                <span>Punto de Partida Satelital (Google Maps)</span>
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Abre Google Maps, busca la granja, haz <strong>clic derecho</strong> sobre la puerta o galpones y haz clic en las coordenadas para copiarlas.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Pegar Coordenadas de Google Maps:
              </label>
              <Input
                type="text"
                placeholder="Ej: -11.824512, -77.089431"
                value={farmCoordInput}
                onChange={(e) => handleParseFarmCoords(e.target.value)}
                className="font-mono text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Al pegar, el sistema detecta y separa automáticamente la latitud y longitud.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Latitud (WGS84):
                </label>
                <Input
                  type="number"
                  step="any"
                  placeholder="Ej: -11.824512"
                  value={farmLat}
                  onChange={(e) => setFarmLat(e.target.value)}
                  className="font-mono text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Longitud (WGS84):
                </label>
                <Input
                  type="number"
                  step="any"
                  placeholder="Ej: -77.089431"
                  value={farmLng}
                  onChange={(e) => setFarmLng(e.target.value)}
                  className="font-mono text-xs font-bold"
                />
              </div>
            </div>

            {farmLat && farmLng && (
              <a
                href={`https://www.google.com/maps?q=${farmLat},${farmLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Verificar ubicación en Google Maps</span>
              </a>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditingFarmCoords(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveFarmCoords}
                isLoading={isSavingFarmCoords}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                Guardar Coordenadas
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
