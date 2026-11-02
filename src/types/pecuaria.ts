export type SexType = 'MACHO' | 'HEMBRA';

export type BarnStatus = 'OPERATIVO' | 'BLOQUEADO_SANITARIO' | 'PENDIENTE_REVISION' | 'CERRADO';

export interface OfficialFarmDefinition {
  name: string;
  code: string;
  zone: string;
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
  bird_age_days: number;
  specials_general_count: number;
  barn_balance_available: number;
  average_weight_kg: number | null;
  min_weight_kg?: number | null;
  max_weight_kg?: number | null;
  weight_range_label?: string | null;
  sex: SexType; // Solo 'MACHO' o 'HEMBRA'
  
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
      // Alternar sexos (solo MACHO y HEMBRA, sin mixto)
      const isMacho = (farmIdx + b) % 2 === 0;
      const sex = isMacho ? 'MACHO' : 'HEMBRA';

      // Galpones > 45 días para prioridad de cierre
      let age = 36 + ((farmIdx * 3 + b * 2) % 10);
      if (b === 1 && farmIdx % 2 === 0) age = 47;
      if (b === 3 && farmIdx % 3 === 0) age = 46;
      if (b === 5 && farmIdx % 4 === 0) age = 48;

      const baseWeight = isMacho ? 2.60 + (b * 0.03) : 2.35 + (b * 0.02);
      const roundedAvg = Math.round(baseWeight * 100) / 100;
      const minW = Math.round((roundedAvg - 0.16) * 100) / 100;
      const maxW = Math.round((roundedAvg + 0.18) * 100) / 100;

      let physical = 5000 + (b * 200);
      let specials = 40 + ((b * 15) % 90);
      let reserved = (b % 3 === 0) ? 100 : 0;

      if (b === 9 || b === 10) {
        physical = 920;
        specials = 45;
        reserved = 0;
      }

      const available = Math.max(0, physical - specials - reserved);

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
        bird_age_days: age,
        specials_general_count: specials,
        barn_balance_available: available,
        average_weight_kg: roundedAvg,
        min_weight_kg: minW,
        max_weight_kg: maxW,
        weight_range_label: `${minW.toFixed(2)} - ${maxW.toFixed(2)} kg`,
        sex: sex,
        physical_count: physical,
        reserved_count: reserved,
        sold_pending_count: 0,
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
