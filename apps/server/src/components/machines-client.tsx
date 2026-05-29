'use client';

import { AppShell } from '@/components/app-shell';
import { useTestData } from '@/lib/hooks/use-test-data';
import { useJsonFetch } from '@/lib/hooks/use-json-fetch';
import { TEST_MACHINES } from '@/lib/test-data/fixtures';
import type { Machine } from '@taskyard/protocol';

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

export function MachinesClient() {
  const { useTestData: testDataOn } = useTestData();
  const { data, loading } = useJsonFetch<{ machines: MachineRow[] }>(
    '/api/machines',
    5000,
    !testDataOn,
  );
  const machines = testDataOn ? TEST_MACHINES : (data?.machines ?? []);

  return (
    <AppShell>
      <div className="main-padded">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading && machines.length === 0 && !testDataOn ? (
            <p className="empty-state">Loading machines…</p>
          ) : machines.length === 0 ? (
            <p className="empty-state">
              No workers connected. Start one with{' '}
              <code>pnpm dev:worker -- --hub ws://localhost:3001</code>
            </p>
          ) : (
            <table className="machines-table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Address</th>
                  <th>Hardware</th>
                  <th>Threads</th>
                  <th>
                    Port range ({machines[0]?.port_range_start}–{machines[0]?.port_range_end})
                  </th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => {
                  const used = m.port_utilization?.used ?? 0;
                  const total = m.port_utilization?.total ?? 0;
                  return (
                    <tr key={m.id}>
                      <td data-label="Machine">
                        <strong>{m.name}</strong>
                      </td>
                      <td data-label="Address" className="spec-mono">
                        {m.ip_address ?? '—'}
                      </td>
                      <td data-label="Hardware" className="spec-mono">
                        {formatHardware(m)}
                      </td>
                      <td data-label="Threads">{m.active_threads ?? 0} active</td>
                      <td data-label="Ports">
                        <PortBar used={used} total={total} />
                        <span className="spec-mono" style={{ display: 'block', marginTop: 6 }}>
                          {used} of {total} ports in use
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
