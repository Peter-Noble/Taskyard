'use client';

import { useCallback, useEffect, useState } from 'react';

export function useJsonFetch<T>(url: string, intervalMs = 5000, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as T;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [url, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    refresh();
    if (intervalMs <= 0) return;
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs, enabled]);

  return { data, loading, error, refresh };
}
