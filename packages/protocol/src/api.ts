import type { AgentEvent, MachineStatus, ThreadState } from './events.js';
import type { MachineSpecs } from './websocket.js';

export type Project = {
  id: string;
  name: string;
  repo_url: string | null;
  default_branch: string;
  archived: boolean;
  archived_at: string | null;
  created_at: string;
  active_threads?: number;
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

export type Thread = {
  id: string;
  project_id: string;
  project_name?: string;
  machine_id: string | null;
  machine_name?: string;
  agent_type: string;
  branch: string;
  prompt: string;
  status: ThreadState;
  worktree_path: string | null;
  container_id: string | null;
  web_port: number | null;
  rustdesk_port: number | null;
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

export type AgentManifest = {
  name: string;
  description: string;
  version: string;
  entrypoint: string;
  language: 'python' | 'typescript' | 'javascript';
  env_vars: string[];
};

export type CreateThreadRequest = {
  project_id: string;
  agent_type: string;
  branch: string;
  prompt: string;
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
