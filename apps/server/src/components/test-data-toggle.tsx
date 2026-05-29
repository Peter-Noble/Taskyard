'use client';

import { useTestData as useTestDataContext } from '@/lib/hooks/use-test-data';

export function TestDataToggle() {
  const { useTestData, setUseTestData, hydrated } = useTestDataContext();

  if (!hydrated) {
    return (
      <span className="header-test-toggle" aria-hidden="true">
        Test data
      </span>
    );
  }

  return (
    <label className="header-test-toggle">
      <input
        type="checkbox"
        checked={useTestData}
        onChange={(e) => setUseTestData(e.target.checked)}
        aria-label="Use test data"
      />
      <span>Test data</span>
    </label>
  );
}
