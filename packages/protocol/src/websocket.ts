import type { AgentEvent, ThreadState } from './events.js';

export type MachineSpecs = {
  cpu_cores: number;
  ram_gb: number;
  gpu: string | null;
};

export type PortRange = {
  start: number;
  end: number;
};

export type WorkerMessage =
  | {
      type: 'register';
      id: string;
      hostname: string;
      specs: MachineSpecs;
      port_range: PortRange;
    }
  | {
      type: 'heartbeat';
      machine_id: string;
      cpu_percent: number;
      ram_used_gb: number;
    }
  | { type: 'event'; thread_id: string; payload: AgentEvent }
  | { type: 'state_change'; thread_id: string; state: ThreadState }
  | { type: 'pong' };

export type ServerMessage =
  | {
      type: 'spawn_thread';
      thread_id: string;
      project: string;
      repo_url: string;
      branch: string;
      agent_type: string;
      prompt: string;
      ports: { web: number; vnc: number };
      env: Record<string, string>;
    }
  | { type: 'kill_thread'; thread_id: string }
  | { type: 'close_thread'; thread_id: string }
  | { type: 'ping' };
