import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PANEL_VISIBILITY,
  PANEL_VISIBILITY_COOKIE,
  panelVisibilityCookie,
  parsePanelVisibility,
} from './panel-visibility';

describe('panel visibility cookie', () => {
  it('opens every panel when the cookie is missing or unreadable', () => {
    expect(parsePanelVisibility(null)).toEqual(DEFAULT_PANEL_VISIBILITY);
    expect(parsePanelVisibility('')).toEqual(DEFAULT_PANEL_VISIBILITY);
    expect(parsePanelVisibility('not-json')).toEqual(DEFAULT_PANEL_VISIBILITY);
  });

  it('reads a saved arrangement and ignores unknown fields', () => {
    const raw = JSON.stringify({ tasks: false, threads: true, workers: false, extra: 1 });
    expect(parsePanelVisibility(raw)).toEqual({ tasks: false, threads: true, workers: false });
    expect(parsePanelVisibility(encodeURIComponent(raw))).toEqual({
      tasks: false,
      threads: true,
      workers: false,
    });
  });

  it('keeps a panel open when its flag is missing or not a boolean', () => {
    expect(parsePanelVisibility(JSON.stringify({ workers: false, tasks: 'no' }))).toEqual({
      tasks: true,
      threads: true,
      workers: false,
    });
  });

  it('writes a year-long cookie the parser can read back', () => {
    const header = panelVisibilityCookie({ tasks: true, threads: false, workers: false });
    expect(header.startsWith(`${PANEL_VISIBILITY_COOKIE}=`)).toBe(true);
    expect(header).toContain('Path=/');
    expect(header).toContain('Max-Age=31536000');
    expect(header).toContain('SameSite=Lax');
    const value = header.slice(PANEL_VISIBILITY_COOKIE.length + 1).split(';')[0] ?? '';
    expect(parsePanelVisibility(value)).toEqual({ tasks: true, threads: false, workers: false });
  });
});
