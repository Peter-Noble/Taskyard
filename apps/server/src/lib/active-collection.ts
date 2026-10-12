export type CollectionSummary = {
  id: string;
  name: string;
  project_ids: string[];
};

// D-005
export const ACTIVE_COLLECTION_COOKIE = 'taskyard-collection';

export function projectsInCollection<T extends { id: string }>(
  items: T[],
  collection: CollectionSummary | null,
): T[] {
  if (!collection) return items;
  const order = new Map(collection.project_ids.map((id, index) => [id, index]));
  return items
    .filter((item) => order.has(item.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function threadsInCollection<T extends { project_id: string | null }>(
  items: T[],
  collection: CollectionSummary | null,
): T[] {
  if (!collection) return items;
  const ids = new Set(collection.project_ids);
  return items.filter((item) => item.project_id != null && ids.has(item.project_id));
}

export function activeCollectionCookie(id: string | null): string {
  const value = encodeURIComponent(id ?? '');
  return `${ACTIVE_COLLECTION_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function writeActiveCollection(id: string | null) {
  if (typeof document === 'undefined') return;
  document.cookie = activeCollectionCookie(id);
}

export function readRequestCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    if (!value) return undefined;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}
