import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('es-PE').format(val);
}

export function formatWeight(val: number | null | undefined): string {
  if (val === null || val === undefined) return '-';
  return `${Number(val).toFixed(3)} kg`;
}

