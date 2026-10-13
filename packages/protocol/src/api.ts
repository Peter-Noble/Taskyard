import type { AgentEvent, MachineStatus, ThreadState } from './events.js';
import type { MachineSpecs } from './websocket.js';

export type ProjectTaskCounts = {
  backlog: number;
  ready: number;
  in_progress: number;
  review: number;
  merge: number;
  waiting: number;
};

export type Project = {
  id: string;
  name: string;
  repo_url: string | null;
  default_branch: string;
  archived: boolean;
  archived_at: string | null;
  created_at: string;
  sort_order?: number;
  active_threads?: number;
  task_counts?: ProjectTaskCounts;
};

export type ReorderProjectsRequest = {
  ids: string[];
};

export type CreateProjectRequest = {
  name: string;
  repo_url?: string | null;
  default_branch?: string;
};

export type UpdateProjectRequest = {
  name?: string;
  repo_url?: string | null;
  default_branch?: string;
  archived?: boolean;
};

export type SchedulingMode = 'auto' | 'manual_only' | 'disabled';

export type PlacementMode = 'auto' | 'machine' | 'pool' | 'local';

export type ThreadPlacement = {
  mode: PlacementMode;
  machine_id?: string;
  pool?: string;
};

export type Machine = {
  id: string;
  name: string;
  ip_address: string | null;
  port_range_start: number;
  port_range_end: number;
  cpu_cores: number | null;
  ram_gb: number | null;
  gpu_info: string | null;
  status: MachineStatus;
  last_heartbeat: string | null;
  cpu_percent?: number;
  ram_used_gb?: number;
  active_threads?: number;
  scheduling_mode: SchedulingMode;
  pool: string;
  is_local: boolean;
  max_concurrent_threads: number | null;
  allowed_agent_types: string[] | null;
  allowed_project_ids: string[] | null;
  priority: number;
};

export type TaskStatus =
  | 'backlog'
  | 'ready'
  | 'in_progress'
  | 'review'
  | 'merge'
  | 'waiting'
  | 'completed'
  | 'cancelled';

export type TaskType = 'feature' | 'bug' | 'documentation' | 'thought';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type DecisionStatus = 'accepted' | 'rejected';

export type TaskLink = {
  id: string;
  short_id: string;
  title: string;
  status: TaskStatus;
};

export type Task = {
  id: string;
  short_id: string;
  project_id: string;
  parent_id: string | null;
  parent_short_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  task_type: TaskType;
  priority: TaskPriority;
  /** Free-text theme; grouping UX is TA-27. */
  category: string | null;
  assignee: string | null;
  /** True when a dependency is still open. */
  blocked: boolean;
  created_at: string;
  updated_at: string;
};

export type TaskDecision = {
  id: string;
  task_id: string;
  task_short_id: string;
  project_id: string;
  choice: string;
  why: string;
  status: DecisionStatus;
  exported_at: string | null;
  created_at: string;
};

export type TaskActivity =
  | {
      type: 'comment';
      actor: string;
      text: string;
      created_at: string;
    }
  | {
      type: 'status_change';
      actor: string;
      from: TaskStatus;
      to: TaskStatus;
      created_at: string;
    }
  | {
      type: 'change';
      actor: string;
      summary: string;
      detail?: string;
      created_at: string;
    };

export type TaskChildSummary = {
  id: string;
  short_id: string;
  title: string;
  status: TaskStatus;
};

export type TaskDetail = Task & {
  activity: TaskActivity[];
  children: TaskChildSummary[];
  blocked_by: TaskLink[];
  blocks: TaskLink[];
  decisions: TaskDecision[];
};

export type ListTasksQuery = {
  project_id?: string;
  status?: TaskStatus;
  parent_id?: string;
};

export type CreateTaskRequest = {
  title: string;
  project_id: string;
  parent_id?: string | null;
  description?: string;
  status?: TaskStatus;
  task_type?: TaskType;
  priority?: TaskPriority;
  category?: string | null;
};

export type UpdateTaskRequest = {
  title?: string;
  description?: string;
  status?: TaskStatus;
  task_type?: TaskType;
  priority?: TaskPriority;
  category?: string | null;
  assignee?: string | null;
  /** Required when moving a task to `waiting`. Stored as a comment. */
  wait_reason?: string;
  actor?: string;
};

export type ClaimTaskRequest = {
  assignee: string;
  actor?: string;
};

export type AddTaskDependencyRequest = {
  depends_on: string;
};

export type AddTaskDecisionRequest = {
  choice: string;
  why?: string;
  status?: DecisionStatus;
  actor?: string;
};

export type MarkDecisionsExportedRequest = {
  project_id: string;
  ids: string[];
};

export type AddTaskCommentRequest = {
  text: string;
  actor?: string;
};

export type Thread = {
  id: string;
  project_id: string;
  project_name?: string;
  task_id: string | null;
  machine_id: string | null;
  machine_name?: string;
  agent_type: string;
  branch: string;
  prompt: string;
  status: ThreadState;
  worktree_path: string | null;
  container_id: string | null;
  web_port: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  closed_at: string | null;
};

export type ThreadEvent = {
  id: number;
  thread_id: string;
  event_type: string;
  payload: AgentEvent;
  timestamp: string;
};

export type ThreadDetail = Thread & {
  events: ThreadEvent[];
};

export type AgentRuntime = 'process' | 'acp';

export type AgentManifest = {
  name: string;
  description: string;
  version: string;
  entrypoint: string;
  language: 'python' | 'typescript' | 'javascript';
  env_vars: string[];
  /** Default `process` (stub script). ACP agents use `acp`. */
  runtime?: AgentRuntime;
  /** argv for ACP runtime, e.g. `["agent", "acp"]` */
  command?: string[];
  /** ACP authenticate methodId, e.g. `cursor_login` */
  auth_method?: string;
};

export type CreateThreadRequest = {
  project_id: string;
  agent_type: string;
  branch: string;
  /** Required unless `task_id` is set (prompt is seeded from the task). */
  prompt?: string;
  task_id?: string;
  /** @deprecated Use `placement.mode: "machine"` */
  machine_id?: string;
  placement?: ThreadPlacement;
};

export type CreateThreadResponse = {
  thread: Thread;
};

export type ListThreadsQuery = {
  status?: ThreadState;
};

export type UpdateMachineRequest = {
  scheduling_mode?: SchedulingMode;
  pool?: string;
  max_concurrent_threads?: number | null;
  allowed_agent_types?: string[] | null;
  allowed_project_ids?: string[] | null;
  priority?: number;
};

export type MachineRegisterPayload = {
  id: string;
  name: string;
  hostname: string;
  specs: MachineSpecs;
  port_range: { start: number; end: number };
};
