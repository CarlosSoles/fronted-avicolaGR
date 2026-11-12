export type SexType = 'MACHO' | 'HEMBRA' | 'MIXTO';

export type BarnStatus = 'OPERATIVO' | 'BLOQUEADO_SANITARIO' | 'PENDIENTE_REVISION' | 'CERRADO';

export interface OfficialFarmDefinition {
  name: string;
  code: string;
  zone: string;
}

// Coordenadas reales de las granjas (WGS84), sincronizadas con la tabla `farms`.
// Se usan para calcular cercanía al punto de entrega cuando el backend no está disponible.
export const FARM_COORDINATES: Record<string, { lat: number; lng: number }> = {
  '507': { lat: -11.932109, lng: -77.06789 },
  ESMER: { lat: -8.16789, lng: -79.078901 },
  HARC2: { lat: -12.334567, lng: -76.823456 },
  MORI2: { lat: -8.37002, lng: -78.869961 },
  'NUC-9': { lat: -11.954321, lng: -77.045678 },
  'NUC-B': { lat: -11.94321, lng: -77.056789 },
  PAC67: { lat: -12.245678, lng: -76.912345 },
  PACI1: { lat: -12.26789, lng: -76.890123 },
  PACI2: { lat: -12.278901, lng: -76.879012 },
  PACI5: { lat: -12.289012, lng: -76.867901 },
  PACI6: { lat: -12.234567, lng: -76.923456 },
  PACI7: { lat: -12.256789, lng: -76.901234 },
  QBAGA: { lat: -8.178901, lng: -79.089012 },
  'R4G-A': { lat: -12.323456, lng: -76.834567 },
  'R4G-B': { lat: -12.301234, lng: -76.856789 },
  'R4G-C': { lat: -12.312345, lng: -76.845678 },
  SEMIA: { lat: -8.145678, lng: -79.056789 },
  SEMIB: { lat: -8.156789, lng: -79.06789 },
  SISA1: { lat: -11.965432, lng: -77.034567 },
  SISA2: { lat: -11.987654, lng: -77.012345 },
  SISA3: { lat: -11.976543, lng: -77.023456 },
  TRAD1: { lat: -8.125432, lng: -79.034567 },
  TRAD2: { lat: -8.132145, lng: -79.041234 },
};

