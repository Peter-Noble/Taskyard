export type ThreadState =
  | 'pending'
  | 'spawning'
  | 'running'
  | 'paused'
  | 'completed'
  | 'error'
  | 'closed';

export type MachineStatus = 'online' | 'offline' | 'busy';

export type AgentEventBase = {
  timestamp?: string;
};

export type AgentEvent =
  | (AgentEventBase & { type: 'system'; event: string; [key: string]: unknown })
  | (AgentEventBase & { type: 'thought'; content: string })
  | (AgentEventBase & { type: 'file_read'; path: string })
  | (AgentEventBase & { type: 'file_write'; path: string; size_bytes?: number })
  | (AgentEventBase & {
      type: 'command_run';
      command: string;
      exit_code: number;
      output?: string;
    })
  | (AgentEventBase & { type: 'error'; message: string })
  | (AgentEventBase & { type: 'stdout'; content: string });
