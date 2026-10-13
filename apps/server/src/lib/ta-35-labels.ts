export const TA35_LABELS_PARAM = 'ta-35-labels';
export const TA35_LABELS_OPTIONS = ['A', 'B', 'C'] as const;
export type Ta35LabelsOption = (typeof TA35_LABELS_OPTIONS)[number];

export function parseTa35Labels(raw: string | string[] | undefined | null): Ta35LabelsOption | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return (TA35_LABELS_OPTIONS as readonly string[]).includes(upper)
    ? (upper as Ta35LabelsOption)
    : null;
}
