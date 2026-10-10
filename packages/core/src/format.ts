import type {
  AgentEvent,
  Machine,
  Project,
  Task,
  TaskActivity,
  TaskChildSummary,
  TaskStatus,
  Thread,
  ThreadEvent,
} from '@taskyard/protocol';
import type { events, machines, projects, taskActivity, tasks, threads } from '@taskyard/db';

type ProjectRow = typeof projects.$inferSelect;
type MachineRow = typeof machines.$inferSelect;
type ThreadRow = typeof threads.$inferSelect;
type EventRow = typeof events.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;
type TaskActivityRow = typeof taskActivity.$inferSelect;

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export function formatProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    repo_url: row.repoUrl ?? null,
    default_branch: row.defaultBranch ?? 'main',
    archived: row.archived ?? false,
    archived_at: iso(row.archivedAt),
    created_at: iso(row.createdAt) ?? new Date().toISOString(),
    sort_order: row.sortOrder ?? 0,
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
    scheduling_mode: (row.schedulingMode ?? 'auto') as Machine['scheduling_mode'],
    pool: row.pool ?? 'default',
    is_local: row.isLocal ?? false,
    max_concurrent_threads: row.maxConcurrentThreads ?? null,
    allowed_agent_types: parseMachineJsonList(row.allowedAgentTypes),
    allowed_project_ids: parseMachineJsonList(row.allowedProjectIds),
    priority: row.priority ?? 0,
  };
}

function parseMachineJsonList(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return null;
  }
}

export function formatThread(
  row: ThreadRow,
  extras?: { project_name?: string; machine_name?: string },
): Thread {
  return {
    id: row.id,
    project_id: row.projectId ?? '',
    project_name: extras?.project_name,
    task_id: row.taskId ?? null,
    machine_id: row.machineId,
    machine_name: extras?.machine_name,
    agent_type: row.agentType,
    branch: row.branch,
    prompt: row.prompt,
    status: row.status as Thread['status'],
    worktree_path: row.worktreePath,
    container_id: row.containerId,
    web_port: row.webPort,
    created_at: iso(row.createdAt) ?? new Date().toISOString(),
    started_at: iso(row.startedAt),
    completed_at: iso(row.completedAt),
    closed_at: iso(row.closedAt),
  };
}

export function formatTask(
  row: TaskRow,
  extras?: { blocked?: boolean; parent_short_id?: string | null },
): Task {
  return {
    id: row.id,
    short_id: row.shortId,
    project_id: row.projectId,
    parent_id: row.parentId ?? null,
    parent_short_id: extras?.parent_short_id ?? null,
    title: row.title,
    description: row.description ?? '',
    status: row.status as TaskStatus,
    assignee: row.assignee ?? null,
    blocked: extras?.blocked ?? false,
    created_at: iso(row.createdAt) ?? new Date().toISOString(),
    updated_at: iso(row.updatedAt) ?? new Date().toISOString(),
  };
}

export function formatTaskChild(row: TaskRow): TaskChildSummary {
  return {
    id: row.id,
    short_id: row.shortId,
    title: row.title,
    status: row.status as TaskStatus,
  };
}

export function formatTaskActivity(row: TaskActivityRow): TaskActivity {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  const created_at = iso(row.timestamp) ?? new Date().toISOString();

  if (row.kind === 'comment') {
    return {
      type: 'comment',
      actor: row.actor,
      text: typeof payload.text === 'string' ? payload.text : '',
      created_at,
    };
  }

  if (row.kind === 'change') {
    const detail = typeof payload.detail === 'string' ? payload.detail : undefined;
    return {
      type: 'change',
      actor: row.actor,
      summary: typeof payload.summary === 'string' ? payload.summary : '',
      ...(detail ? { detail } : {}),
      created_at,
    };
  }

  return {
    type: 'status_change',
    actor: row.actor,
    from: payload.from as TaskStatus,
    to: payload.to as TaskStatus,
    created_at,
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
