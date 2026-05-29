'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'taskyard-use-test-data';

type TestDataContextValue = {
  useTestData: boolean;
  setUseTestData: (value: boolean) => void;
  toggleTestData: () => void;
  hydrated: boolean;
};

const TestDataContext = createContext<TestDataContextValue | null>(null);

export function TestDataProvider({ children }: { children: React.ReactNode }) {
  const [useTestData, setUseTestDataState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setUseTestDataState(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setUseTestDataState(false);
    }
    setHydrated(true);
  }, []);

  const setUseTestData = useCallback((value: boolean) => {
    setUseTestDataState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTestData = useCallback(() => {
    setUseTestData(!useTestData);
  }, [setUseTestData, useTestData]);

  const value = useMemo(
    () => ({ useTestData, setUseTestData, toggleTestData, hydrated }),
    [useTestData, setUseTestData, toggleTestData, hydrated],
  );

  return <TestDataContext.Provider value={value}>{children}</TestDataContext.Provider>;
}

export function useTestData(): TestDataContextValue {
  const ctx = useContext(TestDataContext);
  if (!ctx) throw new Error('useTestData must be used within TestDataProvider');
  return ctx;
}

export function isDemoThreadId(id: string): boolean {
  return id.startsWith('demo-');
}
