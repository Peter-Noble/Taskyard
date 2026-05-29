'use client';

import { TestDataProvider } from '@/lib/hooks/use-test-data';

export function Providers({ children }: { children: React.ReactNode }) {
  return <TestDataProvider>{children}</TestDataProvider>;
}
