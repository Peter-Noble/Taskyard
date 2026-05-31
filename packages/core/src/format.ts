import type { AgentEvent, Machine, Project, Thread, ThreadEvent } from '@taskyard/protocol';
import type { events, machines, projects, threads } from '@taskyard/db';

type ProjectRow = typeof projects.$inferSelect;
type MachineRow = typeof machines.$inferSelect;
type ThreadRow = typeof threads.$inferSelect;
type EventRow = typeof events.$inferSelect;

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export function formatProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    repo_url: row.repoUrl,
    default_branch: row.defaultBranch ?? 'main',
    created_at: iso(row.createdAt) ?? new Date().toISOString(),
  };
}

export function formatMachine(row: MachineRow, activeThreads = 0): Machine {
  return {
    id: row.id,
    name: row.name,
    ip_address: row.ipAddress,
    port_range_start: row.portRangeStart,
    port_range_end: row.portRangeEnd,
    cpu_cores: row.cpuCores,
    ram_gb: row.ramGb,
    gpu_info: row.gpuInfo,
    status: (row.status ?? 'offline') as Machine['status'],
    last_heartbeat: iso(row.lastHeartbeat),
    cpu_percent: row.cpuPercent ?? undefined,
    ram_used_gb: row.ramUsedGb ?? undefined,
    active_threads: activeThreads,
  };
}

export function formatThread(
  row: ThreadRow,
  extras?: { project_name?: string; machine_name?: string },
): Thread {
  return {
    id: row.id,
    project_id: row.projectId ?? '',
    project_name: extras?.project_name,
    machine_id: row.machineId,
    machine_name: extras?.machine_name,
    agent_type: row.agentType,
    branch: row.branch,
    prompt: row.prompt,
    status: row.status as Thread['status'],
    worktree_path: row.worktreePath,
    container_id: row.containerId,
    web_port: row.webPort,
    rustdesk_port: row.rustdeskPort,
    created_at: iso(row.createdAt) ?? new Date().toISOString(),
    started_at: iso(row.startedAt),
    completed_at: iso(row.completedAt),
    closed_at: iso(row.closedAt),
  };
}

export function formatEvent(row: EventRow): ThreadEvent {
  let payload: AgentEvent;
  try {
    payload = JSON.parse(row.payload) as AgentEvent;
  } catch {
    payload = { type: 'stdout', content: row.payload };
  }
  return {
    id: row.id,
    thread_id: row.threadId ?? '',
    event_type: row.eventType,
    payload,
    timestamp: iso(row.timestamp) ?? new Date().toISOString(),
  };
}
