import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  PlusCircle,
  Search,
  Pencil,
  MapPin,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/api';
import { Client, ClientCreatePayload, ClientUpdatePayload } from '@/types/comercial';
import { sanitizePeruCoordinates } from '@/modules/gerencia/components/gps/gpsRoutesData';

interface ClientFormState {
  business_name: string;
  tax_id: string;
  zone_code: string;
  address: string;
  contact_phone: string;
  latitude: string;
  longitude: string;
  min_weight: string;
  max_weight: string;
  is_active: boolean;
}

const EMPTY_FORM: ClientFormState = {
  business_name: '',
  tax_id: '',
  zone_code: 'METROPOLITANA',
  address: '',
  contact_phone: '',
  latitude: '',
  longitude: '',
  min_weight: '',
  max_weight: '',
  is_active: true,
};

const ZONES = [
  { value: 'METROPOLITANA', label: 'Metropolitana (Lima)' },
  { value: 'NORTE', label: 'Zona Norte' },
  { value: 'CENTRO', label: 'Zona Centro' },
  { value: 'SUR', label: 'Zona Sur' },
];

/**
 * Catálogo de clientes con alta y edición.
 * Todos los datos provienen de la API; no hay valores de relleno.
 */
export const ClientsPanel: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient<Client[]>('/comercial/clients');
      setClients(data || []);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || 'No se pudo cargar el catálogo de clientes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) =>
      [client.business_name, client.tax_id, client.zone_code, client.address, client.contact_phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [clients, search]);

  const openCreate = () => {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      business_name: client.business_name,
      tax_id: client.tax_id,
      zone_code: client.zone_code || 'METROPOLITANA',
      address: client.address || '',
      contact_phone: client.contact_phone || '',
      latitude: client.latitude != null ? String(client.latitude) : '',
      longitude: client.longitude != null ? String(client.longitude) : '',
      min_weight: client.preferred_min_weight != null ? String(client.preferred_min_weight) : '',
      max_weight: client.preferred_max_weight != null ? String(client.preferred_max_weight) : '',
      is_active: client.is_active,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const update = (patch: Partial<ClientFormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const businessName = form.business_name.trim();
    const taxId = form.tax_id.trim();
    if (!businessName || !taxId) {
      setFormError('La razón social y el RUC/DNI son obligatorios.');
      return;
    }

    const duplicated = clients.some(
      (c) => c.id !== editingClient?.id && c.tax_id.toLowerCase() === taxId.toLowerCase()
    );
    if (duplicated) {
      setFormError(`Ya existe otro cliente registrado con el RUC/DNI "${taxId}".`);
      return;
    }

    let latitude: number | null = null;
    let longitude: number | null = null;
    const latStr = form.latitude.trim();
    const lngStr = form.longitude.trim();
    if (latStr || lngStr) {
      if (!latStr || !lngStr) {
        setFormError('Debe ingresar latitud y longitud juntas, o dejar ambas vacías.');
        return;
      }
      const sanitized = sanitizePeruCoordinates(latStr, lngStr);
      if (sanitized) {
        latitude = sanitized.lat;
        longitude = sanitized.lng;
      } else {
        latitude = Number(latStr);
        longitude = Number(lngStr);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
          setFormError('La latitud debe ser un número entre -90 y 90.');
          return;
        }
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
          setFormError('La longitud debe ser un número entre -180 y 180.');
          return;
        }
      }
    }

    const minWeight = form.min_weight.trim() ? Number(form.min_weight) : null;
    const maxWeight = form.max_weight.trim() ? Number(form.max_weight) : null;
    if (minWeight !== null && maxWeight !== null && minWeight > maxWeight) {
      setFormError('El peso mínimo preferente no puede ser mayor al peso máximo.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingClient) {
        const payload: ClientUpdatePayload = {
          business_name: businessName,
          tax_id: taxId,
          zone_code: form.zone_code,
          address: form.address.trim(),
          contact_phone: form.contact_phone.trim(),
          latitude,
          longitude,
          preferred_min_weight: minWeight,
          preferred_max_weight: maxWeight,
          is_active: form.is_active,
        };
        const updated = await apiClient<Client>(`/comercial/clients/${editingClient.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        showToast(`Cliente "${updated.business_name}" actualizado.`);
      } else {
        const payload: ClientCreatePayload = {
          business_name: businessName,
          tax_id: taxId,
          zone_code: form.zone_code,
          address: form.address.trim() || undefined,
          contact_phone: form.contact_phone.trim() || undefined,
          latitude,
          longitude,
          preferred_min_weight: minWeight ?? undefined,
          preferred_max_weight: maxWeight ?? undefined,
          is_active: form.is_active,
        };
        const created = await apiClient<Client>('/comercial/clients', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setClients((prev) => [created, ...prev]);
        showToast(`Cliente "${created.business_name}" registrado.`);
      }
      setFormOpen(false);
      setEditingClient(null);
      setForm(EMPTY_FORM);
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar el cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {loadError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-800 dark:text-rose-300">
          <span className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{loadError}</span>
          </span>
          <Button size="sm" variant="secondary" onClick={loadClients} className="self-end sm:self-auto font-bold">
            Reintentar
          </Button>
        </div>
      )}

      {/* Barra de búsqueda y alta */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por razón social, RUC, zona o dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600"
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={openCreate}
          className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Registrar Cliente</span>
        </Button>
      </div>

      {/* Tabla del catálogo */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900/90 text-slate-950 dark:text-slate-100 text-[11px] font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4 whitespace-nowrap">RUC / DNI</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Zona</th>
                <th className="hidden md:table-cell py-3 px-4">Dirección de Entrega</th>
                <th className="hidden lg:table-cell py-3 px-4 text-center whitespace-nowrap">Coordenadas</th>
                <th className="hidden lg:table-cell py-3 px-4 text-center whitespace-nowrap">Pesos Pref.</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Estado</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-red-600 border-r-transparent mb-2" />
                    <div className="font-bold text-xs">Cargando clientes...</div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <div className="font-bold">
                      {clients.length === 0 ? 'No hay clientes registrados' : 'No se encontraron clientes con ese criterio'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const hasCoords = client.latitude != null && client.longitude != null;
                  return (
                    <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-950 dark:text-white">{client.business_name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {client.contact_phone || 'Sin teléfono'}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {client.tax_id}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-700 dark:text-slate-300">
                          {client.zone_code}
                        </span>
                      </td>

                      <td className="hidden md:table-cell py-3 px-4 text-slate-700 dark:text-slate-300 max-w-[280px]">
                        <span className="line-clamp-2">{client.address || '—'}</span>
                      </td>

                      <td className="hidden lg:table-cell py-3 px-4 text-center whitespace-nowrap">
                        {hasCoords ? (
                          <a
                            href={`https://www.google.com/maps?q=${client.latitude},${client.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10.5px] font-mono font-bold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                            title="Ver punto de entrega en Google Maps"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>
                              {Number(client.latitude).toFixed(5)}, {Number(client.longitude).toFixed(5)}
                            </span>
                          </a>
                        ) : (
                          <span className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400">
                            Sin coordenadas
                          </span>
                        )}
                      </td>

                      <td className="hidden lg:table-cell py-3 px-4 text-center font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {client.preferred_min_weight != null && client.preferred_max_weight != null
                          ? `${Number(client.preferred_min_weight).toFixed(2)} - ${Number(client.preferred_max_weight).toFixed(2)} kg`
                          : '—'}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {client.is_active ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Activo</span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400 font-bold">Inactivo</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(client)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Editar ficha del cliente"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {hasCoords && (
                            <a
                              href={`https://www.google.com/maps?q=${client.latitude},${client.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Abrir punto de entrega en Google Maps"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
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

      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium px-1">
        Las coordenadas registradas aquí se cargan automáticamente como punto de entrega al seleccionar el cliente
        en un pedido.
      </p>

      {/* Modal de alta / edición */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingClient ? 'Editar Ficha del Cliente' : 'Registrar Nuevo Cliente'}
        description="Los datos se guardan en la base de datos del sistema."
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {formError && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Razón Social *
              </label>
              <input
                type="text"
                value={form.business_name}
                onChange={(e) => update({ business_name: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="Ej. Distribuidora Santa Anita S.A.C."
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                RUC / DNI *
              </label>
              <input
                type="text"
                value={form.tax_id}
                onChange={(e) => update({ tax_id: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="20548963211"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Zona
              </label>
              <select
                value={form.zone_code}
                onChange={(e) => update({ zone_code: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                {ZONES.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Teléfono de contacto
              </label>
              <input
                type="text"
                value={form.contact_phone}
                onChange={(e) => update({ contact_phone: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="+51 987 654 321"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Dirección de entrega
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update({ address: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
              placeholder="Av. Nicolás Ayllón 3800, Mercado Santa Anita"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Latitud
              </label>
              <input
                type="text"
                value={form.latitude}
                onChange={(e) => update({ latitude: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="-12.04318"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Longitud
              </label>
              <input
                type="text"
                value={form.longitude}
                onChange={(e) => update({ longitude: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="-77.02824"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Peso mínimo preferente (kg)
              </label>
              <input
                type="text"
                value={form.min_weight}
                onChange={(e) => update({ min_weight: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="2.20"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Peso máximo preferente (kg)
              </label>
              <input
                type="text"
                value={form.max_weight}
                onChange={(e) => update({ max_weight: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="2.50"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update({ is_active: e.target.checked })}
              className="w-4 h-4 accent-red-600"
            />
            <span>Cliente activo (puede recibir pedidos)</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="secondary" size="sm" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" isLoading={isSaving} className="bg-red-600 hover:bg-red-700 text-white font-bold">
              {editingClient ? 'Guardar Cambios' : 'Registrar Cliente'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
