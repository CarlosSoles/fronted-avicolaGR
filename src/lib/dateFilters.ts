// ==============================================================================
// FILTRO DE FECHAS PARA PEDIDOS COMERCIALES
// Archivo: fronted/src/lib/dateFilters.ts
// ==============================================================================

export type DateCriterion = 'saca' | 'registro';

export type DatePreset =
  | 'ALL'
  | 'TODAY'
  | 'NEXT_3_DAYS'
  | 'LAST_3_DAYS'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_6_MONTHS'
  | 'CUSTOM';

export interface DateFilterValue {
  criterion: DateCriterion;
  preset: DatePreset;
  from: string;
  to: string;
}

export interface DateRange {
  from: string | null;
  to: string | null;
}

export const DEFAULT_DATE_FILTER: DateFilterValue = {
  criterion: 'saca',
  preset: 'ALL',
  from: '',
  to: '',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Convierte una fecha local a clave YYYY-MM-DD (sin desfase UTC). */
export const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Convierte un ISO timestamp a la fecha local del navegador (America/Lima). */
export function localDateKeyFromIso(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return toDateKey(d);
}

/** Fecha de referencia de un pedido según el criterio elegido. */
export function orderDateKey(
  order: { target_delivery_date?: string | null; created_at?: string | null },
  criterion: DateCriterion
): string | null {
  return criterion === 'saca'
    ? order.target_delivery_date || null
    : localDateKeyFromIso(order.created_at);
}

const addDays = (d: Date, days: number): Date => {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
};

/** Lunes de la semana de la fecha dada (semana ISO: lunes a domingo). */
const startOfWeek = (d: Date): Date => {
  const day = d.getDay(); // 0 = domingo
  const offset = (day + 6) % 7; // lunes = 0
  return addDays(d, -offset);
};

/** Resuelve el rango de fechas efectivo de un preset. */
export function resolveRange(value: DateFilterValue, today: Date = new Date()): DateRange {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  switch (value.preset) {
    case 'ALL':
      return { from: null, to: null };
    case 'TODAY':
      return { from: toDateKey(t), to: toDateKey(t) };
    case 'NEXT_3_DAYS':
      return { from: toDateKey(t), to: toDateKey(addDays(t, 2)) };
    case 'LAST_3_DAYS':
      return { from: toDateKey(addDays(t, -2)), to: toDateKey(t) };
    case 'THIS_WEEK': {
      const monday = startOfWeek(t);
      return { from: toDateKey(monday), to: toDateKey(addDays(monday, 6)) };
    }
    case 'THIS_MONTH': {
      const first = new Date(t.getFullYear(), t.getMonth(), 1);
      const last = new Date(t.getFullYear(), t.getMonth() + 1, 0);
      return { from: toDateKey(first), to: toDateKey(last) };
    }
    case 'LAST_6_MONTHS': {
      const first = new Date(t.getFullYear(), t.getMonth() - 5, 1);
      return { from: toDateKey(first), to: toDateKey(t) };
    }
    case 'CUSTOM':
      return { from: value.from || null, to: value.to || null };
    default:
      return { from: null, to: null };
  }
}

/** Indica si una clave YYYY-MM-DD cae dentro del rango (inclusive). */
export function matchesRange(key: string | null, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!key) return false;
  if (range.from && key < range.from) return false;
  if (range.to && key > range.to) return false;
  return true;
}

/** Etiqueta legible del filtro activo. */
export function describeRange(value: DateFilterValue, range: DateRange): string {
  if (!range.from && !range.to) return 'Todas las fechas';
  const fmt = (key: string) => {
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
  };
  if (range.from && range.to && range.from === range.to) return fmt(range.from);
  if (range.from && range.to) return `${fmt(range.from)} → ${fmt(range.to)}`;
  if (range.from) return `Desde ${fmt(range.from)}`;
  return `Hasta ${fmt(range.to as string)}`;
}
