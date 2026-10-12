'use client';

import { createContext, useContext } from 'react';
import { TestDataProvider } from '@/lib/hooks/use-test-data';

export type SessionPerson = {
  id: string;
  username: string;
  displayName: string;
};

const SessionContext = createContext<SessionPerson | null>(null);

export function useSessionPerson() {
  return useContext(SessionContext);
}

export function Providers({
  person,
  children,
}: {
  person: SessionPerson | null;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={person}>
      <TestDataProvider>{children}</TestDataProvider>
    </SessionContext.Provider>
  );
}
