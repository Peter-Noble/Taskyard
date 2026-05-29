'use client';

import { useEffect, useRef } from 'react';
import type { Thread, ThreadEvent } from '@taskyard/protocol';
import { formatAgentLabel, formatDuration } from '@/lib/format-ui';
import { StatusBadge } from '@/components/status-badge';

import type { TestChatFixture } from '@/lib/test-data/fixtures';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  text: string;
};

function eventToChatMessage(ev: ThreadEvent): ChatMessage | null {
  const p = ev.payload;
  switch (p.type) {
    case 'thought':
      return { role: 'assistant', text: p.content };
    case 'system':
      return { role: 'system', text: `${p.event}${p.status ? ` · ${String(p.status)}` : ''}` };
    case 'file_read':
      return { role: 'system', text: `Read ${p.path}` };
    case 'file_write':
      return {
        role: 'system',
        text: `Wrote ${p.path}${p.size_bytes != null ? ` (${p.size_bytes} B)` : ''}`,
      };
    case 'command_run':
      return { role: 'system', text: `$ ${p.command} (exit ${p.exit_code})` };
    case 'error':
      return { role: 'system', text: `Error · ${p.message}` };
    case 'stdout':
      return { role: 'system', text: p.content };
    default:
      return null;
  }
}

function buildMessages(thread: Thread, events: ThreadEvent[]): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  if (thread.prompt) {
    msgs.push({ role: 'user', text: thread.prompt });
  }
  for (const ev of events) {
    const msg = eventToChatMessage(ev);
    if (msg) msgs.push(msg);
  }
  return msgs;
}

function roleLabel(role: ChatMessage['role']): string {
  if (role === 'user') return 'You';
  if (role === 'assistant') return 'Agent';
  return 'System';
}

type ChatStreamProps = {
  thread: Thread;
  events: ThreadEvent[];
  demoChat?: TestChatFixture | null;
};

export function ChatStream({ thread, events, demoChat }: ChatStreamProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const messages = demoChat
    ? demoChat.messages
    : buildMessages(thread, events);
  const waiting = demoChat ? demoChat.waiting : thread.status === 'paused';
  const waitingPrompt = demoChat?.waitingPrompt
    ?? (thread.status === 'paused'
      ? 'Agent is paused — reply to continue or open the thread detail view.'
      : '');

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, waiting]);

  return (
    <div className="chat-thread" role="log" aria-live="polite" aria-label="Thread conversation">
      <div className="chat-scroll">
        {messages.length === 0 ? (
          <article className="chat-msg chat-msg-system">
            <div className="chat-msg-body">Waiting for agent output…</div>
          </article>
        ) : (
          messages.map((m, i) => (
            <article key={i} className={`chat-msg chat-msg-${m.role}`}>
              <header className="chat-msg-head">{roleLabel(m.role)}</header>
              <div className="chat-msg-body">{m.text}</div>
            </article>
          ))
        )}
      </div>
      {waiting ? (
        <div className="chat-waiting" role="status">
          <p className="chat-waiting-label">Waiting for your input</p>
          <p className="chat-waiting-prompt">{waitingPrompt}</p>
          <div className="chat-compose">
            <input type="text" className="chat-compose-input" placeholder="Reply to agent…" aria-label="Reply to agent" />
            <button type="button" className="btn btn-primary chat-compose-send">
              Send
            </button>
          </div>
        </div>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}

export function StreamHeaderSub({ thread }: { thread: Thread }) {
  return (
    <>
      <StatusBadge status={thread.status} /> {formatAgentLabel(thread.agent_type)} ·{' '}
      {thread.machine_name ?? '—'} · {formatDuration(thread.started_at ?? thread.created_at)}
    </>
  );
}
