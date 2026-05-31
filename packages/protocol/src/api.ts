import type { AgentEvent, MachineStatus, ThreadState } from './events.js';
import type { MachineSpecs } from './websocket.js';

export type Project = {
  id: string;
  name: string;
  repo_url: string;
  default_branch: string;
  created_at: string;
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
  machine_id?: string;
};

export type CreateThreadResponse = {
  thread: Thread;
};

export type ListThreadsQuery = {
  status?: ThreadState;
};

export type MachineRegisterPayload = {
  id: string;
  name: string;
  hostname: string;
  specs: MachineSpecs;
  port_range: { start: number; end: number };
};
