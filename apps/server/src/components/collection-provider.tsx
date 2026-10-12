'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { writeActiveCollection, type CollectionSummary } from '@/lib/active-collection';

type CollectionState = {
  activeId: string | null;
  active: CollectionSummary | null;
  collections: CollectionSummary[];
  select: (id: string | null) => void;
  refresh: () => Promise<void>;
  create: (name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggleProject: (collectionId: string, projectId: string, include: boolean) => Promise<void>;
};

const CollectionContext = createContext<CollectionState | null>(null);

export function useCollections(): CollectionState {
  const value = useContext(CollectionContext);
  if (!value) {
    return {
      activeId: null,
      active: null,
      collections: [],
      select: () => undefined,
      refresh: async () => undefined,
      create: async () => undefined,
      remove: async () => undefined,
      toggleProject: async () => undefined,
    };
  }
  return value;
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function CollectionProvider({
  initialId,
  enabled,
  children,
}: {
  initialId: string | null;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(initialId || null);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCollections([]);
      setLoaded(true);
      return;
    }
    const res = await fetch('/api/collections');
    if (!res.ok) {
      setLoaded(true);
      return;
    }
    const data = (await res.json()) as { collections: CollectionSummary[] };
    setCollections(data.collections);
    setLoaded(true);
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!loaded || !activeId) return;
    if (collections.some((item) => item.id === activeId)) return;
    setActiveId(null);
    writeActiveCollection(null);
  }, [activeId, collections, loaded]);

  const active = useMemo(
    () => collections.find((item) => item.id === activeId) ?? null,
    [activeId, collections],
  );

  const select = useCallback((id: string | null) => {
    setActiveId(id);
    writeActiveCollection(id);
  }, []);

  const create = useCallback(
    async (name: string) => {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { collection: CollectionSummary };
      await refresh();
      select(data.collection.id);
    },
    [refresh, select],
  );

  const remove = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/collections/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readError(res));
      if (activeId === id) select(null);
      await refresh();
    },
    [activeId, refresh, select],
  );

  const toggleProject = useCallback(
    async (collectionId: string, projectId: string, include: boolean) => {
      const res = include
        ? await fetch(`/api/collections/${encodeURIComponent(collectionId)}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: projectId }),
          })
        : await fetch(
            `/api/collections/${encodeURIComponent(collectionId)}/projects?project_id=${encodeURIComponent(projectId)}`,
            { method: 'DELETE' },
          );
      if (!res.ok) throw new Error(await readError(res));
      await refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ activeId, active, collections, select, refresh, create, remove, toggleProject }),
    [active, activeId, collections, create, refresh, remove, select, toggleProject],
  );

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}
