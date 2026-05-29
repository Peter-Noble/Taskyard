import type { AgentEvent, Thread, ThreadState } from '@taskyard/protocol';

export type StatusBadgeVariant =
  | 'running'
  | 'waiting'
  | 'completed'
  | 'error';

export function threadStatusBadge(status: ThreadState): {
  variant: StatusBadgeVariant;
  label: string;
} {
  switch (status) {
    case 'running':
      return { variant: 'running', label: 'Running' };
    case 'pending':
    case 'spawning':
      return { variant: 'waiting', label: 'Starting' };
    case 'paused':
      return { variant: 'waiting', label: 'Paused' };
    case 'completed':
      return { variant: 'completed', label: 'Done' };
    case 'closed':
      return { variant: 'completed', label: 'Closed' };
    case 'error':
      return { variant: 'error', label: 'Error' };
    default:
      return { variant: 'waiting', label: status };
  }
}

export function formatAgentLabel(agentType: string): string {
  if (!agentType) return '—';
  return agentType.charAt(0).toUpperCase() + agentType.slice(1);
}

export function formatDuration(fromIso: string, toIso?: string | null): string {
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  const ms = Math.max(0, to - from);
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h > 0 ? `${days}d ${h}h` : `${days}d`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function threadTitle(thread: Thread): string {
  return thread.branch || thread.project_name || thread.id.slice(0, 8);
}

export function loadCellCount(percent: number | undefined | null): number {
  if (percent == null || Number.isNaN(percent)) return 0;
  if (percent <= 0) return 0;
  if (percent >= 100) return 4;
  return Math.min(4, Math.max(1, Math.ceil(percent / 25)));
}

export type EventFilter = 'all' | 'thoughts' | 'files' | 'commands';

export function matchesEventFilter(eventType: string, filter: EventFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'thoughts') return eventType === 'thought';
  if (filter === 'files') return eventType === 'file_read' || eventType === 'file_write';
  if (filter === 'commands') return eventType === 'command_run';
  return true;
}

export type TermLine = { className: string; text: string };

export function eventToTermLine(payload: AgentEvent, timestamp: string): TermLine {
  const ts = formatTime(timestamp);
  switch (payload.type) {
    case 'thought':
      return { className: 'term-thought', text: `[${ts}] → ${payload.content}` };
    case 'file_read':
      return { className: 'term-file', text: `[${ts}] read ${payload.path}` };
    case 'file_write':
      return {
        className: 'term-file',
        text: `[${ts}] wrote ${payload.path}${payload.size_bytes != null ? ` (${payload.size_bytes} B)` : ''}`,
      };
    case 'command_run': {
      const out = payload.output ? `\n${payload.output}` : '';
      return {
        className: 'term-cmd',
        text: `[${ts}] $ ${payload.command} (exit ${payload.exit_code})${out}`,
      };
    }
    case 'error':
      return { className: 'term-error', text: `[${ts}] ✗ ${payload.message}` };
    case 'system':
      return {
        className: 'term-dim',
        text: `[${ts}] ${payload.event}${payload.status ? ` · ${String(payload.status)}` : ''}`,
      };
    case 'stdout':
      return { className: 'term-dim', text: `[${ts}] ${payload.content}` };
    default:
      return { className: 'term-dim', text: `[${ts}] ${JSON.stringify(payload)}` };
  }
}

export function isActiveThread(status: ThreadState): boolean {
  return ['pending', 'spawning', 'running', 'paused'].includes(status);
}

export function isHistoryThread(status: ThreadState): boolean {
  return ['completed', 'error', 'closed'].includes(status);
}
