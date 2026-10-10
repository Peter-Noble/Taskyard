export type PanelVisibility = {
  tasks: boolean;
  threads: boolean;
  workers: boolean;
};

export const PANEL_VISIBILITY_COOKIE = 'taskyard-panels';

export const DEFAULT_PANEL_VISIBILITY: PanelVisibility = {
  tasks: true,
  threads: true,
  workers: true,
};

const PANELS = ['tasks', 'threads', 'workers'] as const;

function cookieValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function parsePanelVisibility(raw: string | null | undefined): PanelVisibility {
  if (!raw) return { ...DEFAULT_PANEL_VISIBILITY };
  try {
    const value = JSON.parse(cookieValue(raw)) as unknown;
    if (!value || typeof value !== 'object') return { ...DEFAULT_PANEL_VISIBILITY };
    const record = value as Record<string, unknown>;
    const next = { ...DEFAULT_PANEL_VISIBILITY };
    for (const key of PANELS) {
      if (typeof record[key] === 'boolean') next[key] = record[key];
    }
    return next;
  } catch {
    return { ...DEFAULT_PANEL_VISIBILITY };
  }
}

export function panelVisibilityCookie(panels: PanelVisibility): string {
  const value = encodeURIComponent(JSON.stringify(panels));
  return `${PANEL_VISIBILITY_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function writePanelVisibility(panels: PanelVisibility) {
  if (typeof document === 'undefined') return;
  // D-001
  document.cookie = panelVisibilityCookie(panels);
}
