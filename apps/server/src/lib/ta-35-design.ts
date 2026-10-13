export const TA35_DESIGN_PARAM = 'ta-35-design';
export const TA35_DESIGN_OPTIONS = ['A', 'B', 'C', 'D'] as const;
export type Ta35DesignOption = (typeof TA35_DESIGN_OPTIONS)[number];

export function parseTa35Design(raw: string | string[] | undefined | null): Ta35DesignOption | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return (TA35_DESIGN_OPTIONS as readonly string[]).includes(upper)
    ? (upper as Ta35DesignOption)
    : null;
}
