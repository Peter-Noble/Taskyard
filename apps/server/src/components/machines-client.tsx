'use client';

import { useCallback, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useTestData } from '@/lib/hooks/use-test-data';
import { useJsonFetch } from '@/lib/hooks/use-json-fetch';
import { TEST_MACHINES } from '@/lib/test-data/fixtures';
import type { Machine, SchedulingMode, UpdateMachineRequest } from '@taskyard/protocol';

type MachineRow = Machine & { port_utilization?: { used: number; total: number } };

function PortBar({ used, total }: { used: number; total: number }) {
  const segments = Math.min(20, total);
  const filled = total === 0 ? 0 : Math.round((used / total) * segments);
  return (
    <div className="port-bar" aria-label={`${used} of ${total} ports used`}>
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={`port-seg${i < filled ? ' used' : ''}`} />
      ))}
    </div>
  );
}

function formatHardware(m: MachineRow): string {
  const cores = m.cpu_cores != null ? `${m.cpu_cores} cores` : '—';
  const ram = m.ram_gb != null ? `${m.ram_gb} GB RAM` : '—';
  const gpu = m.gpu_info ?? '—';
  return `${cores} · ${ram} · ${gpu}`;
}

function MachinePolicyRow({
  machine: initial,
  testDataOn,
  onSaved,
}: {
  machine: MachineRow;
  testDataOn: boolean;
  onSaved: () => void;
}) {
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>(
    initial.scheduling_mode,
  );
  const [pool, setPool] = useState(initial.pool);
  const [maxThreads, setMaxThreads] = useState(
    initial.max_concurrent_threads != null ? String(initial.max_concurrent_threads) : '',
  );
  const [priority, setPriority] = useState(String(initial.priority));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = useCallback(async () => {
    if (testDataOn) {
      setMessage('Disabled in test-data mode');
      return;
    }
    setSaving(true);
    setMessage(null);
    const body: UpdateMachineRequest = {
      scheduling_mode: schedulingMode,
      pool,
      priority: Number(priority) || 0,
      max_concurrent_threads: maxThreads.trim() === '' ? null : Number(maxThreads),
    };
    try {
      const res = await fetch(`/api/machines/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setMessage('Saved');
      onSaved();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [
    testDataOn,
    schedulingMode,
    pool,
    maxThreads,
    priority,
    initial.id,
    onSaved,
  ]);

  return (
    <tr key={initial.id}>
      <td data-label="Machine">
        <strong>{initial.name}</strong>
        {initial.is_local ? (
          <span className="machine-badge machine-badge-local">Local</span>
        ) : null}
        {initial.scheduling_mode === 'manual_only' ? (
          <span className="machine-badge">Manual only</span>
        ) : null}
      </td>
      <td data-label="Address" className="spec-mono">
        {initial.ip_address ?? '—'}
      </td>
      <td data-label="Hardware" className="spec-mono">
        {formatHardware(initial)}
      </td>
      <td data-label="Threads">
        {initial.active_threads ?? 0} active
        {initial.max_concurrent_threads != null
          ? ` / ${initial.max_concurrent_threads} max`
          : ''}
      </td>
      <td data-label="Scheduling">
        <select
          className="form-select form-select-compact"
          value={schedulingMode}
          onChange={(e) => setSchedulingMode(e.target.value as SchedulingMode)}
          disabled={testDataOn}
        >
          <option value="auto">Auto</option>
          <option value="manual_only">Manual only</option>
          <option value="disabled">Disabled</option>
        </select>
      </td>
      <td data-label="Pool">
        <input
          type="text"
          className="form-input form-input-compact spec-mono"
          value={pool}
          onChange={(e) => setPool(e.target.value)}
          disabled={testDataOn}
        />
      </td>
      <td data-label="Max threads">
        <input
          type="number"
          min={1}
          className="form-input form-input-compact"
          placeholder="∞"
          value={maxThreads}
          onChange={(e) => setMaxThreads(e.target.value)}
          disabled={testDataOn}
        />
      </td>
      <td data-label="Priority">
        <input
          type="number"
          className="form-input form-input-compact"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          disabled={testDataOn}
        />
      </td>
      <td data-label="Ports">
        <PortBar
          used={initial.port_utilization?.used ?? 0}
          total={initial.port_utilization?.total ?? 0}
        />
      </td>
      <td data-label="Actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void save()}
          disabled={saving || testDataOn}
        >
          {saving ? '…' : 'Save'}
        </button>
        {message ? (
          <span className="machine-save-msg" style={{ display: 'block', marginTop: 4 }}>
            {message}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

export function MachinesClient() {
  const { useTestData: testDataOn } = useTestData();
  const { data, loading, refresh } = useJsonFetch<{ machines: MachineRow[] }>(
    '/api/machines',
    5000,
    !testDataOn,
  );
  const machines = testDataOn ? TEST_MACHINES : (data?.machines ?? []);

  return (
    <AppShell>
      <div className="main-padded">
        <p className="page-lead" style={{ marginBottom: 16 }}>
          Workers register on connect. Mark a worker as local with{' '}
          <code className="spec-mono">pnpm dev:worker -- --hub &lt;url&gt; --local</code>.
          Auto placement skips <strong>manual only</strong> machines unless you pick them
          explicitly.
        </p>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading && machines.length === 0 && !testDataOn ? (
            <p className="empty-state">Loading machines…</p>
          ) : machines.length === 0 ? (
            <p className="empty-state">
              No workers connected. Start one with{' '}
              <code>pnpm dev:worker -- --hub ws://localhost:3001</code>
            </p>
          ) : (
            <table className="machines-table machines-table-policy">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Address</th>
                  <th>Hardware</th>
                  <th>Threads</th>
                  <th>Mode</th>
                  <th>Pool</th>
                  <th>Max</th>
                  <th>Pri</th>
                  <th>Ports</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => (
                  <MachinePolicyRow
                    key={m.id}
                    machine={m}
                    testDataOn={testDataOn}
                    onSaved={() => void refresh()}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
