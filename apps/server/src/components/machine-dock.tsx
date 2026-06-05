import type { Machine, Thread } from '@taskyard/protocol';
import {
  formatAgentLabel,
  formatDuration,
  isActiveThread,
  loadCellCount,
  threadTitle,
} from '@/lib/format-ui';
import { StatusBadge } from '@/components/status-badge';

type MachineWithPorts = Machine & {
  port_utilization?: { used: number; total: number };
};

type MachineDockProps = {
  machines: MachineWithPorts[];
  threads: Thread[];
  selectedThreadId: string | null;
  onSelectThread: (id: string) => void;
};

function LoadCells({
  label,
  percent,
  warn,
}: {
  label: string;
  percent: number | undefined;
  warn?: boolean;
}) {
  const on = loadCellCount(percent);
  return (
    <div className="load-group" aria-label={`${label} load`}>
      <span className="load-tag">{label}</span>
      <div className="load-cells">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={[
              'load-cell',
              i < on ? 'on' : '',
              warn && i === on - 1 && on === 4 ? 'warn' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>
    </div>
  );
}

function statusClass(status: string): string {
  if (status === 'error') return 'error';
  if (status === 'completed' || status === 'closed') return 'completed';
  if (status === 'running') return 'running';
  return 'waiting';
}

export function MachineDock({
  machines,
  threads,
  selectedThreadId,
  onSelectThread,
}: MachineDockProps) {
  if (machines.length === 0) {
    return (
      <footer className="capacity-dock" aria-label="Machine capacity">
        <p className="empty-state">
          No workers connected. Start one with{' '}
          <code>pnpm dev:worker -- --hub ws://localhost:3001</code>
        </p>
      </footer>
    );
  }

  return (
    <footer className="capacity-dock" aria-label="Machine capacity">
      {machines.map((machine, idx) => {
        const machineThreads = threads.filter((t) => t.machine_id === machine.id);
        const activeCount = machineThreads.filter((t) => isActiveThread(t.status)).length;
        const cpuPct = machine.cpu_percent;
        const ramPct =
          machine.ram_used_gb != null && machine.ram_gb
            ? (machine.ram_used_gb / machine.ram_gb) * 100
            : undefined;

        const tileClass = [
          'machine-tile',
          machine.is_local ? 'machine-tile-local' : '',
          machine.scheduling_mode === 'disabled' ? 'machine-tile-disabled' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div key={machine.id} className={tileClass} data-machine={machine.name}>
            <div className="machine-tile-top">
              <div className="machine-title-row">
                <span className="entity-num" aria-hidden="true">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <h3 className="machine-name">
                  {machine.name}
                  {machine.is_local ? (
                    <span className="machine-badge machine-badge-local">Local</span>
                  ) : null}
                </h3>
              </div>
              <div className="machine-loads">
                <LoadCells label="CPU" percent={cpuPct} />
                <LoadCells label="RAM" percent={ramPct} warn={ramPct != null && ramPct > 75} />
              </div>
            </div>
            <div className="machine-tile-meta">
              {machine.ip_address ?? '—'} · {activeCount} thread{activeCount === 1 ? '' : 's'}
            </div>
            <div className="machine-threads" aria-label={`Threads on ${machine.name}`}>
              {machineThreads.length === 0 ? (
                <span className="spec-mono" style={{ fontSize: 12 }}>
                  No threads
                </span>
              ) : (
                machineThreads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="machine-thread-btn"
                    data-status={statusClass(t.status)}
                    aria-pressed={selectedThreadId === t.id}
                    onClick={() => onSelectThread(t.id)}
                  >
                    {threadTitle(t)}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </footer>
  );
}

type ThreadListProps = {
  threads: Thread[];
  selectedThreadId: string | null;
  onSelect: (id: string) => void;
  onNewThread: () => void;
};

export function ThreadRailHead({ onNewThread }: { onNewThread: () => void }) {
  return (
    <header className="panel-head thread-rail-head">
      <span className="thread-rail-head-label">Threads</span>
      <button type="button" className="btn btn-primary btn-rail-new" onClick={onNewThread}>
        New Thread
      </button>
    </header>
  );
}

export function ThreadRailAside({
  threads,
  selectedThreadId,
  onSelect,
}: Omit<ThreadListProps, 'onNewThread'>) {
  const active = threads.filter((t) => isActiveThread(t.status));
  const history = threads.filter((t) => !isActiveThread(t.status));

  function renderItem(thread: Thread, num: string) {
    const duration = formatDuration(
      thread.started_at ?? thread.created_at,
      thread.completed_at ?? thread.closed_at,
    );
    return (
      <li key={thread.id}>
        <button
          type="button"
          className="thread-item"
          aria-selected={selectedThreadId === thread.id}
          onClick={() => onSelect(thread.id)}
        >
          <div className="thread-item-row">
            <span className="entity-num" aria-hidden="true">
              {num}
            </span>
            <div className="thread-item-main">
              <div className="thread-item-title-row">
                <h3>{threadTitle(thread)}</h3>
                <StatusBadge status={thread.status} />
              </div>
              <div className="thread-item-meta">
                <span className="agent-tag">{formatAgentLabel(thread.agent_type)}</span>{' '}
                {thread.machine_name ?? '—'} · {duration}
              </div>
            </div>
          </div>
        </button>
      </li>
    );
  }

  return (
    <aside className="thread-rail" aria-label="Threads">
      <div className="thread-list-scroll">
        {active.length === 0 && history.length === 0 ? (
          <p className="empty-state">No threads yet. Create one to get started.</p>
        ) : (
          <>
            <ul className="thread-list">
              {active.map((t, i) => renderItem(t, String(i + 1).padStart(2, '0')))}
            </ul>
            {history.length > 0 ? (
              <>
                <div className="thread-section-break" role="separator">
                  <span>Thread history</span>
                </div>
                <ul className="thread-list thread-list-history">
                  {history.map((t, i) => renderItem(t, String(active.length + i + 1).padStart(2, '0')))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

export function ThreadRail({
  threads,
  selectedThreadId,
  onSelect,
  onNewThread,
}: ThreadListProps) {
  return (
    <>
      <ThreadRailHead onNewThread={onNewThread} />
      <ThreadRailAside threads={threads} selectedThreadId={selectedThreadId} onSelect={onSelect} />
    </>
  );
}
