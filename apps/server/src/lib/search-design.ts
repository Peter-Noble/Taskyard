export type SearchDesign = 'A' | 'B' | 'C';

export function parseSearchDesign(value: string | undefined): SearchDesign {
  return value === 'B' || value === 'C' ? value : 'A';
}
