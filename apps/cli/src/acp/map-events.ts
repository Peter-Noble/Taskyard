import type { AgentEvent } from '@taskyard/protocol';

type SessionUpdateParams = {
  sessionId?: string;
  update?: {
    sessionUpdate?: string;
    content?: { type?: string; text?: string };
    toolCall?: { title?: string; kind?: string; rawInput?: unknown };
    toolCallUpdate?: { status?: string; output?: string; exitCode?: number };
    [key: string]: unknown;
  };
};

export function mapSessionUpdate(params: unknown): AgentEvent[] {
  const p = params as SessionUpdateParams;
  const update = p?.update;
  if (!update) return [];

  const events: AgentEvent[] = [];

  if (update.sessionUpdate === 'agent_message_chunk') {
    const text = update.content?.text;
    if (text) events.push({ type: 'thought', content: text });
    return events;
  }

  if (update.sessionUpdate === 'tool_call' || update.toolCall) {
    const title = update.toolCall?.title ?? update.toolCall?.kind ?? 'tool';
    events.push({
      type: 'command_run',
      command: String(title),
      exit_code: -1,
      output: JSON.stringify(update.toolCall?.rawInput ?? update.toolCall ?? update),
    });
    return events;
  }

  if (update.sessionUpdate === 'tool_call_update' || update.toolCallUpdate) {
    const tc = update.toolCallUpdate;
    events.push({
      type: 'command_run',
      command: 'tool',
      exit_code: tc?.exitCode ?? (tc?.status === 'completed' ? 0 : -1),
      output: tc?.output,
    });
    return events;
  }

  if (update.sessionUpdate === 'error') {
    const message =
      typeof update.content === 'object' && update.content && 'text' in update.content
        ? String((update.content as { text?: string }).text)
        : JSON.stringify(update);
    events.push({ type: 'error', message });
    return events;
  }

  events.push({
    type: 'system',
    event: 'acp_update',
    sessionUpdate: update.sessionUpdate,
    payload: update,
  });
  return events;
}

const PERMISSION_OPTION_IDS = new Set(['allow-once', 'allow-always', 'reject-once']);

export function isToolPermissionRequest(params: unknown): boolean {
  const p = params as { options?: Array<{ optionId?: string; id?: string }> };
  const options = p?.options;
  if (!Array.isArray(options) || options.length === 0) return false;
  return options.some((o) => {
    const id = o.optionId ?? o.id;
    return id != null && PERMISSION_OPTION_IDS.has(id);
  });
}

export function autoAllowPermissionResponse(): unknown {
  return { outcome: { outcome: 'selected', optionId: 'allow-once' } };
}
