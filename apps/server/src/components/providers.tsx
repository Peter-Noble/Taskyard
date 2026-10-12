'use client';

import { createContext, useContext } from 'react';
import { TestDataProvider } from '@/lib/hooks/use-test-data';
import { CollectionProvider } from '@/components/collection-provider';

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
  collectionId,
  children,
}: {
  person: SessionPerson | null;
  collectionId: string | null;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={person}>
      <CollectionProvider initialId={collectionId} enabled={person != null}>
        <TestDataProvider>{children}</TestDataProvider>
      </CollectionProvider>
    </SessionContext.Provider>
  );
}