/** Distancia en km entre dos coordenadas WGS84 (fórmula de Haversine). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 100) / 100;
}

export const OFFICIAL_FARMS: OfficialFarmDefinition[] = [
  { name: 'Tradisa 1', code: 'TRAD1', zone: 'ZONA_NORTE' },
  { name: 'Tradisa II', code: 'TRAD2', zone: 'ZONA_NORTE' },
  { name: 'Pacifico 6', code: 'PACI6', zone: 'ZONA_SUR' },
  { name: 'San Jose 3', code: 'PAC67', zone: 'ZONA_SUR' },
  { name: 'San Jose 2', code: 'PACI7', zone: 'ZONA_SUR' },
  { name: 'Pacifico 1', code: 'PACI1', zone: 'ZONA_SUR' },
  { name: 'Pacifico 2', code: 'PACI2', zone: 'ZONA_SUR' },
  { name: 'San Jose 1', code: 'PACI5', zone: 'ZONA_SUR' },
  { name: 'Santa Isabel 2', code: 'SISA2', zone: 'ZONA_CENTRO' },
  { name: 'Semillero A', code: 'SEMIA', zone: 'ZONA_NORTE' },
  { name: 'Santa Isabel 3', code: 'SISA3', zone: 'ZONA_CENTRO' },
  { name: 'Santa Isabel 1', code: 'SISA1', zone: 'ZONA_CENTRO' },
  { name: 'Semillero B', code: 'SEMIB', zone: 'ZONA_NORTE' },
  { name: 'Nucleo 9', code: 'NUC-9', zone: 'ZONA_CENTRO' },
  { name: 'R4GB', code: 'R4G-B', zone: 'ZONA_SUR' },
  { name: 'Nucleo B', code: 'NUC-B', zone: 'ZONA_CENTRO' },
  { name: 'Esmeralda', code: 'ESMER', zone: 'ZONA_NORTE' },
  { name: 'R4GC', code: 'R4G-C', zone: 'ZONA_SUR' },
  { name: 'R4GA', code: 'R4G-A', zone: 'ZONA_SUR' },
  { name: 'Quebaga', code: 'QBAGA', zone: 'ZONA_NORTE' },
  { name: 'Puerto Mori 2', code: 'MORI2', zone: 'ZONA_NORTE' },
  { name: '507', code: '507', zone: 'ZONA_CENTRO' },
  { name: 'Harco 2', code: 'HARC2', zone: 'ZONA_SUR' },
];

export interface TablaGeneralSaldoItem {
  farm_id: string;
  farm_name: string;
  farm_code: string; // Solo se muestra este código en la columna Granja
  farm_zone: string;
  barn_id: string;
  barn_number: number;
  barn_code: string; // e.g. G-01, G-02
  barn_status: BarnStatus;
  batch_id?: string;
  batch_code?: string;
  
  // Las columnas obligatorias
  campaign?: string;
  bird_age_days: number;
  specials_general_count: number;
  barn_balance_available: number;
  average_weight_kg: number | null;
  average_weight_g?: number | null;
  average_weight_today_g?: number | null;
  average_weight_yesterday_g?: number | null;
  standard_weight_g?: number | null;
  min_weight_kg?: number | null;
  max_weight_kg?: number | null;
  weight_range_label?: string | null;
  sex: SexType; // 'MACHO' | 'HEMBRA' | 'MIXTO'
  
  // Desglose físico
  physical_count: number;
  reserved_count: number;
  sold_pending_count: number;
  last_inventory_update?: string;
  is_closed?: boolean;
}

export interface TablaGeneralSaldoResponse {
  total_records: number;
  data: TablaGeneralSaldoItem[];
}

// Generador central de datos oficiales para las 23 granjas (10 galpones c/u = 230 galpones)
export function generateInitialOfficialData(): TablaGeneralSaldoItem[] {
  const items: TablaGeneralSaldoItem[] = [];

  OFFICIAL_FARMS.forEach((farm, farmIdx) => {
    for (let b = 1; b <= 10; b++) {
      const barnCode = `G-${String(b).padStart(2, '0')}`;
      // 20% MIXTO, 40% MACHO, 40% HEMBRA
      let sex: SexType = 'MACHO';
      if (b === 1 || b === 6) {
        sex = 'MIXTO';
      } else if ((farmIdx + b) % 2 === 0) {
        sex = 'MACHO';
      } else {
        sex = 'HEMBRA';
      }

      // Edades en los 3 rangos: 32-35, 36-39, 40-41
      const rangeMod = (farmIdx + b) % 3;
      let age = 38;
      if (rangeMod === 0) age = 32 + ((farmIdx * 2 + b) % 4); // 32..35
      else if (rangeMod === 1) age = 36 + ((farmIdx * 3 + b) % 4); // 36..39
      else age = 40 + ((farmIdx + b) % 2); // 40..41

      const baseWeight = sex === 'MACHO' ? 2.65 + (b * 0.03) : sex === 'HEMBRA' ? 2.35 + (b * 0.02) : 2.50 + (b * 0.025);
      const roundedAvg = Math.round(baseWeight * 100) / 100;
      const minW = Math.round((roundedAvg - 0.16) * 100) / 100;
      const maxW = Math.round((roundedAvg + 0.18) * 100) / 100;

      // Saldo mayor a 10,000 aves (excepto galpón 10 que tiene < 2,000 aves para control de stock bajo)
      let physical = 10500 + ((b * 600) % 6000);
      let specials = 45 + ((b * 15) % 90);
      let reserved = (b % 4 === 0) ? 200 : 0;

      if (b === 10) {
        physical = 1450;
        specials = 40;
        reserved = 0;
      }

      const available = Math.max(0, physical - specials - reserved);
      const todayG = Math.round((roundedAvg * 1000 + ((farmIdx * 5 + b * 11) % 40)) * 100) / 100;
      const yesterdayG = Math.round((todayG - 52 + ((farmIdx + b) % 15)) * 100) / 100;

      items.push({
        farm_id: `farm-uuid-${farm.code.toLowerCase()}`,
        farm_name: farm.name,
        farm_code: farm.code,
        farm_zone: farm.zone,
        barn_id: `barn-uuid-${farm.code.toLowerCase()}-${b}`,
        barn_number: b,
        barn_code: barnCode,
        barn_status: 'OPERATIVO',
        batch_code: `LOT-${farm.code}-${String(b).padStart(2, '0')}`,
        campaign: '208',
        bird_age_days: age,
        specials_general_count: specials,
        barn_balance_available: available,
        average_weight_kg: roundedAvg,
        average_weight_g: todayG,
        average_weight_today_g: todayG,
        average_weight_yesterday_g: yesterdayG,
        min_weight_kg: minW,
        max_weight_kg: maxW,
        weight_range_label: `${minW.toFixed(2)} - ${maxW.toFixed(2)} kg`,
        sex: sex,
        physical_count: physical,
        reserved_count: reserved,
        sold_pending_count: 0,
        last_inventory_update: new Date().toISOString(),
        is_closed: false,
      });
    }
  });

  return items;
}

export interface Farm {
  id: string;
  name: string;
  code: string;
  zone_code: string;
  is_active: boolean;
}

export interface IndividualWeightInput {
  bird_sequence: number;
  weight_kg: number;
}

export interface WeightStratumDistribution {
  label: string;
  range_text: string;
  count: number;
  percentage: number;
  color: string;
}
